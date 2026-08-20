import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { findActivePayment, getRegistrationByPublicId } from "@/lib/registrations";
import { reconcilePayment } from "@/lib/payments";
import { isPaymentGatewayConfigured } from "@/lib/env";
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
  searchParams,
}: {
  params: Promise<{ publicId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { publicId } = await params;
  const query = await searchParams;

  let registration = await getRegistrationByPublicId(publicId);
  if (!registration) notFound();

  // O piloto acabou de voltar do checkout da InfinitePay: ela manda esses
  // parâmetros na URL de retorno. É a primeira vez que `slug` e
  // `transactionNsu` existem — sem eles não dá pra perguntar nada ao gateway.
  const returnSlug = pickString(query.slug);
  const returnTransactionNsu = pickString(query.transaction_nsu);
  const returnOrderNsu = pickString(query.order_nsu);

  if (registration.status !== "PAID" && returnSlug && returnTransactionNsu && returnOrderNsu) {
    const activePayment = findActivePayment(registration);
    if (
      activePayment &&
      activePayment.kind === "INFINITEPAY" &&
      activePayment.gatewayPaymentId === returnOrderNsu
    ) {
      await reconcilePayment(activePayment.id, {
        slug: returnSlug,
        transactionNsu: returnTransactionNsu,
      });
      // Recarrega: `reconcilePayment` pode ter promovido a inscrição a PAGA.
      registration = await getRegistrationByPublicId(publicId);
      if (!registration) notFound();
    }
  }

  // Já pago: não faz sentido continuar aqui.
  if (registration.status === "PAID") {
    redirect(`/inscricao/${publicId}`);
  }

  const activePayment = findActivePayment(registration);
  const checkoutUrl = activePayment?.kind === "INFINITEPAY" ? activePayment.checkoutUrl : null;

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
          initialCheckoutUrl={checkoutUrl}
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

function pickString(value: string | string[] | undefined): string | undefined {
  const raw = Array.isArray(value) ? value[0] : value;
  const trimmed = raw?.trim();
  return trimmed ? trimmed : undefined;
}
