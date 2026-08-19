import Link from "next/link";
import { eventConfig } from "@/config/event";
import { formatShortDate } from "@/lib/format";
import { WhatsAppButton } from "./whatsapp-button";

export function SiteFooter() {
  const { contact, location } = eventConfig;
  const dates = eventConfig.schedule.map((day) => formatShortDate(day.date)).join(" e ");

  return (
    <footer className="mt-16 border-t border-dirt-800 bg-dirt-900">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:grid-cols-2 lg:grid-cols-3">
        <div>
          <p className="display-title text-2xl text-chalk">{eventConfig.name}</p>
          <p className="mt-2 text-sm text-chalk-dim">{eventConfig.subtitle}</p>
          <p className="mt-4 text-sm text-chalk-dim">
            {dates}
            <br />
            {location.name} — {location.city}
          </p>
          <p className="mt-3 text-sm text-chalk-dim">
            Entrada: {eventConfig.entranceInformation}
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

        <div>
          <p className="display-label text-sm text-race-400">Contato da organização</p>
          {contact.phone && <p className="mt-3 text-sm text-chalk-dim">{contact.phone}</p>}
          {contact.email && (
            <p className="mt-2 text-sm text-chalk-dim">
              <a href={`mailto:${contact.email}`} className="hover:text-chalk">
                {contact.email}
              </a>
            </p>
          )}
          <div className="mt-4">
            <WhatsAppButton label="Falar no WhatsApp" variant="secondary" />
          </div>
        </div>
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
