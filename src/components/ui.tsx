import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

/**
 * Peças visuais reutilizadas pelo site. Ficam juntas de propósito: são poucas,
 * pequenas, e mantê-las em um arquivo evita caçar componente por pasta.
 */

/** Título de seção com a barra inclinada laranja. */
export function SectionTitle({
  children,
  eyebrow,
  className = "",
}: {
  children: ReactNode;
  eyebrow?: string;
  className?: string;
}) {
  return (
    <div className={className}>
      {eyebrow && <p className="display-label mb-2 text-sm text-race-500">{eyebrow}</p>}
      <h2 className="display-title flex items-center gap-3 text-3xl text-chalk sm:text-4xl">
        <span aria-hidden className="block h-8 w-1.5 -skew-x-12 bg-race-500 sm:h-10" />
        {children}
      </h2>
    </div>
  );
}

type ButtonVariant = "primary" | "secondary" | "ghost";

const buttonStyles: Record<ButtonVariant, string> = {
  primary: "bg-race-500 text-dirt-950 hover:bg-race-400",
  secondary: "border-2 border-chalk/25 bg-transparent text-chalk hover:border-race-500 hover:text-race-400",
  ghost: "bg-dirt-800 text-chalk hover:bg-dirt-700",
};

const buttonBase =
  "display-label tap-target inline-flex items-center justify-center -skew-x-12 px-6 text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50";

/** Botão inclinado — o "corte" diagonal é a assinatura visual do site. */
export function ActionButton({
  variant = "primary",
  className = "",
  children,
  ...props
}: ComponentProps<"button"> & { variant?: ButtonVariant }) {
  return (
    <button className={`${buttonBase} ${buttonStyles[variant]} ${className}`} {...props}>
      <span className="skew-x-12">{children}</span>
    </button>
  );
}

/** Mesma aparência do `ActionButton`, mas navegando. */
export function ActionLink({
  variant = "primary",
  className = "",
  children,
  href,
  ...props
}: ComponentProps<typeof Link> & { variant?: ButtonVariant }) {
  return (
    <Link href={href} className={`${buttonBase} ${buttonStyles[variant]} ${className}`} {...props}>
      <span className="skew-x-12">{children}</span>
    </Link>
  );
}

/** Cartão padrão das listagens. */
export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`border border-dirt-800 bg-dirt-900 ${className}`}>{children}</div>
  );
}

/** Par rótulo/valor usado nas revisões e no painel. */
export function DataRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-dirt-800 py-2.5 last:border-b-0">
      <dt className="display-label text-xs text-chalk-dim">{label}</dt>
      <dd className="text-right text-sm font-medium text-chalk">{value}</dd>
    </div>
  );
}

const statusStyles = {
  PENDING: "border-race-500/50 bg-race-500/10 text-race-400",
  PAID: "border-flag-500/50 bg-flag-500/10 text-flag-400",
  CANCELLED: "border-dirt-600 bg-dirt-800 text-chalk-dim",
  EXPIRED: "border-dirt-600 bg-dirt-800 text-chalk-dim",
  REFUNDED: "border-dirt-600 bg-dirt-800 text-chalk-dim",
  FAILED: "border-red-500/50 bg-red-500/10 text-red-400",
} as const;

const statusLabels = {
  PENDING: "Pendente",
  PAID: "Pago",
  CANCELLED: "Cancelado",
  EXPIRED: "Expirado",
  REFUNDED: "Estornado",
  FAILED: "Falhou",
} as const;

export type StatusKey = keyof typeof statusStyles;

export function StatusBadge({ status }: { status: StatusKey }) {
  return (
    <span
      className={`display-label inline-flex items-center border px-2.5 py-1 text-xs ${statusStyles[status]}`}
    >
      {statusLabels[status]}
    </span>
  );
}

/** Caixa de erro/alerta com contraste suficiente para leitura no sol. */
export function Alert({
  tone = "error",
  title,
  children,
}: {
  tone?: "error" | "info" | "success";
  title?: string;
  children: ReactNode;
}) {
  const tones = {
    error: "border-red-500/50 bg-red-500/10 text-red-200",
    info: "border-race-500/40 bg-race-500/10 text-race-200",
    success: "border-flag-500/50 bg-flag-500/10 text-flag-400",
  };

  return (
    <div role={tone === "error" ? "alert" : "status"} className={`border p-4 text-sm ${tones[tone]}`}>
      {title && <p className="display-label mb-1 text-xs">{title}</p>}
      {children}
    </div>
  );
}
