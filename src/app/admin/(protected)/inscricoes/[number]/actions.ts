"use server";

import { revalidatePath } from "next/cache";
import { hasAdminSession } from "@/lib/admin-auth";
import { reconcilePayment } from "@/lib/payments";

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
