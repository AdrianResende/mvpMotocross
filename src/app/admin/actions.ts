"use server";

import { redirect } from "next/navigation";
import { endAdminSession, isValidAdminCredentials, startAdminSession } from "@/lib/admin-auth";
import { isAdminConfigured } from "@/lib/env";

/**
 * Server Actions do login administrativo.
 *
 * E-mail e senha são comparados no servidor e nunca voltam para o cliente. A
 * resposta em caso de erro é sempre a mesma mensagem genérica, para não
 * revelar qual dos dois campos está errado.
 */

export type LoginState = { error?: string };

export async function loginAction(
  _previous: LoginState,
  formData: FormData,
): Promise<LoginState> {
  if (!isAdminConfigured()) {
    return {
      error:
        "Área administrativa não configurada. Defina ADMIN_EMAIL, ADMIN_PASSWORD e ADMIN_SESSION_SECRET no servidor.",
    };
  }

  const email = formData.get("email");
  const password = formData.get("password");
  if (
    typeof email !== "string" ||
    typeof password !== "string" ||
    !isValidAdminCredentials(email, password)
  ) {
    return { error: "E-mail ou senha incorretos." };
  }

  await startAdminSession();
  redirect("/admin");
}

export async function logoutAction(): Promise<void> {
  await endAdminSession();
  redirect("/admin/login");
}
