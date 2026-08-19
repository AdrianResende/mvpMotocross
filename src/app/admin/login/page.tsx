import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { hasAdminSession } from "@/lib/admin-auth";
import { isAdminConfigured } from "@/lib/env";
import { LoginForm } from "./login-form";
import { Alert } from "@/components/ui";

export const metadata: Metadata = {
  title: "Acesso do organizador",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function AdminLoginPage() {
  if (await hasAdminSession()) redirect("/admin");

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center px-4 py-12">
      <p className="display-label text-sm text-race-500">Área restrita</p>
      <h1 className="display-title mt-2 text-4xl text-chalk">Organizador</h1>
      <p className="mt-3 text-sm text-chalk-dim">
        Acesso ao painel de inscrições e pagamentos.
      </p>

      <div className="mt-8">
        {isAdminConfigured() ? (
          <LoginForm />
        ) : (
          <Alert title="Painel não configurado">
            Defina <code>ADMIN_PASSWORD</code> e <code>ADMIN_SESSION_SECRET</code> nas
            variáveis de ambiente do servidor para habilitar o acesso. Veja{" "}
            <code>.env.example</code>.
          </Alert>
        )}
      </div>
    </div>
  );
}
