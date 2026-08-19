import { z } from "zod";
import { onlyDigits } from "./format";

/** Unidades da federação, para o seletor de estado. */
export const UFS = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA",
  "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN",
  "RS", "RO", "RR", "SC", "SP", "SE", "TO",
] as const;

/**
 * Valida CPF pelos dígitos verificadores (algoritmo da Receita Federal).
 * Rejeita também as sequências repetidas (000..., 111...), que passam no
 * cálculo mas nunca são CPFs válidos.
 */
export function isValidCpf(value: string): boolean {
  const digits = onlyDigits(value);
  if (digits.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(digits)) return false;

  const checkDigit = (length: number): number => {
    let sum = 0;
    for (let i = 0; i < length; i++) {
      sum += Number(digits[i]) * (length + 1 - i);
    }
    const remainder = (sum * 10) % 11;
    return remainder === 10 ? 0 : remainder;
  };

  return checkDigit(9) === Number(digits[9]) && checkDigit(10) === Number(digits[10]);
}

const cpfSchema = z
  .string()
  .transform(onlyDigits)
  .refine((v) => v.length === 11, { message: "CPF deve ter 11 dígitos" })
  .refine(isValidCpf, { message: "CPF inválido" });

const phoneSchema = z
  .string()
  .transform(onlyDigits)
  .refine((v) => v.length === 10 || v.length === 11, {
    message: "Telefone deve ter DDD + número (10 ou 11 dígitos)",
  });

const birthDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Data de nascimento inválida")
  .refine(
    (value) => {
      const date = new Date(`${value}T12:00:00-03:00`);
      if (Number.isNaN(date.getTime())) return false;
      const age = ageOn(date, new Date());
      return age >= 4 && age <= 100;
    },
    { message: "Data de nascimento fora do intervalo aceito" },
  );

/** Idade completa de alguém nascido em `birthDate`, na data `reference`. */
export function ageOn(birthDate: Date, reference: Date): number {
  let age = reference.getFullYear() - birthDate.getFullYear();
  const monthDiff = reference.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && reference.getDate() < birthDate.getDate())) {
    age -= 1;
  }
  return age;
}

export const pilotSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(5, "Informe o nome completo")
    .max(120, "Nome muito longo")
    .refine((v) => v.includes(" "), { message: "Informe nome e sobrenome" }),
  cpf: cpfSchema,
  birthDate: birthDateSchema,
  phone: phoneSchema,
  email: z.string().trim().toLowerCase().email("E-mail inválido").max(160),
  city: z.string().trim().min(2, "Informe a cidade").max(80),
  state: z.enum(UFS, { message: "Selecione o estado" }),
});

export const motorcycleSchema = z.object({
  number: z.string().trim().min(1, "Informe o número da moto").max(4, "Número muito longo"),
  brand: z.string().trim().min(2, "Informe a marca").max(40),
  model: z.string().trim().min(1, "Informe o modelo").max(40),
  displacement: z.string().trim().min(2, "Informe a cilindrada").max(20),
});

/**
 * Payload aceito por POST /api/registrations.
 *
 * Note que NÃO existe campo de preço nem de total: o servidor busca os preços
 * no banco e calcula o total sozinho. Qualquer valor enviado pelo navegador
 * seria ignorado — aqui ele nem é aceito pelo schema.
 */
export const createRegistrationSchema = z.object({
  pilot: pilotSchema,
  motorcycle: motorcycleSchema,
  categoryIds: z
    .array(z.string().min(1))
    .min(1, "Selecione ao menos uma categoria")
    .max(10, "Categorias demais em uma única inscrição")
    // Duplicatas são removidas antes de chegar ao banco; o índice único em
    // (registrationNumber, categoryId) é a segunda linha de defesa.
    .transform((ids) => Array.from(new Set(ids))),
});

export type CreateRegistrationInput = z.infer<typeof createRegistrationSchema>;
export type PilotInput = z.infer<typeof pilotSchema>;
export type MotorcycleInput = z.infer<typeof motorcycleSchema>;

export const createPaymentSchema = z.object({
  method: z.enum(["PIX", "CARD"]),
});
