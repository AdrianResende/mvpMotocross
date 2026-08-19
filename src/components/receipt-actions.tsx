"use client";

import { useState } from "react";
import { ActionButton } from "./ui";

/**
 * Ações do comprovante.
 *
 * Duas coisas que funcionam de verdade, sem depender de nenhum serviço externo
 * que ainda não esteja configurado:
 *
 *  - ENVIAR: usa o compartilhamento nativo do celular (Web Share API) e cai
 *    para copiar o link quando o navegador não oferece o recurso. Não existe
 *    envio de e-mail aqui porque este projeto não tem provedor de e-mail
 *    configurado — prometer isso seria mentira.
 *  - BAIXAR: abre a caixa de impressão do navegador, onde "Salvar como PDF" é
 *    uma opção padrão em celular e desktop. A página tem estilos de impressão
 *    próprios para o PDF sair limpo.
 */
export function ReceiptActions({
  registrationNumber,
  pilotName,
}: {
  registrationNumber: number;
  pilotName: string;
}) {
  const [feedback, setFeedback] = useState<string | null>(null);

  async function share() {
    const url = typeof window === "undefined" ? "" : window.location.href;
    const title = `Inscrição #${registrationNumber}`;
    const text = `Comprovante de inscrição de ${pilotName} — inscrição #${registrationNumber}.`;

    if (navigator.share) {
      try {
        await navigator.share({ title, text, url });
        return;
      } catch {
        // O usuário cancelou o compartilhamento, ou o navegador recusou.
        // Seguimos para o plano B em vez de mostrar um erro.
      }
    }

    try {
      await navigator.clipboard.writeText(url);
      setFeedback("Link do comprovante copiado.");
    } catch {
      setFeedback("Copie o endereço desta página para compartilhar o comprovante.");
    }

    setTimeout(() => setFeedback(null), 4000);
  }

  return (
    <div className="print:hidden">
      <div className="flex flex-col gap-3 sm:flex-row">
        <ActionButton variant="secondary" onClick={share} className="w-full sm:w-auto">
          Enviar comprovante
        </ActionButton>
        <ActionButton
          variant="secondary"
          onClick={() => window.print()}
          className="w-full sm:w-auto"
        >
          Baixar comprovante
        </ActionButton>
      </div>

      {feedback && (
        <p role="status" className="mt-3 text-sm text-flag-400">
          {feedback}
        </p>
      )}

      <p className="mt-3 text-xs text-dirt-600">
        Em &ldquo;Baixar&rdquo;, escolha <strong>Salvar como PDF</strong> na caixa de
        impressão do seu aparelho.
      </p>
    </div>
  );
}
