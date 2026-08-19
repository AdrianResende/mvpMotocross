"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { SelectField, TextField } from "@/components/form-fields";
import { ActionButton } from "@/components/ui";

/**
 * Filtros da listagem de inscrições.
 *
 * O estado vive na URL, não no componente: o organizador pode salvar o
 * endereço de "pendentes da MX1" nos favoritos, ou mandar o link para alguém.
 */
export function RegistrationFilters({
  categories,
}: {
  categories: Array<{ id: string; name: string }>;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);

  const activeCount = ["status", "categoria", "de", "ate", "busca"].filter((key) =>
    searchParams.get(key),
  ).length;

  function applyFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);
    const params = new URLSearchParams();

    for (const [key, value] of formData.entries()) {
      if (typeof value === "string" && value.trim()) {
        params.set(key, value.trim());
      }
    }

    const query = params.toString();
    router.push(query ? `/admin?${query}` : "/admin");
  }

  return (
    <div className="border border-dirt-800 bg-dirt-900">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        className="display-label tap-target flex w-full items-center justify-between px-4 text-sm text-chalk"
      >
        <span>
          Filtros
          {activeCount > 0 && (
            <span className="ml-2 bg-race-500 px-2 py-0.5 text-xs text-dirt-950">
              {activeCount}
            </span>
          )}
        </span>
        <span aria-hidden className={`transition-transform ${open ? "rotate-45" : ""}`}>
          +
        </span>
      </button>

      {open && (
        <form onSubmit={applyFilters} className="border-t border-dirt-800 p-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <SelectField
              label="Situação"
              name="status"
              defaultValue={searchParams.get("status") ?? ""}
            >
              <option value="">Todas</option>
              <option value="PAID">Pagas</option>
              <option value="PENDING">Pendentes</option>
              <option value="CANCELLED">Canceladas</option>
            </SelectField>

            <SelectField
              label="Categoria"
              name="categoria"
              defaultValue={searchParams.get("categoria") ?? ""}
            >
              <option value="">Todas</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </SelectField>

            <TextField
              label="Piloto (nome, CPF ou e-mail)"
              name="busca"
              defaultValue={searchParams.get("busca") ?? ""}
              placeholder="Buscar…"
            />

            <TextField
              label="Inscrições a partir de"
              name="de"
              type="date"
              defaultValue={searchParams.get("de") ?? ""}
            />

            <TextField
              label="Até"
              name="ate"
              type="date"
              defaultValue={searchParams.get("ate") ?? ""}
            />
          </div>

          <div className="mt-5 flex flex-wrap gap-3">
            <ActionButton type="submit">Aplicar filtros</ActionButton>
            {activeCount > 0 && (
              <ActionButton
                type="button"
                variant="secondary"
                onClick={() => router.push("/admin")}
              >
                Limpar
              </ActionButton>
            )}
          </div>
        </form>
      )}
    </div>
  );
}
