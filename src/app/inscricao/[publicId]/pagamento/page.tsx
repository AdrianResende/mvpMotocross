import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { findActivePayment, getRegistrationByPublicId } from "@/lib/registrations";
import { isPaymentGatewayConfigured, serverEnv } from "@/lib/env";
import { formatCents, formatCpf } from "@/lib/format";
import { PaymentPanel } from "@/components/payment-panel";
import { Card } from "@/components/ui";

export const metadata: Metadata = {
  title: "Pagamento",
  // A página é pessoal e não deve aparecer em buscadores.
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function PaymentPage({
  params,
}: {
  params: Promise<{ publicId: string }>;
}) {
  const { publicId } = await params;
  const registration = await getRegistrationByPublicId(publicId);

  if (!registration) notFound();

  // Já pago: não faz sentido continuar aqui.
  if (registration.status === "PAID") {
    redirect(`/inscricao/${publicId}`);
  }

  const activePayment = findActivePayment(registration);

  const initialPix =
    activePayment?.kind === "PIX_QRCODE" && activePayment.brCode && activePayment.brCodeBase64
      ? {
          paymentId: activePayment.id,
          brCode: activePayment.brCode,
          brCodeBase64: activePayment.brCodeBase64,
          expiresAt: activePayment.expiresAt?.toISOString() ?? null,
          devMode: activePayment.devMode,
        }
      : null;

  const initialCheckoutUrl =
    activePayment?.kind === "BILLING" ? activePayment.checkoutUrl : null;

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:py-14">
      <p className="display-label text-sm text-race-500">Inscrição #{registration.number}</p>
      <h1 className="display-title mt-2 text-4xl text-chalk sm:text-5xl">Pagamento</h1>

      {/* Resumo compacto: o piloto acabou de revisar, não precisa reler tudo. */}
      <Card className="mt-6 p-4">
        <dl className="space-y-2 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-chalk-dim">Piloto</dt>
            <dd className="text-right font-medium text-chalk">
              {registration.pilot.fullName}
            </dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-chalk-dim">CPF</dt>
            <dd className="text-right font-medium text-chalk">
              {formatCpf(registration.pilot.cpf)}
            </dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-chalk-dim">Categorias</dt>
            <dd className="text-right font-medium text-chalk">
              {registration.categories.map((item) => item.category.name).join(", ")}
            </dd>
          </div>
          <div className="flex justify-between gap-4 border-t border-dirt-800 pt-2">
            <dt className="text-chalk-dim">Total</dt>
            <dd className="text-right font-semibold text-chalk">
              {formatCents(registration.totalCents)}
            </dd>
          </div>
        </dl>
      </Card>

      <div className="mt-8">
        <PaymentPanel
          publicId={publicId}
          registrationNumber={registration.number}
          totalCents={registration.totalCents}
          initialPix={initialPix}
          initialCheckoutUrl={initialCheckoutUrl}
          // Cartão é recurso em BETA na AbacatePay e depende de liberação na
          // conta do organizador. Veja o README antes de habilitar.
          cardEnabled={serverEnv.abacatePayCardEnabled}
          gatewayConfigured={isPaymentGatewayConfigured()}
        />
      </div>

      <p className="mt-8 border-l-2 border-dirt-700 pl-4 text-xs text-dirt-600">
        Guarde o endereço desta página. É por ele que você acompanha e consulta sua
        inscrição a qualquer momento.
      </p>
    </div>
  );
}
