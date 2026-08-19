import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getRegistrationByNumber } from "@/lib/admin-data";
import { isPaymentGatewayConfigured } from "@/lib/env";
import {
  formatCents,
  formatCpf,
  formatDateTime,
  formatPhone,
  formatShortDate,
} from "@/lib/format";
import { Card, DataRow, StatusBadge } from "@/components/ui";
import { RecheckPaymentButton } from "./recheck-button";

export const metadata: Metadata = {
  title: "Detalhe da inscrição",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function AdminRegistrationDetailPage({
  params,
}: {
  params: Promise<{ number: string }>;
}) {
  const { number: rawNumber } = await params;
  const number = Number(rawNumber);

  if (!Number.isInteger(number) || number <= 0) notFound();

  const registration = await getRegistrationByNumber(number);
  if (!registration) notFound();

  const pendingPayment = registration.payments.find((payment) => payment.status === "PENDING");

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <Link
        href="/admin"
        className="text-sm text-chalk-dim underline underline-offset-2 hover:text-chalk"
      >
        ← Voltar para a lista
      </Link>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
        <h1 className="display-title text-3xl text-chalk sm:text-4xl">
          Inscrição #{registration.number}
        </h1>
        <StatusBadge status={registration.status} />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        {/* -------------------------------------------------------- PILOTO */}
        <Card className="p-5">
          <h2 className="display-label text-sm text-race-500">Piloto</h2>
          <dl className="mt-3">
            <DataRow label="Nome" value={registration.pilot.fullName} />
            <DataRow label="CPF" value={formatCpf(registration.pilot.cpf)} />
            <DataRow
              label="Nascimento"
              value={formatShortDate(registration.pilot.birthDate)}
            />
            <DataRow label="Telefone" value={formatPhone(registration.pilot.phone)} />
            <DataRow
              label="E-mail"
              value={
                <a
                  href={`mailto:${registration.pilot.email}`}
                  className="hover:text-race-400"
                >
                  {registration.pilot.email}
                </a>
              }
            />
            <DataRow
              label="Cidade"
              value={`${registration.pilot.city} — ${registration.pilot.state}`}
            />
          </dl>
        </Card>

        {/* ---------------------------------------------------------- MOTO */}
        <Card className="p-5">
          <h2 className="display-label text-sm text-race-500">Moto</h2>
          {registration.motorcycle ? (
            <dl className="mt-3">
              <DataRow label="Número" value={registration.motorcycle.number} />
              <DataRow label="Marca" value={registration.motorcycle.brand} />
              <DataRow label="Modelo" value={registration.motorcycle.model} />
              <DataRow label="Cilindrada" value={registration.motorcycle.displacement} />
            </dl>
          ) : (
            <p className="mt-3 text-sm text-chalk-dim">Sem moto cadastrada.</p>
          )}
        </Card>

        {/* ---------------------------------------------------- CATEGORIAS */}
        <Card className="p-5">
          <h2 className="display-label text-sm text-race-500">Categorias</h2>
          <dl className="mt-3">
            {registration.categories.map((item) => (
              <DataRow
                key={item.id}
                label={item.category.name}
                value={
                  <>
                    {formatCents(item.priceCents)}
                    {/* Deixa visível quando o catálogo mudou depois da
                        inscrição — o valor cobrado continua sendo o congelado. */}
                    {item.priceCents !== item.category.priceCents && (
                      <span className="block text-xs text-chalk-dim">
                        hoje: {formatCents(item.category.priceCents)}
                      </span>
                    )}
                  </>
                }
              />
            ))}
          </dl>
          <div className="mt-3 flex items-baseline justify-between gap-4 border-t-2 border-race-500 pt-3">
            <span className="display-label text-xs text-race-400">Total</span>
            <span className="display-title text-2xl text-chalk">
              {formatCents(registration.totalCents)}
            </span>
          </div>
        </Card>

        {/* ------------------------------------------------------- RESUMO */}
        <Card className="p-5">
          <h2 className="display-label text-sm text-race-500">Situação</h2>
          <dl className="mt-3">
            <DataRow label="Status" value={<StatusBadge status={registration.status} />} />
            <DataRow label="Criada em" value={formatDateTime(registration.createdAt)} />
            {registration.paidAt && (
              <DataRow label="Paga em" value={formatDateTime(registration.paidAt)} />
            )}
            <DataRow
              label="Link do piloto"
              value={
                <Link
                  href={`/inscricao/${registration.publicId}`}
                  className="text-race-400 hover:text-race-500"
                >
                  Abrir comprovante
                </Link>
              }
            />
          </dl>
        </Card>
      </div>

      {/* --------------------------------------------------------- PAGAMENTOS */}
      <section className="mt-8">
        <h2 className="display-label text-sm text-race-500">Pagamentos</h2>

        {registration.payments.length === 0 ? (
          <Card className="mt-3 p-5">
            <p className="text-sm text-chalk-dim">
              Nenhuma cobrança foi gerada para esta inscrição ainda.
            </p>
          </Card>
        ) : (
          <div className="mt-3 space-y-3">
            {registration.payments.map((payment) => (
              <Card key={payment.id} className="p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="display-label text-xs text-chalk-dim">
                      {payment.kind === "PIX_QRCODE" ? "QR Code PIX" : "Checkout hospedado"}
                      {payment.devMode && " · modo de teste"}
                    </p>
                    <p className="mt-1 font-mono text-xs break-all text-chalk-dim">
                      {payment.gatewayPaymentId}
                    </p>
                  </div>
                  <StatusBadge status={payment.status} />
                </div>

                <dl className="mt-4">
                  <DataRow label="Valor" value={formatCents(payment.amountCents)} />
                  <DataRow label="Gateway" value={payment.gateway} />
                  {payment.paymentMethod && (
                    <DataRow
                      label="Método"
                      value={payment.paymentMethod === "PIX" ? "PIX" : "Cartão de crédito"}
                    />
                  )}
                  <DataRow label="Criada em" value={formatDateTime(payment.createdAt)} />
                  {payment.paidAt && (
                    <DataRow label="Confirmada em" value={formatDateTime(payment.paidAt)} />
                  )}
                  {payment.expiresAt && (
                    <DataRow label="Expira em" value={formatDateTime(payment.expiresAt)} />
                  )}
                </dl>
              </Card>
            ))}
          </div>
        )}

        {/* Botão de conferência manual: útil se o webhook falhou ou o
            organizador quer confirmar antes de liberar a credencial. */}
        {pendingPayment && isPaymentGatewayConfigured() && (
          <div className="mt-4">
            <RecheckPaymentButton paymentId={pendingPayment.id} />
            <p className="mt-2 text-xs text-dirt-600">
              Consulta o status direto na AbacatePay e atualiza a inscrição se o
              pagamento já tiver sido aprovado.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
