/**
 * CONFIGURAÇÃO CENTRAL DO EVENTO
 * ==============================
 *
 * Único arquivo que o organizador edita para mudar as informações do evento.
 * Nada aqui está repetido nas páginas.
 *
 *
 * REGRA DE VERACIDADE DESTE ARQUIVO
 * ---------------------------------
 * Todo campo preenchido abaixo veio do material oficial da organização.
 *
 * Campos que a organização ainda NÃO informou ficam `null` ou vazios — nunca
 * preenchidos por conta própria. O site sabe distinguir os dois casos: o que
 * está aqui é exibido como informação oficial; o que está `null` simplesmente
 * não aparece, ou aparece marcado como pendente de configuração.
 *
 * Nunca preencha um campo "para não ficar vazio". Um campo vazio é uma
 * informação honesta; um campo inventado, não.
 *
 * PREÇOS NÃO FICAM AQUI. Eles vivem no banco (tabela `Category`) porque o
 * valor cobrado é recalculado no servidor e o histórico precisa ser
 * preservado. O organizador define os preços em /admin/categorias.
 */

export type ScheduleDay = {
  /** Data no formato ISO (AAAA-MM-DD). */
  date: string;
  /** Horário de início do dia (HH:MM). */
  startTime: string;
  /** Horário da corrida (HH:MM). `null` se a organização não informou. */
  raceTime: string | null;
  /** Observação opcional sobre o dia. */
  description: string | null;
};

export type SpecialEvent = {
  title: string;
  description: string;
  /** Premiação, exatamente como informada pela organização. */
  prize: string;
};

export const eventConfig = {
  // ------------------------------------------------------------- IDENTIDADE
  name: "Primeiro Motocross CT 147",
  subtitle: "Pista de cara nova!",

  /**
   * Texto de apresentação do evento.
   *
   * `null` porque a organização não forneceu um texto descritivo. As páginas
   * se ajustam sozinhas quando este campo está vazio.
   */
  description: null as string | null,

  // ------------------------------------------------------------ LOCALIZAÇÃO
  location: {
    /** Local exatamente como informado pela organização. */
    name: "Povoado da Invernada",
    city: "Coronel Xavier Chaves",
    /** UF não informada pela organização. */
    state: null as string | null,

    /** Endereço completo não informado pela organização. */
    address: null as string | null,
    latitude: -21.028347 as number | null,
    longitude: -44.266558 as number | null,
    mapsUrl: "https://www.google.com/maps?q=-21.028347,-44.266558" as string | null,
  },

  // ------------------------------------------------------------ PROGRAMAÇÃO
  /**
   * Programação oficial. Contém EXATAMENTE os horários informados pela
   * organização — nenhum treino, classificatória, abertura ou premiação foi
   * acrescentado.
   */
  schedule: [
    {
      date: "2026-08-22",
      startTime: "10:00",
      raceTime: "14:00",
      description: null,
    },
    {
      date: "2026-08-23",
      startTime: "09:00",
      raceTime: "12:00",
      description: null,
    },
  ] satisfies ScheduleDay[],

  /**
   * Prazo final das inscrições online.
   *
   * `null` porque a organização não informou uma data-limite. Com `null`, as
   * inscrições seguem abertas e nenhum prazo é exibido. Para definir um prazo,
   * use uma data ISO com fuso, por exemplo: "2026-08-21T23:59:59-03:00".
   */
  registrationsCloseAt: null as string | null,

  // ---------------------------------------------------------------- ENTRADA
  /** Informação oficial de entrada no evento. */
  entranceInformation: "1 kg de alimento",

  // -------------------------------------------------------------- HOSPEDAGEM
  accommodationInformation: "Há reservas para hospedagem no local.",

  // ----------------------------------------------------------------- CONTATO
  contact: {
    /** Telefone/WhatsApp oficial. */
    phone: "(32) 99999-6803",
    /** Mesmo número em formato internacional, para o link do WhatsApp. */
    whatsapp: "5532999996803",
    /** Não informados pela organização. */
    email: null as string | null,
    instagram: null as string | null,
  },

  // --------------------------------------------------------- AÇÕES ESPECIAIS
  specialEvents: [
    {
      title: "Categoria Leiteiro",
      description: "Melhor fantasia leva o prêmio.",
      prize: "Kit churrasco + cerveja",
    },
  ] satisfies SpecialEvent[],

  /**
   * Regras do evento.
   *
   * Vazio: a organização não forneceu regulamento. A seção de regras só
   * aparece no site quando houver conteúdo aqui.
   */
  rules: [] as Array<{ title: string; items: string[] }>,
} as const;

export type EventConfig = typeof eventConfig;

/** Primeiro dia do evento, usado para datas de referência. */
export function firstEventDate(): string {
  return eventConfig.schedule[0].date;
}

/** Último dia do evento. */
export function lastEventDate(): string {
  return eventConfig.schedule[eventConfig.schedule.length - 1].date;
}
