"use server";

import { revalidatePath } from "next/cache";
import { hasAdminSession } from "@/lib/admin-auth";
import { confirmManualPayment, reconcilePayment } from "@/lib/payments";

/**
 * Conferência manual de uma cobrança, disparada pelo painel.
 *
 * A checagem de sessão é refeita aqui: Server Actions são endpoints HTTP
 * próprios e não herdam a proteção do layout.
 */
export async function recheckPaymentAction(
  paymentId: string,
): Promise<{ status?: string; error?: string }> {
  if (!(await hasAdminSession())) {
    return { error: "Sessão expirada. Entre novamente." };
  }

  const result = await reconcilePayment(paymentId);

  if (result.error) {
    return { error: result.error };
  }

  if (result.justPaid) {
    revalidatePath("/admin");
  }

  return { status: result.status };
}

export type ConfirmManualPaymentState = { error?: string; success?: boolean };

/**
 * Confirma manualmente o pagamento de uma inscrição, para quando o piloto
 * pagou por fora (ex.: PIX pessoal do organizador) enquanto o gateway não
 * está disponível para receber de verdade.
 */
export async function confirmManualPaymentAction(
  _previous: ConfirmManualPaymentState,
  formData: FormData,
): Promise<ConfirmManualPaymentState> {
  if (!(await hasAdminSession())) {
    return { error: "Sessão expirada. Entre novamente." };
  }

  const registrationNumber = Number(formData.get("registrationNumber"));
  if (!Number.isInteger(registrationNumber) || registrationNumber <= 0) {
    return { error: "Inscrição inválida." };
  }

  const note = String(formData.get("note") ?? "").trim();
  if (note.length < 5) {
    return { error: "Descreva como o pagamento foi recebido (ex.: “PIX pessoal, comprovante conferido”)." };
  }

  const result = await confirmManualPayment(registrationNumber, note);
  if (!result.ok) {
    return { error: result.error };
  }

  revalidatePath("/admin");
  revalidatePath(`/admin/inscricoes/${registrationNumber}`);

  return { success: true };
}
