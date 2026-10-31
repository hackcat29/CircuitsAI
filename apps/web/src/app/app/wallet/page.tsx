"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import toast from "react-hot-toast";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Shield, Award, Crown, Gem, Send, Droplets, QrCode, User, Settings, Mail, AtSign } from "lucide-react";
import { isAddress, parseUnits } from "viem";
import {
  useSocialCircleWallet,
  useSocialSession,
  useWallet,
  useMyAgents,
  useAgentWallet,
  useLaunchpadTrades,
  useCctpSelfBridge,
  type MyAgentSummary,
} from "@/hooks";
import { usePrivyWalletClient } from "@/hooks/usePrivyWalletClient";
import { isEvmChain, MONAD_MAINNET, BASE_SEPOLIA, ETH_SEPOLIA, SELECTABLE_CHAINS, getChainById, toIndexerChainSlug, type ChainId } from "@/lib/chains";
import { formatUsdc, formatDecimal, formatRelativeTime, truncateAddress } from "@/lib/format";
import { describeActionError } from "@/lib/errors";
import { cn } from "@/lib/cn";
import { Card, CardHeader, CardTitle, CardDescription, Button, Input, Skeleton, Badge, Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui";
import {
  DepositQrModal,
  WalletPortfolioOverview,
  AgentTreasuryCommand,
  DegenTradingMarginCommand,
  UnifiedTransactionLedger,
} from "@/components/wallet";
import { EditProfileModal } from "@/components/profile/EditProfileModal";

const TIERS = [
  { name: "Bronze", min: 0, max: 4, color: "#CD7F32", icon: Shield },
  { name: "Silver", min: 5, max: 19, color: "#B8BCC6", icon: Award },
  { name: "Gold", min: 20, max: 99, color: "#FFB13D", icon: Crown },
  { name: "Diamond", min: 100, max: Infinity, color: "#7DD3FC", icon: Gem },
];

function tierFor(score: number) {
  return TIERS.find((t) => score >= t.min && score <= t.max) ?? TIERS[0];
}

const ERC20_TRANSFER_ABI = [
  { type: "function", name: "transfer", stateMutability: "nonpayable", inputs: [{ name: "to", type: "address" }, { name: "amount", type: "uint256" }], outputs: [{ type: "bool" }] },
] as const;

interface ContributorEntry {
  address: string;
  agentsRegistered: number;
  jobsCompleted: number;
  pipelinesBuilt: number;
  skillsPublished: number;
  projectsLaunched: number;
  score: number;
}

function SignInGate() {
  const { profile, loading, signIn, ready, signingIn } = useSocialSession();

  if (loading) return <Skeleton className="h-40 w-full" />;
  if (profile) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Get Started</CardTitle>
        <CardDescription>Sign in with Email to get an embedded wallet on Monad, Base, and Ethereum Sepolia, no crypto wallet needed.</CardDescription>
      </CardHeader>
      <div className="flex flex-col gap-3 p-5 pt-0">
        <Button onClick={signIn} disabled={!ready || signingIn}>
          {!ready ? "Loading…" : signingIn ? "Signing in…" : "Sign in with Email"}
        </Button>
      </div>
    </Card>
  );
}

function ContributorPointsCard({ address }: { address: string | undefined }) {
  const query = useQuery({
    queryKey: ["contribute-leaderboard"],
    queryFn: () => fetch("/api/contribute/leaderboard").then((r) => r.json() as Promise<{ entries: ContributorEntry[] }>),
    staleTime: 60_000,
  });

  const entry = query.data?.entries.find((e) => e.address.toLowerCase() === address?.toLowerCase());
  const score = entry?.score ?? 0;
  const tier = tierFor(score);
  const TierIcon = tier.icon;

  return (
    <Card className="border border-border-subtle bg-bg-elevated/75 shadow-xs">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-[15px] font-extrabold flex items-center gap-2">
              <Crown className="h-4 w-4 text-accent-violet" />
              <span>Contributor Tier &amp; Score</span>
            </CardTitle>
            <CardDescription className="text-xs">Ecosystem activity points tracking on-chain builder contributions and tier standing.</CardDescription>
          </div>
          <Link href="/contribute" className="text-xs font-bold text-accent-violet hover:underline">
            View Hub →
          </Link>
        </div>
      </CardHeader>
      <div className="flex items-center gap-4 px-5 pb-5">
        {query.isLoading ? (
          <Skeleton className="h-12 w-full" />
        ) : (
          <>
            <div className="h-12 w-12 rounded-xl bg-bg-surface3 border border-border-strong flex items-center justify-center shrink-0">
              <TierIcon className="h-6 w-6" style={{ color: tier.color }} />
            </div>
            <div>
              <div className="font-mono text-2xl font-black" style={{ color: tier.color }}>
                {score.toLocaleString()} <span className="text-sm font-normal text-text-quaternary">pts</span>
              </div>
              <div className="text-xs text-text-secondary font-bold">{tier.name} Tier Contributor</div>
            </div>
          </>
        )}
      </div>
    </Card>
  );
}

const PHASE_LABEL: Record<string, string> = {
  burning: "Burning…",
  relaying: "Submitting…",
  "awaiting-attestation": "Waiting for attestation…",
};

function BridgeCard({ ownerAddress }: { ownerAddress: string | undefined }) {
  const [sourceChain, setSourceChain] = useState(BASE_SEPOLIA);
  const [destinationChain, setDestinationChain] = useState(ETH_SEPOLIA);
  const [amount, setAmount] = useState("");
  const { phase, error, burnTxHash, bridge, supported } = useCctpSelfBridge(sourceChain, destinationChain, ownerAddress);

  const busy = phase === "burning" || phase === "relaying" || phase === "awaiting-attestation";
  const destinationOptions = SELECTABLE_CHAINS.filter((c) => c.chainId !== sourceChain.chainId);

  if (SELECTABLE_CHAINS.length <= 1) {
    return (
      <Card className="border border-border-subtle bg-bg-elevated/75 shadow-xs">
        <CardHeader className="pb-3">
          <CardTitle className="text-[15px] font-extrabold">Circle CCTP Cross-Chain Bridge</CardTitle>
          <CardDescription className="text-xs">
            Cross-chain USDC liquidity transfers via Circle CCTP.
          </CardDescription>
        </CardHeader>
        <div className="px-5 pb-5">
          <div className="p-3.5 rounded-[12px] bg-bg-surface border border-border-subtle text-xs text-text-secondary">
            <span className="font-semibold text-text-primary">Monad Mainnet is currently the sole active network in Circuits Protocol.</span>
            <p className="mt-1 text-text-tertiary">
              CCTP cross-chain bridging routes will activate automatically as additional mainnet chains are connected.
            </p>
          </div>
        </div>
      </Card>
    );
  }

  function handleSourceChange(value: string) {
    const next = getChainById(Number(value) as ChainId);
    if (!next) return;
    setSourceChain(next);
    if (next.chainId === destinationChain.chainId) {
      const fallback = SELECTABLE_CHAINS.find((c) => c.chainId !== next.chainId);
      if (fallback) setDestinationChain(fallback);
    }
  }

  function handleDestinationChange(value: string) {
    const next = getChainById(Number(value) as ChainId);
    if (next) setDestinationChain(next);
  }

  async function handleBridge() {
    try {
      await bridge(amount);
      setAmount("");
    } catch {
      // error surfaced via `error`
    }
  }

  return (
    <Card className="border border-border-subtle bg-bg-elevated/75 shadow-xs">
      <CardHeader className="pb-3">
        <CardTitle className="text-[15px] font-extrabold">Circle CCTP Cross-Chain Bridge</CardTitle>
        <CardDescription className="text-xs">
          Move USDC natively between Base Sepolia and Ethereum Sepolia via Circle CCTP.
        </CardDescription>
      </CardHeader>
      <div className="flex flex-col gap-3 px-5 pb-5">
        <div className="flex items-center gap-2">
          <Select value={String(sourceChain.chainId)} onValueChange={handleSourceChange} disabled={busy}>
            <SelectTrigger className="flex-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SELECTABLE_CHAINS.map((c) => (
                <SelectItem key={c.chainId} value={String(c.chainId)}>
                  {c.chainName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <ArrowRight className="h-4 w-4 shrink-0 text-text-tertiary" />
          <Select value={String(destinationChain.chainId)} onValueChange={handleDestinationChange} disabled={busy}>
            <SelectTrigger className="flex-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {destinationOptions.map((c) => (
                <SelectItem key={c.chainId} value={String(c.chainId)}>
                  {c.chainName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Input placeholder="Amount (USDC)" value={amount} onChange={(e) => setAmount(e.target.value)} disabled={busy} />

        {!supported && <p className="text-xs text-text-tertiary">CCTP bridging isn&apos;t configured on {sourceChain.chainName} yet.</p>}

        <Button onClick={handleBridge} disabled={busy || !supported || !amount || Number(amount) <= 0}>
          {busy ? PHASE_LABEL[phase] : "Bridge USDC"}
        </Button>

        {phase === "awaiting-attestation" && (
          <p className="text-xs text-text-tertiary">
            Waiting for Circle&apos;s attestation. Standard transfers can take a few minutes. Funds will arrive on {destinationChain.chainName} automatically.
          </p>
        )}
        {phase === "complete" && <p className="text-xs text-emerald">Bridged. Funds will appear on {destinationChain.chainName} shortly.</p>}
        {error && <p className="text-xs text-red">{error}</p>}
        {burnTxHash && (
          <a
            href={`${sourceChain.explorerUrl}/tx/${burnTxHash}`}
            target="_blank"
            rel="noreferrer"
            className="text-xs text-text-tertiary underline"
          >
            View burn transaction
          </a>
        )}
      </div>
    </Card>
  );
}

export default function WalletPage() {
  const { profile } = useSocialSession();
  const { chain: activeChain } = useWallet();
  const evmChain = isEvmChain(activeChain) ? activeChain : MONAD_MAINNET;
  const { wallet, isLoading } = useSocialCircleWallet(evmChain);
  const privyWalletClient = usePrivyWalletClient(evmChain);
  const chainSlug = toIndexerChainSlug(evmChain);
  const { loading: agentsLoading, agents: myAgents } = useMyAgents();

  const [agentBalanceUsdc, setAgentBalanceUsdc] = useState(0);
  const [degenMarginUsdc, setDegenMarginUsdc] = useState(0);
  const [showDepositQr, setShowDepositQr] = useState(false);
  const [showEditProfileModal, setShowEditProfileModal] = useState(false);

  const [withdrawTo, setWithdrawTo] = useState("");
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [withdrawBusy, setWithdrawBusy] = useState(false);
  const [withdrawError, setWithdrawError] = useState<string | null>(null);
  const [withdrawNotice, setWithdrawNotice] = useState<string | null>(null);

  const queryContributor = useQuery({
    queryKey: ["contribute-leaderboard"],
    queryFn: () => fetch("/api/contribute/leaderboard").then((r) => r.json() as Promise<{ entries: ContributorEntry[] }>),
    staleTime: 60_000,
  });

  const contributorScore = queryContributor.data?.entries.find((e) => e.address.toLowerCase() === wallet?.address?.toLowerCase())?.score ?? 0;

  async function handleWithdraw() {
    setWithdrawError(null);
    setWithdrawNotice(null);
    if (!isAddress(withdrawTo)) {
      setWithdrawError("Enter a valid destination address.");
      return;
    }
    if (!withdrawAmount || Number(withdrawAmount) <= 0) {
      setWithdrawError("Enter an amount greater than 0.");
      return;
    }
    if (!privyWalletClient || !privyWalletClient.account) {
      setWithdrawError("Wallet not ready. Try again in a moment.");
      return;
    }
    setWithdrawBusy(true);
    try {
      const hash = await privyWalletClient.writeContract({
        account: privyWalletClient.account,
        chain: evmChain.viemChain,
        address: evmChain.usdcAddress as `0x${string}`,
        abi: ERC20_TRANSFER_ABI,
        functionName: "transfer",
        args: [withdrawTo as `0x${string}`, parseUnits(withdrawAmount, 6)],
      });
      setWithdrawNotice(`Sent successfully: tx ${hash.slice(0, 10)}…`);
      setWithdrawTo("");
      setWithdrawAmount("");
    } catch (err) {
      setWithdrawError(describeActionError(err, "Withdrawal failed."));
    } finally {
      setWithdrawBusy(false);
    }
  }

  const walletBalanceNumber = wallet ? Number(wallet.balanceUsdc) : 0;

  return (
    <div className="max-w-370 mx-auto px-4 sm:px-6 pt-4 sm:pt-5.5 pb-16 space-y-5 sm:space-y-6">
      <div className="mx-auto flex max-w-5xl flex-col gap-6">

        <SignInGate />

        {profile && wallet && (
          <>
            {/* Human Profile & Identity Card */}
            {/* <Card className="border border-border-subtle bg-bg-elevated/75 shadow-xs overflow-hidden">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between p-5 gap-4">
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="h-12 w-12 rounded-full border border-border-strong bg-bg-surface3 flex items-center justify-center shrink-0 overflow-hidden">
                    {profile.avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={profile.avatarUrl} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <User className="h-6 w-6 text-text-tertiary" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-base font-bold text-text-primary truncate">
                        {profile.displayName || truncateAddress(profile.walletAddress ?? "")}
                      </span>
                      {profile.username && (
                        <Badge variant="violet" className="font-mono text-[11px]">
                          @{profile.username}
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5 text-xs text-text-tertiary">
                      {profile.email && (
                        <span className="flex items-center gap-1 font-mono text-[11px] text-text-secondary">
                          <Mail className="h-3 w-3 text-accent-violet" />
                          <span>{profile.email}</span>
                        </span>
                      )}
                      {profile.email && <span className="text-text-quaternary">•</span>}
                      <span className="font-mono text-[10.5px] text-text-quaternary">{truncateAddress(wallet.address)}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 flex-wrap">
                  {profile.username && (
                    <Link href={`/${profile.username}`}>
                      <Button variant="outline" size="sm" className="text-xs font-semibold gap-1.5 cursor-pointer">
                        <User className="h-3.5 w-3.5 text-accent-violet" />
                        <span>View Public Profile</span>
                      </Button>
                    </Link>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowEditProfileModal(true)}
                    className="text-xs font-semibold gap-1.5 cursor-pointer"
                  >
                    <Settings className="h-3.5 w-3.5 text-text-tertiary" />
                    <span>Edit Profile</span>
                  </Button>
                </div>
              </div>
            </Card> */}

            {/* Top Multi-Chain Portfolio Overview */}
            <WalletPortfolioOverview
              walletAddress={wallet.address}
              walletBalanceUsdc={walletBalanceNumber}
              agentTreasuryUsdc={agentBalanceUsdc}
              degenMarginUsdc={degenMarginUsdc}
              contributorScore={contributorScore}
              chainName={evmChain.chainName}
              onOpenDepositQr={() => setShowDepositQr(true)}
            />

            {/* Quick Withdraw / Transfer Card */}
            <Card className="border border-border-subtle bg-bg-elevated/75 shadow-xs">
              <CardHeader className="pb-3">
                <CardTitle className="text-[15px] font-extrabold flex items-center gap-2">
                  <Send className="h-4 w-4 text-accent-violet" />
                  <span>Withdraw / Transfer USDC</span>
                </CardTitle>
                <CardDescription className="text-xs">
                  Transfer USDC from your primary personal wallet to an external EVM address on {evmChain.chainName}.
                </CardDescription>
              </CardHeader>
              <div className="px-5 pb-5 space-y-3">
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Input
                    placeholder="Destination address (0x...)"
                    value={withdrawTo}
                    onChange={(e) => setWithdrawTo(e.target.value)}
                    className="font-mono text-xs sm:flex-1"
                  />
                  <Input
                    placeholder="Amount (USDC)"
                    value={withdrawAmount}
                    onChange={(e) => setWithdrawAmount(e.target.value)}
                    className="sm:w-36 font-mono"
                  />
                  <Button size="sm" onClick={handleWithdraw} disabled={withdrawBusy || !withdrawTo || !withdrawAmount}>
                    {withdrawBusy ? "Sending…" : "Send Transfer"}
                  </Button>
                </div>
                {withdrawError && <p className="text-xs text-red font-semibold">{withdrawError}</p>}
                {withdrawNotice && <p className="text-xs text-emerald font-semibold">{withdrawNotice}</p>}
              </div>
            </Card>

            {/* 2-Column Grid: Agent Operating Treasuries & Degen Trading Margin */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <AgentTreasuryCommand
                chainSlug={chainSlug}
                agents={myAgents}
                loading={agentsLoading}
                onTotalBalanceUpdate={setAgentBalanceUsdc}
              />

              <DegenTradingMarginCommand
                agents={myAgents}
                loading={agentsLoading}
                onTotalMarginUpdate={setDegenMarginUsdc}
              />
            </div>

            {/* 2-Column Grid: Cross-Chain Bridges & Contributor Points */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <BridgeCard ownerAddress={wallet.address} />
              <ContributorPointsCard address={wallet.address} />
            </div>

            {/* Full-Width Activity & Settlement Ledger */}
            <UnifiedTransactionLedger
              address={wallet.address}
              explorerUrl={evmChain.explorerUrl}
            />

            {/* Deposit QR Modal */}
            <DepositQrModal
              address={wallet.address}
              chainName={evmChain.chainName}
              explorerUrl={evmChain.explorerUrl}
              isOpen={showDepositQr}
              onClose={() => setShowDepositQr(false)}
            />

            {/* Human Profile Edit Modal */}
            <EditProfileModal
              isOpen={showEditProfileModal}
              onClose={() => setShowEditProfileModal(false)}
            />
          </>
        )}
      </div>
    </div>
  );
}
