import "server-only";

/**
 * Acesso às variáveis de ambiente do servidor.
 *
 * Nenhuma delas tem prefixo `NEXT_PUBLIC_`, portanto o bundler nunca as inclui
 * no JavaScript enviado ao navegador. O import de `server-only` garante um erro
 * de build caso este módulo seja importado por engano de um Client Component.
 */

function optional(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value ? value : undefined;
}

function required(name: string): string {
  const value = optional(name);
  if (!value) {
    throw new Error(
      `Variável de ambiente ausente: ${name}. Veja .env.example para a lista completa.`,
    );
  }
  return value;
}

export const serverEnv = {
  get databaseUrl() {
    return required("DATABASE_URL");
  },

  /** URL pública do site, sem barra final. */
  get appBaseUrl() {
    return (optional("APP_BASE_URL") ?? "http://localhost:3000").replace(/\/+$/, "");
  },

  // Legado da integração com a AbacatePay — mantidas porque o cliente em
  // `abacatepay.ts` continua no repositório, mas nada em `payments.ts` as usa
  // mais. Veja README para religar, se um dia fizer sentido.
  get abacatePayApiKey() {
    return optional("ABACATEPAY_API_KEY");
  },

  get abacatePayWebhookSecret() {
    return optional("ABACATEPAY_WEBHOOK_SECRET");
  },

  /** Vazio = validação por assinatura HMAC desligada. */
  get abacatePayWebhookSigningSecret() {
    return optional("ABACATEPAY_WEBHOOK_SIGNING_SECRET");
  },

  get abacatePayWebhookSignatureHeader() {
    return (optional("ABACATEPAY_WEBHOOK_SIGNATURE_HEADER") ?? "x-webhook-signature").toLowerCase();
  },

  /** Sua InfiniteTag, sem "@" ou "$". É o identificador da sua conta — não é secreta. */
  get infinitePayHandle() {
    return optional("INFINITEPAY_HANDLE");
  },

  /** Opcional: só necessário se a sua conta exigir Bearer token para consultar status. */
  get infinitePayApiToken() {
    return optional("INFINITEPAY_API_TOKEN");
  },

  /**
   * Segredo que nós mesmos definimos e embutimos na `webhook_url` enviada à
   * InfinitePay na criação do link — ela não tem assinatura própria de
   * webhook, então este é quem impede chamadas aleatórias ao endpoint.
   */
  get infinitePayWebhookSecret() {
    return optional("INFINITEPAY_WEBHOOK_SECRET");
  },

  get adminEmail() {
    return optional("ADMIN_EMAIL");
  },

  get adminPassword() {
    return optional("ADMIN_PASSWORD");
  },

  get adminSessionSecret() {
    return optional("ADMIN_SESSION_SECRET");
  },
} as const;

/**
 * O gateway só está utilizável quando há uma InfiniteTag configurada.
 * Sem ela o site continua funcionando (inscrições são criadas normalmente),
 * mas a tela de pagamento informa explicitamente que falta configuração —
 * em vez de fingir que uma cobrança foi gerada.
 */
export function isPaymentGatewayConfigured(): boolean {
  return Boolean(serverEnv.infinitePayHandle);
}

/** O painel admin exige as três variáveis para poder abrir sessão. */
export function isAdminConfigured(): boolean {
  return Boolean(serverEnv.adminEmail && serverEnv.adminPassword && serverEnv.adminSessionSecret);
}
