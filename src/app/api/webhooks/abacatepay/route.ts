import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { serverEnv } from "@/lib/env";
import { reconcilePayment } from "@/lib/payments";

/**
 * WEBHOOK DA ABACATEPAY
 * =====================
 * POST /api/webhooks/abacatepay?webhookSecret=<segredo>
 *
 * Cadastre esta URL no painel da AbacatePay. O segredo que você definir lá vem
 * de volta na query string e precisa bater com ABACATEPAY_WEBHOOK_SECRET.
 *
 *
 * O QUE ESTE ENDPOINT *NÃO* FAZ
 * -----------------------------
 * Ele NÃO marca nada como pago com base no que o evento diz. O corpo do
 * webhook é tratado como uma dica não confiável — no máximo, ele informa QUAL
 * cobrança olhar. Quem decide se a inscrição está paga é `reconcilePayment()`,
 * que pergunta o status diretamente à API da AbacatePay usando a chave secreta.
 *
 * Consequência: mesmo que alguém descubra a URL e o segredo e forje um evento
 * `billing.paid` impecável, nenhuma inscrição vira PAGA — a conferência com o
 * gateway devolveria PENDING.
 *
 *
 * CAMADAS DE VALIDAÇÃO
 * --------------------
 * 1. Segredo na query string (obrigatório, comparação em tempo constante).
 * 2. Assinatura HMAC-SHA256 do corpo bruto — OPCIONAL, desligada por padrão.
 *    Veja o bloco "Assinatura HMAC" no README: o header e o segredo exatos
 *    precisam ser confirmados no painel da sua conta antes de ligar.
 * 3. Idempotência: o `id` do evento é gravado em `WebhookEvent` com índice
 *    único. Reentrega vira no-op.
 * 4. Conferência com a API do gateway antes de qualquer mudança de status.
 *
 *
 * FORMATO DO EVENTO (confirmado em @abacatepay/types)
 * ---------------------------------------------------
 * {
 *   id: string,            // identificador do evento
 *   event: "billing.paid", // tipo
 *   devMode: boolean,
 *   data: {
 *     payment: { amount, fee, method },
 *     // um dos dois, conforme a origem da cobrança:
 *     pixQrCode?: { id, amount, kind: "PIX", status: "PAID" },
 *     billing?:   { id, amount, status: "PAID", ... }
 *   }
 * }
 */

/** Sempre respondemos 200 depois de registrar o evento, para o gateway não reenviar em loop. */
const ACK = { received: true };

type WebhookBody = {
  id?: unknown;
  event?: unknown;
  devMode?: unknown;
  data?: {
    pixQrCode?: { id?: unknown };
    billing?: { id?: unknown };
  };
};

function safeEquals(a: string, b: string): boolean {
  const bufferA = Buffer.from(a, "utf8");
  const bufferB = Buffer.from(b, "utf8");
  if (bufferA.length !== bufferB.length) {
    timingSafeEqual(bufferA, bufferA);
    return false;
  }
  return timingSafeEqual(bufferA, bufferB);
}

export async function POST(request: Request) {
  // ---------------------------------------------------------- 1. segredo
  const expectedSecret = serverEnv.abacatePayWebhookSecret;
  if (!expectedSecret) {
    console.error("[webhook] ABACATEPAY_WEBHOOK_SECRET não configurado. Evento recusado.");
    return NextResponse.json({ error: "Webhook não configurado." }, { status: 503 });
  }

  const providedSecret = new URL(request.url).searchParams.get("webhookSecret") ?? "";
  if (!safeEquals(providedSecret, expectedSecret)) {
    console.warn("[webhook] Segredo inválido na query string. Evento recusado.");
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  // O corpo é lido como texto porque a assinatura HMAC, quando ativada, é
  // calculada sobre os bytes exatos recebidos — não sobre o JSON reserializado.
  const rawBody = await request.text();

  // ------------------------------------------------------- 2. assinatura
  const signingSecret = serverEnv.abacatePayWebhookSigningSecret;
  if (signingSecret) {
    const headerName = serverEnv.abacatePayWebhookSignatureHeader;
    const receivedSignature = request.headers.get(headerName);

    if (!receivedSignature) {
      console.warn(`[webhook] Header de assinatura "${headerName}" ausente. Evento recusado.`);
      return NextResponse.json({ error: "Assinatura ausente." }, { status: 401 });
    }

    const expectedSignature = createHmac("sha256", signingSecret)
      .update(rawBody, "utf8")
      .digest("base64");

    // Aceita base64 e hex: a codificação exata depende da configuração da
    // conta, e as duas são verificadas em tempo constante.
    const expectedHex = createHmac("sha256", signingSecret).update(rawBody, "utf8").digest("hex");

    if (
      !safeEquals(receivedSignature, expectedSignature) &&
      !safeEquals(receivedSignature.toLowerCase(), expectedHex)
    ) {
      console.warn("[webhook] Assinatura HMAC não confere. Evento recusado.");
      return NextResponse.json({ error: "Assinatura inválida." }, { status: 401 });
    }
  }

  // ------------------------------------------------------------ 3. corpo
  let body: WebhookBody;
  try {
    body = JSON.parse(rawBody) as WebhookBody;
  } catch {
    console.warn("[webhook] Corpo não é JSON válido.");
    return NextResponse.json({ error: "Corpo inválido." }, { status: 400 });
  }

  const eventId = typeof body.id === "string" ? body.id : null;
  const eventType = typeof body.event === "string" ? body.event : "desconhecido";
  const devMode = body.devMode === true;

  if (!eventId) {
    console.warn(`[webhook] Evento "${eventType}" sem id. Ignorado.`);
    return NextResponse.json(ACK);
  }

  // ----------------------------------------------------- 4. idempotência
  // O índice único em `externalId` é o que garante a idempotência de verdade:
  // se o mesmo evento chegar duas vezes (inclusive em paralelo), apenas a
  // primeira inserção passa.
  try {
    await prisma.webhookEvent.create({
      data: { externalId: eventId, event: eventType, devMode, outcome: "RECEBIDO" },
    });
  } catch {
    console.info(`[webhook] Evento ${eventId} já processado anteriormente. Ignorado.`);
    return NextResponse.json(ACK);
  }

  // Só `billing.paid` altera estado. Os demais ficam registrados no log.
  if (eventType !== "billing.paid") {
    await recordOutcome(eventId, "IGNORADO_TIPO_NAO_TRATADO");
    return NextResponse.json(ACK);
  }

  // O evento traz `pixQrCode` ou `billing`, conforme a origem da cobrança.
  const charge = body.data?.pixQrCode ?? body.data?.billing;
  const chargeId = typeof charge?.id === "string" ? charge.id : null;

  if (!chargeId) {
    console.warn(`[webhook] Evento ${eventId} sem id de cobrança.`);
    await recordOutcome(eventId, "SEM_ID_DE_COBRANCA");
    return NextResponse.json(ACK);
  }

  const payment = await prisma.payment.findUnique({ where: { gatewayPaymentId: chargeId } });
  if (!payment) {
    // Cobrança que não pertence a este site (ou de outro ambiente).
    console.warn(`[webhook] Cobrança ${chargeId} não corresponde a nenhum pagamento local.`);
    await recordOutcome(eventId, "COBRANCA_DESCONHECIDA");
    return NextResponse.json(ACK);
  }

  // ------------------------------------- 5. conferência com o gateway
  // O valor informado no evento é deliberadamente ignorado: `reconcilePayment`
  // vai perguntar o status e o valor à própria AbacatePay.
  const result = await reconcilePayment(payment.id);

  if (result.error) {
    console.error(
      `[webhook] Falha ao conferir a cobrança ${chargeId} com o gateway: ${result.error}`,
    );
    await recordOutcome(eventId, "FALHA_NA_CONFERENCIA");
    // 500 faz a AbacatePay reenviar o evento mais tarde. Como o registro de
    // idempotência já foi gravado, removemos para permitir o reprocessamento.
    await prisma.webhookEvent.deleteMany({ where: { externalId: eventId } });
    return NextResponse.json({ error: "Falha temporária. Reenvie o evento." }, { status: 500 });
  }

  const outcome = result.justPaid
    ? "INSCRICAO_CONFIRMADA"
    : result.status === "PAID"
      ? "JA_ESTAVA_PAGA"
      : `NAO_PAGO_NO_GATEWAY:${result.status}`;

  console.info(
    `[webhook] Evento ${eventId} (${eventType}) processado para a inscrição ` +
      `#${payment.registrationNumber}: ${outcome}`,
  );

  await recordOutcome(eventId, outcome);
  return NextResponse.json(ACK);
}

async function recordOutcome(externalId: string, outcome: string): Promise<void> {
  await prisma.webhookEvent.updateMany({ where: { externalId }, data: { outcome } });
}

/**
 * A AbacatePay envia um GET ao cadastrar o webhook em algumas configurações;
 * responder aqui evita que o cadastro pareça quebrado. Nenhum dado é exposto.
 */
export function GET() {
  return NextResponse.json({ status: "ok" });
}
