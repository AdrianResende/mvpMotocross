import { NextResponse } from "next/server";
import { findActivePayment, getRegistrationByPublicId } from "@/lib/registrations";
import { createPaymentForRegistration } from "@/lib/payments";
import { isPaymentGatewayConfigured } from "@/lib/env";
import { InfinitePayNotConfiguredError } from "@/lib/infinitepay";

/**
 * POST /api/registrations/[publicId]/pagamento — gera o link de checkout.
 *
 * O valor NUNCA vem do corpo da requisição: sai de `registration.totalCents`,
 * gravado quando a inscrição foi criada. PIX e cartão não são mais escolhidos
 * aqui — o piloto escolhe na própria página da InfinitePay.
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ publicId: string }> },
) {
  if (!isPaymentGatewayConfigured()) {
    return NextResponse.json(
      {
        error: "Pagamentos ainda não estão configurados neste site. Defina INFINITEPAY_HANDLE no servidor.",
        code: "GATEWAY_NOT_CONFIGURED",
      },
      { status: 503 },
    );
  }

  const { publicId } = await params;

  const registration = await getRegistrationByPublicId(publicId);
  if (!registration) {
    return NextResponse.json({ error: "Inscrição não encontrada." }, { status: 404 });
  }

  // Já existe um link válido: reaproveita em vez de gerar outro.
  const activePayment = findActivePayment(registration);
  if (activePayment && activePayment.kind === "INFINITEPAY" && activePayment.checkoutUrl) {
    return NextResponse.json({ paymentId: activePayment.id, reused: true });
  }

  try {
    const result = await createPaymentForRegistration(registration);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 422 });
    }
    return NextResponse.json({ paymentId: result.paymentId, reused: false }, { status: 201 });
  } catch (error) {
    if (error instanceof InfinitePayNotConfiguredError) {
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
