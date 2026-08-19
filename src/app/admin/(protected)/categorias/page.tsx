import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { formatCents } from "@/lib/format";
import { Alert, Card } from "@/components/ui";
import { CategoryEditor } from "./category-editor";

export const metadata: Metadata = {
  title: "Categorias",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function AdminCategoriesPage() {
  const categories = await prisma.category.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });

  const withoutPrice = categories.filter(
    (category) => category.active && category.priceCents === null,
  );

  // Quantas inscrições cada categoria já tem — o organizador precisa saber
  // antes de mexer no preço.
  const counts = await prisma.registrationCategory.groupBy({
    by: ["categoryId"],
    where: { registration: { status: { in: ["PENDING", "PAID"] } } },
    _count: { _all: true },
  });
  const countByCategory = new Map(counts.map((row) => [row.categoryId, row._count._all]));

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="display-title text-3xl text-chalk sm:text-4xl">Categorias</h1>
      <p className="mt-2 text-sm text-chalk-dim">
        Defina aqui o valor de cada categoria. O preço vale para novas inscrições;
        inscrições já feitas mantêm o valor cobrado na época.
      </p>

      {withoutPrice.length > 0 && (
        <div className="mt-6">
          <Alert title={`${withoutPrice.length} categoria(s) sem preço definido`}>
            <p>
              Ninguém consegue se inscrever nestas categorias enquanto o valor não for
              informado:
            </p>
            <p className="mt-2 font-semibold">
              {withoutPrice.map((category) => category.name).join(" · ")}
            </p>
          </Alert>
        </div>
      )}

      <div className="mt-8 space-y-3">
        {categories.map((category) => (
          <Card
            key={category.id}
            className={`p-5 ${
              category.active && category.priceCents === null ? "border-race-500/60" : ""
            }`}
          >
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <h2 className="display-title text-2xl text-chalk">{category.name}</h2>
              <div className="flex items-center gap-3">
                {countByCategory.get(category.id) ? (
                  <span className="text-xs text-chalk-dim">
                    {countByCategory.get(category.id)} inscrito(s)
                  </span>
                ) : null}
                <span
                  className={`display-label text-sm ${
                    category.priceCents === null ? "text-race-400" : "text-flag-400"
                  }`}
                >
                  {category.priceCents === null
                    ? "Valor a definir"
                    : formatCents(category.priceCents)}
                </span>
              </div>
            </div>

            <CategoryEditor
              categoryId={category.id}
              // O input é preenchido em reais, como o organizador pensa no valor.
              currentPrice={
                category.priceCents === null
                  ? ""
                  : (category.priceCents / 100).toFixed(2).replace(".", ",")
              }
              active={category.active}
              description={category.description ?? ""}
            />
          </Card>
        ))}
      </div>
    </div>
  );
}
