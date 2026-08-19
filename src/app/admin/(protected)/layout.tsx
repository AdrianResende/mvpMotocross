import Link from "next/link";
import { redirect } from "next/navigation";
import { hasAdminSession } from "@/lib/admin-auth";
import { logoutAction } from "../actions";
import { eventConfig } from "@/config/event";

export const dynamic = "force-dynamic";

/**
 * Guarda de acesso do painel.
 *
 * A verificação fica aqui, no servidor, e não em um proxy/middleware: assim
 * qualquer página nova sob /admin nasce protegida, e a decisão acontece no
 * mesmo lugar onde os dados são lidos.
 *
 * `/admin/login` é a única exceção — ela precisa ser acessível deslogado, e
 * tem seu próprio layout de tela cheia.
 */
export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const authenticated = await hasAdminSession();

  if (!authenticated) {
    redirect("/admin/login");
  }

  return (
    <div className="min-h-screen">
      <header className="border-b border-dirt-800 bg-dirt-900">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-2.5">
            <span aria-hidden className="block h-6 w-1.5 -skew-x-12 bg-race-500" />
            <div>
              <p className="display-title text-lg leading-none text-chalk">Painel</p>
              <p className="text-xs text-chalk-dim">{eventConfig.name}</p>
            </div>
          </div>

          <nav className="flex items-center gap-4">
            <Link href="/admin" className="display-label text-sm text-chalk-dim hover:text-chalk">
              Inscrições
            </Link>
            <Link href="/" className="display-label text-sm text-chalk-dim hover:text-chalk">
              Ver site
            </Link>
            <form action={logoutAction}>
              <button
                type="submit"
                className="display-label text-sm text-chalk-dim hover:text-race-400"
              >
                Sair
              </button>
            </form>
          </nav>
        </div>
      </header>

      {children}
    </div>
  );
}
