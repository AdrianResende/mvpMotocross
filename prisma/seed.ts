/**
 * CATEGORIAS OFICIAIS DO EVENTO
 * =============================
 *
 * Rodar:  npm run db:seed
 *
 * As 15 categorias abaixo vieram do material oficial da organização.
 *
 *
 * POR QUE NENHUMA TEM PREÇO
 * -------------------------
 * Os preços não estavam legíveis no material fornecido. Preencher um valor
 * "provisório" seria pior do que deixar vazio: um número na tela parece
 * oficial, e alguém acabaria cobrando errado.
 *
 * Então `priceCents` fica `null`, que significa PREÇO NÃO DEFINIDO — e não
 * gratuito. Enquanto estiver assim:
 *
 *   - a categoria aparece no site marcada como "preço a definir";
 *   - ninguém consegue se inscrever nela (bloqueio no servidor, não só na tela);
 *   - o painel administrativo exibe um aviso listando o que falta.
 *
 * O organizador define os preços em /admin/categorias, sem mexer no código.
 *
 * Também não foram preenchidos: faixa etária, limite de vagas e descrições —
 * a organização não informou nenhum deles.
 *
 * O seed é idempotente (`upsert` por `slug`) e NÃO sobrescreve preços já
 * definidos pelo organizador.
 */
import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

/** Categorias oficiais, na ordem informada pela organização. */
const officialCategories = [
  { slug: "mx1", name: "MX1" },
  { slug: "mx2", name: "MX2" },
  { slug: "mx3", name: "MX3" },
  { slug: "mx4", name: "MX4" },
  { slug: "nacional-a", name: "Nacional A" },
  { slug: "nacional-b", name: "Nacional B" },
  { slug: "trilheiros", name: "Trilheiros" },
  { slug: "local", name: "Local" },
  { slug: "50cc", name: "50cc" },
  { slug: "65cc", name: "65cc" },
  { slug: "80cc", name: "80cc" },
  { slug: "intermediaria-a", name: "Intermediária A" },
  { slug: "intermediaria-b", name: "Intermediária B" },
  { slug: "forca-livre-nacional", name: "Força Livre Nacional" },
  { slug: "forca-livre-importada", name: "Força Livre Importada" },
];

async function main() {
  for (const [index, category] of officialCategories.entries()) {
    await prisma.category.upsert({
      where: { slug: category.slug },
      create: {
        slug: category.slug,
        name: category.name,
        // Sem preço, sem descrição, sem faixa etária, sem limite de vagas:
        // a organização não informou nada disso.
        priceCents: null,
        description: null,
        minAge: null,
        maxAge: null,
        maxPilots: null,
        notes: null,
        active: true,
        sortOrder: index + 1,
      },
      // Em uma re-execução, mexemos apenas em nome e ordem. Preço, descrição e
      // demais ajustes feitos pelo organizador no painel são preservados.
      update: {
        name: category.name,
        sortOrder: index + 1,
      },
    });
  }

  const missingPrice = await prisma.category.count({
    where: { active: true, priceCents: null },
  });

  console.log(`Seed concluído. ${officialCategories.length} categorias oficiais gravadas.`);

  if (missingPrice > 0) {
    console.log(
      `\nATENÇÃO: ${missingPrice} categoria(s) ainda SEM PREÇO definido.\n` +
        `Ninguém consegue se inscrever nelas até que o preço seja informado.\n` +
        `Defina os valores em /admin/categorias.`,
    );
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
