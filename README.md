# Primeiro Motocross CT 147 — site de inscrições

Site de inscrição online do **Primeiro Motocross CT 147**, em Coronel Xavier
Chaves — Povoado da Invernada, nos dias **22 e 23 de agosto**. O piloto se
inscreve pelo celular, escolhe uma ou mais categorias, paga por PIX ou cartão
pelo checkout da InfinitePay e recebe a confirmação; o organizador acompanha
tudo por um painel protegido.

**Stack:** Next.js 16 (App Router) · TypeScript · Tailwind CSS v4 · PostgreSQL ·
Prisma 7 · InfinitePay.

---

## ⚠️ Leia primeiro: o que ainda falta configurar

O código está pronto e testado, mas **três coisas dependem de informação que
ainda não existe**. Enquanto não forem preenchidas, o site funciona e continua
honesto — avisa o que falta em vez de fingir que está tudo certo.

| O que | Onde | Sem isso… |
|---|---|---|
| **1. Preços das categorias** | painel, em `/admin/categorias` | **As inscrições não abrem.** As 15 categorias existem, mas aparecem como "valor a definir" e o servidor recusa inscrição nelas. Os preços não estavam legíveis no material, e um valor chutado seria pior que nenhum. |
| **2. InfiniteTag** | `INFINITEPAY_HANDLE` | Inscrições são criadas normalmente, mas a tela de pagamento exibe "Pagamentos ainda não configurados". Nenhum link de checkout é gerado. |
| **3. Webhook cadastrado no painel da InfinitePay** | painel + `INFINITEPAY_WEBHOOK_SECRET` | Pagamentos ainda são confirmados, porque o site também consulta o gateway quando o piloto volta do checkout e pelo botão do painel. Mas a confirmação deixa de ser instantânea se o piloto fechar a aba antes de voltar. |

Detalhes de cada um mais abaixo.

> Existe também uma **confirmação manual** no painel (`/admin/inscricoes/[número]`),
> para receber por fora do gateway quando necessário — ver seção própria abaixo.

---

## Informação oficial × informação não configurada

O site distingue as duas coisas em todo lugar, e essa distinção é a regra
central do projeto.

**Está no site porque veio do material oficial:** nome, subtítulo "Pista de cara
nova!", local, as datas 22 e 23/08 com os horários informados (10:00/14:00 no
sábado, 09:00/12:00 no domingo), entrada de 1 kg de alimento, as 15 categorias,
a Categoria Leiteiro com o prêmio kit churrasco + cerveja, a hospedagem no local
e o telefone (32) 99999-6803.

**Não está no site porque a organização não informou:** preços, endereço
completo, coordenadas, regulamento, idade mínima ou máxima, documentos exigidos,
limite de pilotos, premiações além da Leiteiro, horários de treino,
classificatória, abertura ou premiação, e condições da hospedagem.

Esses campos não foram preenchidos com valores plausíveis. Eles ficam vazios, e
o site se adapta: seções sem conteúdo não aparecem, e o que bloqueia uma ação
(o preço) é anunciado com todas as letras. Quando a organização informar
qualquer um deles, basta preencher o campo correspondente — a estrutura já
existe.

---

## Como rodar

Pré-requisitos: Node.js 20+ e um PostgreSQL acessível.

```bash
npm install
cp .env.example .env      # preencha DATABASE_URL (o resto pode ficar vazio por ora)
npm run db:migrate        # cria as tabelas
npm run db:seed           # carrega as 15 categorias oficiais (sem preço)
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
| `npm run db:seed` | Carrega as 15 categorias oficiais |
| `npm run db:studio` | Abre o Prisma Studio para editar dados na mão |
| `npm run typecheck` | Verificação de tipos |
| `npm run test:fluxo` | Testa o fluxo de pagamento ponta a ponta (ver abaixo) |

---

## Configuração do evento

### `src/config/event.ts` — informações do evento

Nome, subtítulo, local, datas e horários, entrada, hospedagem, contato e ações
especiais. Nenhuma dessas informações está repetida nas páginas.

Campos que a organização ainda não informou estão como `null`, e a estrutura já
está pronta para recebê-los:

```ts
location: {
  name: "Povoado da Invernada",
  city: "Coronel Xavier Chaves",
  state: null,       // não informado
  address: null,     // endereço completo, quando houver
  latitude: null,
  longitude: null,
  mapsUrl: null,     // preenchendo, o botão "Ver rota" aparece sozinho
},
```

Mesma lógica para `registrationsCloseAt` (sem prazo definido, as inscrições
seguem abertas), `rules` (vazio, a seção de regras não aparece) e
`description`.

**Não preencha um campo só para não deixá-lo vazio.** Vazio é uma informação
honesta; inventado, não.

### Preços — no painel, não no código

Preços e descrições ficam **no banco**, e o organizador os define em
**`/admin/categorias`**, sem tocar em código.

Uma categoria com preço `null` significa **valor não definido** — e não
gratuito. Enquanto estiver assim:

- aparece no site marcada como "valor a definir";
- **ninguém consegue se inscrever nela** — o bloqueio é no servidor, não só na
  tela: uma requisição montada à mão recebe `409 PRICE_NOT_SET`;
- o painel exibe um aviso listando exatamente quais categorias faltam;
- se *nenhuma* categoria tiver preço, a home troca o botão de inscrição por
  "ver categorias" e explica que as inscrições abrem quando os valores saírem.

Para definir: entre em `/admin/categorias`, digite o valor em reais (`150` ou
`150,00`) e salve. O site público reflete na hora. Apagar o campo devolve a
categoria para "a definir".

> Inscrições já feitas **mantêm** o valor cobrado na época
> (`RegistrationCategory.priceCents`). Mudar o preço no painel afeta apenas as
> próximas.

### As 15 categorias oficiais

MX1 · MX2 · MX3 · MX4 · Nacional A · Nacional B · Trilheiros · Local · 50cc ·
65cc · 80cc · Intermediária A · Intermediária B · Força Livre Nacional · Força
Livre Importada

Carregadas por `npm run db:seed`, que é idempotente e **não sobrescreve preços
já definidos** no painel.

---

## Integração com a InfinitePay

### O que foi confirmado, e como

A InfinitePay não publica um pacote de tipos oficial. Os campos abaixo foram
conferidos contra **duas integrações reais e independentes** (um módulo
WooCommerce e um módulo WHMCS, ambos em produção) — e testados ao vivo: os
dois domínios de API documentados respondem o mesmo formato de erro para uma
requisição inválida, então qualquer um dos dois funciona.

| Item | Valor |
|---|---|
| Base URL | `https://api.infinitepay.io/invoices/public/checkout` |
| Autenticação | o `handle` (sua InfiniteTag) no corpo da requisição — **não** é um secret de servidor |
| Autenticação extra (opcional) | header `Authorization: Bearer <token>`, só se a sua conta exigir |
| Valores | sempre em centavos, mínimo `100` (R$ 1,00) |
| Criar link de checkout | `POST /links` → `{ url }` |
| Conferir pagamento | `POST /payment_check` → `{ paid, amount, paid_amount, ... }` |
| Retorno do checkout | a InfinitePay redireciona com `?slug=&transaction_nsu=&order_nsu=&capture_method=&receipt_url=` |

Diferenças importantes em relação a um gateway com API key de servidor
(AbacatePay, Stripe etc.):

- **Não existe QR Code PIX embutido no site.** Só checkout hospedado — o
  piloto é sempre redirecionado para a página da InfinitePay, escolhe PIX ou
  cartão por lá, e volta para cá depois.
- **Não existe modo de teste/sandbox documentado.** Todo link criado é real.
  `npm run test:fluxo` continua funcionando porque substitui o `fetch`, não
  depende de um `devMode` do gateway.
- **O webhook não manda um status "pago".** Manda `amount` e `paid_amount` —
  quem decide se bate é o nosso servidor (ver seção Webhook).

O cliente HTTP está em [`src/lib/infinitepay.ts`](src/lib/infinitepay.ts), com
a procedência de cada campo comentada.

### Legado: AbacatePay

Este projeto usava a AbacatePay antes. O cliente
([`src/lib/abacatepay.ts`](src/lib/abacatepay.ts)) e a rota de webhook
(`src/app/api/webhooks/abacatepay/`) continuam no repositório, mas
**nada em `payments.ts` os chama mais** — foram deixados como referência e
para o caso de a conta ser aprovada e fizer sentido voltar a usá-la. Uma
cobrança antiga com `kind = PIX_QRCODE` ou `BILLING` (se houver) ainda é
conferível por `reconcilePayment()`, mas nenhuma cobrança nova nasce assim.

---

## Webhook

### Cadastro no painel da InfinitePay

Diferente da AbacatePay, **não precisa cadastrar nada manualmente no
painel**: a URL do webhook é enviada junto com o `handle` toda vez que um link
de checkout é criado (campo `webhook_url` em `POST /links`), já com o segredo
embutido na query string.

1. Escolha um segredo forte, por exemplo: `openssl rand -base64 32`
2. Coloque-o em `INFINITEPAY_WEBHOOK_SECRET` no servidor.
3. Pronto — toda cobrança nova já nasce apontando para
   `https://SEU-DOMINIO.com/api/webhooks/infinitepay?webhookSecret=SEU_SEGREDO`.

O endpoint recusa com **401** qualquer chamada cujo segredo não bata (comparação
em tempo constante).

### O webhook não confirma pagamento sozinho

Esta é a decisão de arquitetura mais importante do projeto — e ela vale tanto
para a InfinitePay quanto valia para a AbacatePay:

> **O corpo do webhook é tratado como uma dica não confiável.** No máximo, ele
> diz *qual cobrança olhar* (`order_nsu`, `transaction_nsu`, `invoice_slug`).
> Quem decide se a inscrição está paga é o servidor, perguntando `paid` e
> `paid_amount` **diretamente à API da InfinitePay** via `payment_check`.

Consequência prática: mesmo que alguém descubra a URL e o segredo e forje um
evento com `paid_amount` alto, **nenhuma inscrição vira PAGA** — a InfinitePay
não tem registro dessa transação, e `payment_check` devolveria `paid: false`.
Esse cenário é testado em `npm run test:fluxo`.

Efeito colateral bem-vindo: se o webhook atrasar ou se perder, o pagamento
ainda é confirmado, porque a mesma conferência roda quando o piloto volta do
checkout (a InfinitePay manda `slug`/`transaction_nsu` na URL de retorno) e
quando o organizador clica em "Conferir pagamento no gateway".

**Limitação honesta:** sem `slug` e `transaction_nsu`, não há como perguntar
nada à InfinitePay — e eles só existem depois que o piloto volta do checkout
ou o webhook chega uma vez. Até lá, a inscrição fica PENDENTE mesmo que o
pagamento já tenha sido aprovado no cartão/PIX do piloto.

### Proteções do endpoint

| Risco | Proteção |
|---|---|
| Webhook duplicado | `transaction_nsu` gravado em `WebhookEvent` com índice único; reentrega vira no-op |
| Pagamento duplicado | `gatewayPaymentId` (`order_nsu`, gerado por nós) é único; a confirmação é condicionada a `status ≠ PAID` |
| Evento forjado | O status vem da consulta a `payment_check`, não do corpo do evento |
| Valor incompleto | `paid_amount` precisa cobrir o `amountCents` cobrado antes de confirmar |
| Cobrança de outro sistema | `order_nsu` desconhecido é registrado no log e ignorado |
| Falha temporária | Responde 500 e libera o registro de idempotência, para a InfinitePay reenviar |

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
ADMIN_EMAIL=<identificador do organizador>
ADMIN_PASSWORD=<senha do organizador>
ADMIN_SESSION_SECRET=<openssl rand -base64 48>
```

Acesso em `/admin`. Sem essas três variáveis, a tela de login informa que o
painel não está configurado — em vez de ficar aberto.

`ADMIN_EMAIL` não precisa ter formato de e-mail de verdade — é só um segundo
campo que soma à senha, comparado em tempo constante como a senha. O modelo é
credencial única, adequado a um evento pontual. Se no futuro houver vários
organizadores, troque `src/lib/admin-auth.ts` por uma biblioteca de
autenticação; nada mais no projeto depende dele além de uma função.

---

## Teste do fluxo de pagamento

```bash
npm run test:fluxo
```

Exercita a regra crítica do sistema sem mover dinheiro e sem depender de rede:
o script substitui o `fetch` global por um dublê que responde no formato
conferido da InfinitePay. **Nenhum código de produção é alterado para o
teste** — o dublê entra por baixo, no `fetch`.

O que é verificado:

1. Total somado pelo servidor a partir dos preços do banco
2. Inscrição nasce pendente e continua pendente depois de gerar o link de checkout
3. **Retorno forjado com o gateway dizendo "não pago" não confirma a inscrição**
4. Pagamento aprovado pelo gateway confirma a inscrição
5. Reentrega do webhook não confirma duas vezes nem duplica pagamento
6. Alterar o preço da categoria não altera inscrições anteriores
7. **Categoria sem preço é recusada** (`PRICE_NOT_SET`), sem gravar inscrição parcial
8. Gateway confirmando `paid_amount` menor que o cobrado faz a confirmação ser recusada

### Testando com dinheiro de verdade

A InfinitePay não documenta um modo sandbox: **toda cobrança criada com uma
InfiniteTag real é real**, mesmo em desenvolvimento. Não há como ensaiar o
fluxo completo sem mover pelo menos R$ 1,00 de verdade — `npm run test:fluxo`
é o único jeito de testar a lógica sem gastar dinheiro, porque ele nem chega a
tocar a rede.

Enquanto a conta não estiver pronta para receber pelo gateway, o painel tem
uma **confirmação manual** (`/admin/inscricoes/[número]`) para registrar um
pagamento recebido por fora — ver seção "Confirmação manual" abaixo.

---

## Confirmação manual de pagamento

Em `/admin/inscricoes/[número]`, qualquer inscrição ainda não paga tem a opção
**"Recebeu por fora do gateway?"** — para quando o piloto pagou diretamente na
chave PIX pessoal do organizador, por exemplo.

A nota descrevendo como o pagamento foi recebido é **obrigatória**: como não
há gateway para conferir, ela é o único registro de auditoria dessa
confirmação. Fica gravada em `Payment.notes` e aparece no detalhe da
inscrição e na exportação CSV.

---

## Deploy

1. Provisione um PostgreSQL e aponte `DATABASE_URL` para ele.
2. Configure as variáveis de `.env.example` no painel do provedor.
3. Defina `APP_BASE_URL` com a URL pública (sem barra final) — ela monta as
   URLs de retorno enviadas ao gateway.
4. Rode `npm run db:deploy` e depois `npm run db:seed`.
5. Defina `INFINITEPAY_HANDLE` e `INFINITEPAY_WEBHOOK_SECRET` (seção Webhook
   acima) — o cadastro do webhook em si é automático, feito a cada link criado.
6. Entre em `/admin/categorias` e **defina os preços** — as inscrições só abrem
   depois disso.

`prisma generate` roda no `postinstall`, então o cliente é gerado
automaticamente no build.

---

## Estrutura

```
src/
  config/event.ts        Configuração do evento — o arquivo do organizador
  lib/
    infinitepay.ts       Cliente da InfinitePay, com a procedência de cada campo
    abacatepay.ts        Legado — não é mais chamado por payments.ts (ver README)
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
    admin/(protected)/categorias/   Definição de preços pelo organizador
    api/registrations/              Criação, cobrança e status
    api/webhooks/infinitepay/       Webhook
    api/webhooks/abacatepay/        Legado
  components/            Peças de UI
prisma/
  schema.prisma          Modelo de dados
  seed.ts                As 15 categorias oficiais
scripts/
  test-fluxo.mts         Teste ponta a ponta do pagamento
```

---

## Fora de escopo (de propósito)

Ranking, sistema de pontos, app mobile, login de piloto, chat, patrocinadores e
qualquer coisa que não estivesse no caminho crítico entre "piloto abre o site" e
"organizador vê a inscrição paga". O prazo era de poucos dias; o que está aqui é
o que precisa funcionar no dia da prova.
