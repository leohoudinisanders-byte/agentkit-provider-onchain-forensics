# agentkit-provider-onchain-forensics

Give a Coinbase AgentKit agent a way to check a token contract before it moves money.

Four actions, no LLM in the decision path: the agent asks a deterministic engine, and the engine
answers with a grade, a score and the evidence behind it.

```bash
npm install agentkit-provider-onchain-forensics @coinbase/agentkit zod
```

## Wire it in

```ts
import { AgentKit } from "@coinbase/agentkit";
import { onchainForensicsActionProvider } from "agentkit-provider-onchain-forensics";

const agentkit = await AgentKit.from({
  walletProvider,
  actionProviders: [
    onchainForensicsActionProvider(), // free daily samples need no signer
  ],
});

// With paid settlement wired through x402-fetch:
// onchainForensicsActionProvider({ payFetch: wrapFetchWithPayment(fetch, wallet) })
```

The provider reports `supportsNetwork` for any EVM network, and it never signs anything itself: it
reads public chain data, so an agent can screen a token before its wallet provider is ever touched.

## The four actions

| Action | The question it answers | Price |
| --- | --- | --- |
| `token_verdict` | Is this token alive, and how risky is a buy? | $0.02 |
| `settlesafe_check` | Can I settle in it or accept it as payment? | $0.02 |
| `token_mints` | Is supply still being printed? | $0.02 |
| `wallet_screen` | Does this counterparty wallet check out? | $0.05 |

A real `token_verdict` result:

```json
{
  "grade": "A",
  "grade_label": "LIVE AND BROAD",
  "activity_score_0_100": 89,
  "transfers_recent": 1504,
  "unique_wallets_recent": 640,
  "market_depth": { "available": true, "liquidity_usd": 30000000 },
  "data_quality": "COMPLETE"
}
```

The grade carries its basis. Depth can raise a flow-only grade but never lower one, never override
a risk flag, and never lift a non-token: a quiet token with $30M of liquidity reads `C / QUIET BUT
LIQUID`, not `F`.

## Paying for calls

Every route gives free trial calls each day, so a fresh agent gets a real answer before it needs a
wallet. Once that sample is spent, a route returns its x402 challenge and this provider returns it
as data instead of throwing:

```json
{
  "needs_payment": true,
  "route": "token_verdict",
  "price_usd": 0.02,
  "network": "Base",
  "pay_to": "0x8EBf…46fb9",
  "how_to_settle": "onchainForensicsActionProvider({ payFetch: … })"
}
```

So an agent with no signer still learns the exact cost of the decision, and an agent with one
proceeds. `createForensicsPlugin`-style options: `payFetch`, `creditKey` (sent as
`X-Credit-Key` for prepaid packs), `trial: false`.

Arguments are validated locally before any network call: a malformed address or an unsupported
chain throws immediately instead of reaching the API.

## Why an agent should not guess

A model that has never seen a contract will still answer "looks fine". `token_verdict` returns
`data_quality` and its observation window on every call, so a partial read is reported as partial
instead of being rounded down to zero. No signer, no data, or an unreadable chain all come back as
a labelled state, never as a confident "A".

Full catalog, prices and the OpenAPI spec: <https://onchainforensics.dev/llms.txt>

## Test

```bash
npm run smoke
```

Nine checks through a real `AgentKit.from(...)` instance: action registration, live answers from
all four routes, local schema rejection, the priced-challenge path with no signer, and the
`payFetch` hook.

MIT licensed. Issues: <https://github.com/leohoudinisanders-byte/agentkit-provider-onchain-forensics>.
