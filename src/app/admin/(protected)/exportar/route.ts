import { NextResponse } from "next/server";
import { hasAdminSession } from "@/lib/admin-auth";
import { listRegistrations, parseAdminFilters } from "@/lib/admin-data";
import { formatCents, formatCpf, formatDateTime, formatPaymentKind, formatPhone } from "@/lib/format";

/**
 * Exporta as inscrições filtradas como CSV, para o organizador levar uma lista
 * impressa/planilha no dia do evento. Mesmos filtros da tabela do painel.
 *
 * `;` como separador porque é o que o Excel em pt-BR espera por padrão — com
 * `,` ele lê tudo como uma coluna só.
 */

const CSV_DELIMITER = ";";

function escapeCsvField(value: string): string {
  if (value.includes(CSV_DELIMITER) || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function toRow(fields: string[]): string {
  return fields.map(escapeCsvField).join(CSV_DELIMITER);
}

const statusLabels: Record<string, string> = {
  PENDING: "Pendente",
  PAID: "Pago",
  CANCELLED: "Cancelado",
};

export async function GET(request: Request) {
  if (!(await hasAdminSession())) {
    return NextResponse.json({ error: "Sessão expirada. Entre novamente." }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const filters = parseAdminFilters(Object.fromEntries(searchParams));

  // Sem limite de linhas: a tabela do painel corta em 200, a exportação não.
  const registrations = await listRegistrations(filters, 100_000);

  const header = toRow([
    "Inscrição",
    "Piloto",
    "CPF",
    "Telefone",
    "E-mail",
    "Cidade/UF",
    "Categorias",
    "Valor",
    "Status",
    "Forma de pagamento",
    "Data da inscrição",
  ]);

  const rows = registrations.map((registration) => {
    const payment = registration.payments[0];
    const paymentLabel = payment ? formatPaymentKind(payment.kind) : "";

    return toRow([
      String(registration.number),
      registration.pilot.fullName,
      formatCpf(registration.pilot.cpf),
      formatPhone(registration.pilot.phone),
      registration.pilot.email,
      `${registration.pilot.city}/${registration.pilot.state}`,
      registration.categories.map((item) => item.category.name).join(", "),
      formatCents(registration.totalCents),
      statusLabels[registration.status] ?? registration.status,
      paymentLabel,
      formatDateTime(registration.createdAt),
    ]);
  });

  // BOM no início: sem ele, o Excel no Windows abre acento e "ç" quebrados.
  const csv = "﻿" + [header, ...rows].join("\r\n");

  const filenameSuffix = filters.status ? `-${filters.status.toLowerCase()}` : "";

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="inscricoes${filenameSuffix}.csv"`,
    },
  });
}
