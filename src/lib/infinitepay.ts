import "server-only";
import { serverEnv } from "./env";

/**
 * Cliente HTTP da InfinitePay (Checkout Integrado).
 * ====================================================
 *
 * A InfinitePay não publica um pacote de tipos oficial como a AbacatePay. Os
 * campos abaixo foram conferidos contra DUAS integrações reais e independentes
 * (um módulo WooCommerce e um módulo WHMCS, ambos em produção) e batem entre
 * si. Nenhum campo foi inventado.
 *
 * A URL base foi trocada em 2026-08-20: a InfinitePay avisou (alerta no
 * painel) que `api.infinitepay.io/invoices/public/checkout/*` está sendo
 * descontinuada em favor de `api.checkout.infinitepay.io/*`. O aviso deles
 * confirma que o payload das requisições e o formato do webhook não mudam —
 * só o domínio.
 *
 * Diferenças importantes em relação à AbacatePay:
 *   - Autenticação é pelo `handle` (sua InfiniteTag, público) no corpo da
 *     requisição — não por um secret de servidor. Um `api_key` (Bearer) é
 *     aceito e enviado quando configurado, mas a documentação descreve como
 *     opcional ("caso sua conta exija").
 *   - Não existe QR Code PIX embutido no site: só checkout hospedado (link).
 *     O piloto sempre é redirecionado para a página da InfinitePay.
 *   - Não existe modo de teste/sandbox documentado — todo link criado é real.
 *   - O webhook não manda um status "pago"; manda `amount` e `paid_amount`.
 *     Por isso, igual à AbacatePay, o servidor NUNCA confia nisso: usa o
 *     evento só como gatilho para perguntar à própria InfinitePay via
 *     `payment_check` antes de confirmar qualquer coisa.
 *
 * Endpoints:
 *   POST /links          -> cria o link de checkout
 *   POST /payment_check  -> confere se foi pago
 */

const API_BASE_URL = "https://api.checkout.infinitepay.io";
const REQUEST_TIMEOUT_MS = 15_000;

export type InfinitePayResult<T> = { ok: true; data: T } | { ok: false; error: string };

export type CreateCheckoutLinkResult = {
  url: string;
};

/** Dados devolvidos pelo piloto ao voltar do checkout, ou pelo webhook. */
export type PaymentCheckResult = {
  paid: boolean;
  amount: number;
  paidAmount: number;
  installments: number | null;
  captureMethod: string | null;
};

class InfinitePayNotConfiguredError extends Error {
  constructor() {
    super(
      "INFINITEPAY_HANDLE não está configurada. Defina a variável de ambiente para habilitar pagamentos.",
    );
    this.name = "InfinitePayNotConfiguredError";
  }
}

async function request<T>(path: string, body: Record<string, unknown>): Promise<InfinitePayResult<T>> {
  const handle = serverEnv.infinitePayHandle;
  if (!handle) {
    throw new InfinitePayNotConfiguredError();
  }

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const apiToken = serverEnv.infinitePayApiToken;
  if (apiToken) {
    headers.Authorization = `Bearer ${apiToken}`;
  }

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method: "POST",
      headers,
      body: JSON.stringify({ handle, ...body }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      cache: "no-store",
    });
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    return { ok: false, error: `Falha de rede ao contatar a InfinitePay: ${reason}` };
  }

  let payload: Record<string, unknown> | null = null;
  try {
    payload = (await response.json()) as Record<string, unknown>;
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const message = typeof payload?.message === "string" ? payload.message : null;
    return { ok: false, error: message ?? `InfinitePay respondeu ${response.status} em ${path}` };
  }

  return { ok: true, data: payload as T };
}

/**
 * Cria o link de checkout hospedado (PIX ou cartão, à escolha do piloto na
 * própria página da InfinitePay).
 *
 * POST https://api.infinitepay.io/invoices/public/checkout/links
 */
export async function createCheckoutLink(params: {
  orderNsu: string;
  amountCents: number;
  description: string;
  redirectUrl: string;
  webhookUrl: string;
  customer: { name: string; email: string; phoneNumber?: string };
}): Promise<InfinitePayResult<CreateCheckoutLinkResult>> {
  const result = await request<{ url?: string; payment_url?: string }>("/links", {
    order_nsu: params.orderNsu,
    redirect_url: params.redirectUrl,
    webhook_url: params.webhookUrl,
    amount: params.amountCents,
    items: [
      {
        quantity: 1,
        price: params.amountCents,
        description: params.description.slice(0, 100),
      },
    ],
    customer: {
      name: params.customer.name.slice(0, 100),
      email: params.customer.email,
      ...(params.customer.phoneNumber ? { phone_number: params.customer.phoneNumber } : {}),
    },
  });

  if (!result.ok) return result;

  const url = result.data.url ?? result.data.payment_url;
  if (!url) {
    return { ok: false, error: "A InfinitePay não devolveu a URL do checkout." };
  }

  return { ok: true, data: { url } };
}

/**
 * Confere se uma cobrança foi paga. É a ÚNICA fonte de verdade — o webhook e
 * o retorno do checkout só fornecem `slug` e `transactionNsu` para esta
 * consulta, nunca decidem status sozinhos.
 *
 * POST https://api.infinitepay.io/invoices/public/checkout/payment_check
 */
export async function checkPayment(params: {
  orderNsu: string;
  transactionNsu: string;
  slug: string;
}): Promise<InfinitePayResult<PaymentCheckResult>> {
  const result = await request<{
    paid?: boolean;
    amount?: number;
    paid_amount?: number;
    installments?: number;
    capture_method?: string;
  }>("/payment_check", {
    order_nsu: params.orderNsu,
    transaction_nsu: params.transactionNsu,
    slug: params.slug,
  });

  if (!result.ok) return result;

  return {
    ok: true,
    data: {
      paid: result.data.paid === true,
      amount: result.data.amount ?? 0,
      paidAmount: result.data.paid_amount ?? 0,
      installments: result.data.installments ?? null,
      captureMethod: result.data.capture_method ?? null,
    },
  };
}

export { InfinitePayNotConfiguredError };
