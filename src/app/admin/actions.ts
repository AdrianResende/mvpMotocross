"use server";

import { redirect } from "next/navigation";
import { endAdminSession, isValidAdminPassword, startAdminSession } from "@/lib/admin-auth";
import { isAdminConfigured } from "@/lib/env";

/**
 * Server Actions do login administrativo.
 *
 * A senha é comparada no servidor e nunca volta para o cliente. A resposta em
 * caso de erro é sempre a mesma mensagem genérica.
 */

export type LoginState = { error?: string };

export async function loginAction(
  _previous: LoginState,
  formData: FormData,
): Promise<LoginState> {
  if (!isAdminConfigured()) {
    return {
      error:
        "Área administrativa não configurada. Defina ADMIN_PASSWORD e ADMIN_SESSION_SECRET no servidor.",
    };
  }

  const password = formData.get("password");
  if (typeof password !== "string" || !isValidAdminPassword(password)) {
    return { error: "Senha incorreta." };
  }

  await startAdminSession();
  redirect("/admin");
}

export async function logoutAction(): Promise<void> {
  await endAdminSession();
  redirect("/admin/login");
}
