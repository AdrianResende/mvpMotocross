"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { hasAdminSession } from "@/lib/admin-auth";

/**
 * Edição de categorias pelo organizador.
 *
 * A sessão é revalidada aqui: Server Actions são endpoints HTTP próprios e não
 * herdam a proteção do layout.
 */

const updateSchema = z.object({
  categoryId: z.string().min(1),
  /**
   * Preço em REAIS, como o organizador digita ("150" ou "150,00").
   * Vazio limpa o preço e volta a categoria para "a definir".
   */
  price: z.string(),
  active: z.boolean(),
  description: z.string().max(300),
});

export type UpdateCategoryState = { error?: string; success?: string };

/** Converte "1.234,56" ou "1234.56" em centavos. Vazio devolve `null`. */
function parsePriceToCents(input: string): number | null | "invalid" {
  const trimmed = input.trim();
  if (!trimmed) return null;

  // Aceita vírgula ou ponto como separador decimal; remove separador de milhar.
  const normalized = trimmed
    .replace(/\s/g, "")
    .replace(/^R\$/i, "")
    .replace(/\.(?=\d{3}(\D|$))/g, "")
    .replace(",", ".");

  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return "invalid";

  const cents = Math.round(Number(normalized) * 100);
  if (!Number.isSafeInteger(cents) || cents < 0) return "invalid";

  // A AbacatePay recusa cobranças abaixo de R$ 1,00.
  if (cents > 0 && cents < 100) return "invalid";

  return cents;
}

export async function updateCategoryAction(
  _previous: UpdateCategoryState,
  formData: FormData,
): Promise<UpdateCategoryState> {
  if (!(await hasAdminSession())) {
    return { error: "Sessão expirada. Entre novamente." };
  }

  const parsed = updateSchema.safeParse({
    categoryId: formData.get("categoryId"),
    price: String(formData.get("price") ?? ""),
    active: formData.get("active") === "on",
    description: String(formData.get("description") ?? ""),
  });

  if (!parsed.success) {
    return { error: "Dados inválidos." };
  }

  const priceCents = parsePriceToCents(parsed.data.price);
  if (priceCents === "invalid") {
    return {
      error: "Valor inválido. Use um número como 150 ou 150,00 (mínimo R$ 1,00).",
    };
  }

  const description = parsed.data.description.trim();

  await prisma.category.update({
    where: { id: parsed.data.categoryId },
    data: {
      priceCents,
      active: parsed.data.active,
      description: description ? description : null,
    },
  });

  // As páginas públicas leem preço e disponibilidade, então precisam refletir
  // a mudança imediatamente.
  revalidatePath("/");
  revalidatePath("/categorias");
  revalidatePath("/inscricao");
  revalidatePath("/admin/categorias");
  revalidatePath("/admin");

  return {
    success:
      priceCents === null
        ? "Preço removido. A categoria volta para “a definir” e não aceita inscrição."
        : "Categoria atualizada.",
  };
}
