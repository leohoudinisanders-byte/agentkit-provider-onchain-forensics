"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/onchainForensicsActionProvider.ts
var onchainForensicsActionProvider_exports = {};
__export(onchainForensicsActionProvider_exports, {
  CATALOG: () => CATALOG,
  OnchainForensicsActionProvider: () => OnchainForensicsActionProvider,
  SERVICE: () => SERVICE,
  callRoute: () => callRoute,
  default: () => onchainForensicsActionProvider_default,
  onchainForensicsActionProvider: () => onchainForensicsActionProvider
});
module.exports = __toCommonJS(onchainForensicsActionProvider_exports);
var import_agentkit = require("@coinbase/agentkit");
var import_zod = require("zod");
var SERVICE = "onchain-forensics";
var CATALOG = "https://onchainforensics.dev/llms.txt";
var BASE = "https://solene-fa2010da.base44.app/functions";
var UA = "agentkit-provider-onchain-forensics/1.0.0 (+https://onchainforensics.dev)";
var ROUTES = {
  verdict: { fn: "forensicsVerdict", price: 0.02 },
  settlesafe: { fn: "forensicsSettlesafe", price: 0.02 },
  mints: { fn: "forensicsMints", price: 0.02 },
  wallet: { fn: "forensicsWallet", price: 0.05 }
};
function decodeChallenge(header) {
  try {
    const decoded = typeof atob === "function" ? atob(header) : Buffer.from(header, "base64").toString("utf8");
    const j = JSON.parse(decoded);
    const a = (j.accepts || [])[0] || {};
    return {
      price_usd: a.amount ? Number(a.amount) / 1e6 : null,
      network: a.network,
      asset: a.asset,
      payTo: a.payTo,
      maxTimeoutSeconds: a.maxTimeoutSeconds,
      x402Version: j.x402Version
    };
  } catch {
    return null;
  }
}
async function callRoute(routeKey, params = {}, opts = {}) {
  const route = ROUTES[routeKey];
  if (!route) throw new Error(`unknown route: ${routeKey}`);
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== void 0 && v !== null && v !== "") qs.set(k, String(v));
  }
  if (opts.trial !== false) qs.set("trial", "1");
  const url = `${BASE}/${route.fn}?${qs.toString()}`;
  const headers = { "User-Agent": UA, Accept: "application/json" };
  if (opts.creditKey) headers["X-Credit-Key"] = opts.creditKey;
  const doFetch = typeof opts.payFetch === "function" ? opts.payFetch : fetch;
  const started = Date.now();
  const res = await doFetch(url, { method: "GET", headers });
  const ms = Date.now() - started;
  const text = await res.text();
  let raw = null;
  try {
    raw = JSON.parse(text);
  } catch {
  }
  const header = res.headers.get("payment-required") || res.headers.get("PAYMENT-REQUIRED");
  const body = raw && raw.data && typeof raw.data === "object" ? raw.data : raw;
  return {
    status: res.status,
    ms,
    data: body,
    envelope: raw,
    challenge: res.status === 402 && header ? decodeChallenge(header) : null
  };
}
var CHAIN_ENUM = import_zod.z.enum(["base", "ethereum", "linea", "xrp", "solana", "canton"]);
var ADDRESS = import_zod.z.string().regex(/^0x[a-fA-F0-9]{40}$/, "expected a 0x-prefixed 40-hex-character address");
var TokenVerdictSchema = import_zod.z.object({
  address: ADDRESS.describe("ERC-20 contract address, 0x-prefixed (40 hex characters)."),
  chain: CHAIN_ENUM.optional().describe("Chain to read. Defaults to base.")
});
var SettlesafeSchema = import_zod.z.object({
  address: ADDRESS.describe("Contract address of the asset you are about to settle or accept."),
  chain: CHAIN_ENUM.optional().describe("Chain to read. Defaults to base.")
});
var MintsSchema = import_zod.z.object({
  address: ADDRESS.describe("ERC-20 contract address whose mint activity and supply inflation you want."),
  chain: CHAIN_ENUM.optional().describe("Chain to read. Defaults to base.")
});
var WalletScreenSchema = import_zod.z.object({
  address: ADDRESS.describe("Wallet address of the counterparty you are about to transact with."),
  chain: CHAIN_ENUM.optional().describe("Chain to read. Defaults to base.")
});
function paywall(routeKey, challenge) {
  if (!challenge) return JSON.stringify({ error: "no_payload", route: routeKey });
  const network = challenge.network === "eip155:8453" ? "Base" : challenge.network;
  return JSON.stringify({
    needs_payment: true,
    route: routeKey,
    price_usd: challenge.price_usd,
    network,
    asset: challenge.asset,
    pay_to: challenge.payTo,
    note: `The free daily sample for ${routeKey} is spent. This call costs $${challenge.price_usd} USDC on ${network}. This provider was constructed without a payFetch signer, so it can quote the price but not settle it.`,
    how_to_settle: "Construct the provider as onchainForensicsActionProvider({ payFetch: wrapFetchWithPayment(fetch, wallet) })."
  });
}
var OnchainForensicsActionProvider = class extends import_agentkit.ActionProvider {
  opts;
  constructor(config = {}) {
    super("onchain-forensics", []);
    this.opts = config;
  }
  supportsNetwork = (network) => !network?.protocolFamily || network.protocolFamily === "evm";
  async run(routeKey, args, shape) {
    const result = await callRoute(
      routeKey,
      { address: args.address, chain: args.chain || "base" },
      this.opts
    );
    if (result.status === 200 && result.data) {
      return JSON.stringify({
        paid: false,
        free_sample: true,
        latency_ms: result.ms,
        ...shape(result.data)
      });
    }
    return paywall(routeKey, result.challenge);
  }
  /** Grade a token A-F with holder breadth and DEX depth, before the agent buys or holds it. */
  tokenVerdict = async (rawArgs) => {
    const args = TokenVerdictSchema.parse(rawArgs);
    return this.run("verdict", args, (d) => ({
      address: args.address,
      chain: args.chain || "base",
      token: d.token_name || d.token_symbol || null,
      grade: d.grade,
      grade_label: d.grade_label || d.verdict_tier,
      activity_score_0_100: d.activity_score_0_100,
      transfers_recent: d.transfers_recent,
      unique_wallets_recent: d.unique_wallets_recent,
      window_min: d.window_min,
      flags: d.flags || [],
      market_depth: d.market_depth || null,
      data_quality: d.data_quality,
      plain_take: d.plain_take || null
    }));
  };
  /** Decide whether an asset is safe to settle in or accept as payment. */
  settlesafeCheck = async (rawArgs) => {
    const args = SettlesafeSchema.parse(rawArgs);
    return this.run("settlesafe", args, (d) => ({
      address: args.address,
      chain: args.chain || "base",
      settle_safe: d.settle_safe,
      asset_status: d.asset_status,
      reasons: d.reasons || [],
      risk_flags: d.risk_flags || [],
      plain_take: d.plain_take || null
    }));
  };
  /** Read mint activity: how much supply is still being created, over what window. */
  tokenMints = async (rawArgs) => {
    const args = MintsSchema.parse(rawArgs);
    return this.run("mints", args, (d) => {
      const win = d.window || {};
      const n = d.mint_count ?? d.events_returned ?? 0;
      const events = Array.isArray(d.events) ? d.events : [];
      const latest = events[0];
      return {
        address: args.address,
        chain: args.chain || "base",
        mint_count: n,
        total_minted: d.total_minted,
        window_min: win.window_min ?? null,
        data_quality: d.data_quality,
        latest_mint: latest ? { to: latest.to ?? latest.minter ?? null, block: latest.blockNumber ?? latest.block ?? null } : null,
        plain_take: n === 0 ? `No mint events in the last ${win.window_min ?? "?"} minutes, so supply is not being printed right now.` : `${n} mint event(s) in the last ${win.window_min ?? "?"} minutes creating ${d.total_minted ?? "?"} units.`
      };
    });
  };
  /** Screen a wallet before paying it or accepting payment from it. */
  walletScreen = async (rawArgs) => {
    const args = WalletScreenSchema.parse(rawArgs);
    return this.run("wallet", args, (d) => ({
      address: args.address,
      chain: args.chain || "base",
      trust_pass: d.trust_pass,
      trust_tier: d.trust_tier,
      is_contract: d.is_contract,
      eip_7702_delegated: d.eip_7702_delegated,
      total_txs_sent: d.total_txs_sent,
      distinct_tokens: d.distinct_tokens,
      unique_counterparties: d.unique_counterparties,
      trust_reasons: d.trust_reasons || [],
      eth_balance: d.eth_balance
    }));
  };
  getActions(_walletProvider) {
    return [
      {
        name: "token_verdict",
        description: "Grade a token before trading or holding it. Returns an A-F letter grade, a 0-100 activity score, recent transfer and holder counts, DEX depth, and risk flags. Use whenever the user names a token contract and asks whether it is safe, alive, worth buying, or a scam. Costs $0.02 per lookup after the free daily sample.",
        schema: TokenVerdictSchema,
        invoke: this.tokenVerdict
      },
      {
        name: "settlesafe_check",
        description: "Check whether an asset is safe to settle in or accept as payment: canonical registry match, ERC-20 readability, decimals and risk flags. Use before quoting a price in an unfamiliar token or signing a settlement. Costs $0.02 after the free daily sample.",
        schema: SettlesafeSchema,
        invoke: this.settlesafeCheck
      },
      {
        name: "token_mints",
        description: "Report mint activity on a token: how many mint events fired, how much supply they created, over what block window, and how complete the read was. Use when the user asks about supply inflation, hidden mint functions, or whether the team can print more. Costs $0.02 after the free daily sample.",
        schema: MintsSchema,
        invoke: this.tokenMints
      },
      {
        name: "wallet_screen",
        description: "Screen a wallet before you transact with it: trust tier and pass/fail, wallet vs contract, EIP-7702 delegation, transfer counts and distinct counterparties. Use when the user asks whether a counterparty wallet is safe to pay or accept payment from. Costs $0.05 after the free daily sample.",
        schema: WalletScreenSchema,
        invoke: this.walletScreen
      }
    ];
  }
};
var onchainForensicsActionProvider = (config = {}) => new OnchainForensicsActionProvider(config);
var onchainForensicsActionProvider_default = onchainForensicsActionProvider;
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  CATALOG,
  OnchainForensicsActionProvider,
  SERVICE,
  callRoute,
  onchainForensicsActionProvider
});
