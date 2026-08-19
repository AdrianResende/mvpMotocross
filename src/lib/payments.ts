import "server-only";
import { prisma } from "./db";
import { serverEnv } from "./env";
import { eventConfig } from "@/config/event";
import {
  checkPixQrCode,
  createBilling,
  createPixQrCode,
  findBilling,
  type AbacatePayCustomer,
  type AbacatePayStatus,
} from "./abacatepay";
import type { PaymentStatus } from "@/generated/prisma/enums";
import type { RegistrationDetail } from "./registrations";

/**
 * Criação e conferência de cobranças.
 *
 * PRINCÍPIO CENTRAL DESTE ARQUIVO
 * ================================
 * Uma inscrição só vira PAGA através de `reconcilePayment()`, que pergunta o
 * status DIRETAMENTE à API da AbacatePay. O webhook não tem autoridade para
 * marcar nada como pago — ele apenas avisa "olha de novo nesta cobrança".
 *
 * Consequência prática: mesmo que alguém descubra a URL do webhook e forje um
 * evento `billing.paid` perfeito, nada acontece, porque o servidor vai
 * conferir com o gateway e receber `PENDING`.
 */

/** Validade do QR Code PIX. 1 hora é tempo de sobra para um pagamento PIX. */
const PIX_EXPIRATION_SECONDS = 60 * 60;

/** Traduz o status do gateway para o enum do banco. */
function toPaymentStatus(status: AbacatePayStatus): PaymentStatus {
  switch (status) {
    case "PAID":
      return "PAID";
    case "PENDING":
      return "PENDING";
    case "EXPIRED":
      return "EXPIRED";
    case "CANCELLED":
      return "CANCELLED";
    case "REFUNDED":
      return "REFUNDED";
  }
}

function customerFrom(registration: RegistrationDetail): AbacatePayCustomer {
  return {
    name: registration.pilot.fullName,
    email: registration.pilot.email,
    taxId: registration.pilot.cpf,
    cellphone: registration.pilot.phone,
  };
}

export type CreatePaymentResult =
  | { ok: true; paymentId: string }
  | { ok: false; error: string };

/**
 * Gera a cobrança de uma inscrição.
 *
 * O valor cobrado é SEMPRE `registration.totalCents`, gravado no banco no
 * momento da inscrição. Nada vindo da requisição influencia o valor.
 */
export async function createPaymentForRegistration(
  registration: RegistrationDetail,
  method: "PIX" | "CARD",
): Promise<CreatePaymentResult> {
  if (registration.status === "PAID") {
    return { ok: false, error: "Esta inscrição já está paga." };
  }
  if (registration.status === "CANCELLED") {
    return { ok: false, error: "Esta inscrição foi cancelada." };
  }

  const amountCents = registration.totalCents;
  if (amountCents < 100) {
    return { ok: false, error: "Valor abaixo do mínimo aceito pelo gateway (R$ 1,00)." };
  }

  const description = `Inscrição #${registration.number} — ${eventConfig.name}`;
  const customer = customerFrom(registration);
  const metadata = {
    // `externalId` é o campo que a AbacatePay reserva para o nosso
    // identificador. Guardamos o publicId para conseguir cruzar os dados.
    externalId: registration.publicId,
    registrationNumber: String(registration.number),
  };

  if (method === "PIX") {
    const result = await createPixQrCode({
      amountCents,
      description,
      customer,
      expiresInSeconds: PIX_EXPIRATION_SECONDS,
      metadata,
    });

    if (!result.ok) return { ok: false, error: result.error };

    // Coerência de valor: se o gateway devolveu um valor diferente do que
    // pedimos, algo está errado e não gravamos a cobrança.
    if (result.data.amount !== amountCents) {
      return {
        ok: false,
        error: "O gateway devolveu um valor diferente do solicitado. Cobrança não registrada.",
      };
    }

    const payment = await prisma.payment.create({
      data: {
        registrationNumber: registration.number,
        kind: "PIX_QRCODE",
        gatewayPaymentId: result.data.id,
        amountCents: result.data.amount,
        status: toPaymentStatus(result.data.status),
        brCode: result.data.brCode,
        brCodeBase64: result.data.brCodeBase64,
        expiresAt: new Date(result.data.expiresAt),
        devMode: result.data.devMode,
      },
    });

    return { ok: true, paymentId: payment.id };
  }

  // CARD: usamos o checkout hospedado oficial da AbacatePay. Nenhum dado de
  // cartão passa por este servidor — o piloto é redirecionado para a página
  // do gateway. PIX vai junto na lista de métodos para o piloto poder trocar
  // de ideia dentro do próprio checkout.
  const registrationUrl = `${serverEnv.appBaseUrl}/inscricao/${registration.publicId}`;
  const result = await createBilling({
    methods: ["PIX", "CARD"],
    products: registration.categories.map((item) => ({
      externalId: `categoria-${item.category.slug}`,
      name: `${item.category.name} — ${eventConfig.name}`,
      quantity: 1,
      // Preço unitário em centavos, o mesmo congelado na inscrição.
      price: item.priceCents,
      description: item.category.description.slice(0, 200),
    })),
    returnUrl: registrationUrl,
    completionUrl: registrationUrl,
    customer,
    externalId: registration.publicId,
    metadata,
  });

  if (!result.ok) return { ok: false, error: result.error };

  const billedTotal = result.data.products.reduce(
    (sum, product) => sum + product.price * product.quantity,
    0,
  );
  if (billedTotal !== amountCents) {
    return {
      ok: false,
      error: "O gateway devolveu um valor diferente do solicitado. Cobrança não registrada.",
    };
  }

  const payment = await prisma.payment.create({
    data: {
      registrationNumber: registration.number,
      kind: "BILLING",
      gatewayPaymentId: result.data.id,
      amountCents: billedTotal,
      status: toPaymentStatus(result.data.status),
      checkoutUrl: result.data.url,
      devMode: result.data.devMode,
    },
  });

  return { ok: true, paymentId: payment.id };
}

export type ReconcileResult = {
  /** Status conhecido depois da conferência. */
  status: PaymentStatus;
  /** `true` quando esta conferência foi a que confirmou o pagamento. */
  justPaid: boolean;
  /** Preenchido quando não foi possível falar com o gateway. */
  error?: string;
};

/**
 * Confere uma cobrança contra a API da AbacatePay e, se estiver paga,
 * promove a inscrição a PAGA.
 *
 * É a ÚNICA função do sistema que escreve `status: "PAID"`.
 *
 * Proteções aplicadas aqui:
 *  - idempotência: uma cobrança já PAID retorna sem reescrever nada;
 *  - conferência de valor: se o gateway informar um valor diferente do que foi
 *    cobrado, o pagamento NÃO é aceito;
 *  - a inscrição só muda de status junto com o pagamento, na mesma transação.
 */
export async function reconcilePayment(paymentId: string): Promise<ReconcileResult> {
  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    include: { registration: true },
  });

  if (!payment) {
    return { status: "FAILED", justPaid: false, error: "Pagamento não encontrado." };
  }

  // Já confirmado: nada a fazer. Reentrega de webhook cai aqui.
  if (payment.status === "PAID") {
    return { status: "PAID", justPaid: false };
  }

  let gatewayStatus: AbacatePayStatus;
  let gatewayAmount: number | null = null;
  let paidMethod: string | null = null;

  if (payment.kind === "PIX_QRCODE") {
    const result = await checkPixQrCode(payment.gatewayPaymentId);
    if (!result.ok) {
      return { status: payment.status, justPaid: false, error: result.error };
    }
    gatewayStatus = result.data.status;
    // `pixQrCode/check` devolve apenas status e expiresAt. O valor não muda
    // depois da criação, então o valor congelado no banco continua válido.
    paidMethod = "PIX";
  } else {
    const result = await findBilling(payment.gatewayPaymentId);
    if (!result.ok) {
      return { status: payment.status, justPaid: false, error: result.error };
    }
    gatewayStatus = result.data.status;
    gatewayAmount = result.data.products.reduce(
      (sum, product) => sum + product.price * product.quantity,
      0,
    );
    paidMethod = result.data.methods.includes("CARD") ? null : "PIX";
  }

  const nextStatus = toPaymentStatus(gatewayStatus);

  if (nextStatus !== "PAID") {
    if (nextStatus !== payment.status) {
      await prisma.payment.update({
        where: { id: payment.id },
        data: { status: nextStatus },
      });
    }
    return { status: nextStatus, justPaid: false };
  }

  // O gateway diz PAGO. Antes de aceitar, o valor precisa bater.
  if (gatewayAmount !== null && gatewayAmount !== payment.amountCents) {
    console.error(
      `[pagamento] Divergência de valor na cobrança ${payment.gatewayPaymentId}: ` +
        `esperado ${payment.amountCents}, gateway informou ${gatewayAmount}. Pagamento NÃO confirmado.`,
    );
    return {
      status: payment.status,
      justPaid: false,
      error: "Valor divergente entre a cobrança e o gateway.",
    };
  }

  if (payment.amountCents !== payment.registration.totalCents) {
    console.error(
      `[pagamento] Cobrança ${payment.gatewayPaymentId} tem valor ${payment.amountCents}, ` +
        `mas a inscrição #${payment.registrationNumber} totaliza ${payment.registration.totalCents}. Pagamento NÃO confirmado.`,
    );
    return {
      status: payment.status,
      justPaid: false,
      error: "Valor da cobrança não corresponde ao total da inscrição.",
    };
  }

  const paidAt = new Date();

  // A escrita é condicionada a `status: "PENDING"`: se duas conferências
  // simultâneas chegarem aqui (webhook + polling da página), apenas uma
  // atualiza a linha, e a outra vê `count: 0`.
  const updated = await prisma.$transaction(async (tx) => {
    const result = await tx.payment.updateMany({
      where: { id: payment.id, status: { not: "PAID" } },
      data: { status: "PAID", paidAt, paymentMethod: paidMethod },
    });

    if (result.count === 0) return false;

    await tx.registration.update({
      where: { number: payment.registrationNumber },
      data: { status: "PAID", paidAt },
    });

    return true;
  });

  return { status: "PAID", justPaid: updated };
}
