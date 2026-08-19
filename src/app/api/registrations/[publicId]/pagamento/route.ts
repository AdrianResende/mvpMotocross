import { NextResponse } from "next/server";
import { createPaymentSchema } from "@/lib/validation";
import { findActivePayment, getRegistrationByPublicId } from "@/lib/registrations";
import { createPaymentForRegistration } from "@/lib/payments";
import { isPaymentGatewayConfigured } from "@/lib/env";
import { GatewayNotConfiguredError } from "@/lib/abacatepay";

/**
 * POST /api/registrations/[publicId]/pagamento — gera a cobrança.
 *
 * O valor NUNCA vem do corpo da requisição: o único parâmetro aceito é o método
 * ("PIX" ou "CARD"). O valor sai de `registration.totalCents`, gravado quando a
 * inscrição foi criada.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ publicId: string }> },
) {
  if (!isPaymentGatewayConfigured()) {
    return NextResponse.json(
      {
        error:
          "Pagamentos ainda não estão configurados neste site. Defina ABACATEPAY_API_KEY no servidor.",
        code: "GATEWAY_NOT_CONFIGURED",
      },
      { status: 503 },
    );
  }

  const { publicId } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Corpo da requisição inválido." }, { status: 400 });
  }

  const parsed = createPaymentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Método de pagamento inválido." }, { status: 400 });
  }

  const registration = await getRegistrationByPublicId(publicId);
  if (!registration) {
    return NextResponse.json({ error: "Inscrição não encontrada." }, { status: 404 });
  }

  // Se já existe uma cobrança válida do mesmo tipo, reaproveita em vez de
  // gerar outra — evita dois QR Codes vivos para a mesma inscrição.
  const activePayment = findActivePayment(registration);
  const wantedKind = parsed.data.method === "PIX" ? "PIX_QRCODE" : "BILLING";
  if (activePayment && activePayment.kind === wantedKind) {
    return NextResponse.json({ paymentId: activePayment.id, reused: true });
  }

  try {
    const result = await createPaymentForRegistration(registration, parsed.data.method);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 422 });
    }
    return NextResponse.json({ paymentId: result.paymentId, reused: false }, { status: 201 });
  } catch (error) {
    if (error instanceof GatewayNotConfiguredError) {
      return NextResponse.json(
        { error: error.message, code: "GATEWAY_NOT_CONFIGURED" },
        { status: 503 },
      );
    }
    console.error("[pagamento] Falha ao criar cobrança:", error);
    return NextResponse.json(
      { error: "Não foi possível gerar a cobrança. Tente novamente." },
      { status: 500 },
    );
  }
}
