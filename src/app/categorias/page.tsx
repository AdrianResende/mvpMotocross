import type { Metadata } from "next";
import { eventConfig } from "@/config/event";
import { formatAgeRange, formatCents } from "@/lib/format";
import { listCategoriesWithAvailability, registrationsClosed } from "@/lib/registrations";
import { ActionLink, Alert, Card, SectionTitle } from "@/components/ui";

export const metadata: Metadata = {
  title: "Categorias",
  description: "Categorias, valores e vagas disponíveis para inscrição.",
};

// A contagem de vagas precisa refletir o banco a cada visita.
export const dynamic = "force-dynamic";

export default async function CategoriesPage() {
  const categories = await listCategoriesWithAvailability();
  const closed = registrationsClosed();

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:py-16">
      <SectionTitle eyebrow="Valores e vagas">Categorias</SectionTitle>

      <p className="mt-5 max-w-2xl text-lg text-chalk-dim">
        Marque quantas categorias quiser na hora da inscrição. O total é somado
        automaticamente e cobrado em um pagamento só.
      </p>

      {eventConfig.isDemoData && (
        <div className="mt-6 max-w-2xl">
          <Alert tone="info" title="Categorias de demonstração">
            As categorias e os preços abaixo foram cadastrados apenas para testar o
            sistema. Substitua pelos dados reais antes de abrir as inscrições — veja{" "}
            <code>prisma/seed.ts</code>.
          </Alert>
        </div>
      )}

      {categories.length === 0 ? (
        <div className="mt-8 max-w-2xl">
          <Alert tone="info" title="Nenhuma categoria cadastrada">
            Rode <code>npm run db:seed</code> para carregar as categorias de exemplo, ou
            cadastre as categorias reais direto no banco.
          </Alert>
        </div>
      ) : (
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {categories.map((category) => {
            const ageRange = formatAgeRange(category.minAge, category.maxAge);

            return (
              <Card key={category.id} className="flex flex-col">
                <div className="flex items-start justify-between gap-3 border-b border-dirt-800 p-5">
                  <h2 className="display-title text-3xl text-chalk">{category.name}</h2>
                  <div className="text-right">
                    <p className="display-label text-2xl leading-none text-race-400">
                      {formatCents(category.priceCents)}
                    </p>
                    <p className="mt-1 text-xs text-chalk-dim">por piloto</p>
                  </div>
                </div>

                <div className="flex flex-1 flex-col gap-4 p-5">
                  <p className="text-sm text-chalk-dim">{category.description}</p>

                  <dl className="space-y-2 text-sm">
                    {ageRange && (
                      <div className="flex justify-between gap-4">
                        <dt className="text-chalk-dim">Idade</dt>
                        <dd className="text-right font-medium text-chalk">{ageRange}</dd>
                      </div>
                    )}
                    {category.maxPilots !== null && (
                      <div className="flex justify-between gap-4">
                        <dt className="text-chalk-dim">Vagas</dt>
                        <dd
                          className={`text-right font-medium ${
                            category.isFull ? "text-red-400" : "text-chalk"
                          }`}
                        >
                          {category.isFull
                            ? "Esgotadas"
                            : `${category.remainingSpots} de ${category.maxPilots} livres`}
                        </dd>
                      </div>
                    )}
                  </dl>

                  {category.notes && (
                    <p className="border-l-2 border-race-500/40 pl-3 text-xs text-chalk-dim">
                      {category.notes}
                    </p>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <div className="mt-12">
        {closed ? (
          <Alert tone="info" title="Inscrições encerradas">
            O prazo de inscrição online já passou. Procure a organização para saber se
            ainda há vagas na secretaria do evento.
          </Alert>
        ) : (
          <ActionLink href="/inscricao">Fazer inscrição</ActionLink>
        )}
      </div>
    </div>
  );
}
