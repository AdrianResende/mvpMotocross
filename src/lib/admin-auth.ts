import "server-only";
import { createHmac, timingSafeEqual, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { serverEnv, isAdminConfigured } from "./env";

/**
 * Autenticação da área administrativa.
 *
 * Modelo deliberadamente simples para um MVP de poucos dias: uma senha única
 * do organizador, guardada em variável de ambiente, trocada por um cookie de
 * sessão assinado com HMAC-SHA256.
 *
 * Propriedades de segurança:
 *  - a senha nunca é gravada no cookie, só a data de expiração assinada;
 *  - o cookie é httpOnly (JavaScript da página não o lê) e SameSite=Lax;
 *  - a comparação da assinatura e da senha é feita em tempo constante;
 *  - sem a assinatura correta o cookie é descartado — não dá para forjar sessão
 *    editando o valor no navegador.
 *
 * Se o evento crescer e precisar de vários usuários, troque este módulo por uma
 * biblioteca de autenticação; nada mais no projeto depende dele além de
 * `requireAdmin()`.
 */

const COOKIE_NAME = "mx_admin_session";
const SESSION_DURATION_MS = 12 * 60 * 60 * 1000; // 12 horas

/** Compara dois textos em tempo constante, sem vazar o tamanho pelo timing. */
function safeEquals(a: string, b: string): boolean {
  const bufferA = Buffer.from(a, "utf8");
  const bufferB = Buffer.from(b, "utf8");
  if (bufferA.length !== bufferB.length) {
    // Ainda assim faz uma comparação para manter o tempo aproximadamente
    // constante entre "tamanho errado" e "conteúdo errado".
    timingSafeEqual(bufferA, bufferA);
    return false;
  }
  return timingSafeEqual(bufferA, bufferB);
}

function sign(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

/** Confere a senha informada no formulário de login. */
export function isValidAdminPassword(password: string): boolean {
  const expected = serverEnv.adminPassword;
  if (!expected) return false;
  return safeEquals(password, expected);
}

/** Cria o cookie de sessão. Chame apenas depois de validar a senha. */
export async function startAdminSession(): Promise<void> {
  const secret = serverEnv.adminSessionSecret;
  if (!secret) {
    throw new Error("ADMIN_SESSION_SECRET não configurado.");
  }

  const expiresAt = Date.now() + SESSION_DURATION_MS;
  // O nonce garante que dois logins nunca produzam o mesmo cookie.
  const payload = `${expiresAt}.${randomBytes(16).toString("base64url")}`;
  const value = `${payload}.${sign(payload, secret)}`;

  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, value, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: Math.floor(SESSION_DURATION_MS / 1000),
  });
}

export async function endAdminSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

/** `true` quando a requisição atual traz uma sessão de admin válida. */
export async function hasAdminSession(): Promise<boolean> {
  if (!isAdminConfigured()) return false;

  const secret = serverEnv.adminSessionSecret;
  if (!secret) return false;

  const cookieStore = await cookies();
  const raw = cookieStore.get(COOKIE_NAME)?.value;
  if (!raw) return false;

  const separator = raw.lastIndexOf(".");
  if (separator <= 0) return false;

  const payload = raw.slice(0, separator);
  const signature = raw.slice(separator + 1);

  if (!safeEquals(signature, sign(payload, secret))) return false;

  const expiresAt = Number(payload.split(".")[0]);
  if (!Number.isFinite(expiresAt) || Date.now() > expiresAt) return false;

  return true;
}
