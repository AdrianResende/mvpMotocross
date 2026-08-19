/**
 * Seed de CATEGORIAS DE DEMONSTRAÇÃO.
 *
 * >>> ATENÇÃO <<<
 * As categorias, os preços e as faixas etárias abaixo são EXEMPLOS para o
 * sistema poder ser testado. Não são as categorias oficiais de nenhum
 * campeonato. Substitua pelos dados reais antes de abrir as inscrições.
 *
 * Rodar:  npm run db:seed
 *
 * O seed é idempotente (`upsert` por `slug`): rodar de novo atualiza as
 * categorias existentes em vez de duplicá-las.
 *
 * Preços em CENTAVOS. 15000 = R$ 150,00.
 */
import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const categories = [
  {
    slug: "mx1",
    name: "MX1",
    description:
      "Categoria principal, para pilotos experientes em motos de alta cilindrada.",
    priceCents: 15_000,
    minAge: 18,
    maxAge: null,
    maxPilots: 40,
    notes: "Motos de 250cc 2T a 450cc 4T.",
    sortOrder: 1,
  },
  {
    slug: "mx2",
    name: "MX2",
    description:
      "Para pilotos de bom nível técnico em motos de cilindrada intermediária.",
    priceCents: 15_000,
    minAge: 16,
    maxAge: null,
    maxPilots: 40,
    notes: "Motos de 125cc 2T a 250cc 4T.",
    sortOrder: 2,
  },
  {
    slug: "intermediaria",
    name: "Intermediária",
    description:
      "Degrau entre o amadorismo e a elite, para quem já compete com regularidade.",
    priceCents: 12_000,
    minAge: 16,
    maxAge: null,
    maxPilots: 40,
    notes: null,
    sortOrder: 3,
  },
  {
    slug: "amador",
    name: "Amador",
    description:
      "Para quem pilota por diversão e quer a experiência de uma prova oficial.",
    priceCents: 10_000,
    minAge: 16,
    maxAge: null,
    maxPilots: 50,
    notes: "Sem exigência de resultados anteriores.",
    sortOrder: 4,
  },
  {
    slug: "junior",
    name: "Júnior",
    description: "Categoria de base, para os pilotos mais novos da pista.",
    priceCents: 8_000,
    minAge: 8,
    maxAge: 15,
    maxPilots: 30,
    notes: "Exige autorização do responsável na retirada da credencial.",
    sortOrder: 5,
  },
];

async function main() {
  for (const category of categories) {
    await prisma.category.upsert({
      where: { slug: category.slug },
      create: { ...category, active: true },
      update: category,
    });
  }

  const total = await prisma.category.count();
  console.log(`Seed concluído. ${categories.length} categorias de DEMONSTRAÇÃO gravadas (${total} no total).`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
