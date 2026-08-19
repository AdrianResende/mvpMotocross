"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const NAV_LINKS = [
  { href: "/", label: "Início" },
  { href: "/evento", label: "O evento" },
  { href: "/categorias", label: "Categorias" },
];

/**
 * Cabeçalho do site. No celular vira um menu recolhível para não roubar
 * espaço vertical da tela.
 */
export function SiteHeader() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  // Fecha o menu ao navegar, senão ele fica aberto sobre a página nova.
  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  // A área administrativa tem seu próprio cabeçalho.
  if (pathname.startsWith("/admin")) return null;

  return (
    <header className="sticky top-0 z-40 border-b border-dirt-800 bg-dirt-950/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
        <Link href="/" className="group flex items-center gap-2.5">
          <span
            aria-hidden
            className="block h-7 w-1.5 -skew-x-12 bg-race-500 transition-colors group-hover:bg-race-400"
          />
          <span className="display-title text-lg leading-none text-chalk sm:text-xl">
            Motocross
          </span>
        </Link>

        <nav className="hidden items-center gap-1 sm:flex">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              aria-current={pathname === link.href ? "page" : undefined}
              className={`display-label rounded px-3 py-2 text-sm transition-colors ${
                pathname === link.href
                  ? "text-race-400"
                  : "text-chalk-dim hover:text-chalk"
              }`}
            >
              {link.label}
            </Link>
          ))}
          <Link
            href="/inscricao"
            className="display-label ml-2 -skew-x-12 bg-race-500 px-5 py-2.5 text-sm text-dirt-950 transition-colors hover:bg-race-400"
          >
            <span className="block skew-x-12">Inscreva-se</span>
          </Link>
        </nav>

        <button
          type="button"
          onClick={() => setMenuOpen((open) => !open)}
          aria-expanded={menuOpen}
          aria-label={menuOpen ? "Fechar menu" : "Abrir menu"}
          className="flex h-11 w-11 items-center justify-center rounded border border-dirt-700 text-chalk sm:hidden"
        >
          <span aria-hidden className="relative block h-4 w-5">
            <span
              className={`absolute left-0 block h-0.5 w-5 bg-current transition-transform ${
                menuOpen ? "top-1.5 rotate-45" : "top-0"
              }`}
            />
            <span
              className={`absolute top-1.5 left-0 block h-0.5 w-5 bg-current transition-opacity ${
                menuOpen ? "opacity-0" : "opacity-100"
              }`}
            />
            <span
              className={`absolute left-0 block h-0.5 w-5 bg-current transition-transform ${
                menuOpen ? "top-1.5 -rotate-45" : "top-3"
              }`}
            />
          </span>
        </button>
      </div>

      {menuOpen && (
        <nav className="border-t border-dirt-800 bg-dirt-900 sm:hidden">
          <div className="mx-auto max-w-6xl px-4 py-2">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="display-label tap-target flex items-center border-b border-dirt-800 text-sm text-chalk"
              >
                {link.label}
              </Link>
            ))}
            <Link
              href="/inscricao"
              className="display-label tap-target mt-3 mb-3 flex items-center justify-center bg-race-500 text-sm text-dirt-950"
            >
              Fazer inscrição
            </Link>
          </div>
        </nav>
      )}
    </header>
  );
}
