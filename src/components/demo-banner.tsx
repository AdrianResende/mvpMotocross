import { eventConfig } from "@/config/event";

/**
 * Faixa fixa no topo enquanto o site roda com dados fictícios.
 *
 * Existe para que ninguém confunda o conteúdo de demonstração com as
 * informações reais do campeonato. Some sozinha quando o organizador troca
 * `isDemoData` para `false` em src/config/event.ts.
 */
export function DemoBanner() {
  if (!eventConfig.isDemoData) return null;

  return (
    <div className="hazard-stripes border-b border-race-500/40 bg-dirt-900">
      <p className="mx-auto max-w-5xl px-4 py-2 text-center text-xs leading-snug text-chalk sm:text-sm">
        <span className="display-label text-race-400">Dados de demonstração</span>
        <span className="mx-2 text-dirt-600">|</span>
        Datas, local, horários, categorias e preços desta página são{" "}
        <strong className="font-semibold">exemplos</strong> para teste do sistema. Não
        representam informações oficiais de nenhum campeonato.
      </p>
    </div>
  );
}
