"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { formatCents } from "@/lib/format";
import { ActionButton, Alert, Card } from "./ui";

/**
 * Tela de pagamento.
 *
 * PIX é o caminho principal: QR Code grande e um botão de copiar bem visível,
 * porque quase todo mundo abre esta página no mesmo celular em que vai pagar.
 *
 * Enquanto a página está aberta, ela pergunta ao NOSSO servidor se a inscrição
 * já foi paga. O servidor, por sua vez, confere com a AbacatePay. Nada nesta
 * tela decide o status — ela apenas exibe o que o servidor respondeu.
 */

type PixData = {
  paymentId: string;
  brCode: string;
  brCodeBase64: string;
  expiresAt: string | null;
  devMode: boolean;
};

type Props = {
  publicId: string;
  registrationNumber: number;
  totalCents: number;
  /** Cobrança PIX já existente, se a página foi recarregada. */
  initialPix: PixData | null;
  /** Checkout hospedado já criado, se houver. */
  initialCheckoutUrl: string | null;
  cardEnabled: boolean;
  gatewayConfigured: boolean;
};

/** De quanto em quanto tempo perguntamos ao servidor se já foi pago. */
const POLL_INTERVAL_MS = 4000;

export function PaymentPanel({
  publicId,
  registrationNumber,
  totalCents,
  initialPix,
  initialCheckoutUrl,
  cardEnabled,
  gatewayConfigured,
}: Props) {
  const router = useRouter();

  // A cobrança vem sempre das props: depois de `router.refresh()` o servidor
  // reenvia os dados atualizados. Guardá-la em estado deixaria a tela
  // mostrando o QR Code antigo.
  const pix = initialPix;
  // Único estado local sobre a cobrança: o piloto abriu o checkout de cartão e
  // decidiu voltar para o PIX.
  const [preferPix, setPreferPix] = useState(false);
  const checkoutUrl = preferPix ? null : initialCheckoutUrl;

  const [loading, setLoading] = useState<"PIX" | "CARD" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Evita duas navegações se o polling responder duas vezes seguidas.
  const redirectedRef = useRef(false);

  const createCharge = useCallback(
    async (method: "PIX" | "CARD") => {
      setLoading(method);
      setError(null);

      try {
        const response = await fetch(`/api/registrations/${publicId}/pagamento`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ method }),
        });
        const payload = await response.json();

        if (!response.ok) {
          setError(payload.error ?? "Não foi possível gerar a cobrança.");
          setLoading(null);
          return;
        }

        // A rota devolve só o id; recarregamos a página para o servidor
        // entregar os dados da cobrança já renderizados.
        router.refresh();
      } catch {
        setError("Falha de conexão. Verifique sua internet e tente novamente.");
        setLoading(null);
      }
    },
    [publicId, router],
  );

  // Enquanto houver cobrança em aberto, pergunta ao servidor se já foi paga.
  useEffect(() => {
    if (!pix && !checkoutUrl) return;
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
  }, [pix, checkoutUrl, publicId, router, gatewayConfigured]);

  async function copyPixCode() {
    if (!pix) return;

    try {
      await navigator.clipboard.writeText(pix.brCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setError("Não foi possível copiar automaticamente. Selecione o código e copie à mão.");
    }
  }

  if (!gatewayConfigured) {
    return (
      <Alert title="Pagamentos ainda não configurados">
        Sua inscrição <strong>#{registrationNumber}</strong> foi criada e está{" "}
        <strong>pendente</strong>, mas este site ainda não tem o gateway de pagamento
        configurado. O organizador precisa definir a variável{" "}
        <code>ABACATEPAY_API_KEY</code> no servidor. Guarde o link desta página: assim
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

      {/* ------------------------------------------------------------- PIX */}
      {pix ? (
        <Card className="p-5">
          <h2 className="display-title text-2xl text-chalk">Pague com PIX</h2>
          <p className="mt-1.5 text-sm text-chalk-dim">
            Abra o app do seu banco, escolha PIX e escaneie o código — ou use o
            copia-e-cola.
          </p>

          {pix.devMode && (
            <div className="mt-4">
              <Alert tone="info" title="Cobrança de teste">
                Esta cobrança foi criada em modo de desenvolvimento no gateway. Nenhum
                dinheiro real será movimentado.
              </Alert>
            </div>
          )}

          <div className="mt-5 flex justify-center">
            {/* O gateway devolve a imagem já como data URL. */}
            <Image
              src={pix.brCodeBase64}
              alt="QR Code do PIX para pagamento da inscrição"
              width={280}
              height={280}
              unoptimized
              className="h-auto w-full max-w-[280px] border-8 border-white bg-white"
            />
          </div>

          <div className="mt-5">
            <p className="display-label mb-1.5 text-xs text-chalk-dim">PIX copia e cola</p>
            <p className="max-h-24 overflow-y-auto border border-dirt-700 bg-dirt-950 p-3 font-mono text-xs break-all text-chalk-dim">
              {pix.brCode}
            </p>
            <ActionButton onClick={copyPixCode} className="mt-3 w-full">
              {copied ? "Código copiado!" : "Copiar código PIX"}
            </ActionButton>
          </div>

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
          <h2 className="display-title text-2xl text-chalk">Escolha como pagar</h2>
          <p className="mt-1.5 text-sm text-chalk-dim">
            O PIX confirma na hora e é a forma mais rápida de garantir sua vaga.
          </p>

          <div className="mt-5 space-y-3">
            <ActionButton
              onClick={() => createCharge("PIX")}
              disabled={loading !== null}
              className="w-full"
            >
              {loading === "PIX" ? "Gerando QR Code…" : "Pagar com PIX"}
            </ActionButton>

            {cardEnabled && (
              <ActionButton
                variant="secondary"
                onClick={() => createCharge("CARD")}
                disabled={loading !== null}
                className="w-full"
              >
                {loading === "CARD" ? "Abrindo checkout…" : "Pagar com cartão de crédito"}
              </ActionButton>
            )}
          </div>

          {cardEnabled && (
            <p className="mt-4 text-xs text-dirt-600">
              O pagamento com cartão acontece no checkout da AbacatePay. Nenhum dado do
              seu cartão passa por este site.
            </p>
          )}
        </Card>
      )}

      {/* -------------------------------------------------------- CHECKOUT */}
      {checkoutUrl && (
        <Card className="p-5">
          <h2 className="display-title text-2xl text-chalk">Checkout com cartão</h2>
          <p className="mt-1.5 text-sm text-chalk-dim">
            Finalize o pagamento na página segura da AbacatePay. Ao terminar, você volta
            para cá automaticamente.
          </p>
          <a
            href={checkoutUrl}
            className="display-label tap-target mt-5 flex w-full -skew-x-12 items-center justify-center bg-race-500 px-6 text-sm text-dirt-950 transition-colors hover:bg-race-400"
          >
            <span className="skew-x-12">Abrir checkout seguro</span>
          </a>
          <button
            type="button"
            onClick={() => {
              setPreferPix(true);
              void createCharge("PIX");
            }}
            className="mt-4 w-full text-sm text-chalk-dim underline underline-offset-2 hover:text-chalk"
          >
            Prefiro pagar com PIX
          </button>
        </Card>
      )}

      <p className="text-xs text-dirt-600">
        Sua inscrição só é confirmada quando a AbacatePay confirmar o pagamento. Chegar
        a uma tela de sucesso ou voltar do checkout, por si só, não confirma nada.
      </p>
    </div>
  );
}
