"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { z } from "zod";
import { motorcycleSchema, pilotSchema, UFS } from "@/lib/validation";
import { formatAgeRange, formatCents, formatCpf, formatPhone, onlyDigits } from "@/lib/format";
import { SelectField, TextField } from "./form-fields";
import { ActionButton, Alert, Card } from "./ui";

/**
 * Formulário de inscrição em 4 etapas.
 *
 * Divide-se em etapas curtas porque o site é usado majoritariamente no celular:
 * poucos campos por tela, teclado certo em cada campo e um botão grande.
 *
 * O total exibido aqui é apenas informativo. Quem calcula o valor cobrado é o
 * servidor, a partir dos preços gravados no banco — nenhum preço sai daqui na
 * requisição.
 */

export type CategoryOption = {
  id: string;
  name: string;
  description: string;
  priceCents: number;
  minAge: number | null;
  maxAge: number | null;
  isFull: boolean;
  remainingSpots: number | null;
};

const STEPS = ["Piloto", "Moto", "Categorias", "Revisão"] as const;

type PilotForm = Record<keyof z.infer<typeof pilotSchema>, string>;
type MotorcycleForm = Record<keyof z.infer<typeof motorcycleSchema>, string>;

const emptyPilot: PilotForm = {
  fullName: "",
  cpf: "",
  birthDate: "",
  phone: "",
  email: "",
  city: "",
  state: "" as PilotForm["state"],
};

const emptyMotorcycle: MotorcycleForm = {
  number: "",
  brand: "",
  model: "",
  displacement: "",
};

export function RegistrationForm({ categories }: { categories: CategoryOption[] }) {
  const router = useRouter();

  const [step, setStep] = useState(0);
  const [pilot, setPilot] = useState<PilotForm>(emptyPilot);
  const [motorcycle, setMotorcycle] = useState<MotorcycleForm>(emptyMotorcycle);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const selected = useMemo(
    () => categories.filter((category) => selectedIds.includes(category.id)),
    [categories, selectedIds],
  );

  const totalCents = useMemo(
    () => selected.reduce((sum, category) => sum + category.priceCents, 0),
    [selected],
  );

  function updatePilot(field: keyof PilotForm, value: string) {
    setPilot((current) => ({ ...current, [field]: value }));
    clearError(`pilot.${field}`);
  }

  function updateMotorcycle(field: keyof MotorcycleForm, value: string) {
    setMotorcycle((current) => ({ ...current, [field]: value }));
    clearError(`motorcycle.${field}`);
  }

  function clearError(key: string) {
    setErrors((current) => {
      if (!(key in current)) return current;
      const next = { ...current };
      delete next[key];
      return next;
    });
  }

  function toggleCategory(id: string) {
    setSelectedIds((current) =>
      current.includes(id) ? current.filter((value) => value !== id) : [...current, id],
    );
    clearError("categoryIds");
  }

  /** Valida a etapa atual e avança. Erros ficam ao lado do campo. */
  function goForward() {
    setSubmitError(null);

    if (step === 0) {
      const result = pilotSchema.safeParse(pilot);
      if (!result.success) {
        setErrors(collectErrors(result.error, "pilot"));
        return;
      }
    }

    if (step === 1) {
      const result = motorcycleSchema.safeParse(motorcycle);
      if (!result.success) {
        setErrors(collectErrors(result.error, "motorcycle"));
        return;
      }
    }

    if (step === 2 && selectedIds.length === 0) {
      setErrors({ categoryIds: "Selecione ao menos uma categoria." });
      return;
    }

    setErrors({});
    setStep((current) => Math.min(current + 1, STEPS.length - 1));
    scrollToTop();
  }

  function goBack() {
    setSubmitError(null);
    setStep((current) => Math.max(current - 1, 0));
    scrollToTop();
  }

  async function submit() {
    setSubmitting(true);
    setSubmitError(null);

    try {
      const response = await fetch("/api/registrations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // Só dados. Nenhum preço, nenhum total — o servidor calcula.
        body: JSON.stringify({ pilot, motorcycle, categoryIds: selectedIds }),
      });

      const payload = await response.json();

      if (!response.ok) {
        if (payload.fieldErrors) setErrors(payload.fieldErrors);
        setSubmitError(payload.error ?? "Não foi possível criar a inscrição.");
        setSubmitting(false);
        scrollToTop();
        return;
      }

      // Segue direto para o pagamento. `replace` impede que o botão "voltar"
      // reenvie o formulário e crie uma inscrição duplicada.
      router.replace(`/inscricao/${payload.publicId}/pagamento`);
    } catch {
      setSubmitError("Falha de conexão. Verifique sua internet e tente novamente.");
      setSubmitting(false);
      scrollToTop();
    }
  }

  return (
    <div>
      <StepIndicator current={step} />

      {submitError && (
        <div className="mt-6">
          <Alert title="Não deu certo">{submitError}</Alert>
        </div>
      )}

      <div className="mt-6">
        {step === 0 && (
          <StepPanel title="Dados do piloto" description="Usamos esses dados na inscrição e no comprovante.">
            <TextField
              label="Nome completo"
              value={pilot.fullName}
              onChange={(event) => updatePilot("fullName", event.target.value)}
              error={errors["pilot.fullName"]}
              autoComplete="name"
              autoCapitalize="words"
              enterKeyHint="next"
              placeholder="Nome e sobrenome"
            />
            <TextField
              label="CPF"
              value={pilot.cpf}
              onChange={(event) => updatePilot("cpf", onlyDigits(event.target.value).slice(0, 11))}
              error={errors["pilot.cpf"]}
              inputMode="numeric"
              enterKeyHint="next"
              placeholder="Somente números"
              hint={pilot.cpf.length === 11 ? formatCpf(pilot.cpf) : "11 dígitos, sem pontos"}
            />
            <TextField
              label="Data de nascimento"
              type="date"
              value={pilot.birthDate}
              onChange={(event) => updatePilot("birthDate", event.target.value)}
              error={errors["pilot.birthDate"]}
              enterKeyHint="next"
            />
            <TextField
              label="Telefone / WhatsApp"
              value={pilot.phone}
              onChange={(event) => updatePilot("phone", onlyDigits(event.target.value).slice(0, 11))}
              error={errors["pilot.phone"]}
              inputMode="tel"
              autoComplete="tel"
              enterKeyHint="next"
              placeholder="DDD + número"
              hint={pilot.phone.length >= 10 ? formatPhone(pilot.phone) : "Ex.: 11999998888"}
            />
            <TextField
              label="E-mail"
              type="email"
              value={pilot.email}
              onChange={(event) => updatePilot("email", event.target.value)}
              error={errors["pilot.email"]}
              inputMode="email"
              autoComplete="email"
              autoCapitalize="off"
              enterKeyHint="next"
              placeholder="voce@email.com"
            />
            <div className="grid gap-5 sm:grid-cols-[1fr_120px]">
              <TextField
                label="Cidade"
                value={pilot.city}
                onChange={(event) => updatePilot("city", event.target.value)}
                error={errors["pilot.city"]}
                autoComplete="address-level2"
                autoCapitalize="words"
                enterKeyHint="next"
              />
              <SelectField
                label="Estado"
                value={pilot.state}
                onChange={(event) => updatePilot("state", event.target.value)}
                error={errors["pilot.state"]}
              >
                <option value="">UF</option>
                {UFS.map((uf) => (
                  <option key={uf} value={uf}>
                    {uf}
                  </option>
                ))}
              </SelectField>
            </div>
          </StepPanel>
        )}

        {step === 1 && (
          <StepPanel title="Dados da moto" description="Ajuda a organização a montar a grid e a vistoria.">
            <TextField
              label="Número da moto"
              value={motorcycle.number}
              onChange={(event) => updateMotorcycle("number", event.target.value.slice(0, 4))}
              error={errors["motorcycle.number"]}
              inputMode="numeric"
              enterKeyHint="next"
              placeholder="Ex.: 27"
            />
            <TextField
              label="Marca"
              value={motorcycle.brand}
              onChange={(event) => updateMotorcycle("brand", event.target.value)}
              error={errors["motorcycle.brand"]}
              autoCapitalize="words"
              enterKeyHint="next"
              placeholder="Ex.: Honda"
            />
            <TextField
              label="Modelo"
              value={motorcycle.model}
              onChange={(event) => updateMotorcycle("model", event.target.value)}
              error={errors["motorcycle.model"]}
              autoCapitalize="words"
              enterKeyHint="next"
              placeholder="Ex.: CRF 250"
            />
            <TextField
              label="Cilindrada"
              value={motorcycle.displacement}
              onChange={(event) => updateMotorcycle("displacement", event.target.value)}
              error={errors["motorcycle.displacement"]}
              enterKeyHint="next"
              placeholder="Ex.: 250cc 4T"
            />
          </StepPanel>
        )}

        {step === 2 && (
          <StepPanel
            title="Categorias"
            description="Marque quantas quiser. O total é somado automaticamente."
          >
            {errors.categoryIds && <Alert>{errors.categoryIds}</Alert>}

            <div className="space-y-3">
              {categories.map((category) => {
                const isSelected = selectedIds.includes(category.id);
                const ageRange = formatAgeRange(category.minAge, category.maxAge);

                return (
                  <label
                    key={category.id}
                    className={`flex cursor-pointer gap-3 border-2 p-4 transition-colors ${
                      category.isFull
                        ? "cursor-not-allowed border-dirt-800 bg-dirt-900 opacity-50"
                        : isSelected
                          ? "border-race-500 bg-race-500/10"
                          : "border-dirt-700 bg-dirt-900 hover:border-dirt-600"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      disabled={category.isFull}
                      onChange={() => toggleCategory(category.id)}
                      className="mt-1 h-5 w-5 shrink-0 accent-race-500"
                    />
                    <span className="flex-1">
                      <span className="flex flex-wrap items-baseline justify-between gap-x-3">
                        <span className="display-title text-xl text-chalk">{category.name}</span>
                        <span className="display-label text-lg text-race-400">
                          {formatCents(category.priceCents)}
                        </span>
                      </span>
                      <span className="mt-1 block text-sm text-chalk-dim">
                        {category.description}
                      </span>
                      <span className="mt-1.5 flex flex-wrap gap-x-4 text-xs text-dirt-600">
                        {ageRange && <span>{ageRange}</span>}
                        {category.isFull ? (
                          <span className="text-red-400">Vagas esgotadas</span>
                        ) : (
                          category.remainingSpots !== null && (
                            <span>{category.remainingSpots} vagas restantes</span>
                          )
                        )}
                      </span>
                    </span>
                  </label>
                );
              })}
            </div>

            <TotalBox totalCents={totalCents} count={selected.length} />
          </StepPanel>
        )}

        {step === 3 && (
          <StepPanel title="Revise sua inscrição" description="Confira tudo antes de pagar.">
            <ReviewBlock
              title="Dados do piloto"
              onEdit={() => setStep(0)}
              rows={[
                ["Nome", pilot.fullName],
                ["CPF", formatCpf(pilot.cpf)],
                ["Telefone", formatPhone(pilot.phone)],
                ["E-mail", pilot.email],
                ["Cidade", `${pilot.city} — ${pilot.state}`],
              ]}
            />

            <ReviewBlock
              title="Moto"
              onEdit={() => setStep(1)}
              rows={[
                ["Número", motorcycle.number],
                ["Marca", motorcycle.brand],
                ["Modelo", motorcycle.model],
                ["Cilindrada", motorcycle.displacement],
              ]}
            />

            <Card className="p-4">
              <div className="flex items-center justify-between gap-4">
                <h3 className="display-label text-xs text-race-400">Categorias</h3>
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="text-xs text-chalk-dim underline underline-offset-2 hover:text-chalk"
                >
                  Alterar
                </button>
              </div>
              <dl className="mt-3">
                {selected.map((category) => (
                  <div
                    key={category.id}
                    className="flex justify-between gap-4 border-b border-dirt-800 py-2.5 last:border-b-0"
                  >
                    <dt className="text-sm text-chalk">{category.name}</dt>
                    <dd className="text-sm font-medium text-chalk">
                      {formatCents(category.priceCents)}
                    </dd>
                  </div>
                ))}
              </dl>
            </Card>

            <TotalBox totalCents={totalCents} count={selected.length} />

            <p className="text-xs text-dirt-600">
              O valor final é conferido pelo servidor no momento da cobrança, a partir
              dos preços cadastrados. Ele não depende do que está exibido nesta tela.
            </p>
          </StepPanel>
        )}
      </div>

      {/* Barra de ação: no celular fica colada no rodapé, sempre ao alcance. */}
      <div className="sticky bottom-0 z-30 -mx-4 mt-8 border-t border-dirt-800 bg-dirt-950/95 px-4 py-4 backdrop-blur">
        <div className="flex gap-3">
          {step > 0 && (
            <ActionButton type="button" variant="secondary" onClick={goBack} disabled={submitting}>
              Voltar
            </ActionButton>
          )}

          {step < STEPS.length - 1 ? (
            <ActionButton type="button" onClick={goForward} className="flex-1">
              Continuar
            </ActionButton>
          ) : (
            <ActionButton type="button" onClick={submit} disabled={submitting} className="flex-1">
              {submitting ? "Criando inscrição…" : "Confirmar e pagar"}
            </ActionButton>
          )}
        </div>
      </div>
    </div>
  );
}

function collectErrors(error: z.ZodError, prefix: string): Record<string, string> {
  return error.issues.reduce<Record<string, string>>((acc, issue) => {
    const key = `${prefix}.${issue.path.join(".")}`;
    if (!acc[key]) acc[key] = issue.message;
    return acc;
  }, {});
}

function scrollToTop() {
  if (typeof window !== "undefined") {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
}

function StepIndicator({ current }: { current: number }) {
  return (
    <ol className="flex gap-1.5">
      {STEPS.map((label, index) => (
        <li key={label} className="flex-1">
          <div
            className={`h-1 -skew-x-12 ${index <= current ? "bg-race-500" : "bg-dirt-800"}`}
          />
          <p
            className={`display-label mt-2 text-[0.65rem] sm:text-xs ${
              index === current ? "text-race-400" : "text-dirt-600"
            }`}
          >
            {index + 1}. {label}
          </p>
        </li>
      ))}
    </ol>
  );
}

function StepPanel({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2 className="display-title text-3xl text-chalk">{title}</h2>
      <p className="mt-1.5 text-sm text-chalk-dim">{description}</p>
      <div className="mt-6 space-y-5">{children}</div>
    </section>
  );
}

function ReviewBlock({
  title,
  rows,
  onEdit,
}: {
  title: string;
  rows: Array<[string, string]>;
  onEdit: () => void;
}) {
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between gap-4">
        <h3 className="display-label text-xs text-race-400">{title}</h3>
        <button
          type="button"
          onClick={onEdit}
          className="text-xs text-chalk-dim underline underline-offset-2 hover:text-chalk"
        >
          Alterar
        </button>
      </div>
      <dl className="mt-3">
        {rows.map(([label, value]) => (
          <div
            key={label}
            className="flex justify-between gap-4 border-b border-dirt-800 py-2.5 last:border-b-0"
          >
            <dt className="text-sm text-chalk-dim">{label}</dt>
            <dd className="text-right text-sm font-medium text-chalk">{value}</dd>
          </div>
        ))}
      </dl>
    </Card>
  );
}

function TotalBox({ totalCents, count }: { totalCents: number; count: number }) {
  return (
    <div className="flex items-center justify-between gap-4 border-2 border-race-500 bg-race-500/10 p-4">
      <div>
        <p className="display-label text-xs text-race-400">Total</p>
        <p className="mt-0.5 text-xs text-chalk-dim">
          {count === 0
            ? "Nenhuma categoria selecionada"
            : `${count} categoria${count > 1 ? "s" : ""}`}
        </p>
      </div>
      <p className="display-title text-3xl text-chalk">{formatCents(totalCents)}</p>
    </div>
  );
}
