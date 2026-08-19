"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { recheckPaymentAction } from "./actions";
import { ActionButton, Alert } from "@/components/ui";

/** Dispara a conferência manual de uma cobrança contra o gateway. */
export function RecheckPaymentButton({ paymentId }: { paymentId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ tone: "info" | "error" | "success"; text: string } | null>(
    null,
  );

  function recheck() {
    setMessage(null);

    startTransition(async () => {
      const result = await recheckPaymentAction(paymentId);

      if (result.error) {
        setMessage({ tone: "error", text: result.error });
        return;
      }

      if (result.status === "PAID") {
        setMessage({ tone: "success", text: "Pagamento confirmado. Inscrição atualizada para PAGA." });
        router.refresh();
        return;
      }

      setMessage({
        tone: "info",
        text: `A AbacatePay informa que esta cobrança está como ${result.status}. Nada foi alterado.`,
      });
    });
  }

  return (
    <div>
      <ActionButton variant="secondary" onClick={recheck} disabled={pending}>
        {pending ? "Consultando o gateway…" : "Conferir pagamento no gateway"}
      </ActionButton>

      {message && (
        <div className="mt-3">
          <Alert tone={message.tone}>{message.text}</Alert>
        </div>
      )}
    </div>
  );
}
