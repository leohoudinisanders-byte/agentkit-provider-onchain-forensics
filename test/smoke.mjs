import { AgentKit } from "@coinbase/agentkit";
import { onchainForensicsActionProvider, callRoute } from "../dist/index.mjs";

const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
};

// A wallet provider stub: this provider never signs, it only reads public chain data.
const walletStub = {
  getAddress: () => "0x0000000000000000000000000000000000000001",
  getNetwork: () => ({ protocolFamily: "evm", networkId: "base-mainnet", chainId: "8453" }),
  getName: () => "stub-wallet",
};

const agentkit = await AgentKit.from({
  walletProvider: walletStub,
  actionProviders: [onchainForensicsActionProvider()],
});
const actions = agentkit.getActions();
const ours = actions.filter((a) => ["token_verdict", "settlesafe_check", "token_mints", "wallet_screen"].includes(a.name));
check("AgentKit registers all four actions", ours.length === 4, ours.map((a) => a.name).join(", "));

const byName = Object.fromEntries(actions.map((a) => [a.name, a]));
const verdict = await byName.token_verdict.invoke({
  address: "0x4200000000000000000000000000000000000006",
  chain: "base",
});
const v = JSON.parse(verdict);
check("token_verdict answers with a grade", ["A","B","C","D","F"].includes(v.grade), `grade ${v.grade} / score ${v.activity_score_0_100}`);

const settlesafe = JSON.parse(await byName.settlesafe_check.invoke({
  address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  chain: "base",
}));
check("settlesafe_check returns a settle decision", typeof settlesafe.settle_safe === "boolean", `${settlesafe.settle_safe} ${settlesafe.asset_status || ""}`);

const mints = JSON.parse(await byName.token_mints.invoke({
  address: "0x4200000000000000000000000000000000000006",
  chain: "base",
}));
check("token_mints reports mint activity", mints.mint_count !== undefined, `mint_count ${mints.mint_count}`);

const wallet = JSON.parse(await byName.wallet_screen.invoke({
  address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  chain: "base",
}));
check(
  "wallet_screen answers or prices the call, never crashes",
  wallet.trust_tier !== undefined || (wallet.needs_payment === true && wallet.price_usd === 0.05),
  wallet.trust_tier !== undefined ? `trust ${wallet.trust_tier}` : `free sample spent -> priced at $${wallet.price_usd}`,
);

// schema validation is real: bad input must throw, not reach the API
let threw = false;
try {
  await byName.token_verdict.invoke({ address: "not-an-address", chain: "base" });
} catch { threw = true; }
check("zod schema rejects a malformed address", threw, "0x-prefixed 40 hex enforced before any network call");

let enumThrew = false;
try { await byName.token_verdict.invoke({ address: "0x4200000000000000000000000000000000000006", chain: "dogecoin" }); }
catch { enumThrew = true; }
check("zod enum rejects an unsupported chain", enumThrew);

// paywall path: no signer + no free sample => a priced challenge, never a crash
const paidOnly = onchainForensicsActionProvider({ trial: false });
const challenge = JSON.parse(await paidOnly.getActions({}).find((a) => a.name === "token_verdict").invoke({
  address: "0x4200000000000000000000000000000000000006",
  chain: "base",
}));
check("paywall returns price and payTo instead of throwing", challenge.needs_payment === true && challenge.price_usd === 0.02, `$${challenge.price_usd} to ${String(challenge.pay_to).slice(0, 10)}…`);

// payFetch hook is honored
const hooked = onchainForensicsActionProvider({ payFetch: async () => new Response(JSON.stringify({ data: { grade: "A", activity_score_0_100: 99 } }), { status: 200 }) });
const hookedOut = JSON.parse(await hooked.getActions({}).find((a) => a.name === "token_verdict").invoke({ address: "0x4200000000000000000000000000000000000006", chain: "base" }));
check("payFetch hook is used when provided", hookedOut.grade === "A", JSON.stringify(hookedOut.grade));

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
if (failed.length) process.exitCode = 1;
