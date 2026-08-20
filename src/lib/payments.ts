import "server-only";
import { prisma } from "./db";
import { serverEnv } from "./env";
import { eventConfig } from "@/config/event";
import { checkPixQrCode, findBilling, type AbacatePayStatus } from "./abacatepay";
import { checkPayment, createCheckoutLink } from "./infinitepay";
import type { PaymentStatus } from "@/generated/prisma/enums";
import type { RegistrationDetail } from "./registrations";

/**
 * Criação e conferência de cobranças.
 *
 * PRINCÍPIO CENTRAL DESTE ARQUIVO
 * ================================
 * Uma inscrição só vira PAGA através de `reconcilePayment()`, que pergunta o
 * status DIRETAMENTE à API do gateway (InfinitePay). O webhook não tem
 * autoridade para marcar nada como pago — ele apenas avisa "olha de novo
 * nesta cobrança".
 *
 * Consequência prática: mesmo que alguém descubra a URL do webhook e forje um
 * evento de pagamento perfeito, nada acontece, porque o servidor vai conferir
 * com o gateway antes de aceitar.
 */

/** "11999998888" -> "+5511999998888". `undefined` se não der pra formatar com confiança. */
function toE164Brazil(phone: string): string | undefined {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10 || digits.length === 11) return `+55${digits}`;
  if (digits.length >= 12) return `+${digits}`;
  return undefined;
}

export type CreatePaymentResult =
  | { ok: true; paymentId: string }
  | { ok: false; error: string };

/**
 * Gera o link de checkout de uma inscrição na InfinitePay.
 *
 * O valor cobrado é SEMPRE `registration.totalCents`, gravado no banco no
 * momento da inscrição. Nada vindo da requisição influencia o valor. PIX e
 * cartão não são mais escolhidos aqui: o piloto escolhe na própria página da
 * InfinitePay depois de ser redirecionado.
 */
export async function createPaymentForRegistration(
  registration: RegistrationDetail,
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

  // Gerado por nós: é o único identificador que existe desde a criação do
  // link (`slug` e `transactionNsu` só existem depois do pagamento).
  const orderNsu = `ip-${registration.number}-${Date.now()}`;
  const registrationUrl = `${serverEnv.appBaseUrl}/inscricao/${registration.publicId}/pagamento`;

  const webhookSecret = serverEnv.infinitePayWebhookSecret;
  const webhookUrl = webhookSecret
    ? `${serverEnv.appBaseUrl}/api/webhooks/infinitepay?webhookSecret=${encodeURIComponent(webhookSecret)}`
    : `${serverEnv.appBaseUrl}/api/webhooks/infinitepay`;

  const result = await createCheckoutLink({
    orderNsu,
    amountCents,
    description: `Inscrição #${registration.number} — ${eventConfig.name}`,
    redirectUrl: registrationUrl,
    webhookUrl,
    customer: {
      name: registration.pilot.fullName,
      email: registration.pilot.email,
      phoneNumber: toE164Brazil(registration.pilot.phone),
    },
  });

  if (!result.ok) return { ok: false, error: result.error };

  const payment = await prisma.payment.create({
    data: {
      registrationNumber: registration.number,
      gateway: "infinitepay",
      kind: "INFINITEPAY",
      gatewayPaymentId: orderNsu,
      amountCents,
      status: "PENDING",
      checkoutUrl: result.data.url,
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
 * Confere uma cobrança contra a API do gateway e, se estiver paga, promove a
 * inscrição a PAGA.
 *
 * É a ÚNICA função do sistema que escreve `status: "PAID"`.
 *
 * Proteções aplicadas aqui:
 *  - idempotência: uma cobrança já PAID retorna sem reescrever nada;
 *  - conferência de valor: se o gateway informar um valor diferente do que foi
 *    cobrado, o pagamento NÃO é aceito;
 *  - a inscrição só muda de status junto com o pagamento, na mesma transação.
 *
 * `returnData` é preenchido quando o piloto acabou de voltar do checkout da
 * InfinitePay (query string) ou quando o webhook chegou — é onde `slug` e
 * `transactionNsu` aparecem pela primeira vez, porque a InfinitePay não os
 * devolve na criação do link.
 */
export async function reconcilePayment(
  paymentId: string,
  returnData?: { slug: string; transactionNsu: string },
): Promise<ReconcileResult> {
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

  if (payment.kind === "INFINITEPAY") {
    return reconcileInfinitePayPayment(payment, returnData);
  }

  // ------------------------------------------------------------- LEGADO
  // PIX_QRCODE / BILLING vinham da AbacatePay. Nenhuma cobrança nova nasce
  // mais assim, mas uma pendência antiga (se existir) continua conferível.
  let gatewayStatus: AbacatePayStatus;
  let gatewayAmount: number | null = null;
  let paidMethod: string | null = null;

  if (payment.kind === "PIX_QRCODE") {
    const result = await checkPixQrCode(payment.gatewayPaymentId);
    if (!result.ok) {
      return { status: payment.status, justPaid: false, error: result.error };
    }
    gatewayStatus = result.data.status;
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
      await prisma.payment.update({ where: { id: payment.id }, data: { status: nextStatus } });
    }
    return { status: nextStatus, justPaid: false };
  }

  if (gatewayAmount !== null && gatewayAmount !== payment.amountCents) {
    console.error(
      `[pagamento] Divergência de valor na cobrança ${payment.gatewayPaymentId}: ` +
        `esperado ${payment.amountCents}, gateway informou ${gatewayAmount}. Pagamento NÃO confirmado.`,
    );
    return { status: payment.status, justPaid: false, error: "Valor divergente entre a cobrança e o gateway." };
  }

  return finalizePaidPayment(payment, paidMethod);
}

/** Traduz o status do gateway (legado AbacatePay) para o enum do banco. */
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

// Nunca chamada em runtime — existe só para derivar o tipo abaixo sem repetir
// o shape do include à mão.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function loadPaymentWithRegistration(id: string) {
  return prisma.payment.findUniqueOrThrow({ where: { id }, include: { registration: true } });
}

type PaymentWithRegistration = Awaited<ReturnType<typeof loadPaymentWithRegistration>>;

async function reconcileInfinitePayPayment(
  payment: PaymentWithRegistration,
  returnData?: { slug: string; transactionNsu: string },
): Promise<ReconcileResult> {
  const slug = returnData?.slug ?? payment.gatewaySlug;
  const transactionNsu = returnData?.transactionNsu ?? payment.gatewayTransactionNsu;

  if (slug && transactionNsu && (slug !== payment.gatewaySlug || transactionNsu !== payment.gatewayTransactionNsu)) {
    payment = await prisma.payment.update({
      where: { id: payment.id },
      data: { gatewaySlug: slug, gatewayTransactionNsu: transactionNsu },
      include: { registration: true },
    });
  }

  // Sem `slug`/`transactionNsu` ainda não dá pra perguntar nada à InfinitePay:
  // o piloto não voltou do checkout e o webhook ainda não chegou. Não é erro,
  // só "ainda não sabemos".
  if (!slug || !transactionNsu) {
    return { status: payment.status, justPaid: false };
  }

  const result = await checkPayment({ orderNsu: payment.gatewayPaymentId, transactionNsu, slug });
  if (!result.ok) {
    return { status: payment.status, justPaid: false, error: result.error };
  }

  if (!result.data.paid) {
    return { status: payment.status, justPaid: false };
  }

  // O gateway diz PAGO. Antes de aceitar, o valor pago precisa cobrir o
  // cobrado (pode vir maior por juros de parcelamento repassados no cartão).
  if (result.data.paidAmount < payment.amountCents) {
    console.error(
      `[pagamento] Valor pago (${result.data.paidAmount}) menor que o cobrado ` +
        `(${payment.amountCents}) na cobrança ${payment.gatewayPaymentId}. Pagamento NÃO confirmado.`,
    );
    return { status: payment.status, justPaid: false, error: "Valor pago menor que o devido." };
  }

  if (payment.amountCents !== payment.registration.totalCents) {
    console.error(
      `[pagamento] Cobrança ${payment.gatewayPaymentId} tem valor ${payment.amountCents}, ` +
        `mas a inscrição #${payment.registrationNumber} totaliza ${payment.registration.totalCents}. Pagamento NÃO confirmado.`,
    );
    return { status: payment.status, justPaid: false, error: "Valor da cobrança não corresponde ao total da inscrição." };
  }

  const paidMethod =
    result.data.captureMethod === "pix" ? "PIX" : result.data.captureMethod === "credit_card" ? "CARD" : null;

  return finalizePaidPayment(payment, paidMethod);
}

/**
 * Escreve PAID no pagamento e na inscrição, na mesma transação. Condicionado
 * a `status: { not: "PAID" }`: se duas conferências simultâneas chegarem aqui
 * (webhook + polling da página), apenas uma atualiza a linha.
 */
async function finalizePaidPayment(
  payment: PaymentWithRegistration,
  paidMethod: string | null,
): Promise<ReconcileResult> {
  const paidAt = new Date();

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

export type ConfirmManualPaymentResult =
  | { ok: true }
  | { ok: false; error: string };

/**
 * Confirma o pagamento de uma inscrição por fora do gateway — usado enquanto a
 * conta na AbacatePay não está aprovada para produção e o organizador recebe
 * o PIX na própria chave, fora do sistema.
 *
 * Diferente de `reconcilePayment`, aqui não há nada para conferir contra um
 * gateway: a confirmação é a palavra do organizador, por isso a nota é
 * obrigatória — é o único registro de auditoria que existe para essa entrada.
 */
export async function confirmManualPayment(
  registrationNumber: number,
  note: string,
): Promise<ConfirmManualPaymentResult> {
  const registration = await prisma.registration.findUnique({
    where: { number: registrationNumber },
  });

  if (!registration) {
    return { ok: false, error: "Inscrição não encontrada." };
  }
  if (registration.status === "PAID") {
    return { ok: false, error: "Esta inscrição já está paga." };
  }
  if (registration.status === "CANCELLED") {
    return { ok: false, error: "Esta inscrição foi cancelada." };
  }

  const paidAt = new Date();

  await prisma.$transaction(async (tx) => {
    await tx.payment.create({
      data: {
        registrationNumber: registration.number,
        gateway: "manual",
        kind: "MANUAL",
        // Não existe id de gateway aqui; geramos um só para satisfazer o
        // índice único e manter o registro rastreável.
        gatewayPaymentId: `manual-${registration.number}-${paidAt.getTime()}`,
        amountCents: registration.totalCents,
        status: "PAID",
        paidAt,
        notes: note,
      },
    });

    await tx.registration.update({
      where: { number: registration.number },
      data: { status: "PAID", paidAt },
    });
  });

  return { ok: true };
}
