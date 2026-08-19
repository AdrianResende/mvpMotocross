import { eventConfig } from "@/config/event";
import { formatCents, formatLongDate, formatShortDate } from "@/lib/format";
import { listCategoriesWithAvailability, registrationsClosed } from "@/lib/registrations";
import { ActionLink, Card, SectionTitle } from "@/components/ui";

// As vagas restantes mudam a cada inscrição, então a home é sempre renderizada
// sob demanda em vez de virar HTML estático no build.
export const dynamic = "force-dynamic";

export default async function HomePage() {
  const categories = await listCategoriesWithAvailability();
  const closed = registrationsClosed();

  const cheapest = categories.reduce<number | null>(
    (min, category) => (min === null || category.priceCents < min ? category.priceCents : min),
    null,
  );

  return (
    <>
      {/* ---------------------------------------------------------------- HERO */}
      <section className="dirt-texture relative overflow-hidden border-b border-dirt-800">
        {/* Rastros diagonais evocando marcas de pneu na terra. */}
        <div aria-hidden className="pointer-events-none absolute inset-0 opacity-40">
          <div className="absolute -top-24 -right-16 h-[140%] w-40 -skew-x-12 bg-gradient-to-b from-race-500/20 to-transparent" />
          <div className="absolute -top-24 right-24 h-[140%] w-16 -skew-x-12 bg-gradient-to-b from-race-600/15 to-transparent" />
        </div>

        <div className="relative mx-auto max-w-6xl px-4 py-16 sm:py-24">
          <p className="display-label text-sm text-race-500">{eventConfig.edition}</p>

          <h1 className="display-title mt-3 text-5xl text-chalk sm:text-7xl lg:text-8xl">
            Campeonato
            <br />
            <span className="text-race-500">de Motocross</span>
          </h1>

          <p className="mt-6 max-w-2xl text-lg text-chalk-dim sm:text-xl">
            {eventConfig.tagline}
          </p>
          <p className="mt-3 max-w-2xl text-base text-chalk-dim">{eventConfig.description}</p>

          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <ActionLink href="/inscricao" className="w-full sm:w-auto">
              Fazer inscrição
            </ActionLink>
            <ActionLink href="/categorias" variant="secondary" className="w-full sm:w-auto">
              Ver categorias
            </ActionLink>
          </div>

          {closed && (
            <p className="display-label mt-6 inline-block border border-race-500/50 bg-race-500/10 px-4 py-2 text-sm text-race-400">
              Inscrições online encerradas
            </p>
          )}
        </div>
      </section>

      {/* ------------------------------------------------------ INFO RÁPIDAS */}
      <section className="border-b border-dirt-800 bg-dirt-900">
        <dl className="mx-auto grid max-w-6xl grid-cols-2 gap-px bg-dirt-800 lg:grid-cols-5">
          <QuickFact label="Data" value={formatShortDate(eventConfig.date)} />
          <QuickFact label="Local" value={eventConfig.venue.name} />
          <QuickFact label="Portões abrem" value={eventConfig.gatesOpenAt} />
          <QuickFact
            label="Inscrições até"
            value={formatShortDate(eventConfig.registrationsCloseAt)}
          />
          <QuickFact
            label="Categorias"
            value={
              cheapest === null
                ? `${categories.length}`
                : `${categories.length} · a partir de ${formatCents(cheapest)}`
            }
            className="col-span-2 lg:col-span-1"
          />
        </dl>
      </section>

      {/* --------------------------------------------------------- CATEGORIAS */}
      <section className="mx-auto max-w-6xl px-4 py-14 sm:py-20">
        <SectionTitle eyebrow="Escolha a sua">Categorias</SectionTitle>
        <p className="mt-4 max-w-2xl text-chalk-dim">
          Você pode se inscrever em quantas categorias quiser — o valor total é somado
          e cobrado em um único pagamento.
        </p>

        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {categories.slice(0, 6).map((category) => (
            <Card key={category.id} className="flex flex-col p-5">
              <div className="flex items-start justify-between gap-3">
                <h3 className="display-title text-2xl text-chalk">{category.name}</h3>
                <span className="display-label shrink-0 text-lg text-race-400">
                  {formatCents(category.priceCents)}
                </span>
              </div>
              <p className="mt-2 flex-1 text-sm text-chalk-dim">{category.description}</p>
              {category.isFull && (
                <p className="display-label mt-3 text-xs text-red-400">Vagas esgotadas</p>
              )}
            </Card>
          ))}
        </div>

        <div className="mt-8">
          <ActionLink href="/categorias" variant="secondary">
            Ver todas as categorias
          </ActionLink>
        </div>
      </section>

      {/* --------------------------------------------------------- PROGRAMAÇÃO */}
      <section className="border-y border-dirt-800 bg-dirt-900">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:py-20">
          <SectionTitle eyebrow={formatLongDate(eventConfig.date)}>
            Programação
          </SectionTitle>

          <ol className="mt-8 space-y-px">
            {eventConfig.schedule.map((item) => (
              <li
                key={`${item.time}-${item.title}`}
                className="flex flex-col gap-1 border-l-2 border-race-500/40 bg-dirt-850 py-3 pl-4 sm:flex-row sm:items-baseline sm:gap-6"
              >
                <span className="display-label w-16 shrink-0 text-lg text-race-400">
                  {item.time}
                </span>
                <span className="font-semibold text-chalk">{item.title}</span>
                {item.description && (
                  <span className="text-sm text-chalk-dim sm:ml-auto sm:text-right">
                    {item.description}
                  </span>
                )}
              </li>
            ))}
          </ol>

          <div className="mt-8">
            <ActionLink href="/evento" variant="secondary">
              Informações completas
            </ActionLink>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------- CHAMADA */}
      <section className="mx-auto max-w-6xl px-4 py-16 text-center sm:py-24">
        <h2 className="display-title text-4xl text-chalk sm:text-6xl">
          Garanta seu portão
          <br />
          <span className="text-race-500">de largada</span>
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-chalk-dim">
          Inscrição pela internet, pagamento por PIX na hora e confirmação automática.
          Sem fila na secretaria no dia da prova.
        </p>
        <div className="mt-8 flex justify-center">
          <ActionLink href="/inscricao">Fazer inscrição</ActionLink>
        </div>
      </section>
    </>
  );
}

function QuickFact({
  label,
  value,
  className = "",
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div className={`bg-dirt-900 px-4 py-5 ${className}`}>
      <dt className="display-label text-xs text-race-500">{label}</dt>
      <dd className="mt-1.5 text-sm font-semibold text-chalk">{value}</dd>
    </div>
  );
}
