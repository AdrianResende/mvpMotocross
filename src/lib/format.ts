/**
 * Formatação e helpers de valores.
 *
 * Regra do projeto: dinheiro trafega e é armazenado SEMPRE em centavos (Int).
 * A conversão para reais acontece apenas na hora de exibir.
 */

const brl = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

/** 15000 -> "R$ 150,00" */
export function formatCents(cents: number): string {
  return brl.format(cents / 100);
}

/**
 * Preço para exibição, ciente de que `null` significa NÃO DEFINIDO — e não
 * gratuito. Nunca devolve "R$ 0,00" para um preço ausente.
 */
export function formatPrice(cents: number | null): string {
  return cents === null ? "A definir" : formatCents(cents);
}

const longDate = new Intl.DateTimeFormat("pt-BR", {
  weekday: "long",
  day: "2-digit",
  month: "long",
  year: "numeric",
  timeZone: "America/Sao_Paulo",
});

const shortDate = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  timeZone: "America/Sao_Paulo",
});

const weekday = new Intl.DateTimeFormat("pt-BR", {
  weekday: "long",
  timeZone: "America/Sao_Paulo",
});

const dateTime = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "America/Sao_Paulo",
});

/** "2026-08-22" -> "sábado, 22 de agosto de 2026" */
export function formatLongDate(isoDate: string | Date): string {
  return longDate.format(toDate(isoDate));
}

export function formatShortDate(isoDate: string | Date): string {
  return shortDate.format(toDate(isoDate));
}

/** "2026-08-22" -> "Sábado" */
export function formatWeekday(isoDate: string | Date): string {
  const name = weekday.format(toDate(isoDate));
  return name.charAt(0).toUpperCase() + name.slice(1);
}

export function formatDateTime(value: string | Date): string {
  return dateTime.format(toDate(value));
}

function toDate(value: string | Date): Date {
  if (value instanceof Date) return value;
  // Datas puras (AAAA-MM-DD) seriam lidas como UTC e poderiam "voltar" um dia
  // no fuso de São Paulo; o meio-dia neutraliza isso.
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T12:00:00-03:00`) : new Date(value);
}

/** "12345678901" -> "123.456.789-01" (não valida, apenas formata). */
export function formatCpf(cpf: string): string {
  const digits = onlyDigits(cpf);
  if (digits.length !== 11) return cpf;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
}

/** "11999998888" -> "(11) 99999-8888" */
export function formatPhone(phone: string): string {
  const digits = onlyDigits(phone);
  if (digits.length === 11) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  return phone;
}

/** Rótulo legível para o organizador, coberto os quatro `PaymentKind`. */
export function formatPaymentKind(kind: string): string {
  switch (kind) {
    case "INFINITEPAY":
      return "InfinitePay";
    case "PIX_QRCODE":
      return "PIX (legado)";
    case "BILLING":
      return "Checkout (legado)";
    case "MANUAL":
      return "Manual";
    default:
      return kind;
  }
}

export function onlyDigits(value: string): string {
  return value.replace(/\D/g, "");
}

/** Mascara o CPF para exibição pública: "123.456.789-01" -> "***.456.789-**" */
export function maskCpf(cpf: string): string {
  const digits = onlyDigits(cpf);
  if (digits.length !== 11) return "***";
  return `***.${digits.slice(3, 6)}.${digits.slice(6, 9)}-**`;
}

/** Faixa etária de uma categoria em texto legível. */
export function formatAgeRange(minAge: number | null, maxAge: number | null): string | null {
  if (minAge !== null && maxAge !== null) return `${minAge} a ${maxAge} anos`;
  if (minAge !== null) return `A partir de ${minAge} anos`;
  if (maxAge !== null) return `Até ${maxAge} anos`;
  return null;
}
