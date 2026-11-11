/**
 * On-chain Forensics action provider for Coinbase AgentKit.
 *
 * Four actions an agent can reach for before it moves money: grade a token, check whether an
 * asset is safe to settle in, read mint activity, and screen a counterparty wallet.
 *
 * Every answer comes from the live On-chain Forensics x402 API. Calls start on the free daily
 * sample; when that is spent the route returns its real 402 challenge, which this provider
 * decodes into price, network and payTo so the agent can state cost instead of failing. To
 * settle paid calls, pass `payFetch` (for example a fetch wrapper from x402-fetch).
 */
import { ActionProvider } from "@coinbase/agentkit";
import type { Action, Network, WalletProvider } from "@coinbase/agentkit";
import { z } from "zod";
export declare const SERVICE = "onchain-forensics";
export declare const CATALOG = "https://onchainforensics.dev/llms.txt";
declare const ROUTES: {
    readonly verdict: {
        readonly fn: "forensicsVerdict";
        readonly price: 0.02;
    };
    readonly settlesafe: {
        readonly fn: "forensicsSettlesafe";
        readonly price: 0.02;
    };
    readonly mints: {
        readonly fn: "forensicsMints";
        readonly price: 0.02;
    };
    readonly wallet: {
        readonly fn: "forensicsWallet";
        readonly price: 0.05;
    };
};
type RouteKey = keyof typeof ROUTES;
export interface ForensicsConfig {
    /** Fetch wrapper that settles x402 402s, e.g. from x402-fetch. */
    payFetch?: typeof fetch;
    /** Credit key for prepaid tiers, sent as X-Credit-Key. */
    creditKey?: string;
    /** Ask for the free daily trial call first (default true). */
    trial?: boolean;
}
export interface ForensicsChallenge {
    price_usd: number | null;
    network?: string;
    asset?: string;
    payTo?: string;
    maxTimeoutSeconds?: number;
    x402Version?: number;
}
export interface RouteResult {
    status: number;
    ms: number;
    data: Record<string, unknown> | null;
    envelope: Record<string, unknown> | null;
    challenge: ForensicsChallenge | null;
}
/** One call to a Forensics route. Never throws on 402: the decoded challenge comes back. */
export declare function callRoute(routeKey: RouteKey, params?: Record<string, string | number | undefined>, opts?: ForensicsConfig): Promise<RouteResult>;
declare const TokenVerdictSchema: z.ZodObject<{
    address: z.ZodString;
    chain: z.ZodOptional<z.ZodEnum<["base", "ethereum", "linea", "xrp", "solana", "canton"]>>;
}, "strip", z.ZodTypeAny, {
    address: string;
    chain?: "base" | "ethereum" | "linea" | "xrp" | "solana" | "canton" | undefined;
}, {
    address: string;
    chain?: "base" | "ethereum" | "linea" | "xrp" | "solana" | "canton" | undefined;
}>;
declare const SettlesafeSchema: z.ZodObject<{
    address: z.ZodString;
    chain: z.ZodOptional<z.ZodEnum<["base", "ethereum", "linea", "xrp", "solana", "canton"]>>;
}, "strip", z.ZodTypeAny, {
    address: string;
    chain?: "base" | "ethereum" | "linea" | "xrp" | "solana" | "canton" | undefined;
}, {
    address: string;
    chain?: "base" | "ethereum" | "linea" | "xrp" | "solana" | "canton" | undefined;
}>;
declare const MintsSchema: z.ZodObject<{
    address: z.ZodString;
    chain: z.ZodOptional<z.ZodEnum<["base", "ethereum", "linea", "xrp", "solana", "canton"]>>;
}, "strip", z.ZodTypeAny, {
    address: string;
    chain?: "base" | "ethereum" | "linea" | "xrp" | "solana" | "canton" | undefined;
}, {
    address: string;
    chain?: "base" | "ethereum" | "linea" | "xrp" | "solana" | "canton" | undefined;
}>;
declare const WalletScreenSchema: z.ZodObject<{
    address: z.ZodString;
    chain: z.ZodOptional<z.ZodEnum<["base", "ethereum", "linea", "xrp", "solana", "canton"]>>;
}, "strip", z.ZodTypeAny, {
    address: string;
    chain?: "base" | "ethereum" | "linea" | "xrp" | "solana" | "canton" | undefined;
}, {
    address: string;
    chain?: "base" | "ethereum" | "linea" | "xrp" | "solana" | "canton" | undefined;
}>;
/**
 * Action provider for the On-chain Forensics x402 API.
 */
export declare class OnchainForensicsActionProvider extends ActionProvider {
    private readonly opts;
    constructor(config?: ForensicsConfig);
    supportsNetwork: (network: Network) => boolean;
    private run;
    /** Grade a token A-F with holder breadth and DEX depth, before the agent buys or holds it. */
    tokenVerdict: (rawArgs: z.infer<typeof TokenVerdictSchema>) => Promise<string>;
    /** Decide whether an asset is safe to settle in or accept as payment. */
    settlesafeCheck: (rawArgs: z.infer<typeof SettlesafeSchema>) => Promise<string>;
    /** Read mint activity: how much supply is still being created, over what window. */
    tokenMints: (rawArgs: z.infer<typeof MintsSchema>) => Promise<string>;
    /** Screen a wallet before paying it or accepting payment from it. */
    walletScreen: (rawArgs: z.infer<typeof WalletScreenSchema>) => Promise<string>;
    getActions(_walletProvider: WalletProvider): Action[];
}
/**
 * Creates an On-chain Forensics action provider.
 *
 * @param config - Optional x402 payment wrapper and credit key
 * @returns A configured action provider
 */
export declare const onchainForensicsActionProvider: (config?: ForensicsConfig) => OnchainForensicsActionProvider;
export default onchainForensicsActionProvider;
