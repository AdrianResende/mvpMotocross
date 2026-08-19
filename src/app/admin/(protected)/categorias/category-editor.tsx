"use client";

import { useActionState } from "react";
import { updateCategoryAction, type UpdateCategoryState } from "./actions";
import { TextField } from "@/components/form-fields";
import { ActionButton, Alert } from "@/components/ui";

const initialState: UpdateCategoryState = {};

/** Formulário de edição de uma categoria. */
export function CategoryEditor({
  categoryId,
  currentPrice,
  active,
  description,
}: {
  categoryId: string;
  currentPrice: string;
  active: boolean;
  description: string;
}) {
  const [state, formAction, pending] = useActionState(updateCategoryAction, initialState);

  return (
    <form action={formAction} className="mt-4">
      <input type="hidden" name="categoryId" value={categoryId} />

      <div className="grid gap-4 sm:grid-cols-[160px_1fr_auto] sm:items-start">
        <TextField
          label="Valor (R$)"
          name="price"
          defaultValue={currentPrice}
          inputMode="decimal"
          placeholder="150,00"
          hint="Vazio = a definir"
        />

        <TextField
          label="Descrição (opcional)"
          name="description"
          defaultValue={description}
          maxLength={300}
          placeholder="Deixe vazio se a organização não informou"
        />

        <div className="sm:pt-6">
          <label className="tap-target flex items-center gap-2.5 text-sm text-chalk">
            <input
              type="checkbox"
              name="active"
              defaultChecked={active}
              className="h-5 w-5 accent-race-500"
            />
            Ativa
          </label>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-4">
        <ActionButton type="submit" variant="secondary" disabled={pending}>
          {pending ? "Salvando…" : "Salvar"}
        </ActionButton>

        {state.success && <span className="text-sm text-flag-400">{state.success}</span>}
      </div>

      {state.error && (
        <div className="mt-3">
          <Alert>{state.error}</Alert>
        </div>
      )}
    </form>
  );
}
