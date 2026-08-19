import { eventConfig } from "@/config/event";

/**
 * Botão de contato pelo WhatsApp.
 *
 * Some sozinho se a organização não tiver número cadastrado, em vez de
 * renderizar um link quebrado.
 */
export function WhatsAppButton({
  label,
  variant = "primary",
  message,
}: {
  label: string;
  variant?: "primary" | "secondary";
  /** Texto pré-preenchido na conversa. */
  message?: string;
}) {
  const { whatsapp } = eventConfig.contact;
  if (!whatsapp) return null;

  const href = message
    ? `https://wa.me/${whatsapp}?text=${encodeURIComponent(message)}`
    : `https://wa.me/${whatsapp}`;

  const styles =
    variant === "primary"
      ? "bg-race-500 text-dirt-950 hover:bg-race-400"
      : "border-2 border-chalk/25 text-chalk hover:border-race-500 hover:text-race-400";

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={`display-label tap-target inline-flex -skew-x-12 items-center justify-center px-6 text-sm transition-colors ${styles}`}
    >
      <span className="skew-x-12">{label}</span>
    </a>
  );
}
