import type { Metadata } from "next";
import { eventConfig } from "@/config/event";
import { listCategoriesWithAvailability, registrationsClosed } from "@/lib/registrations";
import { RegistrationForm } from "@/components/registration-form";
import { ActionLink, Alert } from "@/components/ui";
import { WhatsAppButton } from "@/components/whatsapp-button";

export const metadata: Metadata = {
  title: "Inscrição",
  description: "Faça sua inscrição no campeonato em poucos passos.",
};

export const dynamic = "force-dynamic";

export default async function RegistrationPage() {
  const categories = await listCategoriesWithAvailability();
  const closed = registrationsClosed();
  const selectable = categories.filter((category) => category.selectable);
  const allWithoutPrice =
    categories.length > 0 && categories.every((category) => category.priceMissing);

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:py-14">
      <p className="display-label text-sm text-race-500">{eventConfig.name}</p>
      <h1 className="display-title mt-2 mb-8 text-4xl text-chalk sm:text-5xl">Inscrição</h1>

      {closed ? (
        <div className="space-y-6">
          <Alert tone="info" title="Inscrições encerradas">
            O prazo de inscrição online já passou. Procure a organização do evento para
            saber se ainda há vagas na secretaria.
          </Alert>
          <ActionLink href="/evento" variant="secondary">
            Ver contato da organização
          </ActionLink>
        </div>
      ) : categories.length === 0 ? (
        <Alert tone="info" title="Nenhuma categoria cadastrada">
          Não há categorias disponíveis no momento. Se você é o organizador, rode{" "}
          <code>npm run db:seed</code> para carregar as categorias oficiais.
        </Alert>
      ) : allWithoutPrice ? (
        <div className="space-y-6">
          <Alert tone="info" title="Inscrições ainda não abertas">
            A organização ainda não divulgou os valores das inscrições. Como não é
            possível cobrar sem um valor definido, as inscrições online abrem assim que
            os preços forem informados.
          </Alert>
          <WhatsAppButton
            label="Falar com a organização"
            message={`Olá! Gostaria de saber quando abrem as inscrições do ${eventConfig.name}.`}
          />
        </div>
      ) : selectable.length === 0 ? (
        <div className="space-y-6">
          <Alert tone="info" title="Sem categorias disponíveis">
            No momento nenhuma categoria está aberta para inscrição — as vagas estão
            preenchidas ou os valores ainda não foram divulgados.
          </Alert>
          <WhatsAppButton label="Falar com a organização" />
        </div>
      ) : (
        <RegistrationForm categories={categories} />
      )}
    </div>
  );
}
