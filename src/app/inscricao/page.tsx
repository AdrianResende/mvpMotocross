import type { Metadata } from "next";
import { eventConfig } from "@/config/event";
import { listCategoriesWithAvailability, registrationsClosed } from "@/lib/registrations";
import { RegistrationForm } from "@/components/registration-form";
import { ActionLink, Alert } from "@/components/ui";

export const metadata: Metadata = {
  title: "Inscrição",
  description: "Faça sua inscrição no campeonato em poucos passos.",
};

export const dynamic = "force-dynamic";

export default async function RegistrationPage() {
  const categories = await listCategoriesWithAvailability();
  const closed = registrationsClosed();
  const available = categories.filter((category) => !category.isFull);

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
          <code>npm run db:seed</code> ou cadastre as categorias no banco.
        </Alert>
      ) : available.length === 0 ? (
        <Alert tone="info" title="Vagas esgotadas">
          Todas as categorias estão com as vagas preenchidas.
        </Alert>
      ) : (
        <RegistrationForm categories={categories} />
      )}
    </div>
  );
}
