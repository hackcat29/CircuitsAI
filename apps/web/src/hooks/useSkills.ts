"use client";

import { useCallback } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { parseAbi, parseUnits, type Address } from "viem";
import { usePublicClient } from "wagmi";
import { socialFetch } from "@/lib/social/api";
import { type Skill, SKILL_CATEGORIES, BUILTIN_SKILLS } from "@/lib/skills";
import { useWallet } from "./useWallet";
import { usePrivyWalletClient } from "./usePrivyWalletClient";
import { isEvmChain, toIndexerChainSlug, MONAD_MAINNET } from "@/lib/chains";
import { env } from "@/lib/env";

const ERC20_TRANSFER_ABI = parseAbi(["function transfer(address,uint256) returns (bool)"]);

export type { Skill };
export { SKILL_CATEGORIES, BUILTIN_SKILLS };

export interface PublishSkillParam {
  name: string;
  description: string;
  required: boolean;
}

export type PublishSkillEndpoint =
  | { kind: "HTTP"; url: string; method: "GET" | "POST"; params: PublishSkillParam[] }
  | { kind: "MCP"; url: string };

export interface PublishSkillInput {
  emoji: string;
  name: string;
  desc: string;
  cat: string;
  priceUsdc: string;
  endpoint?: PublishSkillEndpoint;
}

export interface SkillDetail extends Skill {
  endpointKind?: "NONE" | "HTTP" | "MCP" | null;
  endpointUrl?: string | null;
  httpMethod?: "GET" | "POST" | null;
  params?: PublishSkillParam[];
  verifiedAt?: string | null;
  createdAt?: string | null;
}

interface ServerPublishedSkill {
  id: string;
  emoji: string;
  name: string;
  desc: string;
  cat: string;
  priceUsdc: string;
  endpointKind?: "HTTP" | "MCP" | null;
  endpointUrl?: string | null;
  httpMethod?: "GET" | "POST" | null;
  paramsJson?: PublishSkillParam[] | unknown;
  verifiedAt?: string | null;
  createdAt?: string;
  creator: { id: string; displayName: string | null; username?: string | null; walletAddress: string | null };
}

function shortAddress(address: string): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

function toSkill(published: ServerPublishedSkill): Skill {
  const publisherName = published.creator.username
    ? `@${published.creator.username}`
    : published.creator.displayName || (published.creator.walletAddress ? shortAddress(published.creator.walletAddress) : "Community");

  return {
    id: published.id,
    emoji: published.emoji,
    name: published.name,
    desc: published.desc,
    cat: published.cat,
    price: published.priceUsdc && parseFloat(published.priceUsdc) > 0 ? `$${published.priceUsdc}` : "Free",
    publisher: publisherName,
    url: null,
    isCustom: true,
    isLive: Boolean(published.endpointUrl),
    creatorProfileId: published.creator.id,
  };
}

const BUILTIN_SKILL_DETAILS: Record<string, Partial<SkillDetail>> = {
  "clawdhq-agent": {
    endpointKind: "MCP",
    endpointUrl: "https://api.clawd.agent/v1/a2a/mcp",
    httpMethod: "POST",
    params: [
      { name: "agent_id", description: "Target ClawdHQ autonomous agent ID to call", required: true },
      { name: "prompt", description: "Instruction or query for the remote agent", required: true },
      { name: "context", description: "Execution context or shared state", required: false },
    ],
  },
  "arc-contract-guard": {
    endpointKind: "HTTP",
    endpointUrl: "https://rpc.example.com/v1/inspect",
    httpMethod: "POST",
    params: [
      { name: "contract_address", description: "Target EVM smart contract address on Monad", required: true },
      { name: "checks", description: "Checks: reentrancy, access_control, proxy_integrity", required: false },
      { name: "chain_id", description: "Chain ID (143)", required: true },
    ],
  },
  "arc-xero-swap": {
    endpointKind: "HTTP",
    endpointUrl: "https://api.xero.example.com/v1/quote",
    httpMethod: "POST",
    params: [
      { name: "token_in", description: "Inbound token contract address (e.g. USDC on Monad)", required: true },
      { name: "token_out", description: "Outbound token contract address", required: true },
      { name: "amount_in", description: "Amount in atomic token units (e.g. 1000000)", required: true },
    ],
  },
  "arc-x402-dispatcher": {
    endpointKind: "HTTP",
    endpointUrl: "https://gateway.example.com/x402/dispatch",
    httpMethod: "POST",
    params: [
      { name: "service_url", description: "Target x402 metered endpoint URL", required: true },
      { name: "max_price_usdc", description: "Maximum authorized payment amount in USDC", required: true },
      { name: "idempotency_key", description: "Unique invocation tracking key", required: false },
    ],
  },
  goplus: {
    endpointKind: "HTTP",
    endpointUrl: "https://api.gopluslabs.io/api/v1/token_security/5042",
    httpMethod: "GET",
    params: [
      { name: "contract_address", description: "Token contract address on Monad", required: true },
    ],
  },
};

const PUBLISHED_SKILLS_QUERY_KEY = ["published-skills"];

export function useSkills() {
  const queryClient = useQueryClient();
  const { chain } = useWallet();
  const evmChain = isEvmChain(chain) ? chain : MONAD_MAINNET;
  const chainSlug = toIndexerChainSlug(evmChain);
  const walletClient = usePrivyWalletClient(evmChain);
  const publicClient = usePublicClient({ chainId: evmChain.viemChain.id });

  const publishedQuery = useQuery({
    queryKey: PUBLISHED_SKILLS_QUERY_KEY,
    queryFn: () => socialFetch<{ skills: ServerPublishedSkill[] }>("/api/skills/published"),
  });

  const published = (publishedQuery.data?.skills ?? []).map(toSkill);
  const skills = [...BUILTIN_SKILLS, ...published];

  const publishMutation = useMutation({
    mutationFn: async (data: PublishSkillInput) => {
      let feeChain: string | undefined;
      let feeTxHash: string | undefined;
      if (env.NEXT_PUBLIC_SKILL_LISTING_FEE_USDC && env.NEXT_PUBLIC_TREASURY_ADDRESS) {
        if (!chainSlug) throw new Error("Switch to an EVM chain first.");
        if (!walletClient?.account) throw new Error("Sign in first.");
        if (!publicClient) throw new Error("Not connected to this chain yet.");
        const hash = await walletClient.writeContract({
          address: evmChain.usdcAddress as Address,
          abi: ERC20_TRANSFER_ABI,
          functionName: "transfer",
          args: [env.NEXT_PUBLIC_TREASURY_ADDRESS as Address, parseUnits(env.NEXT_PUBLIC_SKILL_LISTING_FEE_USDC, 6)],
          chain: evmChain.viemChain,
          account: walletClient.account!,
        });
        await publicClient.waitForTransactionReceipt({ hash });
        feeTxHash = hash;
        feeChain = chainSlug;
      }

      return socialFetch<{ skill: ServerPublishedSkill }>("/api/skills/published", {
        method: "POST",
        body: JSON.stringify({ ...data, feeChain, feeTxHash }),
      });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: PUBLISHED_SKILLS_QUERY_KEY }),
  });

  const removeMutation = useMutation({
    mutationFn: (id: string) => socialFetch<{ ok: true }>(`/api/skills/published/${encodeURIComponent(id)}`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: PUBLISHED_SKILLS_QUERY_KEY }),
  });

  const publish = useCallback(
    async (data: PublishSkillInput): Promise<Skill> => {
      const { skill } = await publishMutation.mutateAsync(data);
      return toSkill(skill);
    },
    [publishMutation],
  );

  const removeCustom = useCallback((id: string) => removeMutation.mutate(id), [removeMutation]);

  return {
    skills,
    publish,
    removeCustom,
    isLoading: publishedQuery.isLoading,
    isPublishing: publishMutation.isPending,
  };
}

export function useSkill(id?: string) {
  const queryKey = ["skill-detail", id];

  const skillQuery = useQuery<SkillDetail | null>({
    queryKey,
    queryFn: async () => {
      if (!id) return null;

      // 1. Check built-in skills
      const builtin = BUILTIN_SKILLS.find((s) => s.id === id);
      if (builtin) {
        const extra = BUILTIN_SKILL_DETAILS[id] || {};
        return {
          ...builtin,
          endpointKind: extra.endpointKind || "HTTP",
          endpointUrl: extra.endpointUrl || `https://api.example.com/v1/skills/${id}`,
          httpMethod: extra.httpMethod || "POST",
          params: extra.params || [
            { name: "query", description: "Primary query parameter for execution", required: true },
          ],
          isLive: true,
        };
      }

      // 2. Fetch custom published skill from API
      try {
        const res = await socialFetch<{ skill: ServerPublishedSkill }>(`/api/skills/published/${encodeURIComponent(id)}`);
        if (res?.skill) {
          const s = res.skill;
          const base = toSkill(s);
          const parsedParams = Array.isArray(s.paramsJson)
            ? (s.paramsJson as PublishSkillParam[])
            : [];
          return {
            ...base,
            endpointKind: s.endpointKind || "NONE",
            endpointUrl: s.endpointUrl || null,
            httpMethod: s.httpMethod || "POST",
            params: parsedParams,
            verifiedAt: s.verifiedAt || null,
            createdAt: s.createdAt || null,
          };
        }
      } catch {
        // Fallback check
      }

      return null;
    },
    enabled: Boolean(id),
  });

  return {
    skill: skillQuery.data ?? null,
    isLoading: skillQuery.isLoading,
    error: skillQuery.error,
    refetch: skillQuery.refetch,
  };
}
