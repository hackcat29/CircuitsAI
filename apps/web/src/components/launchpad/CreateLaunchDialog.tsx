"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Spinner,
  Switch,
  Textarea,
} from "@/components/ui";
import { BUYBACK_INTERVALS, type BuybackInterval } from "@clawdhq/sdk";
import { parseUnits } from "viem";
import { useLaunchpadActions, useMyAgents, useWallet, useEvmLaunchpadAdapter, useSocialSession, type CreateLaunchInput } from "@/hooks";
import { toIndexerChainSlug, isEvmChain, MONAD_MAINNET } from "@/lib/chains";
import { describeActionError } from "@/lib/errors";
import { formatUsdc } from "@/lib/format";
import { loadFormDraft, saveFormDraft, clearFormDraft } from "@/lib/formDraftStorage";
import { SESSION_LOGOUT_EVENT } from "@/lib/sessionCleanup";
import { launchSlug } from "@/lib/launchSlug";

const EMPTY_FORM: CreateLaunchInput = { agentId: "", name: "", symbol: "", buybackInterval: BUYBACK_INTERVALS.MONTHLY, buybackBps: 2000 };
const MIN_LEAD_MS = 5 * 60 * 1000;

const BUYBACK_INTERVAL_OPTIONS: { value: BuybackInterval; label: string }[] = [
  { value: BUYBACK_INTERVALS.DAILY, label: "Daily (24h)" },
  { value: BUYBACK_INTERVALS.WEEKLY, label: "Weekly (7d)" },
  { value: BUYBACK_INTERVALS.MONTHLY, label: "Monthly (30d)" },
  { value: BUYBACK_INTERVALS.QUARTERLY, label: "Quarterly (90d)" },
];

const BUYBACK_PERCENTAGE_PRESETS = [
  { value: 1000, label: "10%" },
  { value: 2000, label: "20% (Default)" },
  { value: 3000, label: "30%" },
  { value: 5000, label: "50%" },
];

/** `<input type="datetime-local">` wants local time formatted as "YYYY-MM-DDTHH:mm", no
 * timezone suffix — `toISOString()` gives UTC-with-Z, which isn't the same thing. */
function toDatetimeLocalValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

const DEFAULT_SCHEDULE_VALUE = toDatetimeLocalValue(new Date(Date.now() + 60 * 60 * 1000));
const MIN_SCHEDULE_VALUE = toDatetimeLocalValue(new Date(Date.now() + MIN_LEAD_MS));

interface MetadataForm {
  websiteUrl: string;
  twitterUrl: string;
  telegramUrl: string;
  description: string;
}

const EMPTY_METADATA: MetadataForm = { websiteUrl: "", twitterUrl: "", telegramUrl: "", description: "" };

interface CreateLaunchDraft {
  form: CreateLaunchInput;
  metadata: MetadataForm;
  scheduleEnabled: boolean;
  scheduledAt: string;
  preBuyEnabled: boolean;
  preBuyUsdc: string;
}

export function CreateLaunchDialog({
  onCreated,
  defaultOpen = false,
}: {
  onCreated?: (launchId?: string) => void;
  defaultOpen?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(defaultOpen);

  useEffect(() => {
    if (defaultOpen) setOpen(true);
  }, [defaultOpen]);
  const [form, setForm] = useState<CreateLaunchInput>(EMPTY_FORM);
  const [metadata, setMetadata] = useState<MetadataForm>(EMPTY_METADATA);
  const [scheduleEnabled, setScheduleEnabled] = useState(false);
  const [scheduledAt, setScheduledAt] = useState(DEFAULT_SCHEDULE_VALUE);
  const [preBuyEnabled, setPreBuyEnabled] = useState(false);
  const [preBuyUsdc, setPreBuyUsdc] = useState("");
  const [error, setError] = useState<string | null>(null);
  const { createLaunch, buyTokens, busy } = useLaunchpadActions();
  const { agents, loading: agentsLoading, error: agentsError, retry: retryAgents } = useMyAgents();
  const { chain, address } = useWallet();
  const { profile } = useSocialSession();
  const userScope = address || profile?.id || null;
  const evmLaunchpadAdapter = useEvmLaunchpadAdapter(isEvmChain(chain) ? chain : MONAD_MAINNET);
  const [launchFee, setLaunchFee] = useState<bigint | null>(null);
  const hasHydratedRef = useRef(false);
  const isClearingRef = useRef(false);

  // Restore draft on mount or when user changes
  useEffect(() => {
    const draft = loadFormDraft<CreateLaunchDraft>("token_launch", userScope);
    if (draft) {
      if (draft.form) setForm((f) => ({ ...f, ...draft.form }));
      if (draft.metadata) setMetadata((m) => ({ ...m, ...draft.metadata }));
      if (typeof draft.scheduleEnabled === "boolean") setScheduleEnabled(draft.scheduleEnabled);
      if (draft.scheduledAt) setScheduledAt(draft.scheduledAt);
      if (typeof draft.preBuyEnabled === "boolean") setPreBuyEnabled(draft.preBuyEnabled);
      if (typeof draft.preBuyUsdc === "string") setPreBuyUsdc(draft.preBuyUsdc);
    }
    hasHydratedRef.current = true;
  }, [userScope]);

  // Save draft on edit
  useEffect(() => {
    if (!hasHydratedRef.current) return;
    if (isClearingRef.current) {
      isClearingRef.current = false;
      return;
    }
    const hasData = Boolean(
      form.agentId ||
      form.name ||
      form.symbol ||
      metadata.websiteUrl ||
      metadata.twitterUrl ||
      metadata.telegramUrl ||
      metadata.description ||
      preBuyUsdc
    );
    if (!hasData) return;

    const timer = setTimeout(() => {
      saveFormDraft<CreateLaunchDraft>(
        "token_launch",
        {
          form,
          metadata,
          scheduleEnabled,
          scheduledAt,
          preBuyEnabled,
          preBuyUsdc,
        },
        userScope
      );
    }, 300);
    return () => clearTimeout(timer);
  }, [form, metadata, scheduleEnabled, scheduledAt, preBuyEnabled, preBuyUsdc, userScope]);

  // Purge and reset on logout
  useEffect(() => {
    function handleLogout() {
      reset();
      setOpen(false);
    }
    window.addEventListener(SESSION_LOGOUT_EVENT, handleLogout);
    return () => window.removeEventListener(SESSION_LOGOUT_EVENT, handleLogout);
  }, [userScope]);

  // ClawdHQLaunchpad.createLaunch enforces one launch per agent on-chain (AlreadyLaunched) —
  // this filters the picker down to agents that can actually succeed, rather than letting an
  // owner pick one that's already launched and find out via a reverted transaction.
  const [launchedAgentIds, setLaunchedAgentIds] = useState<Set<string> | null>(null);

  useEffect(() => {
    if (!open || !evmLaunchpadAdapter) return;
    let cancelled = false;
    evmLaunchpadAdapter
      .getLaunchFee()
      .then((fee) => {
        if (!cancelled) setLaunchFee(fee);
      })
      .catch(() => {
        if (!cancelled) setLaunchFee(null);
      });
    return () => {
      cancelled = true;
    };
  }, [open, evmLaunchpadAdapter]);

  useEffect(() => {
    if (!open || agents.length === 0) {
      setLaunchedAgentIds(agents.length === 0 ? new Set() : null);
      return;
    }
    let cancelled = false;
    const chainSlug = toIndexerChainSlug(isEvmChain(chain) ? chain : MONAD_MAINNET);
    fetch(`/api/launchpad/agent-launch-status?chain=${chainSlug}&agentIds=${agents.map((a) => a.numericId).join(",")}`)
      .then((res) => (res.ok ? res.json() : { launchedAgentIds: [] }))
      .then(({ launchedAgentIds: ids }: { launchedAgentIds: string[] }) => {
        if (!cancelled) setLaunchedAgentIds(new Set(ids));
      })
      .catch(() => {
        if (!cancelled) setLaunchedAgentIds(new Set());
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, agents, chain]);

  const eligibleAgents = launchedAgentIds ? agents.filter((a) => !launchedAgentIds.has(a.numericId)) : [];
  const checkingEligibility = agents.length > 0 && launchedAgentIds === null;
  const selectedAgent = eligibleAgents.find((a) => a.id === form.agentId);
  const hasMetadata = Boolean(metadata.websiteUrl || metadata.twitterUrl || metadata.telegramUrl || metadata.description);

  function reset() {
    isClearingRef.current = true;
    clearFormDraft("token_launch", userScope);
    setForm(EMPTY_FORM);
    setMetadata(EMPTY_METADATA);
    setScheduleEnabled(false);
    setScheduledAt(DEFAULT_SCHEDULE_VALUE);
    setPreBuyEnabled(false);
    setPreBuyUsdc("");
    setError(null);
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    const scheduledDate = scheduleEnabled ? new Date(scheduledAt) : null;
    if (scheduledDate && scheduledDate.getTime() < Date.now() + MIN_LEAD_MS) {
      setError("Scheduled launch time must be at least 5 minutes from now.");
      return;
    }

    try {
      const launchAt = scheduledDate ? BigInt(Math.floor(scheduledDate.getTime() / 1000)) : undefined;
      // Always wait for launchId from transaction receipt so user can be redirected to token details page
      const launchId = await createLaunch({ ...form, launchAt }, { needsLaunchId: true });

      if (scheduledDate && address && launchId) {
        // Best-effort: the launch itself is already live on-chain at this point regardless —
        // if this off-chain annotation write fails, the launch just shows as scheduled on-chain
        // but without the app's countdown/discovery-hiding UI, not actually tradable early (that
        // part is enforced by the contract itself, not this annotation).
        await fetch("/api/exchange/scheduled-launches", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chain: toIndexerChainSlug(chain),
            launchChainId: launchId,
            creator: address,
            scheduledAt: scheduledDate.toISOString(),
          }),
        }).catch(() => {});
      }

      if (hasMetadata && address && launchId) {
        // Same best-effort philosophy — descriptive metadata never blocks a launch that's
        // already live on-chain.
        await fetch("/api/launchpad/metadata", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chain: toIndexerChainSlug(chain),
            launchChainId: launchId,
            creator: address,
            websiteUrl: metadata.websiteUrl || undefined,
            twitterUrl: metadata.twitterUrl || undefined,
            telegramUrl: metadata.telegramUrl || undefined,
            description: metadata.description || undefined,
          }),
        }).catch(() => {});
      }

      // Not best-effort — this moves real USDC, so only attempted once the launch id is
      // confirmed real (see useLaunchpadActions.createLaunch's doc comment on why a guessed
      // id would be unsafe here). A failure here is surfaced, not swallowed: the launch itself
      // already succeeded regardless, so this only affects whether the creator's own pre-buy
      // went through, not the launch.
      if (preBuyEnabled && preBuyUsdc && launchId) {
        await buyTokens(launchId, parseUnits(preBuyUsdc, 6), 0n);
      }

      const targetSymbol = form.symbol;
      reset();
      setOpen(false);
      onCreated?.(launchId);

      if (launchId) {
        const canonical = launchSlug(targetSymbol, launchId);
        router.push(`/app/launchpad/${canonical}`);
      }
    } catch (err) {
      setError(describeActionError(err, "Failed to create launch."));
    }
  }

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) {
      setError(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button>Launch Token</Button>
      </DialogTrigger>
      <DialogContent
        className="sm:max-w-3xl lg:max-w-4xl p-6 sm:p-7"
        onPointerDownOutside={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader className="border-b border-border-subtle pb-4 mb-5">
          <DialogTitle className="text-xl">Launch a Token</DialogTitle>
          <DialogDescription>
            {chain.chainName}: {selectedAgent ? `by ${selectedAgent.name}` : "start a bonding-curve token sale for one of your agents"}.
          </DialogDescription>
        </DialogHeader>

        {agentsLoading ? (
          <div className="py-10 text-center text-sm text-text-tertiary">Loading your agents…</div>
        ) : agentsError ? (
          <div className="flex flex-col items-center gap-3 py-10 text-center">
            <p className="text-sm text-text-tertiary">Couldn&apos;t load your agents. The RPC didn&apos;t respond in time.</p>
            <Button type="button" variant="outline" size="sm" onClick={retryAgents}>
              Retry
            </Button>
          </div>
        ) : agents.length === 0 ? (
          // Every token here is launched by an Agent — createLaunch reverts NotAgentOwner for
          // anything else, so there's no point rendering a form the owner can't submit.
          <div className="flex flex-col items-center gap-3 py-10 text-center">
            <p className="text-sm text-text-tertiary">
              You need an agent before you can launch a token. Every launch on Circuits Protocol belongs to an Agent.
            </p>
            <Button asChild size="sm">
              <Link href="/register">Register an Agent</Link>
            </Button>
          </div>
        ) : checkingEligibility ? (
          <div className="py-10 text-center text-sm text-text-tertiary">Checking which of your agents can still launch…</div>
        ) : eligibleAgents.length === 0 ? (
          // ClawdHQLaunchpad.createLaunch: one launch per agent, forever (AlreadyLaunched) — every
          // agent this owner has has already used its one shot.
          <div className="flex flex-col items-center gap-3 py-10 text-center">
            <p className="text-sm text-text-tertiary">
              Every agent you own has already launched a token. An agent can only launch one, ever. Register a new agent to launch another.
            </p>
            <Button asChild size="sm">
              <Link href="/register">Register a New Agent</Link>
            </Button>
          </div>
        ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Left Column — Core Token Parameters */}
            <div className="flex flex-col gap-4">
              <div className="text-xs font-bold uppercase tracking-wider text-accent-violet">1. Token Details</div>

              <div className="flex flex-col gap-1.5">
                <Label>Agent</Label>
                <Select value={form.agentId} onValueChange={(value) => setForm((f) => ({ ...f, agentId: value }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose an agent" />
                  </SelectTrigger>
                  <SelectContent>
                    {eligibleAgents.map((agent) => (
                      <SelectItem key={agent.id} value={agent.id}>
                        {agent.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="name">Token Name</Label>
                  <Input
                    id="name"
                    required
                    value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                    placeholder="e.g. Agent Coin"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="symbol">Token Symbol</Label>
                  <Input
                    id="symbol"
                    required
                    maxLength={10}
                    value={form.symbol}
                    onChange={(e) => setForm((f) => ({ ...f, symbol: e.target.value.toUpperCase() }))}
                    placeholder="e.g. AGT"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-3 rounded-xl bg-bg-surface3/40 border border-border-subtle p-3.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-text-primary">Buyback Schedule</span>
                  <Select
                    value={String(form.buybackInterval)}
                    onValueChange={(val) => setForm((f) => ({ ...f, buybackInterval: Number(val) as BuybackInterval }))}
                  >
                    <SelectTrigger className="h-7 text-xs w-36">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {BUYBACK_INTERVAL_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={String(opt.value)}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-text-secondary">Agent Treasury Buyback %:</span>
                    <span className="font-mono font-bold text-accent-violet">{((form.buybackBps ?? 2000) / 100).toFixed(0)}% per cycle</span>
                  </div>
                  <div className="grid grid-cols-4 gap-1.5">
                    {BUYBACK_PERCENTAGE_PRESETS.map((preset) => (
                      <button
                        key={preset.value}
                        type="button"
                        onClick={() => setForm((f) => ({ ...f, buybackBps: preset.value }))}
                        className={`py-1 text-[11px] font-semibold rounded border transition-colors ${
                          (form.buybackBps ?? 2000) === preset.value
                            ? "bg-accent-violet text-text-primary border-accent-violet"
                            : "bg-bg-raised/60 text-text-tertiary border-border-subtle hover:text-text-primary hover:border-border"
                        }`}
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                </div>

                <p className="text-[11px] text-text-quaternary leading-relaxed">
                  Periodic buybacks pull {((form.buybackBps ?? 2000) / 100).toFixed(0)}% of the Agent&apos;s Operating Treasury to buy &amp; permanently burn tokens on the curve.
                </p>
              </div>

              <div className="rounded-xl border border-accent-violet/20 bg-accent-violet/5 p-3.5 flex flex-col gap-1.5 text-xs">
                <div className="flex items-center gap-1.5 font-bold text-accent-violet">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  <span>Fair Launch &amp; Revenue Distribution</span>
                </div>
                <p className="text-text-tertiary leading-relaxed">
                  Fair launch bonding curve with zero creator pre-allocation. Trading fees are distributed: <strong className="text-text-secondary">50% Protocol</strong>, <strong className="text-text-secondary">30% Creator</strong>, and <strong className="text-text-secondary">20% Agent Treasury</strong>. Raised USDC is reserved for DEX graduation liquidity.
                </p>
              </div>
            </div>

            {/* Right Column — Socials & Launch Options */}
            <div className="flex flex-col gap-4">
              <div className="text-xs font-bold uppercase tracking-wider text-accent-violet">2. Enhancements &amp; Settings</div>

              <div className="flex flex-col gap-2 rounded-xl border border-border-subtle bg-bg-raised/40 p-3.5">
                <Label className="text-xs font-semibold text-text-secondary">Socials &amp; Description (optional)</Label>
                <div className="grid grid-cols-1 gap-2">
                  <Input placeholder="Website URL" value={metadata.websiteUrl} onChange={(e) => setMetadata((m) => ({ ...m, websiteUrl: e.target.value }))} />
                  <div className="grid grid-cols-2 gap-2">
                    <Input placeholder="X (Twitter) URL" value={metadata.twitterUrl} onChange={(e) => setMetadata((m) => ({ ...m, twitterUrl: e.target.value }))} />
                    <Input placeholder="Telegram URL" value={metadata.telegramUrl} onChange={(e) => setMetadata((m) => ({ ...m, telegramUrl: e.target.value }))} />
                  </div>
                  <Textarea
                    placeholder="What's this token about?"
                    maxLength={500}
                    rows={3}
                    value={metadata.description}
                    onChange={(e) => setMetadata((m) => ({ ...m, description: e.target.value }))}
                  />
                </div>
              </div>

              <div className="flex flex-col gap-2 rounded-xl border border-border-subtle bg-bg-raised/40 p-3.5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <Label htmlFor="preBuyEnabled" className={`font-semibold ${scheduleEnabled ? "text-text-tertiary" : "cursor-pointer"}`}>
                      Pre-buy your own token
                    </Label>
                    <p className="text-xs text-text-tertiary mt-0.5">
                      {scheduleEnabled
                        ? "Not available for a scheduled launch — trading (including your own buy) is locked on-chain until the scheduled time."
                        : "Buy tokens immediately after launch at starting price."}
                    </p>
                  </div>
                  <Switch id="preBuyEnabled" checked={preBuyEnabled} onCheckedChange={setPreBuyEnabled} disabled={scheduleEnabled} />
                </div>
                {preBuyEnabled && !scheduleEnabled && (
                  <Input
                    inputMode="decimal"
                    placeholder="USDC to spend"
                    value={preBuyUsdc}
                    onChange={(e) => setPreBuyUsdc(e.target.value)}
                    className="mt-1"
                  />
                )}
              </div>

              <div className="flex flex-col gap-2 rounded-xl border border-border-subtle bg-bg-raised/40 p-3.5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <Label htmlFor="scheduleEnabled" className={`font-semibold ${preBuyEnabled ? "text-text-tertiary" : "cursor-pointer"}`}>
                      Schedule for later
                    </Label>
                    <p className="text-xs text-text-tertiary mt-0.5">
                      {preBuyEnabled
                        ? "Not available alongside a pre-buy — disable that first."
                        : "Trading is locked on-chain (not just hidden in the UI) until the time you select."}
                    </p>
                  </div>
                  <Switch id="scheduleEnabled" checked={scheduleEnabled} onCheckedChange={setScheduleEnabled} disabled={preBuyEnabled} />
                </div>
                {scheduleEnabled && (
                  <Input
                    type="datetime-local"
                    required
                    min={MIN_SCHEDULE_VALUE}
                    value={scheduledAt}
                    onChange={(e) => setScheduledAt(e.target.value)}
                    className="mt-1"
                  />
                )}
              </div>
            </div>
          </div>

          {error && <p className="text-sm text-red font-medium">{error}</p>}

          <DialogFooter className="flex-row items-center justify-between gap-4 pt-4 border-t border-border-subtle sm:flex-row">
            <div className="text-xs text-text-tertiary">
              Launch Fee: <span className="font-semibold text-text-primary">{launchFee !== null ? formatUsdc(launchFee) : "loading…"}</span>
            </div>
            <div className="flex items-center gap-2">
              {(form.name || form.symbol || metadata.description) && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={reset}
                  className="text-xs text-text-tertiary hover:text-red hover:bg-red/10"
                >
                  Discard Draft
                </Button>
              )}
              <Button type="submit" disabled={busy || !form.agentId} size="lg" className="min-w-36">
                {busy && <Spinner className="h-4 w-4 mr-2" />}
                Launch Token
              </Button>
            </div>
          </DialogFooter>
        </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
