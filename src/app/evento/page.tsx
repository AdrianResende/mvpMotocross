import type { Metadata } from "next";
import Image from "next/image";
import { eventConfig } from "@/config/event";
import { formatDateTime, formatShortDate, formatWeekday } from "@/lib/format";
import { ActionLink, Card, SectionTitle } from "@/components/ui";
import { WhatsAppButton } from "@/components/whatsapp-button";

export const metadata: Metadata = {
  title: "O evento",
  description: `${eventConfig.name} — ${eventConfig.location.name}, ${eventConfig.location.city}.`,
};

export default function EventPage() {
  const { location, contact } = eventConfig;

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:py-16">
      <p className="display-label text-sm text-race-500">{eventConfig.subtitle}</p>
      <h1 className="display-title mt-2 text-4xl text-chalk sm:text-6xl">
        {eventConfig.name}
      </h1>

      {eventConfig.description && (
        <p className="mt-5 max-w-2xl text-lg text-chalk-dim">{eventConfig.description}</p>
      )}

      {/* ---------------------------------------------------------- ESSENCIAL */}
      <Card className="mt-8 p-5 sm:p-6">
        <dl className="grid gap-5 sm:grid-cols-2">
          <Fact
            label="Local"
            value={
              <>
                {location.name}
                <br />
                <span className="text-chalk-dim">
                  {location.city}
                  {location.state && ` — ${location.state}`}
                </span>
                {/* Endereço completo aparece automaticamente quando a
                    organização informar. Até lá, só o local oficial. */}
                {location.address && (
                  <>
                    <br />
                    <span className="text-chalk-dim">{location.address}</span>
                  </>
                )}
              </>
            }
          />
          <Fact label="Entrada" value={eventConfig.entranceInformation} />
          <Fact
            label="Datas"
            value={eventConfig.schedule
              .map((day) => `${formatWeekday(day.date)}, ${formatShortDate(day.date)}`)
              .join(" · ")}
          />
          {eventConfig.registrationsCloseAt && (
            <Fact
              label="Inscrições online até"
              value={formatDateTime(eventConfig.registrationsCloseAt)}
            />
          )}
        </dl>

        {location.mapsUrl && (
          <a
            href={location.mapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="display-label tap-target mt-6 inline-flex items-center justify-center border-2 border-chalk/25 px-5 text-sm text-chalk transition-colors hover:border-race-500 hover:text-race-400"
          >
            Ver rota até a pista
          </a>
        )}
      </Card>

      {/* ------------------------------------------------------------- A PISTA */}
      <section className="mt-14">
        <SectionTitle eyebrow="Pista de cara nova!">Conheça a pista</SectionTitle>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <div className="relative aspect-[3/4] overflow-hidden border border-dirt-800">
            <Image
              src="/pista-1.jpg"
              alt={`Vista da pista do ${eventConfig.name}`}
              fill
              sizes="(min-width: 640px) 50vw, 100vw"
              className="object-cover"
            />
          </div>
          <div className="relative aspect-[3/4] overflow-hidden border border-dirt-800">
            <Image
              src="/pista-2.jpg"
              alt={`Vista da pista do ${eventConfig.name}`}
              fill
              sizes="(min-width: 640px) 50vw, 100vw"
              className="object-cover"
            />
          </div>
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="overflow-hidden border border-dirt-800">
            <video controls playsInline poster="/pista-1.jpg" className="w-full">
              <source src="/pista-video.mp4" type="video/mp4" />
            </video>
          </div>
          <div className="overflow-hidden border border-dirt-800">
            <video controls playsInline poster="/pista-2.jpg" className="w-full">
              <source src="/pistaVideo.mp4" type="video/mp4" />
            </video>
          </div>
        </div>
      </section>

      {/* -------------------------------------------------------- PROGRAMAÇÃO */}
      <section className="mt-14">
        <SectionTitle eyebrow="Dois dias de prova">Programação</SectionTitle>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
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

        {/* Honestidade: a programação tem só o que a organização informou. */}
        <p className="mt-4 border-l-2 border-dirt-700 pl-4 text-sm text-dirt-600">
          Estes são os horários informados pela organização. Demais horários do dia serão
          divulgados pela organização.
        </p>
      </section>

      {/* ----------------------------------------------------- AÇÃO ESPECIAL */}
      {eventConfig.specialEvents.length > 0 && (
        <section className="mt-14">
          <SectionTitle eyebrow="Atração do evento">Categoria Leiteiro</SectionTitle>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {eventConfig.specialEvents.map((special) => (
              <div key={special.title} className="border-2 border-race-500 bg-race-500/10 p-6">
                <p className="display-title text-3xl text-chalk">{special.title}</p>
                <p className="mt-2 text-chalk-dim">{special.description}</p>
                <div className="mt-5 border-t border-race-500/40 pt-4">
                  <p className="display-label text-xs text-race-400">Prêmio</p>
                  <p className="display-title mt-1 text-2xl text-race-400">{special.prize}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* --------------------------------------------------------- HOSPEDAGEM */}
      <section className="mt-14">
        <SectionTitle eyebrow="Para quem vem de longe">Hospedagem no local</SectionTitle>
        <Card className="mt-6 p-5 sm:p-6">
          <p className="text-lg text-chalk">{eventConfig.accommodationInformation}</p>
          <p className="mt-3 text-sm text-chalk-dim">
            Valores, número de vagas, estrutura, horários e condições de reserva devem ser
            combinados diretamente com a organização.
          </p>
          <div className="mt-6">
            <WhatsAppButton
              label="Entrar em contato"
              message={`Olá! Gostaria de informações sobre a hospedagem no ${eventConfig.name}.`}
            />
          </div>
        </Card>
      </section>

      {/* -------------------------------------------------------------- REGRAS */}
      {eventConfig.rules.length > 0 && (
        <section className="mt-14">
          <SectionTitle eyebrow="Leia antes de vir">Regras e informações</SectionTitle>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {eventConfig.rules.map((section) => (
              <Card key={section.title} className="p-5">
                <h3 className="display-label text-sm text-race-400">{section.title}</h3>
                <ul className="mt-3 space-y-2">
                  {section.items.map((item) => (
                    <li key={item} className="flex gap-2.5 text-sm text-chalk-dim">
                      <span
                        aria-hidden
                        className="mt-1.5 block h-1.5 w-1.5 shrink-0 -skew-x-12 bg-race-500"
                      />
                      {item}
                    </li>
                  ))}
                </ul>
              </Card>
            ))}
          </div>
        </section>
      )}

      {/* ------------------------------------------------------------- CONTATO */}
      <section className="mt-14">
        <SectionTitle eyebrow="Dúvidas sobre o evento">Contato</SectionTitle>
        <Card className="mt-6 p-5 sm:p-6">
          {contact.phone && (
            <div>
              <p className="display-label text-xs text-race-500">Telefone / WhatsApp</p>
              <p className="display-title mt-1 text-3xl text-chalk">{contact.phone}</p>
            </div>
          )}

          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <WhatsAppButton label="Falar com a organização" />
            {contact.phone && (
              <a
                href={`tel:+${eventConfig.contact.whatsapp}`}
                className="display-label tap-target inline-flex -skew-x-12 items-center justify-center border-2 border-chalk/25 px-6 text-sm text-chalk transition-colors hover:border-race-500 hover:text-race-400"
              >
                <span className="skew-x-12">Ligar</span>
              </a>
            )}
          </div>
        </Card>
      </section>

      <div className="mt-12 flex flex-col gap-3 sm:flex-row">
        <ActionLink href="/inscricao" className="w-full sm:w-auto">
          Fazer inscrição
        </ActionLink>
        <ActionLink href="/categorias" variant="secondary" className="w-full sm:w-auto">
          Ver categorias
        </ActionLink>
      </div>
    </div>
  );
}

function Fact({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="display-label text-xs text-race-500">{label}</dt>
      <dd className="mt-1.5 font-semibold text-chalk">{value}</dd>
    </div>
  );
}
