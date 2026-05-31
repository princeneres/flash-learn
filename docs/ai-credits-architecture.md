# Arquitetura: Cobrança de geração com AI por créditos (AbacatePay)

> Status: em implementação. Decisões: **1 crédito = 1 geração**, **somente créditos pagos**
> (BYOK removido), pacotes R$ 9,90 / 10 · R$ 29,90 / 50 · R$ 79,90 / 200.

## Problema

Hoje a geração de decks com AI é **BYOK** (bring-your-own-key): o `LlmService` roda no
browser e chama a OpenAI/Anthropic direto com a chave do usuário (guardada no
`localStorage`). Queremos centralizar **uma chave OpenAI nossa** e cobrar do usuário por
geração. A chave nunca pode ir para o browser — toda chamada à OpenAI passa a ser
server-side.

## Visão geral

```
Browser ──buy-credits──▶ Edge Fn ──checkout──▶ AbacatePay ──PIX──▶ usuário paga
                                                     │
                          Edge Fn ◀──billing.paid (webhook, HMAC+secret)──┘
                          credita saldo em ai_credits
Browser ──ai-generate──▶ Edge Fn ──debita 1 crédito──▶ chama OpenAI (chave secreta)──▶ cards
```

Segredos (somente nas Edge Functions, nunca no bundle):
`OPENAI_API_KEY`, `ABACATEPAY_API_KEY`, `ABACATEPAY_WEBHOOK_SECRET`,
`ABACATE_PRODUCT_*` (IDs dos produtos/pacotes).

## Modelo de dados

- `ai_credits(user_id, balance, updated_at)` — saldo por usuário.
- `ai_credit_ledger(id, user_id, delta, reason, abacate_id unique, created_at)` —
  histórico auditável; `abacate_id` único garante idempotência do webhook.
- `ai_credit_orders(id, user_id, credits, amount_cents, status, abacate_id, created_at)` —
  pedidos de compra (pending → paid/expired).
- `debit_ai_credit(uid)` — débito atômico (`balance > 0`), grava no ledger, lança
  `INSUFFICIENT_CREDITS` se sem saldo.
- `credit_ai(uid, n, reason, abacate_id)` — crédito idempotente (no-op se `abacate_id` já
  existe no ledger).
- `get_ai_credits()` — saldo do usuário autenticado.
- `handle_new_user` estendido: concede **3 créditos de cortesia** no signup.

RLS: usuário lê só o próprio saldo/ledger/orders; escrita só via `service_role`
(Edge Functions) / funções `security definer`.

## Edge Functions

### `ai-generate` (verify_jwt = true)

Único caminho de geração. Valida o JWT, chama `debit_ai_credit(uid)`, e só então chama a
OpenAI com a `OPENAI_API_KEY`. Contém a lógica migrada do antigo `LlmService`
(`buildPrompt`, chamada OpenAI, `coerceCards`). Se a OpenAI falhar após o débito, **estorna**
o crédito (`credit_ai(..., reason='refund')`). Retorna `{ cards }`.

### `buy-credits` (verify_jwt = true)

Recebe `{ packId }`. Mapeia pack → preço/créditos/ID de produto **no servidor** (nunca
confiar no cliente). Cria `ai_credit_orders` pendente e um checkout PIX na AbacatePay com
`externalId = order.id` e `metadata = { user_id, credits }`. Retorna `{ url }`.

### `abacate-webhook` (verify_jwt = false)

Chamado pela AbacatePay. Segurança em camadas: confere `?webhookSecret=` na query,
`x-webhook-timestamp` (anti-replay 5 min) e HMAC SHA-256 do corpo cru
(`x-webhook-signature`, comparação constante). Em `billing.paid`: lê `metadata.user_id` e
créditos, chama `credit_ai(...)` com `abacate_id` (idempotente) e marca a order como `paid`.

## Frontend

- `LlmService` vira cliente fino: `generateCards(opts)` → `supabase.functions.invoke('ai-generate')`.
  Removidos `getConfig/saveConfig/clearConfig/testConnection/isConfigured` e o `localStorage`.
- `AiCreditService` + hook `useAiCredits()` — lê saldo via `get_ai_credits`, abre checkout.
- `AiDeckDialog` — mostra saldo; se 0, CTA "Comprar créditos".
- `Profile` — remove `LlmSettings`, adiciona seção de créditos (saldo, pacotes, histórico).
- i18n: novas chaves `ai.credits.*`.

## Pacotes

| packId  | Créditos | Preço    | Custo OpenAI aprox. | Margem |
| ------- | -------- | -------- | ------------------- | ------ |
| starter | 10       | R$ 9,90  | ~R$ 0,10            | ~99%   |
| popular | 50       | R$ 29,90 | ~R$ 0,50            | ~98%   |
| pro     | 200      | R$ 79,90 | ~R$ 2,00            | ~97%   |

## Setup operacional

1. `supabase secrets set OPENAI_API_KEY=... ABACATEPAY_API_KEY=... ABACATEPAY_WEBHOOK_SECRET=...`
   e os `ABACATE_PRODUCT_*` (IDs dos produtos criados na AbacatePay).
2. Dashboard AbacatePay → Webhooks → URL
   `https://<proj>.supabase.co/functions/v1/abacate-webhook?webhookSecret=<secret>`,
   evento `billing.paid`.
3. Testar com devmode da AbacatePay (PIX simulado).

## Ordem de implementação

1. Migration (tabelas + funções + cortesia no signup).
2. `ai-generate` + migração do `LlmService`.
3. `buy-credits` + `abacate-webhook` + config.toml.
4. UI (saldo, pacotes, histórico) + i18n + remoção do BYOK.
