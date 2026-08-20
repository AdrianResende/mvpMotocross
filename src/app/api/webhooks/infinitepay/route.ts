import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { serverEnv } from "@/lib/env";
import { reconcilePayment } from "@/lib/payments";

/**
 * WEBHOOK DA INFINITEPAY
 * ======================
 * POST /api/webhooks/infinitepay?webhookSecret=<segredo>
 *
 * A InfinitePay não assina os webhooks nem manda de volta um secret próprio —
 * o segredo na query string é NOSSO: nós mesmos o embutimos na `webhook_url`
 * enviada ao criar o link de checkout (ver `createPaymentForRegistration` em
 * `payments.ts`), só pra evitar que qualquer um bata neste endpoint à toa.
 *
 *
 * O QUE ESTE ENDPOINT *NÃO* FAZ
 * -----------------------------
 * Ele NÃO marca nada como pago com base no que o evento diz. A InfinitePay
 * nem manda um campo de status "pago" no webhook — manda `amount` e
 * `paid_amount`. O corpo inteiro é tratado como uma dica não confiável: no
 * máximo, informa QUAL cobrança olhar (`order_nsu`) e os dois dados que
 * faltam pra perguntar de verdade (`transaction_nsu`, `invoice_slug`). Quem
 * decide se a inscrição está paga é `reconcilePayment()`, que pergunta o
 * status diretamente à API da InfinitePay via `payment_check`.
 *
 *
 * FORMATO DO EVENTO (conferido contra duas integrações reais em produção —
 * ver comentário em `src/lib/infinitepay.ts`)
 * -------------------------------------------
 * {
 *   order_nsu: string,
 *   transaction_nsu: string,
 *   invoice_slug: string,
 *   amount: number,
 *   paid_amount: number,
 *   capture_method?: "pix" | "credit_card",
 *   installments?: number,
 *   receipt_url?: string
 * }
 */

const ACK = { received: true };

type WebhookBody = {
  order_nsu?: unknown;
  transaction_nsu?: unknown;
  invoice_slug?: unknown;
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
  const expectedSecret = serverEnv.infinitePayWebhookSecret;
  if (!expectedSecret) {
    console.error("[webhook] INFINITEPAY_WEBHOOK_SECRET não configurado. Evento recusado.");
    return NextResponse.json({ error: "Webhook não configurado." }, { status: 503 });
  }

  const providedSecret = new URL(request.url).searchParams.get("webhookSecret") ?? "";
  if (!safeEquals(providedSecret, expectedSecret)) {
    console.warn("[webhook] Segredo inválido na query string. Evento recusado.");
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  let body: WebhookBody;
  try {
    body = (await request.json()) as WebhookBody;
  } catch {
    console.warn("[webhook] Corpo não é JSON válido.");
    return NextResponse.json({ error: "Corpo inválido." }, { status: 400 });
  }

  const orderNsu = typeof body.order_nsu === "string" ? body.order_nsu : null;
  const transactionNsu = typeof body.transaction_nsu === "string" ? body.transaction_nsu : null;
  const slug = typeof body.invoice_slug === "string" ? body.invoice_slug : null;

  if (!orderNsu) {
    console.warn("[webhook] Evento sem order_nsu. Ignorado.");
    return NextResponse.json(ACK);
  }

  // Idempotência: a InfinitePay não manda um id de evento, então usamos o
  // transaction_nsu (uma tentativa de pagamento real). Reentrega vira no-op.
  const externalId = transactionNsu ?? `sem-transaction-nsu:${orderNsu}:${Date.now()}`;
  try {
    await prisma.webhookEvent.create({
      data: { externalId, event: "payment.notification", gateway: "infinitepay", outcome: "RECEBIDO" },
    });
  } catch {
    console.info(`[webhook] Evento ${externalId} já processado anteriormente. Ignorado.`);
    return NextResponse.json(ACK);
  }

  const payment = await prisma.payment.findUnique({ where: { gatewayPaymentId: orderNsu } });
  if (!payment) {
    console.warn(`[webhook] order_nsu ${orderNsu} não corresponde a nenhum pagamento local.`);
    await recordOutcome(externalId, "COBRANCA_DESCONHECIDA");
    return NextResponse.json(ACK);
  }

  if (!transactionNsu || !slug) {
    console.warn(`[webhook] Evento para ${orderNsu} sem transaction_nsu/invoice_slug.`);
    await recordOutcome(externalId, "DADOS_INCOMPLETOS");
    return NextResponse.json(ACK);
  }

  // O valor informado no evento é deliberadamente ignorado aqui:
  // `reconcilePayment` vai perguntar `paid` e `paid_amount` à própria
  // InfinitePay antes de aceitar qualquer coisa.
  const result = await reconcilePayment(payment.id, { slug, transactionNsu });

  if (result.error) {
    console.error(`[webhook] Falha ao conferir ${orderNsu} com o gateway: ${result.error}`);
    await recordOutcome(externalId, "FALHA_NA_CONFERENCIA");
    // 500 faz a InfinitePay reenviar o evento mais tarde. Como o registro de
    // idempotência já foi gravado, removemos para permitir o reprocessamento.
    await prisma.webhookEvent.deleteMany({ where: { externalId } });
    return NextResponse.json({ error: "Falha temporária. Reenvie o evento." }, { status: 500 });
  }

  const outcome = result.justPaid
    ? "INSCRICAO_CONFIRMADA"
    : result.status === "PAID"
      ? "JA_ESTAVA_PAGA"
      : `NAO_PAGO_NO_GATEWAY:${result.status}`;

  console.info(`[webhook] Evento ${externalId} processado para a inscrição #${payment.registrationNumber}: ${outcome}`);

  await recordOutcome(externalId, outcome);
  return NextResponse.json(ACK);
}

async function recordOutcome(externalId: string, outcome: string): Promise<void> {
  await prisma.webhookEvent.updateMany({ where: { externalId }, data: { outcome } });
}

export function GET() {
  return NextResponse.json({ status: "ok" });
}
