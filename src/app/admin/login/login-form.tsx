"use client";

import { useActionState } from "react";
import { loginAction, type LoginState } from "../actions";
import { TextField } from "@/components/form-fields";
import { ActionButton, Alert } from "@/components/ui";

const initialState: LoginState = {};

export function LoginForm() {
  const [state, formAction, pending] = useActionState(loginAction, initialState);

  return (
    <form action={formAction} className="space-y-5">
      {state.error && <Alert>{state.error}</Alert>}

      {/* type="text", não "email": o valor cadastrado em ADMIN_EMAIL não
          precisa ter formato de e-mail — é só um identificador. */}
      <TextField
        label="E-mail do organizador"
        name="email"
        type="text"
        required
        autoComplete="username"
        enterKeyHint="next"
      />

      <TextField
        label="Senha do organizador"
        name="password"
        type="password"
        required
        autoComplete="current-password"
        enterKeyHint="go"
      />

      <ActionButton type="submit" disabled={pending} className="w-full">
        {pending ? "Entrando…" : "Entrar"}
      </ActionButton>
    </form>
  );
}
