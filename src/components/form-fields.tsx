"use client";

import type { ComponentProps, ReactNode } from "react";
import { useId } from "react";

/**
 * Campos de formulário pensados para o celular: rótulo sempre visível, alvo de
 * toque alto, teclado correto por tipo de campo e erro logo abaixo do campo.
 */

const inputBase =
  "tap-target w-full border-2 border-dirt-700 bg-dirt-950 px-3.5 text-base text-chalk " +
  "transition-colors placeholder:text-dirt-600 focus:border-race-500 focus:outline-none " +
  "aria-[invalid=true]:border-red-500";

function FieldShell({
  id,
  label,
  hint,
  error,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className="display-label mb-1.5 block text-xs text-chalk-dim">
        {label}
      </label>
      {children}
      {error ? (
        <p id={`${id}-error`} role="alert" className="mt-1.5 text-sm text-red-400">
          {error}
        </p>
      ) : (
        hint && <p className="mt-1.5 text-xs text-dirt-600">{hint}</p>
      )}
    </div>
  );
}

export function TextField({
  label,
  hint,
  error,
  ...props
}: ComponentProps<"input"> & { label: string; hint?: string; error?: string }) {
  const generatedId = useId();
  const id = props.id ?? generatedId;

  return (
    <FieldShell id={id} label={label} hint={hint} error={error}>
      <input
        {...props}
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        className={inputBase}
      />
    </FieldShell>
  );
}

export function SelectField({
  label,
  hint,
  error,
  children,
  ...props
}: ComponentProps<"select"> & { label: string; hint?: string; error?: string }) {
  const generatedId = useId();
  const id = props.id ?? generatedId;

  return (
    <FieldShell id={id} label={label} hint={hint} error={error}>
      <select
        {...props}
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        className={inputBase}
      >
        {children}
      </select>
    </FieldShell>
  );
}
