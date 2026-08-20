import Image from "next/image";
import { eventConfig } from "@/config/event";
import { formatCents, formatShortDate, formatWeekday } from "@/lib/format";
import { listCategoriesWithAvailability, registrationsClosed } from "@/lib/registrations";
import { ActionLink, Card, SectionTitle } from "@/components/ui";
import { WhatsAppButton } from "@/components/whatsapp-button";

// As vagas e os preços mudam conforme o organizador configura, então a home é
// sempre renderizada sob demanda.
export const dynamic = "force-dynamic";

export default async function HomePage() {
  const categories = await listCategoriesWithAvailability();
  const closed = registrationsClosed();

  const priced = categories.filter((category) => category.priceCents !== null);
  const cheapest = priced.reduce<number | null>(
    (min, category) =>
      min === null || category.priceCents! < min ? category.priceCents! : min,
    null,
  );
  const anySelectable = categories.some((category) => category.selectable);

  return (
    <>
      {/* ---------------------------------------------------------------- HERO */}
      <section className="dirt-texture relative overflow-hidden border-b border-dirt-800">
        <div aria-hidden className="absolute inset-0">
          <Image
            src="/backMain.png"
            alt=""
            fill
            priority
            sizes="100vw"
            className="object-cover opacity-70"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-dirt-950/35 via-dirt-950/55 to-dirt-950" />
        </div>

        <div aria-hidden className="pointer-events-none absolute inset-0 opacity-40">
          <div className="absolute -top-24 -right-16 h-[140%] w-40 -skew-x-12 bg-gradient-to-b from-race-500/20 to-transparent" />
          <div className="absolute -top-24 right-24 h-[140%] w-16 -skew-x-12 bg-gradient-to-b from-race-600/15 to-transparent" />
        </div>

        <div className="relative mx-auto max-w-6xl px-4 py-16 sm:py-24">
          <p className="display-label text-sm text-race-500">{eventConfig.subtitle}</p>

          <h1 className="display-title mt-3 text-5xl text-chalk sm:text-7xl lg:text-8xl">
            Primeiro
            <br />
            Motocross
            <br />
            <span className="text-race-500">CT 147</span>
          </h1>

          <p className="mt-6 max-w-2xl text-lg text-chalk-dim sm:text-xl">
            {formatEventDates()} · {eventConfig.location.city}
          </p>

          {eventConfig.description && (
            <p className="mt-3 max-w-2xl text-base text-chalk-dim">{eventConfig.description}</p>
          )}

          {/* Entrada: informação oficial, em destaque. */}
          <div className="mt-7 inline-flex items-center gap-3 border-2 border-race-500 bg-race-500/10 px-4 py-3">
            <span className="display-label text-xs text-race-400">Entrada</span>
            <span className="display-title text-xl text-chalk">
              {eventConfig.entranceInformation}
            </span>
          </div>

          {/* Enquanto nenhuma categoria tiver preço, a inscrição não é o
              caminho — mandar o piloto para lá só o levaria a um aviso. */}
          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            {anySelectable ? (
              <>
                <ActionLink href="/inscricao" className="w-full sm:w-auto">
                  Fazer inscrição
                </ActionLink>
                <ActionLink href="/categorias" variant="secondary" className="w-full sm:w-auto">
                  Ver categorias
                </ActionLink>
              </>
            ) : (
              <>
                <ActionLink href="/categorias" className="w-full sm:w-auto">
                  Ver categorias
                </ActionLink>
                <WhatsAppButton
                  label="Falar com a organização"
                  variant="secondary"
                  message={`Olá! Gostaria de informações sobre o ${eventConfig.name}.`}
                />
              </>
            )}
          </div>

          {closed ? (
            <p className="display-label mt-6 inline-block border border-race-500/50 bg-race-500/10 px-4 py-2 text-sm text-race-400">
              Inscrições online encerradas
            </p>
          ) : (
            !anySelectable && (
              <p className="mt-6 max-w-xl border-l-2 border-race-500 pl-4 text-sm text-chalk-dim">
                As inscrições online abrem assim que a organização divulgar os valores
                de cada categoria.
              </p>
            )
          )}
        </div>
      </section>

      {/* ---------------------------------------------------- VÍDEO DE DIVULGAÇÃO */}
      <section className="border-b border-dirt-800 bg-dirt-950">
        <div className="mx-auto max-w-4xl px-4 py-14 sm:py-20">
          <SectionTitle eyebrow="Divulgação oficial">Vídeo de divulgação</SectionTitle>
          <div className="mt-6 overflow-hidden border border-dirt-800">
            <video controls playsInline className="w-full">
              <source src="/divulgacao.mp4" type="video/mp4" />
            </video>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------ INFO RÁPIDAS */}
      <section className="border-b border-dirt-800 bg-dirt-900">
        <dl className="mx-auto grid max-w-6xl grid-cols-2 gap-px bg-dirt-800 lg:grid-cols-4">
          <QuickFact label="Datas" value={formatEventDates()} />
          <QuickFact
            label="Local"
            value={`${eventConfig.location.name} — ${eventConfig.location.city}`}
          />
          <QuickFact label="Entrada" value={eventConfig.entranceInformation} />
          <QuickFact
            label="Categorias"
            value={
              cheapest === null
                ? `${categories.length} categorias`
                : `${categories.length} · a partir de ${formatCents(cheapest)}`
            }
          />
        </dl>
      </section>

      {/* --------------------------------------------------------- PROGRAMAÇÃO */}
      <section className="mx-auto max-w-6xl px-4 py-14 sm:py-20">
        <SectionTitle eyebrow="Dois dias de prova">Programação</SectionTitle>

        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {eventConfig.schedule.map((day) => (
            <Card key={day.date} className="p-5">
              <p className="display-label text-sm text-race-500">{formatWeekday(day.date)}</p>
              <p className="display-title mt-1 text-3xl text-chalk">
                {formatShortDate(day.date)}
              </p>

              <dl className="mt-5 space-y-3">
                <div className="flex items-baseline justify-between gap-4 border-b border-dirt-800 pb-3">
                  <dt className="text-sm text-chalk-dim">Evento a partir das</dt>
                  <dd className="display-title text-2xl text-chalk">{day.startTime}</dd>
                </div>
                {day.raceTime && (
                  <div className="flex items-baseline justify-between gap-4">
                    <dt className="text-sm text-chalk-dim">Corrida</dt>
                    <dd className="display-title text-2xl text-race-400">{day.raceTime}</dd>
                  </div>
                )}
              </dl>

              {day.description && (
                <p className="mt-4 text-sm text-chalk-dim">{day.description}</p>
              )}
            </Card>
          ))}
        </div>
      </section>

      {/* ----------------------------------------------------- AÇÃO ESPECIAL */}
      {eventConfig.specialEvents.length > 0 && (
        <section className="border-y border-dirt-800 bg-dirt-900">
          <div className="mx-auto max-w-6xl px-4 py-14 sm:py-20">
            <SectionTitle eyebrow="Atração do evento">Categoria Leiteiro</SectionTitle>

            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              {eventConfig.specialEvents.map((special) => (
                <div
                  key={special.title}
                  className="border-2 border-race-500 bg-race-500/10 p-6"
                >
                  <p className="display-title text-3xl text-chalk">{special.title}</p>
                  <p className="mt-2 text-chalk-dim">{special.description}</p>
                  <div className="mt-5 border-t border-race-500/40 pt-4">
                    <p className="display-label text-xs text-race-400">Prêmio</p>
                    <p className="display-title mt-1 text-2xl text-race-400">{special.prize}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* --------------------------------------------------------- CATEGORIAS */}
      <section className="mx-auto max-w-6xl px-4 py-14 sm:py-20">
        <SectionTitle eyebrow="15 categorias">Categorias</SectionTitle>
        <p className="mt-4 max-w-2xl text-chalk-dim">
          Você pode se inscrever em quantas categorias quiser — o valor total é somado
          e cobrado em um único pagamento.
        </p>

        <ul className="mt-8 flex flex-wrap gap-2">
          {categories.map((category) => (
            <li
              key={category.id}
              className="display-label border border-dirt-700 bg-dirt-900 px-3 py-2 text-sm text-chalk"
            >
              {category.name}
              {category.priceCents !== null && (
                <span className="ml-2 text-race-400">{formatCents(category.priceCents)}</span>
              )}
            </li>
          ))}
        </ul>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <ActionLink href="/categorias" variant="secondary" className="w-full sm:w-auto">
            Ver valores e detalhes
          </ActionLink>
          {anySelectable && (
            <ActionLink href="/inscricao" className="w-full sm:w-auto">
              Fazer inscrição
            </ActionLink>
          )}
        </div>
      </section>

      {/* --------------------------------------------------------- HOSPEDAGEM */}
      <section className="border-y border-dirt-800 bg-dirt-900">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:py-20">
          <SectionTitle eyebrow="Para quem vem de longe">Hospedagem no local</SectionTitle>
          <p className="mt-4 max-w-2xl text-lg text-chalk-dim">
            {eventConfig.accommodationInformation}
          </p>
          <p className="mt-2 max-w-2xl text-sm text-dirt-600">
            Valores, vagas e condições de reserva devem ser combinados diretamente com a
            organização.
          </p>
          <div className="mt-7">
            <WhatsAppButton label="Entrar em contato" />
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
          {anySelectable
            ? "Inscrição pela internet, pagamento por PIX na hora e confirmação automática."
            : "As inscrições online abrem assim que os valores forem divulgados. Fale com a organização para tirar dúvidas."}
        </p>
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          {anySelectable && <ActionLink href="/inscricao">Fazer inscrição</ActionLink>}
          <WhatsAppButton
            label="Falar com a organização"
            variant={anySelectable ? "secondary" : "primary"}
          />
        </div>
      </section>
    </>
  );
}

/** "22 e 23/08/2026" — ou apenas a data, se o evento tiver um único dia. */
function formatEventDates(): string {
  const days = eventConfig.schedule;
  if (days.length === 1) return formatShortDate(days[0].date);

  const first = new Date(`${days[0].date}T12:00:00-03:00`);
  const last = formatShortDate(days[days.length - 1].date);
  return `${String(first.getDate()).padStart(2, "0")} e ${last}`;
}

function QuickFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-dirt-900 px-4 py-5">
      <dt className="display-label text-xs text-race-500">{label}</dt>
      <dd className="mt-1.5 text-sm font-semibold text-chalk">{value}</dd>
    </div>
  );
}
