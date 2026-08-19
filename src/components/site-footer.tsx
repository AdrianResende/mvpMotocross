import Link from "next/link";
import { eventConfig } from "@/config/event";
import { formatLongDate } from "@/lib/format";

export function SiteFooter() {
  const { contact, venue } = eventConfig;
  const hasContact = contact.phone || contact.whatsapp || contact.email || contact.instagram;

  return (
    <footer className="mt-16 border-t border-dirt-800 bg-dirt-900">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:grid-cols-2 lg:grid-cols-3">
        <div>
          <p className="display-title text-2xl text-chalk">{eventConfig.name}</p>
          <p className="mt-2 text-sm text-chalk-dim">{eventConfig.edition}</p>
          <p className="mt-4 text-sm text-chalk-dim">
            {formatLongDate(eventConfig.date)}
            <br />
            {venue.name}
          </p>
        </div>

        <div>
          <p className="display-label text-sm text-race-400">Navegação</p>
          <ul className="mt-3 space-y-2 text-sm">
            <li>
              <Link href="/evento" className="text-chalk-dim hover:text-chalk">
                Informações do evento
              </Link>
            </li>
            <li>
              <Link href="/categorias" className="text-chalk-dim hover:text-chalk">
                Categorias e valores
              </Link>
            </li>
            <li>
              <Link href="/inscricao" className="text-chalk-dim hover:text-chalk">
                Fazer inscrição
              </Link>
            </li>
            <li>
              <Link href="/admin" className="text-chalk-dim hover:text-chalk">
                Área do organizador
              </Link>
            </li>
          </ul>
        </div>

        {hasContact ? (
          <div>
            <p className="display-label text-sm text-race-400">Contato da organização</p>
            <ul className="mt-3 space-y-2 text-sm text-chalk-dim">
              {contact.phone && <li>{contact.phone}</li>}
              {contact.whatsapp && (
                <li>
                  <a
                    href={`https://wa.me/${contact.whatsapp}`}
                    className="hover:text-chalk"
                    rel="noopener noreferrer"
                    target="_blank"
                  >
                    WhatsApp
                  </a>
                </li>
              )}
              {contact.email && (
                <li>
                  <a href={`mailto:${contact.email}`} className="hover:text-chalk">
                    {contact.email}
                  </a>
                </li>
              )}
              {contact.instagram && <li>{contact.instagram}</li>}
            </ul>
          </div>
        ) : (
          <div>
            <p className="display-label text-sm text-race-400">Contato da organização</p>
            <p className="mt-3 text-sm text-chalk-dim">
              Contatos ainda não cadastrados. Preencha o bloco{" "}
              <code className="text-race-400">contact</code> em{" "}
              <code className="text-race-400">src/config/event.ts</code>.
            </p>
          </div>
        )}
      </div>

      <div className="border-t border-dirt-800 px-4 py-4">
        <p className="mx-auto max-w-6xl text-xs text-dirt-600">
          Pagamentos processados pela AbacatePay. Nenhum dado de cartão trafega ou é
          armazenado por este site.
        </p>
      </div>
    </footer>
  );
}
