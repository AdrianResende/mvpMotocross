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

  /**
   * Habilita o botão de cartão de crédito na tela de pagamento.
   *
   * Desligado por padrão: `CARD` é marcado como recurso em BETA na
   * documentação da AbacatePay e depende de liberação na conta do organizador.
   * Ligue apenas depois de confirmar no painel que o método está ativo.
   */
  get abacatePayCardEnabled() {
    return optional("ABACATEPAY_CARD_ENABLED") === "true";
  },

  get adminPassword() {
    return optional("ADMIN_PASSWORD");
  },

  get adminSessionSecret() {
    return optional("ADMIN_SESSION_SECRET");
  },
} as const;

/**
 * O gateway só está utilizável quando há uma chave de API configurada.
 * Sem ela o site continua funcionando (inscrições são criadas normalmente),
 * mas a tela de pagamento informa explicitamente que falta configuração —
 * em vez de fingir que uma cobrança foi gerada.
 */
export function isPaymentGatewayConfigured(): boolean {
  return Boolean(serverEnv.abacatePayApiKey);
}

/** O painel admin exige as duas variáveis para poder abrir sessão. */
export function isAdminConfigured(): boolean {
  return Boolean(serverEnv.adminPassword && serverEnv.adminSessionSecret);
}
