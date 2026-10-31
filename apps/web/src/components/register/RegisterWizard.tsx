"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Check, X, Shield } from "lucide-react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  Button,
  Input,
  Label,
  Textarea,
  Switch,
  Spinner,
  Badge,
} from "@/components/ui";
import { useAgentRegistration, useAgentImport, useWallet, useSocialSession, useAgentWallet, type RegisterAgentInput } from "@/hooks";
import type { CognitiveLayer, CognitiveLayerInput, SpendAction, LlmKeyProvider } from "@/hooks";
import { EXAMPLE_CIRCUITS_IMPORT } from "@/lib/agentImport";
import { toIndexerChainSlug, type IndexerChainSlug } from "@/lib/chains";
import { FOUNDATION_MODELS, tierMetaFor, TIER_CREDIT_HINT, byokProviderForModel } from "@/lib/foundationModels";
import { socialFetch } from "@/lib/social/api";
import { sha256Hex } from "@/lib/hash";
import { describeActionError } from "@/lib/errors";
import { robotAvatarUrl } from "@/lib/avatar";
import { usePostMedia } from "@/hooks/usePostMedia";
import { cn } from "@/lib/cn";
import { loadFormDraft, saveFormDraft, clearFormDraft } from "@/lib/formDraftStorage";
import { SESSION_LOGOUT_EVENT } from "@/lib/sessionCleanup";

const STEPS = ["Identity", "Capabilities", "Persona", "Review"] as const;

interface RegisterWizardDraft {
  step: number;
  form: RegisterAgentInput;
  persona: typeof PERSONA_DEFAULTS;
  mode: RegistrationMode;
  hosted: typeof HOSTED_DEFAULTS;
  walletMode: AgentWalletMode;
  circleWallet: typeof EMPTY_CIRCLE_WALLET;
}

const EMPTY_FORM: RegisterAgentInput = {
  name: "",
  endpoint: "",
  agentUri: "",
  description: "",
  supportsX402: false,
  supportsA2A: false,
  supportsMcp: false,
};

type RegistrationMode = "byo" | "hosted";

type AgentWalletMode = "auto" | "circle";

const EMPTY_CIRCLE_WALLET = { apiKey: "", entitySecret: "", walletId: "" };

const HOSTED_DEFAULTS = {
  llmBilling: "PLATFORM" as "PLATFORM" | "BYO_KEY",
  // No independent `llmProvider` field — for BYO_KEY billing, the provider is always derived
  // from the persona's chosen Foundation Model (see byokProviderForModel), never chosen
  // separately, so it can't drift from what the owner actually picked.
  llmApiKey: "",
  tickIntervalMinutes: 60,
  spendPolicyEnabled: false,
  dailyCapUsdc: "0",
  autonomousX402ResourceCapUsdc: "",
  allowedActions: [] as SpendAction[],
  goal: "",
  x402ReplyPriceUsdc: "0",
};

const LLM_KEY_PROVIDER_OPTIONS: { id: LlmKeyProvider; label: string; placeholder: string }[] = [
  { id: "ANTHROPIC", label: "Anthropic", placeholder: "sk-ant-…" },
  { id: "OPENAI", label: "OpenAI", placeholder: "sk-…" },
  { id: "GEMINI", label: "Gemini", placeholder: "AIza…" },
];

const SPEND_ACTION_OPTIONS: { id: SpendAction; label: string; desc: string }[] = [
  { id: "POST_JOB", label: "Post Jobs / Task Escrows", desc: "Hire specialized agents with USDC bounties" },
  { id: "X402_PAYMENT", label: "x402 Micropayments", desc: "Pay for external HTTP 402 services & APIs" },
  { id: "CALL_SKILL", label: "Priced Skills & Tools", desc: "Call installed paid skills in the ecosystem" },
  { id: "USE_KNOWLEDGE", label: "Knowledge Marketplace", desc: "Pay for specialized datasets & prompts" },
  { id: "SWAP", label: "Uniswap V3 / AMM Swaps", desc: "Execute decentralized token swaps autonomously" },
];

const PERSONA_DEFAULTS = {
  displayName: "",
  avatarUrl: "",
  personality: [] as string[],
  knowledgeDomains: [] as string[],
  communicationStyle: "technical" as CognitiveLayer["communicationStyle"],
  worldview: "",
  voicePersona: "",
  customSystemPrompt: "",
  foundationModel: "llama-3.3-70b",
  slaHours: 24,
};

const PRESET_TRAITS = ["Analytical", "Precise", "Cautious", "Creative", "Decisive", "Concise"];
const PRESET_DOMAINS = ["DeFi", "Smart Contracts", "Security", "Analytics", "NFTs", "AI/ML"];

/** Persists the persona filled out in Step 2 once the new agent's on-chain id is known —
 * server-side (CognitiveLayer in social-db), not localStorage, so a hosted runtime's LLM loop
 * can read it later. Requires a signed-in owner session (same owner-verified write every other
 * agent-scoped mutation in this app uses); best-effort by design — a sign-in or save failure
 * here shouldn't undo an already-confirmed on-chain registration, so callers should swallow
 * errors from this and just tell the user persona setup didn't finish. */
async function savePersonaForAgent(
  chainSlug: string,
  agentChainId: string,
  persona: typeof PERSONA_DEFAULTS,
): Promise<void> {
  if (
    !persona.displayName &&
    !persona.avatarUrl &&
    !persona.personality.length &&
    !persona.knowledgeDomains.length &&
    !persona.worldview &&
    !persona.voicePersona &&
    !persona.customSystemPrompt
  ) {
    return;
  }
  const updates: CognitiveLayerInput = {
    displayName: persona.displayName,
    avatarUrl: persona.avatarUrl,
    personality: persona.personality,
    knowledgeDomains: persona.knowledgeDomains,
    communicationStyle: persona.communicationStyle,
    worldview: persona.worldview,
    voicePersona: persona.voicePersona,
    customSystemPrompt: persona.customSystemPrompt,
    foundationModel: persona.foundationModel,
    slaHours: persona.slaHours,
  };
  await socialFetch(`/api/agents/${chainSlug}/${agentChainId}/cognitive-layer`, {
    method: "POST",
    body: JSON.stringify(updates),
  });
}

/** Registers this agent on ClawdHQ (a separate AI-agent social platform, see
 * clawdhqLinkCustody.ts), best-effort and after the fact — same "already confirmed on-chain,
 * a downstream failure here shouldn't be reported as a failed registration" shape as
 * savePersonaForAgent above. Wallet linking and the introductory post are attempted
 * server-side as part of the same call; a wallet that isn't provisioned yet just leaves
 * walletLinked false rather than failing the whole connect. */
async function connectAgentToClawdHq(chainSlug: string, agentChainId: string, name: string, description: string, avatarUrl: string): Promise<void> {
  await socialFetch(`/api/agents/${chainSlug}/${agentChainId}/clawdhq`, {
    method: "POST",
    body: JSON.stringify({ name, description, avatarUrl }),
  });
}

/** Validates and stores a bring-your-own Circle Agent Wallet intent *before* the on-chain
 * registerAgent call — unlike persona/hosted-runtime setup, this can't happen after: the agent's
 * on-chain wallet binding is one-time-settable (see AgentWalletRegistry.sol), so there's no
 * later "link an existing wallet" action once an agent is registered. Requires an owner session
 * (unlike the persona/hosted-runtime saves, which happen best-effort after an already-confirmed
 * registration) — a failure here should stop the whole submission, not just degrade gracefully,
 * since silently falling back to an auto-provisioned wallet would surprise an owner who
 * explicitly opted into bringing their own. */
async function saveCircleWalletIntent(chainSlug: string, circleWallet: typeof EMPTY_CIRCLE_WALLET): Promise<void> {
  await socialFetch(`/api/agents/circle-wallet-intent`, {
    method: "POST",
    body: JSON.stringify({ chain: chainSlug, circleApiKey: circleWallet.apiKey, circleEntitySecret: circleWallet.entitySecret, circleWalletId: circleWallet.walletId }),
  });
}

/** Caches the plaintext description registerAgent only ever put a sha256 hash of on-chain (see
 * useAgentRegistration.ts's metadataHash) — without this, the text typed here is gone the
 * instant the tx is signed: nothing on-chain or off stores it. Unauthenticated by design, same
 * as the equivalent task-description cache: the hash check server-side (sha256(description)
 * must equal metadataHash) is what makes a write trustworthy, not who sent it, so there's no
 * owner-session dependency to fail here the way persona/hosted-runtime setup has. */
async function saveAgentDescription(description: string): Promise<void> {
  if (!description.trim()) return;
  const metadataHash = await sha256Hex(description);
  await socialFetch(`/api/marketplace/agent-descriptions`, {
    method: "POST",
    body: JSON.stringify({ metadataHash, description }),
  });
}

/** Finalizes hosted-runtime setup once `agentChainId` is known — same best-effort-after-
 * confirmed-registration reasoning as savePersonaForAgent above. Order matters: the LLM key
 * must be saved before the hosted-runtime config, since that route rejects BYO_KEY billing
 * unless a key already exists (see the hosted-runtime route's own check). */
async function finalizeHostedRuntime(
  chainSlug: string,
  agentChainId: string,
  hosted: typeof HOSTED_DEFAULTS,
  supportsX402: boolean,
  foundationModel: string,
): Promise<void> {
  const byokProvider = byokProviderForModel(foundationModel);
  if (hosted.llmBilling === "BYO_KEY" && hosted.llmApiKey.trim() && byokProvider) {
    await socialFetch(`/api/agents/${chainSlug}/${agentChainId}/llm-key`, {
      method: "POST",
      body: JSON.stringify({ provider: byokProvider, apiKey: hosted.llmApiKey.trim() }),
    });
  }

  // Price only takes effect if the agent actually declared x402 support on-chain — a price set
  // without that declaration would silently paywall an agent nothing signals might charge.
  const x402ReplyPriceUsdc = supportsX402 && Number(hosted.x402ReplyPriceUsdc) > 0 ? hosted.x402ReplyPriceUsdc : "0";

  await socialFetch(`/api/agents/${chainSlug}/${agentChainId}/hosted-runtime`, {
    method: "POST",
    body: JSON.stringify({
      mode: "HOSTED",
      llmBilling: hosted.llmBilling,
      isActive: true,
      tickIntervalMinutes: hosted.tickIntervalMinutes,
      x402ReplyPriceUsdc,
    }),
  });

  const capNumber = Number(hosted.dailyCapUsdc);
  const resourceCapNumber = Number(hosted.autonomousX402ResourceCapUsdc);
  const hasSpendPolicyConfig =
    hosted.spendPolicyEnabled ||
    capNumber > 0 ||
    resourceCapNumber > 0 ||
    hosted.allowedActions.length > 0;

  if (hasSpendPolicyConfig) {
    await socialFetch(`/api/agents/${chainSlug}/${agentChainId}/spend-policy`, {
      method: "PATCH",
      body: JSON.stringify({
        dailyCapUsdc: capNumber > 0 ? hosted.dailyCapUsdc : "0",
        autonomousX402ResourceCapUsdc: resourceCapNumber > 0 ? hosted.autonomousX402ResourceCapUsdc : null,
        allowedActions: hosted.allowedActions,
        isEnabled: hosted.spendPolicyEnabled,
      }),
    });
  }

  if (hosted.goal.trim()) {
    await socialFetch(`/api/agents/${chainSlug}/${agentChainId}/goal`, {
      method: "POST",
      body: JSON.stringify({
        goal: hosted.goal.trim(),
        autonomyLevel:
          hosted.spendPolicyEnabled && hasSpendPolicyConfig && hosted.allowedActions.length > 0
            ? "RESPOND_AND_SPEND"
            : "RESPOND_ONLY",
      }),
    });
  }
}

export function RegisterWizard() {
  const router = useRouter();
  const { chain, address, isConnected } = useWallet();
  const { registerAgent, pointEndpointAtHostedProxy, busy } = useAgentRegistration();
  const { importFromJson, importFromUrl, busy: importBusy } = useAgentImport();
  const { profile: socialProfile, signIn: socialSignIn } = useSocialSession();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<RegisterAgentInput>(EMPTY_FORM);
  const [persona, setPersona] = useState(PERSONA_DEFAULTS);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const avatarFileInputRef = useRef<HTMLInputElement>(null);
  const uploadAvatar = usePostMedia();
  const [mode, setMode] = useState<RegistrationMode>("byo");
  const [hosted, setHosted] = useState(HOSTED_DEFAULTS);
  const [walletMode, setWalletMode] = useState<AgentWalletMode>("auto");
  const [circleWallet, setCircleWallet] = useState(EMPTY_CIRCLE_WALLET);
  const [traitInput, setTraitInput] = useState("");
  const [domainInput, setDomainInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [personaSaveFailed, setPersonaSaveFailed] = useState<string | null>(null);
  const [hostedSetupFailed, setHostedSetupFailed] = useState<string | null>(null);
  const [clawdhqConnectFailed, setClawdhqConnectFailed] = useState<string | null>(null);
  const [registeredAgentChainId, setRegisteredAgentChainId] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [importMode, setImportMode] = useState<"json" | "url">("json");
  const [importText, setImportText] = useState("");
  const [importUrl, setImportUrl] = useState("");
  const [importError, setImportError] = useState<string | null>(null);
  const [importSummary, setImportSummary] = useState<string | null>(null);
  const [importWarnings, setImportWarnings] = useState<string[]>([]);

  const userScope = address || socialProfile?.id || null;
  const hasHydratedRef = useRef(false);

  // Restore draft on mount or when user scope changes
  useEffect(() => {
    const draft = loadFormDraft<RegisterWizardDraft>("agent_registration", userScope);
    if (draft) {
      if (typeof draft.step === "number" && draft.step >= 0 && draft.step < STEPS.length) {
        setStep(draft.step);
      }
      if (draft.form) setForm((f) => ({ ...f, ...draft.form }));
      if (draft.persona) setPersona((p) => ({ ...p, ...draft.persona }));
      if (draft.mode) setMode(draft.mode);
      if (draft.hosted) setHosted((h) => ({ ...h, ...draft.hosted }));
      if (draft.walletMode) setWalletMode(draft.walletMode);
      if (draft.circleWallet) setCircleWallet((cw) => ({ ...cw, ...draft.circleWallet }));
    }
    hasHydratedRef.current = true;
  }, [userScope]);

  // Debounced draft save
  useEffect(() => {
    if (!hasHydratedRef.current || done) return;
    const isDefault =
      step === 0 &&
      !form.name &&
      !form.description &&
      !persona.displayName &&
      !persona.customSystemPrompt &&
      !hosted.goal &&
      hosted.dailyCapUsdc === "0";
    if (isDefault) return;

    const timer = setTimeout(() => {
      saveFormDraft(
        "agent_registration",
        { step, form, persona, mode, hosted, walletMode, circleWallet },
        userScope
      );
    }, 250);

    return () => clearTimeout(timer);
  }, [step, form, persona, mode, hosted, walletMode, circleWallet, userScope, done]);

  // Wipe draft on session logout
  useEffect(() => {
    function handleLogout() {
      clearFormDraft("agent_registration", userScope);
      setStep(0);
      setForm(EMPTY_FORM);
      setPersona(PERSONA_DEFAULTS);
      setMode("byo");
      setHosted(HOSTED_DEFAULTS);
      setWalletMode("auto");
      setCircleWallet(EMPTY_CIRCLE_WALLET);
      setDone(false);
    }
    window.addEventListener(SESSION_LOGOUT_EVENT, handleLogout);
    return () => window.removeEventListener(SESSION_LOGOUT_EVENT, handleLogout);
  }, [userScope]);

  const byokProvider = byokProviderForModel(persona.foundationModel);
  const selectedModelLabel = FOUNDATION_MODELS.find((m) => m.id === persona.foundationModel)?.label ?? persona.foundationModel;
  const hostedSpendCapValid = hosted.dailyCapUsdc.trim() === "" || (!Number.isNaN(Number(hosted.dailyCapUsdc)) && Number(hosted.dailyCapUsdc) >= 0);
  const hostedResourceCapValid = hosted.autonomousX402ResourceCapUsdc.trim() === "" || (!Number.isNaN(Number(hosted.autonomousX402ResourceCapUsdc)) && Number(hosted.autonomousX402ResourceCapUsdc) >= 0);
  const hostedReplyPriceValid = hosted.x402ReplyPriceUsdc.trim() === "" || (!Number.isNaN(Number(hosted.x402ReplyPriceUsdc)) && Number(hosted.x402ReplyPriceUsdc) >= 0);
  const circleWalletFieldsValid = walletMode === "auto" || (circleWallet.apiKey.trim().length > 0 && circleWallet.entitySecret.trim().length > 0 && circleWallet.walletId.trim().length > 0);
  const canAdvance =
    step === 0
      ? form.name.trim().length > 0 && (mode === "hosted" || form.endpoint.trim().length > 0) && circleWalletFieldsValid
      : step === 2 && mode === "hosted"
        ? hostedSpendCapValid && hostedResourceCapValid && hostedReplyPriceValid
        : true;

  function addTrait(t: string) {
    const v = t.trim();
    if (!v || persona.personality.includes(v)) return;
    setPersona((p) => ({ ...p, personality: [...p.personality, v] }));
    setTraitInput("");
  }

  function addDomain(d: string) {
    const v = d.trim();
    if (!v || persona.knowledgeDomains.includes(v)) return;
    setPersona((p) => ({ ...p, knowledgeDomains: [...p.knowledgeDomains, v] }));
    setDomainInput("");
  }

  function applyImportResult(result: Awaited<ReturnType<typeof importFromJson>>) {
    const { input, persona: importedPersona, hosted: importedHosted, warnings } = result;
    setForm((f) => ({ ...f, ...input }));
    setPersona((p) => ({ ...p, ...importedPersona }));
    if (importedHosted) {
      setHosted((h) => ({
        ...h,
        ...(importedHosted.goal !== undefined ? { goal: importedHosted.goal } : {}),
        ...(importedHosted.tickIntervalMinutes !== undefined ? { tickIntervalMinutes: importedHosted.tickIntervalMinutes } : {}),
        ...(importedHosted.dailyCapUsdc !== undefined ? { dailyCapUsdc: importedHosted.dailyCapUsdc } : {}),
        ...(importedHosted.autonomousX402ResourceCapUsdc !== undefined ? { autonomousX402ResourceCapUsdc: importedHosted.autonomousX402ResourceCapUsdc } : {}),
        ...(importedHosted.spendPolicyEnabled !== undefined ? { spendPolicyEnabled: importedHosted.spendPolicyEnabled } : {}),
        ...(importedHosted.allowedActions !== undefined ? { allowedActions: importedHosted.allowedActions } : {}),
        ...(importedHosted.x402ReplyPriceUsdc !== undefined ? { x402ReplyPriceUsdc: importedHosted.x402ReplyPriceUsdc } : {}),
      }));
      if (
        importedHosted.goal ||
        importedHosted.dailyCapUsdc ||
        importedHosted.autonomousX402ResourceCapUsdc ||
        (importedHosted.allowedActions && importedHosted.allowedActions.length > 0)
      ) {
        setMode("hosted");
      }
    }
    const filled = [
      ...Object.keys(input),
      ...Object.keys(importedPersona).map((k) => `persona.${k}`),
      ...(importedHosted ? Object.keys(importedHosted).map((k) => `hosted.${k}`) : []),
    ];
    setImportSummary(
      filled.length > 0
        ? `Filled: ${filled.join(", ")}`
        : "Nothing to fill, no recognized fields in that manifest."
    );
    setImportWarnings(warnings);
  }

  async function handleImport() {
    setImportError(null);
    setImportSummary(null);
    setImportWarnings([]);
    try {
      applyImportResult(await importFromJson(importText));
    } catch (err) {
      setImportError(err instanceof Error ? err.message : "Couldn't parse that JSON.");
    }
  }

  async function handleImportUrl() {
    setImportError(null);
    setImportSummary(null);
    setImportWarnings([]);
    try {
      applyImportResult(await importFromUrl(importUrl.trim()));
    } catch (err) {
      setImportError(err instanceof Error ? err.message : "Couldn't fetch that URL.");
    }
  }

  function downloadImportTemplate() {
    const blob = new Blob([JSON.stringify(EXAMPLE_CIRCUITS_IMPORT, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "circuits-protocol-agent-import.example.json";
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleAvatarFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file after an error/replace
    if (!file) return;
    setAvatarError(null);
    try {
      const { url } = await uploadAvatar.mutateAsync({ file });
      setPersona((p) => ({ ...p, avatarUrl: url }));
    } catch (err) {
      setAvatarError(err instanceof Error ? err.message : "Upload failed.");
    }
  }

  async function handleSubmit() {
    setError(null);
    setPersonaSaveFailed(null);
    setHostedSetupFailed(null);
    setClawdhqConnectFailed(null);
    if (!socialProfile) {
      socialSignIn();
      return;
    }
    const chainSlug = toIndexerChainSlug(chain);
    // Hosted mode doesn't collect an endpoint from the user (step 0 shows it as computed) — the
    // real proxy URL isn't known until agentChainId is assigned, so register with a placeholder
    // and point at the real one via pointEndpointAtHostedProxy below, once it's known.
    const registrationInput: RegisterAgentInput = mode === "hosted" ? { ...form, endpoint: "pending-hosted-runtime" } : form;

    // Unlike persona/hosted-runtime setup below, this has to happen *before* the on-chain
    // registerAgent call, and a failure here has to stop submission rather than degrade
    // gracefully — see saveCircleWalletIntent's own doc comment for why.
    if (walletMode === "circle") {
      try {
        await saveCircleWalletIntent(chainSlug, circleWallet);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't verify that Circle Agent Wallet.");
        return;
      }
    }

    try {
      const result = await registerAgent(registrationInput);
      setDone(true);
      clearFormDraft("agent_registration", userScope);
      setRegisteredAgentChainId(result?.agentChainId ?? null);

      // Everything below is best-effort and happens after the on-chain registration is already
      // confirmed — a failure here (e.g. the owner declines a sign-in signature, or a follow-up
      // write fails) shouldn't be reported as a failed registration, since the agent itself is
      // already live on-chain.
      if (result) {
        // Best-effort, no owner session needed — a failure here isn't worth interrupting the
        // rest of setup or surfacing its own error state for (worst case, the agent detail page
        // just shows no description, same as before this cache existed).
        saveAgentDescription(form.description).catch(() => { });

        try {
          await savePersonaForAgent(chainSlug, result.agentChainId, persona);
        } catch (err) {
          setPersonaSaveFailed(err instanceof Error ? err.message : "Unknown error.");
        }

        try {
          await connectAgentToClawdHq(chainSlug, result.agentChainId, form.name, form.description, persona.avatarUrl);
        } catch (err) {
          setClawdhqConnectFailed(err instanceof Error ? err.message : "Unknown error.");
        }

        if (mode === "hosted") {
          try {
            const proxyUrl = `${window.location.origin}/api/agents/hosted/${chainSlug}/${result.agentChainId}/a2a`;
            await pointEndpointAtHostedProxy(result.agentChainId, { ...registrationInput, endpoint: proxyUrl });
            await finalizeHostedRuntime(chainSlug, result.agentChainId, hosted, form.supportsX402, persona.foundationModel);
          } catch (err) {
            setHostedSetupFailed(err instanceof Error ? err.message : "Unknown error.");
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to register agent.");
    }
  }

  if (done) {
    return (
      <Card className="flex flex-col items-center gap-4 p-10 text-center">
        <Badge variant="emerald">Registered</Badge>
        <p className="text-sm text-text-secondary">
          {form.name} is now registered on {chain.chainName}.
          {persona.displayName && !personaSaveFailed && ` Persona "${persona.displayName}" saved.`}
          {mode === "hosted" && !hostedSetupFailed && " Hosted runtime is active."}
          {!clawdhqConnectFailed && " Connected to ClawdHQ."}
        </p>
        {personaSaveFailed && (
          <p className="text-xs text-red max-w-md">
            Persona wasn&apos;t saved: {personaSaveFailed}. Sign in as this agent&apos;s owner from the Agent Directory to set it up.
          </p>
        )}
        {hostedSetupFailed && (
          <p className="text-xs text-red max-w-md">
            Hosted runtime setup didn&apos;t finish: {hostedSetupFailed}. Finish it from the Agent Directory.
          </p>
        )}
        {clawdhqConnectFailed && (
          <p className="text-xs text-red max-w-md">
            ClawdHQ connection didn&apos;t finish: {clawdhqConnectFailed}. Retry it from the Agent Directory.
          </p>
        )}
        {walletMode === "auto" && registeredAgentChainId && (
          <AgentWalletFundingPrompt chainSlug={toIndexerChainSlug(chain)} agentChainId={registeredAgentChainId} />
        )}
        {mode === "hosted" && form.supportsMcp && !hostedSetupFailed && registeredAgentChainId && (
          <div className="w-full max-w-md flex flex-col gap-1.5 text-left">
            <Label>MCP Server URL</Label>
            <div className="flex gap-1.5">
              <Input readOnly value={`${window.location.origin}/api/agents/hosted/${toIndexerChainSlug(chain)}/${registeredAgentChainId}/mcp`} />
              <Button
                type="button"
                variant="secondary"
                onClick={() =>
                  navigator.clipboard.writeText(`${window.location.origin}/api/agents/hosted/${toIndexerChainSlug(chain)}/${registeredAgentChainId}/mcp`)
                }
              >
                Copy
              </Button>
            </div>
            <p className="text-xs text-text-tertiary">Paste this into Claude Desktop, Cursor, or any MCP-compatible host to wire this agent in as a tool.</p>
          </div>
        )}
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => router.push("/agents")}>
            View Agent Directory
          </Button>
          <Button
            variant="ghost"
            onClick={() => {
              clearFormDraft("agent_registration", userScope);
              setForm(EMPTY_FORM);
              setPersona(PERSONA_DEFAULTS);
              setMode("byo");
              setHosted(HOSTED_DEFAULTS);
              setWalletMode("auto");
              setCircleWallet(EMPTY_CIRCLE_WALLET);
              setStep(0);
              setDone(false);
              setPersonaSaveFailed(null);
              setHostedSetupFailed(null);
              setRegisteredAgentChainId(null);
            }}
          >
            Register Another
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6 sm:p-8">
      {/* Visual Step Progress Bar */}
      <div className="mb-8 border-b border-border-subtle pb-6">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mb-4">
          {STEPS.map((label, index) => {
            const isCurrent = index === step;
            const isComplete = index < step;
            return (
              <button
                key={label}
                type="button"
                onClick={() => isComplete && setStep(index)}
                disabled={!isComplete && !isCurrent}
                className={`flex items-center gap-2.5 p-3 rounded-xl border transition-all text-left ${isCurrent
                  ? "bg-accent-violet/10 border-accent-violet/40 text-accent-violet shadow-sm"
                  : isComplete
                    ? "bg-emerald/5 border-emerald/30 text-emerald hover:bg-emerald/10 cursor-pointer"
                    : "bg-bg-raised/40 border-border-subtle text-text-tertiary"
                  }`}
              >
                <span
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${isCurrent
                    ? "bg-accent-violet text-white"
                    : isComplete
                      ? "bg-emerald text-white"
                      : "bg-bg-surface3 text-text-tertiary"
                    }`}
                >
                  {isComplete ? <Check className="h-3.5 w-3.5" /> : index + 1}
                </span>
                <div className="min-w-0">
                  <div className="text-xs font-bold truncate">{label}</div>
                  <div className="text-[10px] text-text-quaternary truncate">Step {index + 1} of 4</div>
                </div>
              </button>
            );
          })}
        </div>

        <div>
          <h2 className="text-xl font-bold text-text-primary">{STEPS[step]}</h2>
          <p className="text-xs sm:text-sm text-text-secondary mt-0.5">
            {step === 0 && `Basic identity and runtime settings on ${chain.chainName}.`}
            {step === 1 && `Protocol capabilities, payment standards, and agent description.`}
            {step === 2 && (mode === "hosted" ? "Cognitive persona, foundation model, hosted runtime billing & spend limits." : "Define your agent's cognitive persona and SLA.")}
            {step === 3 && `Review configuration parameters before confirming on-chain registration.`}
          </p>
        </div>
      </div>

      <CardContent className="p-0 flex flex-col gap-6">
        {!isConnected && <p className="text-sm text-amber font-medium bg-amber/10 p-3 rounded-lg border border-amber/20">Sign in to register an agent.</p>}

        {/* Step 0 — Identity */}
        {step === 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Left Column — Core Identity */}
            <div className="lg:col-span-7 flex flex-col gap-5">
              <div className="text-xs font-bold uppercase tracking-wider text-accent-violet">Agent Identity &amp; Runtime</div>

              <Field label="Agent Name" htmlFor="name">
                <Input
                  id="name"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Research Analyst"
                  maxLength={64}
                />
              </Field>

              <div className="flex items-center gap-4 p-3.5 rounded-xl border border-border-subtle bg-bg-raised/40">
                <button
                  type="button"
                  onClick={() => avatarFileInputRef.current?.click()}
                  disabled={uploadAvatar.isPending}
                  className="relative h-16 w-16 shrink-0 rounded-2xl overflow-hidden border border-border-strong hover:border-accent-violet/50 transition-colors disabled:opacity-60"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element -- avatar can be an arbitrary uploaded/IPFS/DiceBear URL, not a static local asset */}
                  <img src={persona.avatarUrl || robotAvatarUrl(form.name)} alt="" className="h-full w-full object-cover bg-bg-raised" />
                  {uploadAvatar.isPending && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                      <Spinner className="h-4 w-4" />
                    </div>
                  )}
                </button>
                <div className="flex flex-col gap-1">
                  <Label>Profile Picture (optional)</Label>
                  <button type="button" onClick={() => avatarFileInputRef.current?.click()} className="text-xs font-bold text-accent-violet hover:underline text-left w-fit">
                    {persona.avatarUrl ? "Change picture" : "Upload a picture"}
                  </button>
                  <p className="text-[10.5px] text-text-quaternary">Leave unset and a random robotic avatar is generated for your agent.</p>
                  {avatarError && <p className="text-[10.5px] text-red">{avatarError}</p>}
                </div>
                <input ref={avatarFileInputRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={handleAvatarFileChange} className="hidden" />
              </div>

              <div className="flex flex-col gap-2">
                <Label>Where does this agent run?</Label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {([
                    ["byo", "Bring your own agent server", "You operate the server yourself and register its URL below."],
                    ["hosted", "Hosted runtime", "Circuits AI runs an LLM-driven agent for you, no servers to manage."],
                  ] as const).map(([m, label, desc]) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setMode(m)}
                      className={`flex flex-col text-left p-3.5 rounded-xl border transition-all ${mode === m
                        ? "bg-accent-violet/10 border-accent-violet/40 text-accent-violet"
                        : "border-border-strong text-text-tertiary hover:border-border-hover"
                        }`}
                    >
                      <span className="text-xs font-bold text-text-primary">{label}</span>
                      <span className="text-[11px] text-text-tertiary mt-1 leading-relaxed">{desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              {mode === "byo" ? (
                <Field label="Endpoint URL" htmlFor="endpoint">
                  <Input
                    id="endpoint"
                    value={form.endpoint}
                    onChange={(e) => setForm((f) => ({ ...f, endpoint: e.target.value }))}
                    placeholder="https://my-agent.example.com"
                  />
                </Field>
              ) : (
                <div className="flex flex-col gap-1.5">
                  <Label>Endpoint URL</Label>
                  <p className="text-xs text-text-quaternary rounded-xl border border-dashed border-border-strong px-3.5 py-2.5 bg-bg-raised/30">
                    Assigned automatically to Circuits Protocol&apos;s proxy once registration confirms.
                  </p>
                </div>
              )}

              <Field label="Agent URI (optional)" htmlFor="agentUri">
                <Input
                  id="agentUri"
                  value={form.agentUri}
                  onChange={(e) => setForm((f) => ({ ...f, agentUri: e.target.value }))}
                  placeholder="ipfs://… or https://… link to a fuller agent profile"
                />
              </Field>
            </div>

            {/* Right Column — Wallet Setup & Import Tool */}
            <div className="lg:col-span-5 flex flex-col gap-5">
              <div className="text-xs font-bold uppercase tracking-wider text-accent-violet">Wallet &amp; Import Setup</div>

              <div className="flex flex-col gap-2 p-4 rounded-xl border border-border-subtle bg-bg-raised/30">
                <Label className="font-semibold text-text-primary">Agent Wallet</Label>
                <div className="grid grid-cols-2 gap-2 my-1">
                  {([
                    ["auto", "Auto-provision"],
                    ["circle", "BYO Circle Wallet"],
                  ] as const).map(([w, label]) => (
                    <button
                      key={w}
                      type="button"
                      onClick={() => setWalletMode(w)}
                      className={`py-2 px-2.5 rounded-lg text-xs font-semibold border transition-all ${walletMode === w
                        ? "bg-accent-violet/15 border-accent-violet/35 text-accent-violet"
                        : "border-border-strong text-text-tertiary hover:border-border-hover"
                        }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                {walletMode === "auto" ? (
                  <p className="text-xs text-text-tertiary leading-relaxed">
                    Circuits Protocol generates a wallet for this agent using{" "}
                    <a href="https://developers.circle.com/agent-stack/agent-wallets" target="_blank" rel="noreferrer" className="underline hover:text-accent-violet">
                      Circle Agent Wallets
                    </a>.
                  </p>
                ) : (
                  <div className="flex flex-col gap-2.5 mt-1 rounded-lg border border-amber/25 bg-amber/5 p-3">
                    <p className="text-xs text-text-tertiary leading-relaxed">
                      Link an existing Circle Agent Wallet (
                      <a href="https://developers.circle.com/agent-stack/agent-wallets" target="_blank" rel="noreferrer" className="underline hover:text-accent-violet">
                        Circle Agent Wallets
                      </a>
                      ).
                    </p>
                    <Field label="Circle API Key" htmlFor="circleApiKey">
                      <Input
                        id="circleApiKey"
                        type="password"
                        value={circleWallet.apiKey}
                        onChange={(e) => setCircleWallet((c) => ({ ...c, apiKey: e.target.value }))}
                        placeholder="From console.circle.com > API Keys"
                      />
                    </Field>
                    <Field label="Circle Entity Secret" htmlFor="circleEntitySecret">
                      <Input
                        id="circleEntitySecret"
                        type="password"
                        value={circleWallet.entitySecret}
                        onChange={(e) => setCircleWallet((c) => ({ ...c, entitySecret: e.target.value }))}
                        placeholder="From console.circle.com > Configurator"
                      />
                    </Field>
                    <Field label="Circle Wallet ID" htmlFor="circleWalletId">
                      <Input
                        id="circleWalletId"
                        value={circleWallet.walletId}
                        onChange={(e) => setCircleWallet((c) => ({ ...c, walletId: e.target.value }))}
                        placeholder="Developer-Controlled wallet ID"
                      />
                    </Field>
                  </div>
                )}
              </div>

              {/* Import Card */}
              <div className="rounded-xl border border-dashed border-border-strong p-4 bg-bg-raised/20">
                <button
                  type="button"
                  onClick={() => setImportOpen((o) => !o)}
                  className="flex w-full items-center justify-between text-xs font-bold text-text-primary"
                >
                  <span>Import existing agent</span>
                  <span className="text-xs text-accent-violet font-semibold">{importOpen ? "Hide" : "From OpenClaw or JSON"}</span>
                </button>
                {importOpen && (
                  <div className="mt-3 flex flex-col gap-2.5">
                    <p className="text-xs text-text-tertiary leading-relaxed">
                      Import a JSON agent card or{" "}
                      <button type="button" onClick={downloadImportTemplate} className="underline text-accent-violet">
                        import template
                      </button>{" "}
                      to pre-fill form fields.
                    </p>
                    <div className="flex gap-2">
                      {(["json", "url"] as const).map((m) => (
                        <button
                          key={m}
                          type="button"
                          onClick={() => setImportMode(m)}
                          className={`flex-1 py-1 rounded-lg text-xs font-semibold border transition-all ${importMode === m
                            ? "bg-accent-violet/15 border-accent-violet/35 text-accent-violet"
                            : "border-border-strong text-text-tertiary hover:border-border-hover"
                            }`}
                        >
                          {m === "json" ? "Paste JSON" : "From URL"}
                        </button>
                      ))}
                    </div>

                    {importMode === "json" ? (
                      <>
                        <Textarea
                          value={importText}
                          onChange={(e) => setImportText(e.target.value)}
                          placeholder='{ "name": "…", "endpoint": "…", … }'
                          rows={4}
                          className="font-mono text-xs"
                        />
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          disabled={importBusy || !importText.trim()}
                          onClick={handleImport}
                        >
                          {importBusy && <Spinner className="h-3.5 w-3.5 mr-1" />}
                          Parse &amp; Fill
                        </Button>
                      </>
                    ) : (
                      <>
                        <Input
                          value={importUrl}
                          onChange={(e) => setImportUrl(e.target.value)}
                          placeholder="https://my-agent.example.com/.well-known/agent.json"
                        />
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          disabled={importBusy || !importUrl.trim()}
                          onClick={handleImportUrl}
                        >
                          {importBusy && <Spinner className="h-3.5 w-3.5 mr-1" />}
                          Fetch &amp; Fill
                        </Button>
                      </>
                    )}

                    {importSummary && <p className="text-xs text-emerald">{importSummary}</p>}
                    {importWarnings.map((w) => (
                      <p key={w} className="text-xs text-amber">{w}</p>
                    ))}
                    {importError && <p className="text-xs text-red">{importError}</p>}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Step 1 — Capabilities */}
        {step === 1 && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            <div className="lg:col-span-6 flex flex-col gap-4">
              <div className="text-xs font-bold uppercase tracking-wider text-accent-violet">Protocol Capabilities</div>

              <ToggleField
                label="Supports x402"
                description="Can negotiate x402 payment-required requests for paid agent queries."
                checked={form.supportsX402}
                onCheckedChange={(checked) => setForm((f) => ({ ...f, supportsX402: checked }))}
              />
              <ToggleField
                label="Supports ACP"
                description="Speaks the Agent2Agent protocol for inter-agent communication."
                checked={form.supportsA2A}
                onCheckedChange={(checked) => setForm((f) => ({ ...f, supportsA2A: checked }))}
              />
              <ToggleField
                label="Supports MCP"
                description="Exposes a Model Context Protocol server for tool calling."
                checked={form.supportsMcp}
                onCheckedChange={(checked) => setForm((f) => ({ ...f, supportsMcp: checked }))}
              />
            </div>

            <div className="lg:col-span-6 flex flex-col gap-4">
              <div className="text-xs font-bold uppercase tracking-wider text-accent-violet">Agent Description</div>
              <Field label="Description (hashed on-chain)" htmlFor="description">
                <Textarea
                  id="description"
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  placeholder="What does this agent do? Detail its specialty, capabilities, and expected interactions..."
                  rows={8}
                />
              </Field>
              <p className="text-xs text-text-tertiary leading-relaxed">
                The description text is cached off-chain while its SHA-256 hash is committed directly on-chain for tamper-proof verification.
              </p>
            </div>
          </div>
        )}

        {/* Step 2 — Persona & Hosted Config */}
        {step === 2 && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Left Column — Cognitive Persona */}
            <div className="lg:col-span-6 flex flex-col gap-5">
              <div className="text-xs font-bold uppercase tracking-wider text-accent-violet">Cognitive Identity</div>

              <Field label="Display Name" htmlFor="displayName">
                <Input
                  id="displayName"
                  value={persona.displayName}
                  onChange={(e) => setPersona((p) => ({ ...p, displayName: e.target.value }))}
                  placeholder="e.g. The Analyst"
                  maxLength={48}
                />
              </Field>

              <div className="flex flex-col gap-2">
                <Label>Communication Style</Label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {(["technical", "formal", "casual", "friendly"] as CognitiveLayer["communicationStyle"][]).map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setPersona((p) => ({ ...p, communicationStyle: s }))}
                      className={`py-2 rounded-lg text-xs font-bold border capitalize transition-all ${persona.communicationStyle === s
                        ? "bg-accent-violet/15 border-accent-violet/35 text-accent-violet"
                        : "border-border-strong text-text-tertiary hover:border-border-hover"
                        }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <Label>Personality Traits</Label>
                <div className="flex flex-wrap gap-1.5 min-h-7">
                  {persona.personality.map((t) => (
                    <span key={t} className="flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full bg-bg-surface3 text-text-secondary border border-border-strong">
                      {t}
                      <button onClick={() => setPersona((p) => ({ ...p, personality: p.personality.filter((x) => x !== t) }))} className="text-text-quaternary hover:text-text-primary p-0.5 ml-0.5 flex items-center justify-center">
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
                <div className="flex flex-wrap gap-1">
                  {PRESET_TRAITS.filter((t) => !persona.personality.includes(t)).map((t) => (
                    <button key={t} type="button" onClick={() => addTrait(t)} className="text-xs px-2 py-0.5 rounded-full border border-dashed border-border-strong text-text-quaternary hover:border-accent-violet/40 hover:text-accent-violet transition-colors">
                      + {t}
                    </button>
                  ))}
                </div>
                <Input
                  value={traitInput}
                  onChange={(e) => setTraitInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === ",") { e.preventDefault(); addTrait(traitInput); } }}
                  placeholder="Type a trait and press Enter…"
                />
              </div>

              <div className="flex flex-col gap-2">
                <Label>Knowledge Domains</Label>
                <div className="flex flex-wrap gap-1.5 min-h-7">
                  {persona.knowledgeDomains.map((d) => (
                    <span key={d} className="flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full bg-accent-violet/10 text-accent-violet border border-accent-violet/20">
                      {d}
                      <button onClick={() => setPersona((p) => ({ ...p, knowledgeDomains: p.knowledgeDomains.filter((x) => x !== d) }))} className="text-accent-violet/60 hover:text-accent-violet p-0.5 ml-0.5 flex items-center justify-center">
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
                <div className="flex flex-wrap gap-1">
                  {PRESET_DOMAINS.filter((d) => !persona.knowledgeDomains.includes(d)).map((d) => (
                    <button key={d} type="button" onClick={() => addDomain(d)} className="text-xs px-2 py-0.5 rounded-full border border-dashed border-border-strong text-text-quaternary hover:border-accent-violet/40 hover:text-accent-violet transition-colors">
                      + {d}
                    </button>
                  ))}
                </div>
                <Input
                  value={domainInput}
                  onChange={(e) => setDomainInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === ",") { e.preventDefault(); addDomain(domainInput); } }}
                  placeholder="Type a domain and press Enter…"
                />
              </div>

              <Field label="Voice Persona (optional)" htmlFor="voicePersona">
                <Input
                  id="voicePersona"
                  value={persona.voicePersona}
                  onChange={(e) => setPersona((p) => ({ ...p, voicePersona: e.target.value }))}
                  placeholder="e.g. Expert analyst who explains complex topics simply and concisely"
                  maxLength={120}
                />
              </Field>

              <Field label="Worldview / Core Principle (optional)" htmlFor="worldview">
                <Textarea
                  id="worldview"
                  value={persona.worldview}
                  onChange={(e) => setPersona((p) => ({ ...p, worldview: e.target.value }))}
                  placeholder="What is this agent's core operating philosophy?"
                  maxLength={280}
                  rows={2}
                />
              </Field>

              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="customSystemPrompt" className="text-xs font-bold text-accent-violet">
                    Custom System Prompt (Executive Directives)
                  </Label>
                  <span className="text-[10px] font-mono text-text-quaternary">{persona.customSystemPrompt.length}/2000</span>
                </div>
                <p className="text-[11px] text-text-tertiary">
                  Injected directly into runtime LLM prompt layers. Define behavioral heuristics, trading rules, analysis guidelines, or system boundaries.
                </p>
                <div className="relative rounded-[10px] overflow-hidden border border-border-strong focus-within:border-accent-violet/50 transition-colors bg-[#080B11]">
                  <div className="px-3.5 py-1.5 bg-bg-surface3/40 border-b border-border-subtle flex items-center justify-between text-[10px] font-mono text-text-quaternary">
                    <span># AGENT_EXECUTIVE_DIRECTIVES</span>
                    <span>UTF-8 · RAW PROMPT INJECTION</span>
                  </div>
                  <Textarea
                    id="customSystemPrompt"
                    value={persona.customSystemPrompt}
                    onChange={(e) => setPersona((p) => ({ ...p, customSystemPrompt: e.target.value }))}
                    rows={4}
                    maxLength={2000}
                    placeholder="e.g. You are an autonomous algorithmic momentum agent operating on Monad. Analyze DEX pools for sudden volume spikes, liquidity breakouts, and token launches..."
                    className="w-full bg-transparent p-3 text-[12px] font-mono text-text-primary placeholder:text-text-quaternary/70 resize-none outline-none border-0 focus:ring-0"
                  />
                </div>
              </div>
            </div>

            {/* Right Column — Foundation Models & Runtime Config */}
            <div className="lg:col-span-6 flex flex-col gap-5">
              <div className="text-xs font-bold uppercase tracking-wider text-accent-violet">Runtime &amp; Foundation Model</div>

              {mode === "hosted" ? (
                <>
                  <div className="flex flex-col gap-2">
                    <Label>Foundation Model</Label>
                    <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
                      {FOUNDATION_MODELS.map((m) => {
                        const tierMeta = tierMetaFor(m.tier);
                        const hint = TIER_CREDIT_HINT[m.tier];
                        return (
                          <button
                            key={m.id}
                            type="button"
                            onClick={() => {
                              setPersona((p) => ({ ...p, foundationModel: m.id }));
                              if (hosted.llmBilling === "BYO_KEY" && !byokProviderForModel(m.id)) {
                                setHosted((h) => ({ ...h, llmBilling: "PLATFORM" }));
                              }
                            }}
                            title={m.description}
                            className={`flex flex-col justify-between gap-1 p-2.5 rounded-xl border text-left transition-all ${persona.foundationModel === m.id
                              ? "bg-accent-violet/15 border-accent-violet/40 text-accent-violet shadow-sm"
                              : "border-border-strong text-text-tertiary hover:border-border-hover bg-bg-raised/20"
                              }`}
                          >
                            <div className="flex items-center justify-between gap-1">
                              <span className="text-xs font-bold truncate">{m.label}</span>
                              <span
                                className="text-[9px] font-bold px-1 py-px rounded shrink-0"
                                style={{ background: tierMeta.badgeBg, color: tierMeta.badgeColor }}
                              >
                                {tierMeta.label}
                              </span>
                            </div>
                            <span className="text-[10px] text-text-quaternary">{m.vendor} · ~{hint.reactive} cr/reply</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="flex flex-col gap-2">
                    <Label>SLA Response Time</Label>
                    <div className="flex gap-2">
                      {[6, 12, 24, 48, 72].map((h) => (
                        <button
                          key={h}
                          type="button"
                          onClick={() => setPersona((p) => ({ ...p, slaHours: h }))}
                          className={`flex-1 py-1.5 rounded-lg text-xs font-bold border transition-all ${persona.slaHours === h
                            ? "bg-accent-violet/15 border-accent-violet/35 text-accent-violet"
                            : "border-border-strong text-text-tertiary hover:border-border-hover"
                            }`}
                        >
                          {h}h
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex flex-col gap-4 rounded-xl border border-accent-violet/20 bg-accent-violet/5 p-4">
                    <div>
                      <p className="text-xs font-bold text-accent-violet uppercase tracking-wide">Billing &amp; Autonomous Spend</p>
                      <p className="text-xs text-text-tertiary mt-0.5">Configure model billing and agent autonomous wallet limits.</p>
                    </div>

                    <div className="flex flex-col gap-2">
                      <Label>LLM Billing</Label>
                      <div className="grid grid-cols-2 gap-2">
                        {([
                          ["PLATFORM", "Platform-billed"],
                          ["BYO_KEY", "BYO Model Key"],
                        ] as const).map(([b, label]) => {
                          const disabled = b === "BYO_KEY" && !byokProvider;
                          return (
                            <button
                              key={b}
                              type="button"
                              disabled={disabled}
                              onClick={() => setHosted((h) => ({ ...h, llmBilling: b }))}
                              className={`py-2 rounded-lg text-xs font-semibold border transition-all disabled:opacity-40 ${hosted.llmBilling === b
                                ? "bg-accent-violet/15 border-accent-violet/35 text-accent-violet"
                                : "border-border-strong text-text-tertiary hover:border-border-hover"
                                }`}
                            >
                              {label}
                            </button>
                          );
                        })}
                      </div>
                      {hosted.llmBilling === "BYO_KEY" && byokProvider && (
                        <Input
                          type="password"
                          value={hosted.llmApiKey}
                          onChange={(e) => setHosted((h) => ({ ...h, llmApiKey: e.target.value }))}
                          placeholder={LLM_KEY_PROVIDER_OPTIONS.find((p) => p.id === byokProvider)?.placeholder}
                          className="mt-1"
                        />
                      )}
                    </div>

                    <div className="flex flex-col gap-2">
                      <div className="flex items-center justify-between">
                        <Label>Autonomous Loop Cadence</Label>
                        <span className="text-xs font-mono font-semibold text-accent-violet">
                          {hosted.tickIntervalMinutes >= 60
                            ? `${hosted.tickIntervalMinutes / 60} hour${hosted.tickIntervalMinutes / 60 === 1 ? "" : "s"}`
                            : `${hosted.tickIntervalMinutes} mins`}
                        </span>
                      </div>
                      <p className="text-[11px] text-text-tertiary">How frequently the agent awakens to analyze, post, and execute goals.</p>
                      <div className="grid grid-cols-5 gap-1.5">
                        {[
                          { value: 15, label: "15m" },
                          { value: 30, label: "30m" },
                          { value: 60, label: "1h (Default)" },
                          { value: 360, label: "6h" },
                          { value: 1440, label: "24h" },
                        ].map((opt) => (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() => setHosted((h) => ({ ...h, tickIntervalMinutes: opt.value }))}
                            className={`py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                              hosted.tickIntervalMinutes === opt.value
                                ? "bg-accent-violet/15 border-accent-violet/35 text-accent-violet"
                                : "border-border-strong text-text-tertiary hover:border-border-hover"
                            }`}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {form.supportsX402 && (
                      <div className="flex flex-col gap-1.5">
                        <Label>Reply Price (USDC)</Label>
                        <Input
                          inputMode="decimal"
                          value={hosted.x402ReplyPriceUsdc}
                          onChange={(e) => setHosted((h) => ({ ...h, x402ReplyPriceUsdc: e.target.value }))}
                          placeholder="USDC per reply, e.g. 0.05"
                        />
                      </div>
                    )}

                    <Field label="Standing Autonomous Goal" htmlFor="goal">
                      <Textarea
                        id="goal"
                        value={hosted.goal}
                        onChange={(e) => setHosted((h) => ({ ...h, goal: e.target.value }))}
                        placeholder="Standing proactive goal executed during scheduled loop ticks (e.g. Monitor DEX pools for volume breakouts, verify daily spend headroom, and execute trading insights)..."
                        rows={3}
                      />
                    </Field>

                    <div className="flex flex-col gap-3 rounded-xl border border-border-subtle bg-bg-raised/40 p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <Label className="text-xs font-bold text-text-primary flex items-center gap-1.5">
                            <Shield className="h-3.5 w-3.5 text-accent-violet" />
                            Autonomous Spend Policy Firewall
                          </Label>
                          <p className="text-[11px] text-text-tertiary">
                            Control daily budget and authorize specific on-chain spending actions.
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setHosted((h) => ({ ...h, spendPolicyEnabled: !h.spendPolicyEnabled }))}
                          className={cn(
                            "px-2.5 py-1 rounded-[6px] text-[11px] font-bold border transition-all flex items-center gap-1.5 shrink-0",
                            hosted.spendPolicyEnabled
                              ? "bg-[#0c2a1d] text-[#1FD487] border-[#1FD487]/30"
                              : "bg-bg-surface3 text-text-quaternary border-border-strong",
                          )}
                        >
                          <span className={cn("h-1.5 w-1.5 rounded-full", hosted.spendPolicyEnabled ? "bg-[#1FD487] animate-pulse" : "bg-text-quaternary")} />
                          {hosted.spendPolicyEnabled ? "Firewall Armed" : "Firewall Disarmed"}
                        </button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                        <div>
                          <label className="text-[10px] font-bold uppercase tracking-wider text-text-quaternary block mb-1">
                            Daily Spend Cap (USDC)
                          </label>
                          <Input
                            inputMode="decimal"
                            value={hosted.dailyCapUsdc}
                            onChange={(e) =>
                              setHosted((h) => ({
                                ...h,
                                dailyCapUsdc: e.target.value,
                                spendPolicyEnabled: Number(e.target.value) > 0 ? true : h.spendPolicyEnabled,
                              }))
                            }
                            placeholder="0.00"
                            className="font-mono text-xs"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold uppercase tracking-wider text-text-quaternary block mb-1">
                            Max / Resource Pull (USDC)
                          </label>
                          <Input
                            inputMode="decimal"
                            value={hosted.autonomousX402ResourceCapUsdc}
                            onChange={(e) =>
                              setHosted((h) => ({
                                ...h,
                                autonomousX402ResourceCapUsdc: e.target.value,
                                spendPolicyEnabled: Number(e.target.value) > 0 ? true : h.spendPolicyEnabled,
                              }))
                            }
                            placeholder="e.g. 1.50"
                            className="font-mono text-xs"
                          />
                        </div>
                      </div>

                      <div className="space-y-1.5 pt-1">
                        <div className="flex items-center justify-between">
                          <label className="text-[10px] font-bold uppercase tracking-wider text-text-quaternary">
                            Authorized Spend Permissions
                          </label>
                          <span className="text-[10px] font-mono text-text-quaternary">
                            {hosted.allowedActions.length} of {SPEND_ACTION_OPTIONS.length} active
                          </span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {SPEND_ACTION_OPTIONS.map((opt) => {
                            const isAllowed = hosted.allowedActions.includes(opt.id);
                            return (
                              <button
                                key={opt.id}
                                type="button"
                                onClick={() => {
                                  setHosted((h) => {
                                    const nextActions = isAllowed
                                      ? h.allowedActions.filter((a) => a !== opt.id)
                                      : [...h.allowedActions, opt.id];
                                    return {
                                      ...h,
                                      allowedActions: nextActions,
                                      spendPolicyEnabled: !isAllowed ? true : h.spendPolicyEnabled,
                                    };
                                  });
                                }}
                                className={cn(
                                  "p-2.5 rounded-[8px] border text-left transition-all flex items-start gap-2",
                                  isAllowed
                                    ? "bg-accent-violet/10 border-accent-violet/40 text-text-primary"
                                    : "bg-bg-raised/60 border-border-subtle text-text-quaternary hover:border-border-strong",
                                )}
                              >
                                <span
                                  className={cn(
                                    "mt-0.5 h-3.5 w-3.5 rounded flex items-center justify-center text-[10px] shrink-0",
                                    isAllowed ? "bg-accent-violet text-white" : "border border-border-strong",
                                  )}
                                >
                                  {isAllowed && "✓"}
                                </span>
                                <div className="min-w-0">
                                  <div className="text-[11px] font-semibold text-text-primary truncate">{opt.label}</div>
                                  <div className="text-[10px] text-text-quaternary leading-tight">{opt.desc}</div>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex flex-col gap-4">
                  <div className="flex flex-col gap-2">
                    <Label>SLA Response Time</Label>
                    <div className="flex gap-2">
                      {[6, 12, 24, 48, 72].map((h) => (
                        <button
                          key={h}
                          type="button"
                          onClick={() => setPersona((p) => ({ ...p, slaHours: h }))}
                          className={`flex-1 py-2 rounded-lg text-xs font-bold border transition-all ${persona.slaHours === h
                            ? "bg-accent-violet/15 border-accent-violet/35 text-accent-violet"
                            : "border-border-strong text-text-tertiary hover:border-border-hover"
                            }`}
                        >
                          {h}h
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="rounded-xl border border-border-subtle bg-bg-raised/30 p-4 text-xs text-text-tertiary leading-relaxed">
                    Since you selected Bring Your Own Agent Server, your agent operates on your external infrastructure.
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Step 3 — Review */}
        {step === 3 && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            <div className="lg:col-span-6 flex flex-col gap-4">
              <div className="text-xs font-bold uppercase tracking-wider text-accent-violet">Identity &amp; Wallet Summary</div>
              <div className="rounded-xl border border-border-subtle bg-bg-raised/30 p-4 flex flex-col gap-1">
                <ReviewRow label="Name" value={form.name} />
                <ReviewRow label="Mode" value={mode === "hosted" ? "Hosted runtime" : "Bring your own agent server"} />
                <ReviewRow label="Endpoint" value={mode === "hosted" ? "(assigned automatically)" : form.endpoint} />
                <ReviewRow label="Agent Wallet" value={walletMode === "circle" ? `Circle Wallet (${circleWallet.walletId || "…"})` : "Auto-provisioned"} />
                <ReviewRow label="Agent URI" value={form.agentUri || "(none)"} />
              </div>
            </div>

            <div className="lg:col-span-6 flex flex-col gap-4">
              <div className="text-xs font-bold uppercase tracking-wider text-accent-violet">Capabilities &amp; Persona Summary</div>
              <div className="rounded-xl border border-border-subtle bg-bg-raised/30 p-4 flex flex-col gap-1">
                <ReviewRow label="x402 / ACP / MCP" value={[form.supportsX402, form.supportsA2A, form.supportsMcp].map((v) => (v ? "yes" : "no")).join(" / ")} />
                {persona.displayName && <ReviewRow label="Display Name" value={persona.displayName} />}
                {persona.voicePersona && <ReviewRow label="Voice Persona" value={persona.voicePersona} />}
                {persona.personality.length > 0 && <ReviewRow label="Traits" value={persona.personality.join(", ")} />}
                {persona.knowledgeDomains.length > 0 && <ReviewRow label="Domains" value={persona.knowledgeDomains.join(", ")} />}
                {persona.worldview && <ReviewRow label="Worldview" value={persona.worldview.length > 60 ? `${persona.worldview.slice(0, 60)}…` : persona.worldview} />}
                {persona.customSystemPrompt && (
                  <ReviewRow
                    label="System Directives"
                    value={`${persona.customSystemPrompt.slice(0, 50)}${persona.customSystemPrompt.length > 50 ? "…" : ""} (${persona.customSystemPrompt.length} chars)`}
                  />
                )}
                {mode === "hosted" && (
                  <ReviewRow label="Foundation Model" value={FOUNDATION_MODELS.find((m) => m.id === persona.foundationModel)?.label ?? persona.foundationModel} />
                )}
                <ReviewRow label="SLA Response Time" value={`${persona.slaHours}h`} />
                {mode === "hosted" && (
                  <>
                    <ReviewRow label="LLM Billing" value={hosted.llmBilling === "BYO_KEY" ? "BYO Key" : "Platform-billed"} />
                    <ReviewRow
                      label="Loop Cadence"
                      value={
                        hosted.tickIntervalMinutes >= 60
                          ? `${hosted.tickIntervalMinutes / 60} hour${hosted.tickIntervalMinutes / 60 === 1 ? "" : "s"}`
                          : `${hosted.tickIntervalMinutes} mins`
                      }
                    />
                    {hosted.goal.trim() && (
                      <ReviewRow
                        label="Standing Goal"
                        value={hosted.goal.length > 50 ? `${hosted.goal.slice(0, 50)}…` : hosted.goal}
                      />
                    )}
                    <ReviewRow
                      label="Spend Firewall"
                      value={
                        hosted.spendPolicyEnabled
                          ? `Armed (${Number(hosted.dailyCapUsdc) > 0 ? `${hosted.dailyCapUsdc} USDC/day` : "No daily cap"}${
                              Number(hosted.autonomousX402ResourceCapUsdc) > 0
                                ? `, max ${hosted.autonomousX402ResourceCapUsdc} USDC/pull`
                                : ""
                            })`
                          : "Disarmed"
                      }
                    />
                    {hosted.spendPolicyEnabled && hosted.allowedActions.length > 0 && (
                      <ReviewRow
                        label="Spend Actions"
                        value={hosted.allowedActions
                          .map((a) => SPEND_ACTION_OPTIONS.find((opt) => opt.id === a)?.label ?? a)
                          .join(", ")}
                      />
                    )}
                  </>
                )}
              </div>
            </div>

            {error && <div className="lg:col-span-12 p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red text-sm font-medium">{error}</div>}
          </div>
        )}
      </CardContent>

      {/* Footer Navigation */}
      <CardFooter className="p-0 mt-8 pt-6 border-t border-border-subtle flex items-center justify-between">
        <Button variant="ghost" disabled={step === 0} onClick={() => setStep((s) => s - 1)}>
          Back
        </Button>
        {step < STEPS.length - 1 ? (
          <Button disabled={!canAdvance} onClick={() => setStep((s) => s + 1)} size="lg" className="min-w-32">
            {step === 2 ? "Next (Skip or Continue)" : "Next"}
          </Button>
        ) : !socialProfile ? (
          <Button onClick={socialSignIn} size="lg" className="min-w-40 bg-accent-violet hover:brightness-110">
            Sign In to Register
          </Button>
        ) : (
          <Button disabled={busy || !isConnected} onClick={handleSubmit} size="lg" className="min-w-40">
            {busy && <Spinner className="h-4 w-4 mr-2" />}
            Register Agent
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}

function Field({ label, htmlFor, children }: { label: string; htmlFor: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
    </div>
  );
}

function ToggleField({
  label,
  description,
  checked,
  onCheckedChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border border-border-subtle p-3">
      <div>
        <p className="text-sm font-medium text-text-primary">{label}</p>
        <p className="text-xs text-text-secondary">{description}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  );
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-start gap-4 border-b border-border-subtle py-2 text-xs">
      <span className="text-text-tertiary shrink-0">{label}</span>
      <span className="text-text-primary text-right break-words font-medium">{value}</span>
    </div>
  );
}

/** Shown once on the success screen, only for an auto-provisioned AgentWallet (a BYO Circle
 * wallet owner already controls funding of the address they specified, nothing new to prompt).
 * The wallet doesn't exist yet at the instant registration confirms — it's provisioned
 * asynchronously by the indexer picking up the on-chain registration event, not by this request
 * — so this polls (via useAgentWallet's own refetchInterval) until an address shows up before
 * offering to fund it. Entirely optional: the agent works with a $0 wallet, this just saves a
 * separate trip to its Wallet tab later for an owner who wants to seed it immediately. */
function AgentWalletFundingPrompt({ chainSlug, agentChainId }: { chainSlug: IndexerChainSlug; agentChainId: string }) {
  const { address, isLoading, depositFromConnectedWallet, depositing } = useAgentWallet(chainSlug, agentChainId);
  const [amount, setAmount] = useState("");
  const [fundError, setFundError] = useState<string | null>(null);
  const [fundNotice, setFundNotice] = useState<string | null>(null);

  if (isLoading || !address) {
    return (
      <div className="w-full max-w-md flex items-center gap-2 text-xs text-text-tertiary">
        <Spinner className="h-3.5 w-3.5" />
        Provisioning this agent&apos;s wallet, usually takes a few seconds…
      </div>
    );
  }

  async function handleFund() {
    setFundError(null);
    setFundNotice(null);
    if (!amount || Number(amount) <= 0) {
      setFundError("Enter an amount greater than 0.");
      return;
    }
    try {
      await depositFromConnectedWallet(amount.trim());
      setFundNotice(`Sent ${amount} USDC to this agent's wallet.`);
      setAmount("");
    } catch (err) {
      setFundError(describeActionError(err, "Funding failed."));
    }
  }

  return (
    <div className="w-full max-w-md flex flex-col gap-1.5 text-left">
      <Label>Fund This Agent&apos;s Wallet (optional)</Label>
      <p className="text-xs text-text-tertiary">
        <span className="font-mono break-all">{address}</span> funds its own operations (LLM credits, job budgets, x402 payments). You can also do this anytime from the Agent Directory.
      </p>
      <div className="flex gap-1.5">
        <Input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Amount USDC (optional)" />
        <Button type="button" size="sm" onClick={handleFund} disabled={depositing || !amount.trim()}>
          {depositing ? "Sending…" : "Fund Now"}
        </Button>
      </div>
      {fundError && <p className="text-xs text-red">{fundError}</p>}
      {fundNotice && <p className="text-xs text-emerald">{fundNotice}</p>}
    </div>
  );
}
