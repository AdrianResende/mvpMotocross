import type { Metadata } from "next";
import Link from "next/link";
import {
  countRegistrations,
  getDashboardStats,
  listCategoriesForFilter,
  listRegistrations,
  parseAdminFilters,
  type AdminFilters,
} from "@/lib/admin-data";
import { formatCents, formatCpf, formatDateTime, formatPaymentKind } from "@/lib/format";
import { Alert, Card, StatusBadge } from "@/components/ui";
import { RegistrationFilters } from "./filters";

export const metadata: Metadata = {
  title: "Painel",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/** Quantas linhas a tabela carrega de uma vez. */
const ROW_LIMIT = 200;

export default async function AdminDashboardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;

  // A query string vem do usuário: cada campo é validado antes de virar filtro.
  const filters = parseAdminFilters(params);

  const [stats, registrations, matching, categories] = await Promise.all([
    getDashboardStats(),
    listRegistrations(filters, ROW_LIMIT),
    countRegistrations(filters),
    listCategoriesForFilter(),
  ]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <h1 className="display-title text-3xl text-chalk sm:text-4xl">Inscrições</h1>

      {/* Preço faltando bloqueia inscrição — é a primeira coisa que o
          organizador precisa ver ao abrir o painel. */}
      {stats.categoriesMissingPrice.length > 0 && (
        <div className="mt-5">
          <Alert title={`${stats.categoriesMissingPrice.length} categoria(s) sem preço definido`}>
            <p>
              Estas categorias não aceitam inscrição enquanto o valor não for informado:{" "}
              <strong>
                {stats.categoriesMissingPrice.map((category) => category.name).join(" · ")}
              </strong>
            </p>
            <p className="mt-2">
              <Link href="/admin/categorias" className="underline underline-offset-2">
                Definir valores agora
              </Link>
            </p>
          </Alert>
        </div>
      )}

      {/* ------------------------------------------------------- INDICADORES */}
      <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Stat label="Total de inscrições" value={String(stats.total)} />
        <Stat label="Pagas" value={String(stats.paid)} tone="paid" />
        <Stat label="Pendentes" value={String(stats.pending)} tone="pending" />
        <Stat label="Pilotos" value={String(stats.pilots)} />
        <Stat
          label="Arrecadado"
          value={formatCents(stats.revenueCents)}
          tone="paid"
          className="col-span-2 lg:col-span-1"
        />
      </div>

      {stats.cancelled > 0 && (
        <p className="mt-3 text-sm text-chalk-dim">
          {stats.cancelled} inscriç{stats.cancelled === 1 ? "ão cancelada" : "ões canceladas"} (não
          contam na arrecadação).
        </p>
      )}

      {/* -------------------------------------------------- POR CATEGORIA */}
      <section className="mt-8">
        <h2 className="display-label text-sm text-race-500">Inscritos por categoria</h2>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {stats.byCategory.map((category) => (
            <Card
              key={category.id}
              className={`p-4 ${category.priceCents === null ? "border-race-500/60" : ""}`}
            >
              <p className="display-title text-xl text-chalk">{category.name}</p>
              <p className="display-title mt-1 text-3xl text-race-400">{category.count}</p>
              <p className="mt-1 text-xs text-chalk-dim">
                {category.priceCents === null
                  ? "valor a definir"
                  : formatCents(category.priceCents)}
              </p>
            </Card>
          ))}
        </div>
      </section>

      {/* ------------------------------------------------------------ FILTROS */}
      <section className="mt-8">
        <RegistrationFilters categories={categories} />
      </section>

      {/* ------------------------------------------------------------ TABELA */}
      <section className="mt-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-chalk-dim">
            {matching === 0
              ? "Nenhuma inscrição encontrada com esses filtros."
              : `${matching} inscriç${matching === 1 ? "ão" : "ões"} encontrada${matching === 1 ? "" : "s"}`}
            {matching > ROW_LIMIT && ` — exibindo as ${ROW_LIMIT} mais recentes.`}
          </p>

          {matching > 0 && (
            <a
              href={`/admin/exportar?${buildExportQuery(filters)}`}
              className="display-label tap-target inline-flex -skew-x-12 items-center justify-center border-2 border-chalk/25 px-4 py-2 text-xs text-chalk transition-colors hover:border-race-500 hover:text-race-400"
            >
              <span className="skew-x-12">Exportar CSV</span>
            </a>
          )}
        </div>

        {registrations.length > 0 && (
          // A tabela rola dentro do próprio container: no celular a página
          // nunca desliza para os lados.
          <div className="mt-3 overflow-x-auto border border-dirt-800">
            <table className="w-full min-w-[46rem] border-collapse text-sm">
              <thead>
                <tr className="bg-dirt-900 text-left">
                  <Th>Inscrição</Th>
                  <Th>Piloto</Th>
                  <Th>Categorias</Th>
                  <Th>Valor</Th>
                  <Th>Pagamento</Th>
                  <Th>Data</Th>
                </tr>
              </thead>
              <tbody>
                {registrations.map((registration) => {
                  const payment = registration.payments[0];

                  return (
                    <tr
                      key={registration.number}
                      className="border-t border-dirt-800 hover:bg-dirt-900"
                    >
                      <Td>
                        <Link
                          href={`/admin/inscricoes/${registration.number}`}
                          className="display-label text-race-400 hover:text-race-500"
                        >
                          #{registration.number}
                        </Link>
                      </Td>
                      <Td>
                        <span className="font-medium text-chalk">
                          {registration.pilot.fullName}
                        </span>
                        <br />
                        <span className="text-xs text-chalk-dim">
                          {formatCpf(registration.pilot.cpf)}
                        </span>
                      </Td>
                      <Td>
                        <span className="text-chalk-dim">
                          {registration.categories.map((item) => item.category.name).join(", ")}
                        </span>
                      </Td>
                      <Td>
                        <span className="font-medium text-chalk">
                          {formatCents(registration.totalCents)}
                        </span>
                      </Td>
                      <Td>
                        <StatusBadge status={registration.status} />
                        {payment && (
                          <>
                            <br />
                            <span className="text-xs text-chalk-dim">
                              {formatPaymentKind(payment.kind)}
                              {payment.devMode && " · teste"}
                            </span>
                          </>
                        )}
                      </Td>
                      <Td>
                        <span className="text-xs text-chalk-dim">
                          {formatDateTime(registration.createdAt)}
                        </span>
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
  className = "",
}: {
  label: string;
  value: string;
  tone?: "paid" | "pending";
  className?: string;
}) {
  const valueColor =
    tone === "paid" ? "text-flag-400" : tone === "pending" ? "text-race-400" : "text-chalk";

  return (
    <Card className={`p-4 ${className}`}>
      <p className="display-label text-xs text-chalk-dim">{label}</p>
      <p className={`display-title mt-1.5 text-3xl ${valueColor}`}>{value}</p>
    </Card>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th scope="col" className="display-label px-3 py-2.5 text-xs whitespace-nowrap text-chalk-dim">
      {children}
    </th>
  );
}

function Td({ children }: { children: React.ReactNode }) {
  return <td className="px-3 py-3 align-top">{children}</td>;
}

/** Repassa os filtros atuais para a rota de exportação, com os mesmos nomes da URL. */
function buildExportQuery(filters: AdminFilters): string {
  const query = new URLSearchParams();
  if (filters.status) query.set("status", filters.status);
  if (filters.categoryId) query.set("categoria", filters.categoryId);
  if (filters.from) query.set("de", filters.from);
  if (filters.to) query.set("ate", filters.to);
  if (filters.search) query.set("busca", filters.search);
  return query.toString();
}
