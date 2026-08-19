# Campeonato de Motocross — site de inscrições

MVP de inscrição online para um campeonato de motocross: o piloto se inscreve
pelo celular, escolhe uma ou mais categorias, paga por PIX e recebe a
confirmação; o organizador acompanha tudo por um painel protegido.

**Stack:** Next.js 16 (App Router) · TypeScript · Tailwind CSS v4 · PostgreSQL ·
Prisma 7 · AbacatePay.

---

## ⚠️ Leia primeiro: o que ainda falta configurar

O código está pronto e testado, mas **três coisas dependem de você** e o site
não pode inventá-las. Enquanto não forem feitas, o site funciona e continua
honesto — ele avisa o que falta em vez de fingir que está tudo certo.

| O que | Onde | Sem isso… |
|---|---|---|
| **1. Chave da AbacatePay** | `ABACATEPAY_API_KEY` | Inscrições são criadas normalmente, mas a tela de pagamento exibe "Pagamentos ainda não configurados". Nenhuma cobrança é gerada. |
| **2. Webhook cadastrado no painel da AbacatePay** | painel + `ABACATEPAY_WEBHOOK_SECRET` | Pagamentos ainda são confirmados, porque o site também consulta o gateway ao abrir a página da inscrição e pelo botão do painel. Mas a confirmação deixa de ser instantânea. |
| **3. Dados reais do evento** | `src/config/event.ts` e `prisma/seed.ts` | O site exibe uma faixa de aviso em todas as páginas informando que os dados são de demonstração. |

Detalhes de cada um mais abaixo.

---

## Como rodar

Pré-requisitos: Node.js 20+ e um PostgreSQL acessível.

```bash
npm install
cp .env.example .env      # preencha DATABASE_URL (o resto pode ficar vazio por ora)
npm run db:migrate        # cria as tabelas
npm run db:seed           # carrega as categorias de DEMONSTRAÇÃO
npm run dev
```

O site sobe em <http://localhost:3000>.

### Comandos

| Comando | O que faz |
|---|---|
| `npm run dev` | Servidor de desenvolvimento |
| `npm run build` / `npm start` | Build e execução em produção |
| `npm run db:migrate` | Cria/aplica migrations (desenvolvimento) |
| `npm run db:deploy` | Aplica migrations existentes (produção) |
| `npm run db:seed` | Carrega as categorias de exemplo |
| `npm run db:studio` | Abre o Prisma Studio para editar dados na mão |
| `npm run typecheck` | Verificação de tipos |
| `npm run test:fluxo` | Testa o fluxo de pagamento ponta a ponta (ver abaixo) |

---

## Configuração do evento

Tudo que o organizador precisa mudar está em **dois lugares**:

### `src/config/event.ts` — informações do evento

Nome, data, local, horário de abertura, **programação**, regras, FAQ e contatos.
Nenhuma dessas informações está espalhada pelas páginas.

No topo do arquivo existe uma chave:

```ts
isDemoData: true,
```

Enquanto ela for `true`, uma faixa de aviso aparece em todas as páginas dizendo
que os dados são de demonstração. **Troque para `false` só depois de substituir
tudo pelas informações reais.**

### `prisma/seed.ts` — categorias e preços

Categorias, preços, faixa etária e número de vagas ficam **no banco**, não no
código, porque o valor cobrado precisa ser recalculado no servidor e o histórico
precisa ser preservado.

Edite `prisma/seed.ts` e rode `npm run db:seed` (é idempotente: rodar de novo
atualiza em vez de duplicar). Para ajustes pontuais, `npm run db:studio` edita
direto no banco.

> **Preços são sempre em CENTAVOS.** `15000` = R$ 150,00. Essa é a unidade que a
> AbacatePay usa, e mantê-la ponta a ponta elimina erro de arredondamento.

As categorias que vêm no seed (MX1, MX2, Intermediária, Amador, Júnior) são
**exemplos**, não as categorias oficiais de nenhum campeonato.

---

## Integração com a AbacatePay

### O que foi confirmado na fonte oficial

Este projeto **não** foi escrito a partir de suposições sobre a API. Os
endpoints, nomes de campos, formatos e status abaixo foram lidos nas definições
de tipos dos pacotes oficiais publicados pela AbacatePay no npm —
[`@abacatepay/types`](https://www.npmjs.com/package/@abacatepay/types) e
[`@abacatepay/rest`](https://www.npmjs.com/package/@abacatepay/rest).

| Item | Valor |
|---|---|
| Base URL | `https://api.abacatepay.com/v1` |
| Autenticação | header `Authorization: Bearer <chave>` |
| Valores | sempre em centavos, mínimo `100` (R$ 1,00) |
| Envelope de resposta | `{ data, error }` |
| QR Code PIX | `POST /pixQrCode/create` → `brCode`, `brCodeBase64` |
| Conferir PIX | `GET /pixQrCode/check?id=` |
| Simular pagamento | `POST /pixQrCode/simulate-payment?id=` (só em devMode) |
| Checkout hospedado | `POST /billing/create` → `url` |
| Status possíveis | `PENDING` · `EXPIRED` · `CANCELLED` · `PAID` · `REFUNDED` |
| Evento de webhook | `billing.paid` |

Usamos a **API v1** de propósito: ela aceita os produtos declarados na própria
requisição, enquanto a v2 exige produtos previamente cadastrados no painel — um
passo de configuração externa a mais, dispensável para um evento montado em
poucos dias.

O cliente HTTP está em [`src/lib/abacatepay.ts`](src/lib/abacatepay.ts), com a
procedência de cada endpoint comentada.

### Cartão de crédito é BETA

A documentação oficial marca o método `CARD` como **recurso em beta**, cuja
disponibilidade depende de liberação na conta do organizador.

Por isso o botão de cartão vem **desligado**. Para habilitá-lo, confirme no
painel da AbacatePay que o método está ativo na sua conta e então defina:

```
ABACATEPAY_CARD_ENABLED=true
```

Quando ligado, o pagamento com cartão acontece no **checkout hospedado da
AbacatePay** (`billing/create`). Nenhum dado de cartão passa por este servidor —
não existe, e não deve existir, processamento próprio de cartão aqui.

---

## Webhook

### Cadastro no painel da AbacatePay

1. Escolha um segredo forte, por exemplo: `openssl rand -base64 32`
2. Coloque-o em `ABACATEPAY_WEBHOOK_SECRET` no servidor.
3. No painel da AbacatePay, cadastre a URL do webhook **com o segredo na query
   string**:

   ```
   https://SEU-DOMINIO.com/api/webhooks/abacatepay?webhookSecret=SEU_SEGREDO
   ```

4. Assine o evento `billing.paid`.

O endpoint recusa com **401** qualquer chamada cujo segredo não bata (comparação
em tempo constante).

### O webhook não confirma pagamento sozinho

Esta é a decisão de arquitetura mais importante do projeto:

> **O corpo do webhook é tratado como uma dica não confiável.** No máximo, ele
> diz *qual cobrança olhar*. Quem decide se a inscrição está paga é o servidor,
> perguntando o status **diretamente à API da AbacatePay** com a chave secreta.

Consequência prática: mesmo que alguém descubra a URL e o segredo e forje um
evento `billing.paid` impecável, **nenhuma inscrição vira PAGA** — a conferência
com o gateway devolveria `PENDING`. Esse cenário é testado em
`npm run test:fluxo`.

Efeito colateral bem-vindo: se o webhook atrasar ou se perder, o pagamento ainda
é confirmado, porque a mesma conferência roda quando o piloto abre a página da
inscrição e quando o organizador clica em "Conferir pagamento no gateway".

### Assinatura HMAC (opcional, desligada por padrão)

Além do segredo na query string, o endpoint sabe validar uma assinatura
HMAC-SHA256 do corpo bruto.

**Deixei desligada de propósito.** Não consegui confirmar em primeira mão, na
documentação oficial, qual header e qual segredo a sua conta usa — e ligar uma
validação com o header errado faria o endpoint recusar eventos legítimos.

Para ativar, **depois de confirmar os valores no painel da AbacatePay**:

```
ABACATEPAY_WEBHOOK_SIGNING_SECRET=<segredo de assinatura>
ABACATEPAY_WEBHOOK_SIGNATURE_HEADER=x-webhook-signature   # ajuste se for outro
```

A verificação aceita a assinatura em base64 ou hex, sempre em tempo constante.
Com a variável vazia, essa camada simplesmente não roda — o segredo na query
string continua sendo obrigatório.

### Proteções do endpoint

| Risco | Proteção |
|---|---|
| Webhook duplicado | `id` do evento gravado em `WebhookEvent` com índice único; reentrega vira no-op |
| Pagamento duplicado | `gatewayPaymentId` é único; a confirmação é condicionada a `status ≠ PAID` |
| Evento forjado | O status vem da consulta à API, não do corpo do evento |
| Valor adulterado | O valor da cobrança é conferido contra o total da inscrição antes de confirmar |
| Cobrança de outro sistema | Cobrança desconhecida é registrada no log e ignorada |
| Falha temporária | Responde 500 e libera o registro de idempotência, para a AbacatePay reenviar |

---

## Segurança

- **Nenhum segredo chega ao navegador.** Nenhuma variável usa o prefixo
  `NEXT_PUBLIC_`, e os módulos que leem ambiente importam `server-only`, o que
  quebra o build se forem importados de um Client Component.
- **O preço nunca vem do frontend.** O corpo aceito pela API de inscrição nem
  sequer tem campo de preço ou total (veja `createRegistrationSchema`). O
  servidor lê os preços do banco, dentro de uma transação, e soma. Adulterar a
  requisição não muda um centavo.
- **O preço é congelado.** `RegistrationCategory.priceCents` guarda o valor
  aplicado na hora da inscrição. Mudar o preço da categoria depois não altera
  inscrições já feitas.
- **URLs de inscrição não são enumeráveis.** O endereço público usa um
  `publicId` aleatório, não o número sequencial.
- **Sessão do admin** em cookie `httpOnly`, `SameSite=Lax`, `Secure` em
  produção, assinado com HMAC-SHA256 e validado em tempo constante. Cookie
  forjado ou expirado é recusado.
- **Server Actions revalidam a sessão**, já que são endpoints HTTP próprios e
  não herdam a proteção do layout.
- Páginas de inscrição e do painel são marcadas `noindex`.

### Painel administrativo

```
ADMIN_PASSWORD=<senha do organizador>
ADMIN_SESSION_SECRET=<openssl rand -base64 48>
```

Acesso em `/admin`. Sem essas variáveis, a tela de login informa que o painel
não está configurado — em vez de ficar aberto.

O modelo é senha única, adequado a um evento pontual. Se no futuro houver vários
organizadores, troque `src/lib/admin-auth.ts` por uma biblioteca de
autenticação; nada mais no projeto depende dele além de uma função.

---

## Teste do fluxo de pagamento

```bash
npm run test:fluxo
```

Exercita a regra crítica do sistema sem mover dinheiro e sem depender de rede:
o script substitui o `fetch` global por um dublê que responde no formato
documentado da AbacatePay. **Nenhum código de produção é alterado para o
teste** — o dublê entra por baixo, no `fetch`.

O que é verificado:

1. Total somado pelo servidor a partir dos preços do banco
2. Inscrição nasce pendente e continua pendente depois de gerar a cobrança
3. **Webhook forjado com o gateway dizendo `PENDING` não confirma a inscrição**
4. Pagamento aprovado pelo gateway confirma a inscrição
5. Reentrega do webhook não confirma duas vezes nem duplica pagamento
6. Alterar o preço da categoria não altera inscrições anteriores
7. Gateway devolvendo valor divergente faz a cobrança ser recusada

### Testando com dinheiro de mentira na AbacatePay

Com uma chave de **desenvolvimento** configurada, as cobranças nascem com
`devMode: true` e o site as identifica como teste na tela e no painel. O
endpoint `POST /v1/pixQrCode/simulate-payment?id=<id>` da AbacatePay marca uma
dessas cobranças como paga, permitindo ensaiar o fluxo real antes do evento.

---

## Deploy

1. Provisione um PostgreSQL e aponte `DATABASE_URL` para ele.
2. Configure as variáveis de `.env.example` no painel do provedor.
3. Defina `APP_BASE_URL` com a URL pública (sem barra final) — ela monta as
   URLs de retorno enviadas ao gateway.
4. Rode `npm run db:deploy` e depois `npm run db:seed`.
5. Cadastre a URL do webhook no painel da AbacatePay (seção acima).

`prisma generate` roda no `postinstall`, então o cliente é gerado
automaticamente no build.

---

## Estrutura

```
src/
  config/event.ts        Configuração do evento — o arquivo do organizador
  lib/
    abacatepay.ts        Cliente da API v1, com a procedência de cada endpoint
    payments.ts          Criação de cobrança e reconciliação (único lugar que grava PAID)
    registrations.ts     Regras da inscrição e cálculo do total no servidor
    validation.ts        Schemas Zod compartilhados entre cliente e servidor
    admin-auth.ts        Sessão do painel
    admin-data.ts        Consultas do painel
    db.ts  env.ts  format.ts
  app/
    page.tsx                        Início
    evento/  categorias/            Páginas informativas
    inscricao/                      Formulário em etapas
    inscricao/[publicId]/           Comprovante e status
    inscricao/[publicId]/pagamento/ Pagamento
    admin/login/                    Login (fora da guarda de sessão)
    admin/(protected)/              Painel — a guarda cobre tudo aqui dentro
    api/registrations/              Criação, cobrança e status
    api/webhooks/abacatepay/        Webhook
  components/            Peças de UI
prisma/
  schema.prisma          Modelo de dados
  seed.ts                Categorias de DEMONSTRAÇÃO
scripts/
  test-fluxo.mts         Teste ponta a ponta do pagamento
```

---

## Fora de escopo (de propósito)

Ranking, sistema de pontos, app mobile, login de piloto, chat, patrocinadores e
qualquer coisa que não estivesse no caminho crítico entre "piloto abre o site" e
"organizador vê a inscrição paga". O prazo era de poucos dias; o que está aqui é
o que precisa funcionar no dia da prova.
