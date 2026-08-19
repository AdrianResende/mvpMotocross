import { NextResponse } from "next/server";
import { createRegistrationSchema } from "@/lib/validation";
import { createRegistration, RegistrationError } from "@/lib/registrations";

/**
 * POST /api/registrations — cria uma inscrição.
 *
 * O corpo aceito NÃO tem campo de preço nem de total (veja
 * `createRegistrationSchema`). O servidor lê os preços do banco e calcula o
 * total sozinho, então adulterar a requisição não altera o valor cobrado.
 */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Corpo da requisição inválido." }, { status: 400 });
  }

  const parsed = createRegistrationSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Dados inválidos.",
        // Mapa campo -> mensagem, para o formulário destacar o campo certo.
        fieldErrors: parsed.error.issues.reduce<Record<string, string>>((acc, issue) => {
          const path = issue.path.join(".");
          if (path && !acc[path]) acc[path] = issue.message;
          return acc;
        }, {}),
      },
      { status: 400 },
    );
  }

  try {
    const registration = await createRegistration(parsed.data);
    return NextResponse.json(
      {
        number: registration.number,
        publicId: registration.publicId,
        totalCents: registration.totalCents,
      },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof RegistrationError) {
      // 409: o pedido é válido, mas conflita com o estado atual (vaga
      // esgotada, inscrição duplicada, prazo encerrado).
      return NextResponse.json({ error: error.message, code: error.code }, { status: 409 });
    }

    console.error("[inscrição] Falha ao criar inscrição:", error);
    return NextResponse.json(
      { error: "Não foi possível criar a inscrição. Tente novamente." },
      { status: 500 },
    );
  }
}
