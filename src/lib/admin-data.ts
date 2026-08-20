import "server-only";
import { prisma } from "./db";
import type { RegistrationStatus } from "@/generated/prisma/enums";

/**
 * Consultas do painel administrativo.
 *
 * Tudo aqui roda em Server Components, atrás de `requireAdmin()`. Nenhum destes
 * dados é exposto em rota pública.
 */

export type AdminFilters = {
  status?: RegistrationStatus;
  categoryId?: string;
  /** Data inicial (AAAA-MM-DD), inclusiva. */
  from?: string;
  /** Data final (AAAA-MM-DD), inclusiva. */
  to?: string;
  /** Busca por nome, CPF ou e-mail do piloto. */
  search?: string;
};

const VALID_STATUSES = ["PENDING", "PAID", "CANCELLED"] as const;

/** Lê os filtros da query string. Compartilhado entre a página e a exportação CSV. */
export function parseAdminFilters(
  params: Record<string, string | string[] | undefined>,
): AdminFilters {
  return {
    status: pickStatus(params.status),
    categoryId: pickString(params.categoria),
    from: pickDate(params.de),
    to: pickDate(params.ate),
    search: pickString(params.busca),
  };
}

function pickStatus(value: string | string[] | undefined): RegistrationStatus | undefined {
  const raw = pickString(value);
  return VALID_STATUSES.find((status) => status === raw);
}

function pickString(value: string | string[] | undefined): string | undefined {
  const raw = Array.isArray(value) ? value[0] : value;
  const trimmed = raw?.trim();
  return trimmed ? trimmed : undefined;
}

function pickDate(value: string | string[] | undefined): string | undefined {
  const raw = pickString(value);
  return raw && /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : undefined;
}

/** Traduz os filtros da query string para um `where` do Prisma. */
function buildWhere(filters: AdminFilters) {
  const where: Record<string, unknown> = {};

  if (filters.status) where.status = filters.status;

  if (filters.categoryId) {
    where.categories = { some: { categoryId: filters.categoryId } };
  }

  if (filters.from || filters.to) {
    const createdAt: { gte?: Date; lte?: Date } = {};
    if (filters.from) createdAt.gte = new Date(`${filters.from}T00:00:00-03:00`);
    // `lte` no fim do dia para que a data final seja inclusiva.
    if (filters.to) createdAt.lte = new Date(`${filters.to}T23:59:59.999-03:00`);
    where.createdAt = createdAt;
  }

  if (filters.search) {
    const term = filters.search.trim();
    const digits = term.replace(/\D/g, "");
    where.pilot = {
      OR: [
        { fullName: { contains: term, mode: "insensitive" } },
        { email: { contains: term, mode: "insensitive" } },
        ...(digits.length >= 3 ? [{ cpf: { contains: digits } }] : []),
      ],
    };
  }

  return where;
}

/** Números do topo do painel. */
export async function getDashboardStats() {
  const [byStatus, paidTotal, pilots, perCategory] = await Promise.all([
    prisma.registration.groupBy({ by: ["status"], _count: { _all: true } }),

    // Receita conta APENAS inscrições pagas. Pendentes não são dinheiro.
    prisma.registration.aggregate({
      where: { status: "PAID" },
      _sum: { totalCents: true },
    }),

    // Pilotos distintos com ao menos uma inscrição viva.
    prisma.registration
      .findMany({
        where: { status: { in: ["PENDING", "PAID"] } },
        select: { pilotId: true },
        distinct: ["pilotId"],
      })
      .then((rows) => rows.length),

    prisma.registrationCategory.groupBy({
      by: ["categoryId"],
      where: { registration: { status: { in: ["PENDING", "PAID"] } } },
      _count: { _all: true },
    }),
  ]);

  const countFor = (status: RegistrationStatus) =>
    byStatus.find((row) => row.status === status)?._count._all ?? 0;

  const categories = await prisma.category.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });

  const countByCategory = new Map(perCategory.map((row) => [row.categoryId, row._count._all]));

  const missingPrice = categories.filter(
    (category) => category.active && category.priceCents === null,
  );

  return {
    total: byStatus.reduce((sum, row) => sum + row._count._all, 0),
    paid: countFor("PAID"),
    pending: countFor("PENDING"),
    cancelled: countFor("CANCELLED"),
    revenueCents: paidTotal._sum.totalCents ?? 0,
    pilots,
    byCategory: categories.map((category) => ({
      id: category.id,
      name: category.name,
      priceCents: category.priceCents,
      count: countByCategory.get(category.id) ?? 0,
      maxPilots: category.maxPilots,
    })),
    /** Categorias ativas sem preço: bloqueiam inscrição até serem preenchidas. */
    categoriesMissingPrice: missingPrice.map((category) => ({
      id: category.id,
      name: category.name,
    })),
  };
}

/** Lista da tabela principal, já filtrada. */
export async function listRegistrations(filters: AdminFilters, limit = 200) {
  return prisma.registration.findMany({
    where: buildWhere(filters),
    orderBy: { createdAt: "desc" },
    take: limit,
    include: {
      pilot: true,
      categories: { include: { category: true } },
      payments: { orderBy: { createdAt: "desc" }, take: 1 },
    },
  });
}

export async function countRegistrations(filters: AdminFilters) {
  return prisma.registration.count({ where: buildWhere(filters) });
}

export async function getRegistrationByNumber(number: number) {
  return prisma.registration.findUnique({
    where: { number },
    include: {
      pilot: true,
      motorcycle: true,
      categories: { include: { category: true }, orderBy: { createdAt: "asc" } },
      payments: { orderBy: { createdAt: "desc" } },
    },
  });
}

export async function listCategoriesForFilter() {
  return prisma.category.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: { id: true, name: true },
  });
}
