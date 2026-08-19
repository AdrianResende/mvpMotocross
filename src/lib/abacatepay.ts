import "server-only";
import { serverEnv } from "./env";

/**
 * Cliente HTTP da AbacatePay (API v1).
 * =====================================
 *
 * Tudo aqui foi escrito a partir das definições de tipos publicadas nos pacotes
 * OFICIAIS da AbacatePay no npm — `@abacatepay/types` e `@abacatepay/rest`.
 * Nenhum endpoint, campo ou status abaixo foi inventado.
 *
 * Confirmado nesses pacotes:
 *   - Base URL .......... https://api.abacatepay.com/v1
 *   - Autenticação ...... header `Authorization: Bearer <secret>`
 *   - Valores ........... sempre em CENTAVOS, mínimo 100 (R$ 1,00)
 *   - Envelope .......... toda resposta é `{ data, error }`
 *
 * Endpoints usados:
 *   POST /billing/create              -> checkout hospedado (PIX e/ou cartão)
 *   POST /pixQrCode/create            -> QR Code PIX exibido no próprio site
 *   GET  /pixQrCode/check?id=         -> status atual de um QR Code PIX
 *   GET  /billing/list                -> usado para reconferir uma cobrança
 *   POST /pixQrCode/simulate-payment  -> só funciona em devMode
 *
 * Optamos deliberadamente pela API v1: ela aceita produtos declarados na
 * própria requisição (`products: [{ externalId, name, quantity, price }]`),
 * enquanto a v2 exige produtos previamente cadastrados no painel. Para um
 * evento montado em poucos dias, a v1 evita um passo de configuração externa.
 */

const API_BASE_URL = "https://api.abacatepay.com/v1";

/** Timeout por requisição. O gateway costuma responder em menos de 1s. */
const REQUEST_TIMEOUT_MS = 15_000;

/**
 * Status de cobrança da AbacatePay.
 * Fonte: enum `PaymentStatus` em @abacatepay/types.
 */
export type AbacatePayStatus = "PENDING" | "EXPIRED" | "CANCELLED" | "PAID" | "REFUNDED";

/**
 * Métodos de pagamento.
 * Fonte: enum `PaymentMethod` em @abacatepay/types.
 *
 * ATENÇÃO: a documentação oficial marca `CARD` como recurso em BETA. A
 * disponibilidade depende de liberação na conta do organizador junto à
 * AbacatePay — veja o README.
 */
export type AbacatePayMethod = "PIX" | "CARD";

/** Envelope padrão de resposta da API. */
export type AbacatePayResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

/** Resposta de POST /pixQrCode/create (tipo `APIQRCodePIX`). */
export type PixQrCode = {
  id: string;
  amount: number;
  status: AbacatePayStatus;
  devMode: boolean;
  method: "PIX";
  /** PIX copia-e-cola. */
  brCode: string;
  /** Data URL da imagem do QR Code (`data:image/png;base64,...`). */
  brCodeBase64: string;
  platformFee: number;
  description?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  expiresAt: string;
};

/** Resposta de POST /billing/create (tipo `APICharge`). */
export type Billing = {
  id: string;
  frequency: "ONE_TIME" | "MULTIPLE_PAYMENTS";
  /** URL do checkout hospedado, para onde o piloto é enviado. */
  url: string;
  status: AbacatePayStatus;
  devMode: boolean;
  methods: AbacatePayMethod[];
  products: Array<{ externalId: string; name: string; quantity: number; price: number }>;
  metadata?: { fee?: number; returnUrl?: string; completionUrl?: string };
  createdAt: string;
  updatedAt: string;
};

/** Dados do cliente aceitos pela API (tipo `APICustomer["metadata"]`). */
export type AbacatePayCustomer = {
  name: string;
  email: string;
  /** CPF ou CNPJ. */
  taxId: string;
  cellphone: string;
};

class GatewayNotConfiguredError extends Error {
  constructor() {
    super(
      "ABACATEPAY_API_KEY não está configurada. Defina a variável de ambiente para habilitar pagamentos.",
    );
    this.name = "GatewayNotConfiguredError";
  }
}

async function request<T>(
  path: string,
  init: { method: "GET" | "POST"; body?: unknown },
): Promise<AbacatePayResult<T>> {
  const apiKey = serverEnv.abacatePayApiKey;
  if (!apiKey) {
    throw new GatewayNotConfiguredError();
  }

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method: init.method,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      // Chamadas ao gateway jamais podem servir resposta de cache.
      cache: "no-store",
    });
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    return { ok: false, error: `Falha de rede ao contatar a AbacatePay: ${reason}` };
  }

  // A API responde `{ data, error }` mesmo em erro; corpos não-JSON só
  // aparecem em falhas de infraestrutura.
  let payload: { data?: T; error?: string | null } | null = null;
  try {
    payload = (await response.json()) as { data?: T; error?: string | null };
  } catch {
    payload = null;
  }

  if (!response.ok) {
    return {
      ok: false,
      error: payload?.error ?? `AbacatePay respondeu ${response.status} em ${path}`,
    };
  }

  if (payload?.error) {
    return { ok: false, error: payload.error };
  }

  if (payload?.data === undefined || payload.data === null) {
    return { ok: false, error: `Resposta sem dados em ${path}` };
  }

  return { ok: true, data: payload.data };
}

/**
 * Cria um QR Code PIX avulso.
 * POST https://api.abacatepay.com/v1/pixQrCode/create
 *
 * @param amountCents Valor total em centavos (mínimo 100).
 * @param expiresInSeconds Validade do QR Code, em segundos.
 */
export function createPixQrCode(params: {
  amountCents: number;
  description: string;
  customer: AbacatePayCustomer;
  expiresInSeconds: number;
  metadata?: Record<string, unknown>;
}): Promise<AbacatePayResult<PixQrCode>> {
  return request<PixQrCode>("/pixQrCode/create", {
    method: "POST",
    body: {
      amount: params.amountCents,
      expiresIn: params.expiresInSeconds,
      description: params.description,
      customer: params.customer,
      metadata: params.metadata,
    },
  });
}

/**
 * Cria uma cobrança com checkout hospedado pela AbacatePay.
 * POST https://api.abacatepay.com/v1/billing/create
 *
 * O checkout hospedado é a solução oficial para cartão — nenhum dado de cartão
 * passa por este servidor.
 */
export function createBilling(params: {
  methods: AbacatePayMethod[];
  products: Array<{ externalId: string; name: string; quantity: number; price: number; description?: string }>;
  returnUrl: string;
  completionUrl: string;
  customer: AbacatePayCustomer;
  externalId?: string;
  metadata?: Record<string, unknown>;
}): Promise<AbacatePayResult<Billing>> {
  return request<Billing>("/billing/create", {
    method: "POST",
    body: {
      frequency: "ONE_TIME",
      methods: params.methods,
      products: params.products,
      returnUrl: params.returnUrl,
      completionUrl: params.completionUrl,
      customer: params.customer,
      externalId: params.externalId,
      metadata: params.metadata,
    },
  });
}

/**
 * Consulta o status atual de um QR Code PIX.
 * GET https://api.abacatepay.com/v1/pixQrCode/check?id=<id>
 *
 * Esta é a FONTE DA VERDADE do sistema: o webhook apenas dispara a consulta,
 * e é o resultado daqui que decide se a inscrição vira PAGA.
 */
export function checkPixQrCode(id: string): Promise<AbacatePayResult<{ status: AbacatePayStatus; expiresAt: string }>> {
  return request<{ status: AbacatePayStatus; expiresAt: string }>(
    `/pixQrCode/check?id=${encodeURIComponent(id)}`,
    { method: "GET" },
  );
}

/**
 * Lista as cobranças da loja.
 * GET https://api.abacatepay.com/v1/billing/list
 *
 * A API v1 não expõe um `billing/get` por id, então a reconferência de uma
 * cobrança de checkout é feita localizando o id nesta lista.
 */
export function listBillings(): Promise<AbacatePayResult<Billing[]>> {
  return request<Billing[]>("/billing/list", { method: "GET" });
}

/** Busca uma cobrança específica dentro de `billing/list`. */
export async function findBilling(id: string): Promise<AbacatePayResult<Billing>> {
  const result = await listBillings();
  if (!result.ok) return result;

  const billing = result.data.find((item) => item.id === id);
  if (!billing) {
    return { ok: false, error: `Cobrança ${id} não encontrada na AbacatePay` };
  }
  return { ok: true, data: billing };
}

/**
 * Simula o pagamento de um QR Code PIX.
 * POST https://api.abacatepay.com/v1/pixQrCode/simulate-payment?id=<id>
 *
 * Funciona apenas com cobranças criadas em devMode (chave de teste). Serve para
 * validar o fluxo completo antes do evento, sem mover dinheiro de verdade.
 */
export function simulatePixPayment(id: string): Promise<AbacatePayResult<PixQrCode>> {
  return request<PixQrCode>(`/pixQrCode/simulate-payment?id=${encodeURIComponent(id)}`, {
    method: "POST",
    body: { metadata: {} },
  });
}

export { GatewayNotConfiguredError };
