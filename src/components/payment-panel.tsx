"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { formatCents } from "@/lib/format";
import { ActionButton, Alert, Card } from "./ui";

/**
 * Tela de pagamento.
 *
 * A InfinitePay só oferece checkout hospedado: não existe QR Code embutido no
 * site. O piloto é redirecionado para a página da InfinitePay, escolhe PIX ou
 * cartão por lá, e volta para cá depois.
 *
 * Enquanto a página está aberta, ela pergunta ao NOSSO servidor se a inscrição
 * já foi paga. O servidor, por sua vez, confere com a InfinitePay. Nada nesta
 * tela decide o status — ela apenas exibe o que o servidor respondeu.
 */

type Props = {
  publicId: string;
  registrationNumber: number;
  totalCents: number;
  /** Link de checkout já criado, se a página foi recarregada ou o piloto voltou. */
  initialCheckoutUrl: string | null;
  gatewayConfigured: boolean;
};

/** De quanto em quanto tempo perguntamos ao servidor se já foi pago. */
const POLL_INTERVAL_MS = 4000;

export function PaymentPanel({
  publicId,
  registrationNumber,
  totalCents,
  initialCheckoutUrl,
  gatewayConfigured,
}: Props) {
  const router = useRouter();

  // Vem sempre das props: depois de `router.refresh()` o servidor reenvia o
  // link atualizado.
  const checkoutUrl = initialCheckoutUrl;

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Evita duas navegações se o polling responder duas vezes seguidas.
  const redirectedRef = useRef(false);

  const createCharge = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/registrations/${publicId}/pagamento`, {
        method: "POST",
      });
      const payload = await response.json();

      if (!response.ok) {
        setError(payload.error ?? "Não foi possível gerar o link de pagamento.");
        setLoading(false);
        return;
      }

      // A rota devolve só o id; recarregamos a página para o servidor
      // entregar o link já renderizado.
      router.refresh();
    } catch {
      setError("Falha de conexão. Verifique sua internet e tente novamente.");
      setLoading(false);
    }
  }, [publicId, router]);

  // Enquanto houver um link em aberto, pergunta ao servidor se já foi pago —
  // cobre o caso do piloto pagar e voltar sem passar pelo redirect completo.
  useEffect(() => {
    if (!checkoutUrl) return;
    if (!gatewayConfigured) return;

    let cancelled = false;

    const check = async () => {
      try {
        const response = await fetch(`/api/registrations/${publicId}/status`, {
          cache: "no-store",
        });
        if (!response.ok) return;

        const payload = (await response.json()) as { registrationStatus: string };

        if (!cancelled && payload.registrationStatus === "PAID" && !redirectedRef.current) {
          redirectedRef.current = true;
          router.replace(`/inscricao/${publicId}`);
        }
      } catch {
        // Sem rede no momento: o próximo ciclo tenta de novo em silêncio.
      }
    };

    const timer = setInterval(check, POLL_INTERVAL_MS);
    void check();

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [checkoutUrl, publicId, router, gatewayConfigured]);

  if (!gatewayConfigured) {
    return (
      <Alert title="Pagamentos ainda não configurados">
        Sua inscrição <strong>#{registrationNumber}</strong> foi criada e está{" "}
        <strong>pendente</strong>, mas este site ainda não tem o gateway de pagamento
        configurado. O organizador precisa definir a variável{" "}
        <code>INFINITEPAY_HANDLE</code> no servidor. Guarde o link desta página: assim
        que a configuração for feita, você poderá pagar por aqui.
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 border-2 border-race-500 bg-race-500/10 p-4">
        <div>
          <p className="display-label text-xs text-race-400">Total a pagar</p>
          <p className="mt-0.5 text-xs text-chalk-dim">Inscrição #{registrationNumber}</p>
        </div>
        <p className="display-title text-3xl text-chalk">{formatCents(totalCents)}</p>
      </div>

      {error && <Alert title="Não deu certo">{error}</Alert>}

      {checkoutUrl ? (
        <Card className="p-5">
          <h2 className="display-title text-2xl text-chalk">Pagar agora</h2>
          <p className="mt-1.5 text-sm text-chalk-dim">
            Você escolhe PIX ou cartão de crédito na página segura da InfinitePay. Ao
            terminar, você volta para cá automaticamente.
          </p>

          <a
            href={checkoutUrl}
            className="display-label tap-target mt-5 flex w-full -skew-x-12 items-center justify-center bg-race-500 px-6 text-sm text-dirt-950 transition-colors hover:bg-race-400"
          >
            <span className="skew-x-12">Ir para o pagamento</span>
          </a>

          <div className="mt-5 flex items-center gap-2.5 border-t border-dirt-800 pt-4">
            <span
              aria-hidden
              className="block h-2.5 w-2.5 animate-pulse rounded-full bg-race-500"
            />
            <p className="text-sm text-chalk-dim">
              Aguardando a confirmação do pagamento. Esta página se atualiza sozinha —
              pode deixá-la aberta.
            </p>
          </div>
        </Card>
      ) : (
        <Card className="p-5">
          <h2 className="display-title text-2xl text-chalk">Pagar inscrição</h2>
          <p className="mt-1.5 text-sm text-chalk-dim">
            PIX confirma na hora; cartão de crédito também é aceito, em até 12x — você
            escolhe na página do pagamento.
          </p>

          <ActionButton onClick={createCharge} disabled={loading} className="mt-5 w-full">
            {loading ? "Gerando link de pagamento…" : "Pagar agora"}
          </ActionButton>

          <p className="mt-4 text-xs text-dirt-600">
            Nenhum dado do seu cartão passa por este site — o pagamento acontece no
            checkout da InfinitePay.
          </p>
        </Card>
      )}

      <p className="text-xs text-dirt-600">
        Sua inscrição só é confirmada quando a InfinitePay confirmar o pagamento. Voltar
        do checkout, por si só, não confirma nada.
      </p>
    </div>
  );
}
