import type { Metadata } from "next";
import { eventConfig } from "@/config/event";
import { formatLongDate, formatDateTime } from "@/lib/format";
import { ActionLink, Card, SectionTitle } from "@/components/ui";

export const metadata: Metadata = {
  title: "O evento",
  description: eventConfig.description,
};

export default function EventPage() {
  const { venue, contact } = eventConfig;
  const hasContact = contact.phone || contact.whatsapp || contact.email || contact.instagram;

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:py-16">
      <p className="display-label text-sm text-race-500">{eventConfig.edition}</p>
      <h1 className="display-title mt-2 text-4xl text-chalk sm:text-6xl">
        {eventConfig.name}
      </h1>
      <p className="mt-5 max-w-2xl text-lg text-chalk-dim">{eventConfig.description}</p>

      {/* ---------------------------------------------------------- ESSENCIAL */}
      <Card className="mt-10 p-5 sm:p-6">
        <dl className="grid gap-5 sm:grid-cols-2">
          <Fact label="Data" value={formatLongDate(eventConfig.date)} />
          <Fact label="Abertura dos portões" value={`${eventConfig.gatesOpenAt}h`} />
          <Fact
            label="Local"
            value={
              <>
                {venue.name}
                {venue.address && (
                  <>
                    <br />
                    <span className="text-chalk-dim">{venue.address}</span>
                  </>
                )}
                {(venue.city || venue.state) && (
                  <>
                    <br />
                    <span className="text-chalk-dim">
                      {[venue.city, venue.state].filter(Boolean).join(" — ")}
                    </span>
                  </>
                )}
              </>
            }
          />
          <Fact
            label="Inscrições online até"
            value={formatDateTime(eventConfig.registrationsCloseAt)}
          />
        </dl>

        {venue.mapsUrl && (
          <a
            href={venue.mapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="display-label tap-target mt-6 inline-flex items-center justify-center border-2 border-chalk/25 px-5 text-sm text-chalk transition-colors hover:border-race-500 hover:text-race-400"
          >
            Ver rota até a pista
          </a>
        )}
      </Card>

      {/* -------------------------------------------------------- PROGRAMAÇÃO */}
      <section className="mt-14">
        <SectionTitle eyebrow="Como será o dia">Programação</SectionTitle>
        {eventConfig.isDemoData && (
          <p className="mt-4 border-l-2 border-race-500 bg-dirt-900 py-3 pl-4 text-sm text-chalk-dim">
            Os horários abaixo são <strong className="text-chalk">exemplos</strong>. O
            organizador ajusta a lista em <code className="text-race-400">src/config/event.ts</code>.
          </p>
        )}

        <ol className="mt-6 space-y-px">
          {eventConfig.schedule.map((item) => (
            <li
              key={`${item.time}-${item.title}`}
              className="flex flex-col gap-1 border-l-2 border-race-500/40 bg-dirt-900 py-4 pl-4 sm:flex-row sm:items-baseline sm:gap-6"
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
      </section>

      {/* -------------------------------------------------------------- REGRAS */}
      <section className="mt-14">
        <SectionTitle eyebrow="Leia antes de vir">Regras e informações</SectionTitle>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {eventConfig.rules.map((section) => (
            <Card key={section.title} className="p-5">
              <h3 className="display-label text-sm text-race-400">{section.title}</h3>
              <ul className="mt-3 space-y-2">
                {section.items.map((item) => (
                  <li key={item} className="flex gap-2.5 text-sm text-chalk-dim">
                    <span aria-hidden className="mt-1.5 block h-1.5 w-1.5 shrink-0 -skew-x-12 bg-race-500" />
                    {item}
                  </li>
                ))}
              </ul>
            </Card>
          ))}
        </div>
      </section>

      {/* ----------------------------------------------------------------- FAQ */}
      {eventConfig.faq.length > 0 && (
        <section className="mt-14">
          <SectionTitle eyebrow="Dúvidas comuns">Perguntas frequentes</SectionTitle>
          <div className="mt-6 space-y-px">
            {eventConfig.faq.map((item) => (
              <details key={item.question} className="group bg-dirt-900 p-5">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold text-chalk">
                  {item.question}
                  <span
                    aria-hidden
                    className="shrink-0 text-race-500 transition-transform group-open:rotate-45"
                  >
                    +
                  </span>
                </summary>
                <p className="mt-3 text-sm text-chalk-dim">{item.answer}</p>
              </details>
            ))}
          </div>
        </section>
      )}

      {/* ------------------------------------------------------------- CONTATO */}
      <section className="mt-14">
        <SectionTitle eyebrow="Fale com a organização">Contato</SectionTitle>
        <Card className="mt-6 p-5">
          {hasContact ? (
            <ul className="space-y-3 text-sm">
              {contact.phone && (
                <li>
                  <span className="display-label text-xs text-chalk-dim">Telefone</span>
                  <br />
                  <a href={`tel:${contact.phone}`} className="text-chalk hover:text-race-400">
                    {contact.phone}
                  </a>
                </li>
              )}
              {contact.whatsapp && (
                <li>
                  <span className="display-label text-xs text-chalk-dim">WhatsApp</span>
                  <br />
                  <a
                    href={`https://wa.me/${contact.whatsapp}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-chalk hover:text-race-400"
                  >
                    Abrir conversa
                  </a>
                </li>
              )}
              {contact.email && (
                <li>
                  <span className="display-label text-xs text-chalk-dim">E-mail</span>
                  <br />
                  <a href={`mailto:${contact.email}`} className="text-chalk hover:text-race-400">
                    {contact.email}
                  </a>
                </li>
              )}
              {contact.instagram && (
                <li>
                  <span className="display-label text-xs text-chalk-dim">Instagram</span>
                  <br />
                  <span className="text-chalk">{contact.instagram}</span>
                </li>
              )}
            </ul>
          ) : (
            <p className="text-sm text-chalk-dim">
              Nenhum contato cadastrado ainda. Preencha o bloco{" "}
              <code className="text-race-400">contact</code> em{" "}
              <code className="text-race-400">src/config/event.ts</code> para exibi-lo aqui.
            </p>
          )}
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
