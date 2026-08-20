"use client";

import { useActionState } from "react";
import { confirmManualPaymentAction, type ConfirmManualPaymentState } from "./actions";
import { TextAreaField } from "@/components/form-fields";
import { ActionButton, Alert } from "@/components/ui";

const initialState: ConfirmManualPaymentState = {};

/**
 * Confirma o pagamento por fora do gateway (ex.: PIX pessoal do organizador)
 * enquanto a conta na AbacatePay não está aprovada para produção.
 *
 * A nota é obrigatória: é o único registro de auditoria dessa confirmação,
 * já que não há um gateway pra conferir contra.
 */
export function ManualPaymentForm({ registrationNumber }: { registrationNumber: number }) {
  const [state, formAction, pending] = useActionState(confirmManualPaymentAction, initialState);

  if (state.success) {
    return (
      <Alert tone="success">Pagamento confirmado manualmente. Inscrição atualizada para PAGA.</Alert>
    );
  }

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="registrationNumber" value={registrationNumber} />

      {state.error && <Alert>{state.error}</Alert>}

      <TextAreaField
        label="Como o pagamento foi recebido"
        name="note"
        required
        minLength={5}
        placeholder="Ex.: Recebido via PIX pessoal do organizador em 20/08, comprovante conferido no WhatsApp."
        hint="Fica registrado como o único comprovante desta confirmação — descreva com detalhe."
      />

      <ActionButton type="submit" variant="secondary" disabled={pending}>
        {pending ? "Confirmando…" : "Marcar como paga manualmente"}
      </ActionButton>
    </form>
  );
}
