import type { Metadata } from "next";
import { formatAgeRange, formatCents } from "@/lib/format";
import { listCategoriesWithAvailability, registrationsClosed } from "@/lib/registrations";
import { ActionLink, Alert, Card, SectionTitle } from "@/components/ui";
import { WhatsAppButton } from "@/components/whatsapp-button";

export const metadata: Metadata = {
  title: "Categorias",
  description: "Categorias oficiais e valores de inscrição.",
};

export const dynamic = "force-dynamic";

export default async function CategoriesPage() {
  const categories = await listCategoriesWithAvailability();
  const closed = registrationsClosed();

  const withoutPrice = categories.filter((category) => category.priceMissing);
  const anySelectable = categories.some((category) => category.selectable);

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:py-16">
      <SectionTitle eyebrow="Categorias oficiais">Categorias</SectionTitle>

      <p className="mt-5 max-w-2xl text-lg text-chalk-dim">
        Marque quantas categorias quiser na hora da inscrição. O total é somado
        automaticamente e cobrado em um pagamento só.
      </p>

      {/* Aviso honesto: preço ausente NÃO é preço zero. */}
      {withoutPrice.length > 0 && (
        <div className="mt-6 max-w-2xl">
          <Alert tone="info" title="Valores ainda não divulgados">
            {withoutPrice.length === categories.length ? (
              <>
                A organização ainda não divulgou os valores de inscrição. Assim que os
                preços forem informados, eles aparecem aqui e as inscrições abrem.
              </>
            ) : (
              <>
                {withoutPrice.length} categoria{withoutPrice.length > 1 ? "s" : ""} ainda
                está{withoutPrice.length > 1 ? "ão" : ""} com o valor a definir e não
                aceita{withoutPrice.length > 1 ? "m" : ""} inscrição por enquanto. As
                demais estão liberadas.
              </>
            )}
          </Alert>
        </div>
      )}

      {categories.length === 0 ? (
        <div className="mt-8 max-w-2xl">
          <Alert tone="info" title="Nenhuma categoria cadastrada">
            Se você é o organizador, rode <code>npm run db:seed</code> para carregar as
            categorias oficiais.
          </Alert>
        </div>
      ) : (
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {categories.map((category) => {
            const ageRange = formatAgeRange(category.minAge, category.maxAge);

            return (
              <Card
                key={category.id}
                className={`flex flex-col ${category.priceMissing ? "border-dashed" : ""}`}
              >
                <div className="flex items-start justify-between gap-3 border-b border-dirt-800 p-5">
                  <h2 className="display-title text-3xl text-chalk">{category.name}</h2>
                  <div className="shrink-0 text-right">
                    {category.priceCents === null ? (
                      <>
                        <p className="display-label text-sm leading-tight text-chalk-dim">
                          Valor
                          <br />a definir
                        </p>
                      </>
                    ) : (
                      <>
                        <p className="display-label text-2xl leading-none text-race-400">
                          {formatCents(category.priceCents)}
                        </p>
                        <p className="mt-1 text-xs text-chalk-dim">por piloto</p>
                      </>
                    )}
                  </div>
                </div>

                <div className="flex flex-1 flex-col gap-4 p-5">
                  {category.description && (
                    <p className="text-sm text-chalk-dim">{category.description}</p>
                  )}

                  {(ageRange || category.maxPilots !== null) && (
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
                  )}

                  {category.notes && (
                    <p className="border-l-2 border-race-500/40 pl-3 text-xs text-chalk-dim">
                      {category.notes}
                    </p>
                  )}

                  {category.priceMissing && (
                    <p className="mt-auto text-xs text-dirt-600">
                      Inscrições abrem quando a organização divulgar o valor.
                    </p>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <div className="mt-12 flex flex-col gap-3 sm:flex-row">
        {closed ? (
          <Alert tone="info" title="Inscrições encerradas">
            O prazo de inscrição online já passou. Fale com a organização para saber se
            ainda há vagas.
          </Alert>
        ) : anySelectable ? (
          <ActionLink href="/inscricao" className="w-full sm:w-auto">
            Fazer inscrição
          </ActionLink>
        ) : (
          <WhatsAppButton
            label="Consultar valores"
            message="Olá! Gostaria de saber os valores das inscrições."
          />
        )}
      </div>
    </div>
  );
}
