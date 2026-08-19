import { NextResponse } from "next/server";
import { findActivePayment, getRegistrationByPublicId } from "@/lib/registrations";
import { reconcilePayment } from "@/lib/payments";
import { isPaymentGatewayConfigured } from "@/lib/env";

/**
 * GET /api/registrations/[publicId]/status — status atual da inscrição.
 *
 * Consultado em intervalos pela tela de pagamento enquanto o piloto paga o PIX.
 *
 * Antes de responder, o servidor CONFERE a cobrança direto na API da
 * AbacatePay. Isso deixa o site funcionando mesmo que o webhook atrase ou o
 * evento se perca — e, principalmente, o "pago" nunca vem do navegador.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ publicId: string }> },
) {
  const { publicId } = await params;

  const registration = await getRegistrationByPublicId(publicId);
  if (!registration) {
    return NextResponse.json({ error: "Inscrição não encontrada." }, { status: 404 });
  }

  const payment = findActivePayment(registration);
  let gatewayError: string | undefined;

  if (payment && payment.status === "PENDING" && isPaymentGatewayConfigured()) {
    const result = await reconcilePayment(payment.id);
    gatewayError = result.error;

    if (result.status === "PAID") {
      return NextResponse.json({
        registrationStatus: "PAID",
        paymentStatus: "PAID",
        totalCents: registration.totalCents,
      });
    }

    return NextResponse.json({
      registrationStatus: registration.status,
      paymentStatus: result.status,
      totalCents: registration.totalCents,
      gatewayError,
    });
  }

  return NextResponse.json({
    registrationStatus: registration.status,
    paymentStatus: payment?.status ?? null,
    totalCents: registration.totalCents,
  });
}
