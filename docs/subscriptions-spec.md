# Spec: Camada de Assinatura (Pro) — modelo híbrido

Fecha o modelo híbrido: **créditos por uso** (já existe, p/ IA/áudio) + **assinatura Pro**
(novo, p/ acesso/recursos de custo marginal ~zero).

## Decisões de design

- **Recorrência via CARTÃO** (AbacatePay só garante débito automático no cartão; PIX
  recorrente não é documentado). PIX permanece só nos créditos avulsos.
- **Pro inclui N créditos/mês** (sugestão: 30) creditados em cada `subscription.renewed`,
  além de destravar recursos. Aumenta valor percebido; recarga avulsa continua existindo.
- Fonte da verdade dos limites = tabela `subscriptions`, lida por `get_my_limits()`.

## 1. Migration: tabela `subscriptions`

```sql
create table subscriptions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  plan text not null default 'free' check (plan in ('free','pro')),
  status text not null default 'active'
    check (status in ('active','past_due','canceled')),
  current_period_end timestamptz,
  abacate_subscription_id text,
  updated_at timestamptz not null default now()
);
-- RLS: SELECT próprio; writes só via service role (edge functions).
```

`get_my_limits()` passa a fazer JOIN em `subscriptions`: se `plan='pro'` e
`status='active'` e `current_period_end > now()` → limites altos; senão → free.
Definir os dois tiers de `maxDecks/maxTotalCards/maxCardsPerDeck/maxMediaBytes`.

## 2. Edge Function `create-subscription` (espelha `buy-credits`)

- Valida JWT (mesmo padrão linhas 61-71 de buy-credits).
- Map server-side de plano → `productId` (produto com ciclo MONTHLY/ANNUALLY no dashboard,
  via env `ABACATE_PRODUCT_PRO_MONTHLY` etc).
- `POST /subscriptions/create` com `items`, `customer`, `externalId=user.id`,
  `metadata={user_id, plan, grant_credits}`, `methods:["CARD"]`, return/completion URLs.
- Retorna `{ url }` pro front redirecionar.

## 3. Estender `abacate-webhook`

Manter validação HMAC/timestamp/secret atual. Adicionar branches por `event.event`:

| Evento                                | Ação                                                                                                                                                                                            |
| ------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `subscription.completed`              | upsert `subscriptions` → plan=pro, status=active, set `current_period_end`, `abacate_subscription_id`; creditar bônus mensal (idempotente via `credit_ai` com `p_abacate_id=sub:<id>:<period>`) |
| `subscription.renewed`                | estender `current_period_end`; creditar bônus do novo período (idempotente)                                                                                                                     |
| `subscription.cancelled`              | status=canceled (mantém acesso até `current_period_end`)                                                                                                                                        |
| `checkout.completed` / `billing.paid` | fluxo de créditos atual (ver ⚠️ abaixo)                                                                                                                                                         |

⚠️ **Verificar**: handler atual só trata `billing.paid`. Confirmar se v2 manda
`checkout.completed` p/ o fluxo de créditos — tratar ambos os nomes por segurança.

## 4. Front-end

- `usePlan()` já expõe os limites; adicionar `plan` ('free'|'pro') e `isPro`.
- Tela de Pricing/Upgrade (em Profile ou rota nova) com Pro mensal/anual → chama
  `create-subscription` → redireciona p/ checkout. `completionUrl=/profile?plan=success`.
- Gates de UI nos recursos Pro lendo `isPro`: stats avançadas, export, decks ilimitados,
  mídia/áudio. CTA "Fazer upgrade" onde o free bate no limite.

## 5. Verificação / rollout

1. Testar fluxo de créditos atual em produção (resolver ⚠️ do nome do evento).
2. Provisionar produtos Pro com ciclo no dashboard AbacatePay.
3. Secrets: `ABACATE_PRODUCT_PRO_MONTHLY`, `ABACATE_PRODUCT_PRO_ANNUAL`.
4. Testar webhook em devMode antes de produção.

Refs doc: https://docs.abacatepay.com/pages/webhooks · https://docs.abacatepay.com/pages/subscriptions
