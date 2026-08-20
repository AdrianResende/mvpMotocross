/**
 * TESTE DE FLUXO PONTA A PONTA (sem tocar na InfinitePay de verdade)
 * ====================================================================
 *
 * Rodar:  npm run test:fluxo
 *
 * Este script exercita a regra mais importante do sistema:
 *
 *     UMA INSCRIÇÃO SÓ VIRA PAGA QUANDO A PRÓPRIA INFINITEPAY,
 *     CONSULTADA PELO SERVIDOR, DIZ QUE A COBRANÇA ESTÁ PAGA.
 *
 * Para conseguir testar isso sem mover dinheiro nem depender de rede, o script
 * substitui o `fetch` global por um dublê que responde como a API da
 * InfinitePay responderia, no formato conferido em `src/lib/infinitepay.ts`.
 * Nenhum código de produção é alterado ou instrumentado para o teste — o
 * dublê entra por baixo, no `fetch`.
 *
 * Os dados criados aqui são removidos no final.
 */
import "dotenv/config";

// Handle de mentira: existe só para o cliente HTTP passar da checagem de
// configuração. Nenhuma requisição real sai daqui — o `fetch` é substituído
// logo abaixo.
process.env.INFINITEPAY_HANDLE = "handle-de-teste-nunca-usado-de-verdade";

// ---------------------------------------------------------------- dublê

/** Estado que o "gateway" vai reportar na próxima consulta de payment_check. */
const gateway = {
  paid: false,
  /** Quando definido, sobrepõe o `paid_amount` devolvido — simula pagamento parcial. */
  paidAmountOverride: null as number | null,
};

/** `order_nsu` -> valor cobrado na criação do link, pra ecoar em payment_check. */
const chargedAmounts = new Map<string, number>();

const realFetch = globalThis.fetch;

globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === "string" ? input : input.toString();

  // Qualquer coisa que não seja a InfinitePay segue o caminho normal.
  if (!url.startsWith("https://api.infinitepay.io/invoices/public/checkout/")) {
    return realFetch(input, init);
  }

  const json = (data: unknown) =>
    new Response(JSON.stringify(data), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });

  if (url.endsWith("/links")) {
    const body = JSON.parse(String(init?.body ?? "{}")) as { order_nsu: string; amount: number };
    chargedAmounts.set(body.order_nsu, body.amount);
    return json({ url: `https://checkout.infinitepay.com.br/handle-de-teste?lenc=TESTE-${body.order_nsu}` });
  }

  if (url.endsWith("/payment_check")) {
    const body = JSON.parse(String(init?.body ?? "{}")) as { order_nsu: string };
    const amount = chargedAmounts.get(body.order_nsu) ?? 0;
    return json({
      paid: gateway.paid,
      amount,
      paid_amount: gateway.paid ? (gateway.paidAmountOverride ?? amount) : 0,
      installments: 1,
      capture_method: "pix",
    });
  }

  throw new Error(`O teste não previu esta chamada ao gateway: ${url}`);
}) as typeof fetch;

// Os módulos só são importados DEPOIS do dublê estar no lugar.
const { prisma } = await import("../src/lib/db");
const { createRegistration, getRegistrationByPublicId } = await import("../src/lib/registrations");
const { createPaymentForRegistration, reconcilePayment } = await import("../src/lib/payments");

// ------------------------------------------------------------- asserções

let failures = 0;

function check(description: string, condition: boolean) {
  if (condition) {
    console.log(`  ok   ${description}`);
  } else {
    failures += 1;
    console.error(`  FALHA ${description}`);
  }
}

// CPF válido reservado para o teste, para não colidir com dados reais.
const TEST_CPF = "40364182818";

/**
 * Restaura os preços originais das categorias mexidas pelo teste.
 *
 * Fica dentro de um objeto porque a atribuição acontece em `run()`, e o
 * TypeScript não consegue rastrear isso em uma variável solta.
 */
const teardown: { restorePrices?: () => Promise<void> } = {};

async function cleanup() {
  const pilot = await prisma.pilot.findUnique({ where: { cpf: TEST_CPF } });
  if (!pilot) return;

  const registrations = await prisma.registration.findMany({
    where: { pilotId: pilot.id },
    select: { number: true },
  });
  const numbers = registrations.map((registration) => registration.number);

  await prisma.payment.deleteMany({ where: { registrationNumber: { in: numbers } } });
  await prisma.registrationCategory.deleteMany({ where: { registrationNumber: { in: numbers } } });
  await prisma.registration.deleteMany({ where: { number: { in: numbers } } });
  await prisma.motorcycle.deleteMany({ where: { pilotId: pilot.id } });
  await prisma.pilot.delete({ where: { id: pilot.id } });
}

async function run() {
  await cleanup();

  const allCategories = await prisma.category.findMany({
    where: { active: true, maxAge: null },
    orderBy: { sortOrder: "asc" },
    take: 3,
  });

  if (allCategories.length < 3) {
    throw new Error("Rode `npm run db:seed` antes: o teste precisa de 3 categorias ativas.");
  }

  // As categorias oficiais nascem sem preço. O teste define preços próprios nas
  // duas primeiras e deixa a terceira sem preço de propósito, para verificar o
  // bloqueio. Os valores originais são restaurados no fim.
  const [firstCategory, secondCategory, unpricedCategory] = allCategories;
  const originalPrices = allCategories.map((category) => ({
    id: category.id,
    priceCents: category.priceCents,
  }));

  await prisma.category.update({ where: { id: firstCategory.id }, data: { priceCents: 15_000 } });
  await prisma.category.update({ where: { id: secondCategory.id }, data: { priceCents: 12_000 } });
  await prisma.category.update({ where: { id: unpricedCategory.id }, data: { priceCents: null } });

  const categories = [
    { ...firstCategory, priceCents: 15_000 },
    { ...secondCategory, priceCents: 12_000 },
  ];
  const expectedTotal = 27_000;

  teardown.restorePrices = async () => {
    for (const original of originalPrices) {
      await prisma.category.update({
        where: { id: original.id },
        data: { priceCents: original.priceCents },
      });
    }
  };

  // ------------------------------------------------------------ inscrição
  console.log("\n1. Inscrição");
  const created = await createRegistration({
    pilot: {
      fullName: "Piloto De Teste",
      cpf: TEST_CPF,
      birthDate: "1995-05-05",
      phone: "11912345678",
      email: "teste@example.com",
      city: "Campinas",
      state: "SP",
    },
    motorcycle: { number: "99", brand: "Honda", model: "CRF", displacement: "250cc" },
    categoryIds: [categories[0].id, categories[1].id],
  });

  check(
    `total somado pelo servidor = ${expectedTotal} centavos`,
    created.totalCents === expectedTotal,
  );

  let registration = (await getRegistrationByPublicId(created.publicId))!;
  check("inscrição nasce PENDENTE", registration.status === "PENDING");

  // ---------------------------------------------------------- link de checkout
  console.log("\n2. Geração do link de checkout");
  const payment = await createPaymentForRegistration(registration);
  check("cobrança criada", payment.ok);
  if (!payment.ok) throw new Error(payment.error);

  const paymentRow = await prisma.payment.findUniqueOrThrow({ where: { id: payment.paymentId } });
  check(
    `valor da cobrança = total da inscrição (${expectedTotal})`,
    paymentRow.amountCents === expectedTotal,
  );
  check("cobrança nasce PENDENTE", paymentRow.status === "PENDING");
  check("link de checkout gravado", Boolean(paymentRow.checkoutUrl));

  registration = (await getRegistrationByPublicId(created.publicId))!;
  check("inscrição continua PENDENTE após gerar cobrança", registration.status === "PENDING");

  // ------------------------------------------------- retorno forjado do checkout
  console.log("\n3. Piloto volta do checkout, mas o gateway ainda diz NÃO PAGO");
  gateway.paid = false;
  const forged = await reconcilePayment(payment.paymentId, {
    slug: "slug-de-teste",
    transactionNsu: "txn-de-teste",
  });

  check("conferência devolve PENDENTE", forged.status === "PENDING");
  check("nada foi confirmado", forged.justPaid === false);

  registration = (await getRegistrationByPublicId(created.publicId))!;
  check(
    "INSCRIÇÃO NÃO VIROU PAGA com retorno forjado",
    registration.status === "PENDING",
  );

  // ---------------------------------------------- pagamento verdadeiro
  console.log("\n4. Pagamento confirmado pelo gateway");
  gateway.paid = true;
  // `slug`/`transactionNsu` já foram gravados no passo 3 — o webhook chegando
  // sozinho, sem o piloto ter voltado, cai neste mesmo caminho.
  const confirmed = await reconcilePayment(payment.paymentId);

  check("conferência devolve PAGO", confirmed.status === "PAID");
  check("esta conferência foi a que confirmou", confirmed.justPaid === true);

  registration = (await getRegistrationByPublicId(created.publicId))!;
  check("inscrição virou PAGA", registration.status === "PAID");
  check("data do pagamento gravada", registration.paidAt !== null);
  check(
    "valor pago = total original",
    registration.totalCents === expectedTotal,
  );

  // ------------------------------------------------------- idempotência
  console.log("\n5. Reentrega do webhook (idempotência)");
  const again = await reconcilePayment(payment.paymentId);
  check("continua PAGO", again.status === "PAID");
  check("não confirma duas vezes", again.justPaid === false);

  const paymentsCount = await prisma.payment.count({
    where: { registrationNumber: registration.number },
  });
  check("nenhum pagamento duplicado foi criado", paymentsCount === 1);

  // -------------------------------------------- preço alterado depois
  console.log("\n6. Preço da categoria alterado após a inscrição");
  const originalPrice = categories[0].priceCents;
  await prisma.category.update({
    where: { id: categories[0].id },
    data: { priceCents: originalPrice + 5000 },
  });

  registration = (await getRegistrationByPublicId(created.publicId))!;
  const frozen = registration.categories.find((item) => item.categoryId === categories[0].id);
  check("preço histórico da inscrição não mudou", frozen?.priceCents === originalPrice);
  check("total da inscrição não mudou", registration.totalCents === expectedTotal);

  await prisma.category.update({
    where: { id: categories[0].id },
    data: { priceCents: originalPrice },
  });

  // ------------------------------------ categoria sem preço não aceita inscrição
  console.log("\n7. Categoria com valor a definir");
  await cleanup();

  let blocked = false;
  let blockedCode: string | undefined;
  try {
    await createRegistration({
      pilot: {
        fullName: "Piloto De Teste",
        cpf: TEST_CPF,
        birthDate: "1995-05-05",
        phone: "11912345678",
        email: "teste@example.com",
        city: "Campinas",
        state: "SP",
      },
      motorcycle: { number: "99", brand: "Honda", model: "CRF", displacement: "250cc" },
      // Uma categoria com preço + uma sem preço: a inscrição inteira deve cair.
      categoryIds: [categories[0].id, unpricedCategory.id],
    });
  } catch (error) {
    blocked = true;
    blockedCode = (error as { code?: string }).code;
  }

  check("inscrição recusada", blocked);
  check("motivo é PRICE_NOT_SET", blockedCode === "PRICE_NOT_SET");

  const leaked = await prisma.pilot.findUnique({ where: { cpf: TEST_CPF } });
  check("nenhuma inscrição parcial foi gravada", leaked === null);

  // ------------------------------------------- gateway paga menos que o devido
  console.log("\n8. Gateway confirma pagamento com valor menor que o cobrado");
  await cleanup();

  const second = await createRegistration({
    pilot: {
      fullName: "Piloto De Teste",
      cpf: TEST_CPF,
      birthDate: "1995-05-05",
      phone: "11912345678",
      email: "teste@example.com",
      city: "Campinas",
      state: "SP",
    },
    motorcycle: { number: "99", brand: "Honda", model: "CRF", displacement: "250cc" },
    categoryIds: [categories[0].id],
  });

  const secondRegistration = (await getRegistrationByPublicId(second.publicId))!;
  const secondPayment = await createPaymentForRegistration(secondRegistration);
  check("segunda cobrança criada", secondPayment.ok);
  if (!secondPayment.ok) throw new Error(secondPayment.error);

  gateway.paid = true;
  gateway.paidAmountOverride = 100; // o gateway "confirma" só R$ 1,00 pago
  const shortPaid = await reconcilePayment(secondPayment.paymentId, {
    slug: "slug-de-teste-2",
    transactionNsu: "txn-de-teste-2",
  });
  gateway.paidAmountOverride = null;

  check("conferência recusa o pagamento", shortPaid.justPaid === false);
  check("status não vira PAGO", shortPaid.status !== "PAID");

  const secondRegistrationAfter = (await getRegistrationByPublicId(second.publicId))!;
  check(
    "inscrição não virou PAGA com valor incompleto",
    secondRegistrationAfter.status === "PENDING",
  );

  await cleanup();
}

try {
  await run();
} catch (error) {
  failures += 1;
  console.error("\nErro durante o teste:", error);
} finally {
  await cleanup().catch(() => {});
  await teardown.restorePrices?.().catch(() => {});
  await prisma.$disconnect();
}

if (failures > 0) {
  console.error(`\n${failures} verificação(ões) falharam.`);
  process.exit(1);
}

console.log("\nTodas as verificações passaram.");
