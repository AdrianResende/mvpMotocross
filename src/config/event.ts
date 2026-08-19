/**
 * CONFIGURAÇÃO CENTRAL DO EVENTO
 * ==============================
 *
 * Este é o único arquivo que o organizador precisa editar para mudar as
 * informações do campeonato. Nada aqui está espalhado pelas páginas.
 *
 * >>> ATENÇÃO <<<
 * Todo o conteúdo abaixo é DADO DE DEMONSTRAÇÃO. Nenhuma destas datas, locais,
 * horários, contatos ou regras corresponde a um campeonato real — foram
 * escritos apenas para o sistema poder ser testado ponta a ponta.
 *
 * Enquanto `isDemoData` for `true`, o site exibe um aviso visível em todas as
 * páginas informando que os dados são de demonstração. Troque para `false`
 * SOMENTE depois de substituir tudo pelas informações reais.
 *
 * Os PREÇOS e as CATEGORIAS não ficam aqui: eles vivem no banco de dados
 * (tabela `Category`), porque o valor cobrado precisa ser recalculado no
 * servidor e o histórico precisa ser preservado. Os valores iniciais estão em
 * `prisma/seed.ts` e podem ser alterados direto no banco.
 */

export type ScheduleItem = {
  /** Horário no formato HH:MM. */
  time: string;
  title: string;
  description?: string;
};

export type RuleSection = {
  title: string;
  items: string[];
};

export type FaqItem = {
  question: string;
  answer: string;
};

export const eventConfig = {
  /**
   * DEIXE `true` enquanto as informações abaixo forem fictícias.
   * Com `true`, um aviso de demonstração aparece no topo de todas as páginas.
   */
  isDemoData: true,

  name: "Campeonato de Motocross",
  edition: "Etapa de Demonstração",
  tagline: "Terra, velocidade e adrenalina em uma só pista.",
  description:
    "Uma etapa de motocross com largadas disputadas em todas as categorias, " +
    "da garotada da Júnior aos profissionais da MX1. Inscreva-se pela internet, " +
    "escolha quantas categorias quiser e garanta seu portão de largada antes de " +
    "chegar na pista.",

  /** Datas em formato ISO (AAAA-MM-DD). */
  date: "2026-08-22",
  /** Data-limite das inscrições online (ISO, com fuso). */
  registrationsCloseAt: "2026-08-21T23:59:59-03:00",

  gatesOpenAt: "08:00",

  venue: {
    name: "Pista de Motocross (LOCAL DE DEMONSTRAÇÃO)",
    address: "Endereço a definir",
    city: "Cidade",
    state: "UF",
    /** Deixe vazio para esconder o botão de rota. */
    mapsUrl: "",
  },

  contact: {
    /** Deixe vazio para esconder o item correspondente. */
    phone: "",
    /** Apenas dígitos com DDI, ex.: "5511999999999". Vazio esconde o WhatsApp. */
    whatsapp: "",
    email: "",
    instagram: "",
  },

  /**
   * Programação do dia. HORÁRIOS DE DEMONSTRAÇÃO — ajuste livremente.
   * Adicione ou remova itens à vontade; a página se adapta.
   */
  schedule: [
    { time: "08:00", title: "Abertura do evento", description: "Credenciamento e vistoria das motos." },
    { time: "09:00", title: "Treinos livres", description: "Reconhecimento de pista por categoria." },
    { time: "10:30", title: "Classificatória", description: "Define o portão de largada." },
    { time: "13:00", title: "Corridas", description: "Baterias válidas pelo campeonato." },
    { time: "18:00", title: "Premiação", description: "Pódio e entrega de troféus." },
  ] satisfies ScheduleItem[],

  /** Regras e informações importantes. CONTEÚDO DE DEMONSTRAÇÃO. */
  rules: [
    {
      title: "Equipamento obrigatório",
      items: [
        "Capacete, óculos, luvas, botas e protetor de coluna.",
        "Moto em conformidade com a cilindrada da categoria escolhida.",
        "Número de identificação visível nas placas dianteira e laterais.",
      ],
    },
    {
      title: "Inscrições",
      items: [
        "A inscrição só é confirmada após a confirmação do pagamento pelo gateway.",
        "Cada piloto pode se inscrever em mais de uma categoria pagando o valor de cada uma.",
        "O piloto é responsável pela veracidade dos dados informados.",
      ],
    },
    {
      title: "Conduta na pista",
      items: [
        "Bandeiras e orientações dos fiscais devem ser respeitadas integralmente.",
        "Conduta antidesportiva pode resultar em desclassificação.",
        "Menores de idade precisam de autorização do responsável na retirada da credencial.",
      ],
    },
  ] satisfies RuleSection[],

  faq: [
    {
      question: "Posso me inscrever em mais de uma categoria?",
      answer:
        "Pode. Na etapa de categorias basta marcar todas que quiser — o total é somado automaticamente e cobrado em um único pagamento.",
    },
    {
      question: "Como sei que minha inscrição foi confirmada?",
      answer:
        "A inscrição muda para PAGA apenas quando o gateway de pagamento confirma a transação. Você pode acompanhar o status a qualquer momento pelo link da sua inscrição.",
    },
    {
      question: "Quais formas de pagamento são aceitas?",
      answer:
        "PIX, com QR Code e copia-e-cola exibidos na própria página. Cartão de crédito depende da liberação do recurso na conta do organizador junto ao gateway.",
    },
  ] satisfies FaqItem[],
} as const;

export type EventConfig = typeof eventConfig;
