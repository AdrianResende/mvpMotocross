import "server-only";
import { prisma } from "./db";
import type { CreateRegistrationInput } from "./validation";
import { ageOn } from "./validation";
import { eventConfig } from "@/config/event";

/**
 * Regras de negócio da inscrição.
 *
 * O ponto crítico deste arquivo: o VALOR NUNCA VEM DO NAVEGADOR. O cliente
 * envia apenas os IDs das categorias; os preços são lidos do banco dentro de
 * uma transação e o total é somado aqui. Alterar o preço no DevTools não muda
 * um centavo do que é cobrado.
 */

export class RegistrationError extends Error {
  constructor(
    message: string,
    readonly code:
      | "CATEGORY_NOT_FOUND"
      | "CATEGORY_FULL"
      | "AGE_NOT_ALLOWED"
      | "REGISTRATIONS_CLOSED"
      | "DUPLICATE_REGISTRATION",
  ) {
    super(message);
    this.name = "RegistrationError";
  }
}

/** As inscrições online já se encerraram? */
export function registrationsClosed(now: Date = new Date()): boolean {
  const deadline = new Date(eventConfig.registrationsCloseAt);
  if (Number.isNaN(deadline.getTime())) return false;
  return now > deadline;
}

export type CategoryWithAvailability = {
  id: string;
  slug: string;
  name: string;
  description: string;
  priceCents: number;
  minAge: number | null;
  maxAge: number | null;
  maxPilots: number | null;
  notes: string | null;
  /** Inscrições já confirmadas ou aguardando pagamento. */
  takenSpots: number;
  /** `null` quando a categoria não tem limite de vagas. */
  remainingSpots: number | null;
  isFull: boolean;
};

/**
 * Categorias ativas com a contagem de vagas já ocupadas.
 *
 * Uma vaga conta como ocupada tanto para inscrições PAGAS quanto para as
 * PENDENTES — senão duas pessoas poderiam pagar a última vaga ao mesmo tempo.
 * Inscrições CANCELADAS liberam a vaga.
 */
export async function listCategoriesWithAvailability(): Promise<CategoryWithAvailability[]> {
  const categories = await prisma.category.findMany({
    where: { active: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });

  const counts = await prisma.registrationCategory.groupBy({
    by: ["categoryId"],
    where: { registration: { status: { in: ["PENDING", "PAID"] } } },
    _count: { _all: true },
  });

  const countByCategory = new Map(counts.map((row) => [row.categoryId, row._count._all]));

  return categories.map((category) => {
    const takenSpots = countByCategory.get(category.id) ?? 0;
    const remainingSpots =
      category.maxPilots === null ? null : Math.max(0, category.maxPilots - takenSpots);
    return {
      id: category.id,
      slug: category.slug,
      name: category.name,
      description: category.description,
      priceCents: category.priceCents,
      minAge: category.minAge,
      maxAge: category.maxAge,
      maxPilots: category.maxPilots,
      notes: category.notes,
      takenSpots,
      remainingSpots,
      isFull: remainingSpots !== null && remainingSpots <= 0,
    };
  });
}

/**
 * Cria a inscrição completa (piloto + moto + categorias) em uma transação.
 *
 * Retorna o `publicId` e o `number` da inscrição criada.
 */
export async function createRegistration(input: CreateRegistrationInput): Promise<{
  number: number;
  publicId: string;
  totalCents: number;
}> {
  if (registrationsClosed()) {
    throw new RegistrationError(
      "As inscrições online já foram encerradas.",
      "REGISTRATIONS_CLOSED",
    );
  }

  const birthDate = new Date(`${input.pilot.birthDate}T12:00:00-03:00`);
  const eventDate = new Date(`${eventConfig.date}T12:00:00-03:00`);
  const ageAtEvent = ageOn(birthDate, eventDate);

  return prisma.$transaction(async (tx) => {
    const categories = await tx.category.findMany({
      where: { id: { in: input.categoryIds }, active: true },
    });

    // Qualquer id inexistente ou inativo derruba a inscrição inteira.
    if (categories.length !== input.categoryIds.length) {
      throw new RegistrationError(
        "Uma das categorias selecionadas não existe ou não está mais disponível.",
        "CATEGORY_NOT_FOUND",
      );
    }

    for (const category of categories) {
      if (category.minAge !== null && ageAtEvent < category.minAge) {
        throw new RegistrationError(
          `A categoria ${category.name} exige idade mínima de ${category.minAge} anos na data do evento.`,
          "AGE_NOT_ALLOWED",
        );
      }
      if (category.maxAge !== null && ageAtEvent > category.maxAge) {
        throw new RegistrationError(
          `A categoria ${category.name} aceita pilotos com até ${category.maxAge} anos na data do evento.`,
          "AGE_NOT_ALLOWED",
        );
      }

      if (category.maxPilots !== null) {
        const taken = await tx.registrationCategory.count({
          where: {
            categoryId: category.id,
            registration: { status: { in: ["PENDING", "PAID"] } },
          },
        });
        if (taken >= category.maxPilots) {
          throw new RegistrationError(
            `A categoria ${category.name} está com as vagas esgotadas.`,
            "CATEGORY_FULL",
          );
        }
      }
    }

    // >>> O TOTAL É CALCULADO AQUI, a partir dos preços do banco. <<<
    const totalCents = categories.reduce((sum, category) => sum + category.priceCents, 0);

    // O piloto é identificado pelo CPF: se já existe, seus dados são
    // atualizados em vez de criar um cadastro duplicado.
    const pilot = await tx.pilot.upsert({
      where: { cpf: input.pilot.cpf },
      create: {
        fullName: input.pilot.fullName,
        cpf: input.pilot.cpf,
        birthDate,
        phone: input.pilot.phone,
        email: input.pilot.email,
        city: input.pilot.city,
        state: input.pilot.state,
      },
      update: {
        fullName: input.pilot.fullName,
        birthDate,
        phone: input.pilot.phone,
        email: input.pilot.email,
        city: input.pilot.city,
        state: input.pilot.state,
      },
    });

    // Um mesmo piloto não pode ter duas inscrições abertas na mesma categoria.
    const conflicting = await tx.registrationCategory.findFirst({
      where: {
        categoryId: { in: input.categoryIds },
        registration: { pilotId: pilot.id, status: { in: ["PENDING", "PAID"] } },
      },
      include: { category: true },
    });
    if (conflicting) {
      throw new RegistrationError(
        `Este CPF já possui uma inscrição em aberto na categoria ${conflicting.category.name}.`,
        "DUPLICATE_REGISTRATION",
      );
    }

    const motorcycle = await tx.motorcycle.create({
      data: {
        pilotId: pilot.id,
        number: input.motorcycle.number,
        brand: input.motorcycle.brand,
        model: input.motorcycle.model,
        displacement: input.motorcycle.displacement,
      },
    });

    const registration = await tx.registration.create({
      data: {
        pilotId: pilot.id,
        motorcycleId: motorcycle.id,
        totalCents,
        categories: {
          create: categories.map((category) => ({
            categoryId: category.id,
            // Preço congelado: mudanças futuras no catálogo não afetam
            // inscrições já feitas.
            priceCents: category.priceCents,
          })),
        },
      },
    });

    return {
      number: registration.number,
      publicId: registration.publicId,
      totalCents: registration.totalCents,
    };
  });
}

/** Inscrição com tudo que as telas precisam. */
export async function getRegistrationByPublicId(publicId: string) {
  return prisma.registration.findUnique({
    where: { publicId },
    include: {
      pilot: true,
      motorcycle: true,
      categories: { include: { category: true }, orderBy: { createdAt: "asc" } },
      payments: { orderBy: { createdAt: "desc" } },
    },
  });
}

export type RegistrationDetail = NonNullable<Awaited<ReturnType<typeof getRegistrationByPublicId>>>;

/** O pagamento ainda válido de uma inscrição, se houver. */
export function findActivePayment(registration: RegistrationDetail) {
  return (
    registration.payments.find((payment) => payment.status === "PAID") ??
    registration.payments.find(
      (payment) =>
        payment.status === "PENDING" &&
        (payment.expiresAt === null || payment.expiresAt > new Date()),
    ) ??
    null
  );
}
