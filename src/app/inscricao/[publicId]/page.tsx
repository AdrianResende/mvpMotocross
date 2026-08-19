import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { eventConfig } from "@/config/event";
import { findActivePayment, getRegistrationByPublicId } from "@/lib/registrations";
import { reconcilePayment } from "@/lib/payments";
import { isPaymentGatewayConfigured } from "@/lib/env";
import {
  formatCents,
  formatCpf,
  formatDateTime,
  formatLongDate,
  formatPhone,
} from "@/lib/format";
import { ActionLink, Alert, Card, DataRow, StatusBadge } from "@/components/ui";
import { ReceiptActions } from "@/components/receipt-actions";

export const metadata: Metadata = {
  title: "Minha inscrição",
  // Página pessoal: fora dos buscadores.
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function RegistrationDetailPage({
  params,
}: {
  params: Promise<{ publicId: string }>;
}) {
  const { publicId } = await params;
  let registration = await getRegistrationByPublicId(publicId);

  if (!registration) notFound();

  // O piloto pode chegar aqui vindo do checkout antes de o webhook ter sido
  // entregue. Conferimos a cobrança direto com o gateway para não deixá-lo
  // olhando "pendente" por causa de um atraso na entrega do evento.
  //
  // Note bem: quem confirma é a resposta da API da AbacatePay, não o fato de o
  // navegador ter chegado nesta URL.
  const activePayment = findActivePayment(registration);
  if (
    activePayment &&
    activePayment.status === "PENDING" &&
    registration.status === "PENDING" &&
    isPaymentGatewayConfigured()
  ) {
    const result = await reconcilePayment(activePayment.id);
    if (result.status === "PAID") {
      registration = (await getRegistrationByPublicId(publicId)) ?? registration;
    }
  }

  const isPaid = registration.status === "PAID";
  const payment = findActivePayment(registration);

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:py-14">
      {/* ------------------------------------------------------ CABEÇALHO */}
      {isPaid ? (
        <div className="border-2 border-flag-500 bg-flag-500/10 p-5 sm:p-6">
          <p className="display-label text-sm text-flag-400">Pagamento confirmado</p>
          <h1 className="display-title mt-2 text-4xl text-chalk sm:text-5xl">
            Inscrição confirmada!
          </h1>
          <p className="mt-3 text-sm text-chalk-dim">
            Nos vemos na pista em {formatLongDate(eventConfig.date)}.
          </p>
        </div>
      ) : (
        <div className="border-2 border-race-500 bg-race-500/10 p-5 sm:p-6">
          <p className="display-label text-sm text-race-400">
            {registration.status === "CANCELLED" ? "Inscrição cancelada" : "Aguardando pagamento"}
          </p>
          <h1 className="display-title mt-2 text-4xl text-chalk sm:text-5xl">
            Inscrição #{registration.number}
          </h1>
          {registration.status === "PENDING" && (
            <p className="mt-3 text-sm text-chalk-dim">
              Sua vaga fica reservada, mas a inscrição só é confirmada depois que o
              pagamento for aprovado pelo gateway.
            </p>
          )}
        </div>
      )}

      {/* ------------------------------------------------------ COMPROVANTE */}
      <Card className="mt-6 p-5 sm:p-6">
        <div className="flex items-start justify-between gap-4 border-b border-dirt-800 pb-4">
          <div>
            <p className="display-label text-xs text-race-500">{eventConfig.name}</p>
            <p className="display-title mt-1 text-2xl text-chalk">
              Inscrição #{registration.number}
            </p>
          </div>
          <StatusBadge status={registration.status} />
        </div>

        <dl className="mt-4">
          <DataRow label="Piloto" value={registration.pilot.fullName} />
          <DataRow label="CPF" value={formatCpf(registration.pilot.cpf)} />
          <DataRow label="Telefone" value={formatPhone(registration.pilot.phone)} />
          <DataRow label="E-mail" value={registration.pilot.email} />
          <DataRow
            label="Cidade"
            value={`${registration.pilot.city} — ${registration.pilot.state}`}
          />
        </dl>

        {registration.motorcycle && (
          <>
            <p className="display-label mt-6 mb-2 text-xs text-race-500">Moto</p>
            <dl>
              <DataRow label="Número" value={registration.motorcycle.number} />
              <DataRow
                label="Moto"
                value={`${registration.motorcycle.brand} ${registration.motorcycle.model}`}
              />
              <DataRow label="Cilindrada" value={registration.motorcycle.displacement} />
            </dl>
          </>
        )}

        <p className="display-label mt-6 mb-2 text-xs text-race-500">Categorias</p>
        <dl>
          {registration.categories.map((item) => (
            <DataRow
              key={item.id}
              label={item.category.name}
              // Preço congelado no momento da inscrição, não o preço atual.
              value={formatCents(item.priceCents)}
            />
          ))}
        </dl>

        <div className="mt-4 flex items-baseline justify-between gap-4 border-t-2 border-race-500 pt-4">
          <span className="display-label text-sm text-race-400">
            {isPaid ? "Valor pago" : "Total"}
          </span>
          <span className="display-title text-3xl text-chalk">
            {formatCents(registration.totalCents)}
          </span>
        </div>

        <dl className="mt-6">
          <DataRow label="Data da inscrição" value={formatDateTime(registration.createdAt)} />
          {registration.paidAt && (
            <DataRow label="Pagamento confirmado em" value={formatDateTime(registration.paidAt)} />
          )}
          {payment?.paymentMethod && (
            <DataRow
              label="Forma de pagamento"
              value={payment.paymentMethod === "PIX" ? "PIX" : "Cartão de crédito"}
            />
          )}
        </dl>

        {payment?.devMode && (
          <p className="mt-4 border border-race-500/40 bg-race-500/10 p-3 text-xs text-race-200">
            Cobrança criada em modo de teste no gateway. Não representa um pagamento
            real.
          </p>
        )}
      </Card>

      {/* ----------------------------------------------------------- AÇÕES */}
      <div className="mt-6 space-y-6">
        {isPaid ? (
          <ReceiptActions
            registrationNumber={registration.number}
            pilotName={registration.pilot.fullName}
          />
        ) : registration.status === "PENDING" ? (
          <>
            <ActionLink href={`/inscricao/${publicId}/pagamento`} className="w-full sm:w-auto">
              Pagar agora
            </ActionLink>
            <Alert tone="info" title="Como confirmamos seu pagamento">
              A confirmação vem da própria AbacatePay. Assim que o pagamento for
              aprovado, esta página passa a exibir a inscrição como confirmada — pode
              recarregá-la a qualquer momento.
            </Alert>
          </>
        ) : (
          <Alert tone="info" title="Inscrição cancelada">
            Esta inscrição foi cancelada. Se acha que houve um engano, fale com a
            organização do evento.
          </Alert>
        )}

        <p className="border-l-2 border-dirt-700 pl-4 text-xs text-dirt-600 print:hidden">
          Guarde o endereço desta página: é o seu comprovante e o seu acesso à
          inscrição.
        </p>

        <Link
          href="/"
          className="inline-block text-sm text-chalk-dim underline underline-offset-2 hover:text-chalk print:hidden"
        >
          Voltar para o início
        </Link>
      </div>
    </div>
  );
}
