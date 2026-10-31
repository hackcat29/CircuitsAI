"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ShieldCheck,
  Wallet,
  ArrowRight,
  KeyRound,
  Bot,
  LockKeyhole,
} from "lucide-react";
import type { NearConnector } from "@hot-labs/near-connect";
import { KeyPair } from "@clawdhq/near/wallet";
import type { ConnectorAction } from "@hot-labs/near-connect/build/actions/types";

type Config = {
  network: "mainnet" | "testnet";
  commerce: string | null;
  token: string | null;
  mpc: string;
  walletWasmUrl: string;
  privateInferenceConfigured: boolean;
};
type Agent = {
  accountId: string;
  network: string;
  agent: {
    owner: string;
    balance: string;
    max_per_job: string;
    daily_limit: string;
    completed: number;
    disputed: number;
    paused: boolean;
  };
  wallet: {
    owner: string;
    commerce: string;
    paused: boolean;
    runtime_public_key?: string;
  };
  keys: {
    public_key: string;
    access_key: {
      permission:
        | string
        | {
            FunctionCall: {
              receiver_id: string;
              method_names: string[];
              allowance: string | null;
            };
          };
    };
  }[];
};
const methods = [
  "post_job",
  "deliver",
  "release",
  "open_dispute",
  "cancel_expired",
  "withdraw",
  "sign_transfer",
];
const micros = (value: string) => {
  if (!/^\d+(?:\.\d{1,6})?$/.test(value) || Number(value) <= 0)
    throw new Error("Enter a positive USDC amount with up to six decimals");
  const [a, b = ""] = value.split(".");
  return (BigInt(a) * 1_000_000n + BigInt(b.padEnd(6, "0"))).toString();
};
const sha = async (value: string) =>
  Array.from(
    new Uint8Array(
      await crypto.subtle.digest(
        "SHA-256",
        new Uint8Array(new TextEncoder().encode(value)).buffer,
      ),
    ),
  )
    .map((v) => v.toString(16).padStart(2, "0"))
    .join("");
const fmt = (value: string) =>
  (Number(value) / 1e6).toLocaleString(undefined, { maximumFractionDigits: 6 });
const inputClass =
  "w-full rounded-lg border border-border-subtle bg-bg-surface px-3 py-2 text-sm text-text-primary";
const buttonClass =
  "rounded-lg bg-accent-violet px-4 py-2 text-sm font-bold text-white disabled:opacity-40";

export function NearWalletDashboard() {
  const [config, setConfig] = useState<Config | null>(null),
    [connected, setConnected] = useState(""),
    [ownerKey, setOwnerKey] = useState("");
  const [id, setId] = useState(
      STATIC_DEMO ? "alpha.circuitsai-hackcat.testnet" : "",
    ),
    [agent, setAgent] = useState<Agent | null>(null),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState(""),
    [error, setError] = useState("");
  const [label, setLabel] = useState("alpha"),
    [provider, setProvider] = useState(
      STATIC_DEMO ? "circuitsai-hackcat.testnet" : "",
    ),
    [amount, setAmount] = useState("0.01"),
    [task, setTask] = useState("Review a short agent service specification"),
    [jobId, setJobId] = useState(""),
    [result, setResult] = useState("");
  const [perJob, setPerJob] = useState("0.10"),
    [daily, setDaily] = useState("1.00");
  const connector = useRef<NearConnector | null>(null);
  useEffect(() => {
    loadConfig()
      .then(setConfig)
      .catch(() => setError("Unable to load NEAR configuration"));
    if (STATIC_DEMO)
      loadAgent("alpha.circuitsai-hackcat.testnet")
        .then(setAgent)
        .catch(() =>
          setError(
            "Live account data is temporarily unavailable; try reading the account again.",
          ),
        );
  }, []);
  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed");
    } finally {
      setBusy(false);
    }
  }
  async function connect() {
    if (!config) throw new Error("NEAR configuration unavailable");
    if (!connector.current) {
      const { NearConnector } = await import("@hot-labs/near-connect");
      connector.current = new NearConnector({
        network: config.network,
        features: { signAndSendTransaction: true },
      });
    }
    await connector.current.connect();
    const session = await connector.current.getConnectedWallet();
    setConnected(session.accounts[0]?.accountId ?? "");
    setOwnerKey(session.accounts[0]?.publicKey ?? "");
  }
  async function send(
    receiverId: string,
    methodName: string,
    args: Record<string, unknown>,
    deposit = "0",
    gas = "100000000000000",
  ) {
    if (!connected || !connector.current)
      throw new Error("Connect the owning NEAR wallet first");
    const wallet = await connector.current.wallet();
    const outcome = await wallet.signAndSendTransaction({
      signerId: connected,
      receiverId,
      actions: [
        { type: "FunctionCall", params: { methodName, args, gas, deposit } },
      ],
    });
    if (
      outcome &&
      typeof outcome.status === "object" &&
      "Failure" in outcome.status
    )
      throw new Error("NEAR transaction failed");
    setNotice(
      `Transaction submitted${outcome?.transaction?.hash ? `: ${outcome.transaction.hash}` : "; refresh after wallet confirmation"}`,
    );
  }
  async function load() {
    const data = await loadAgent(id);
    setAgent(data);
  }
  async function createAgent() {
    if (!config?.commerce || !connected)
      throw new Error(
        "Connect the parent account and configure the commerce contract first",
      );
    if (!/^[a-z][a-z0-9_-]{1,30}$/.test(label))
      throw new Error("Use a short lowercase agent name");
    if (!ownerKey)
      throw new Error(
        "Enter the full-access public key you retain for this agent",
      );
    const runtime = KeyPair.fromRandom("ed25519");
    const response = await fetch(config.walletWasmUrl);
    if (!response.ok)
      throw new Error(
        "Agent-wallet WASM is not available; build the NEAR contracts first",
      );
    const code = new Uint8Array(await response.arrayBuffer());
    const account = `${label}.${connected}`;
    if (account.length > 64) throw new Error("Agent account ID is too long");
    // Download runtime credential locally. The owner key never enters the server.
    const file = new Blob(
      [
        JSON.stringify(
          {
            network: config.network,
            accountId: account,
            publicKey: runtime.getPublicKey().toString(),
            secretKey: runtime.toString(),
          },
          null,
          2,
        ),
      ],
      { type: "application/json" },
    );
    const url = URL.createObjectURL(file);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${account}.runtime.json`;
    a.click();
    URL.revokeObjectURL(url);
    const actions: ConnectorAction[] = [
      { type: "CreateAccount" },
      { type: "Transfer", params: { deposit: "4000000000000000000000000" } },
      { type: "DeployContract", params: { code } },
      {
        type: "AddKey",
        params: {
          publicKey: ownerKey,
          accessKey: { permission: "FullAccess" },
        },
      },
      {
        type: "AddKey",
        params: {
          publicKey: runtime.getPublicKey().toString(),
          accessKey: {
            permission: {
              receiverId: account,
              methodNames: methods,
              allowance: "1000000000000000000000000",
            },
          },
        },
      },
      {
        type: "FunctionCall",
        params: {
          methodName: "new",
          args: {
            owner: connected,
            commerce: config.commerce,
            mpc: config.mpc,
            signature_deposit: "1",
            runtime_public_key: runtime.getPublicKey().toString(),
          },
          gas: "30000000000000",
          deposit: "0",
        },
      },
    ];
    const wallet = await connector.current!.wallet();
    const outcome = await wallet.signAndSendTransaction({
      signerId: connected,
      receiverId: account,
      actions,
    });
    if (
      outcome &&
      typeof outcome.status === "object" &&
      "Failure" in outcome.status
    )
      throw new Error(
        "Agent creation failed; the downloaded runtime key is not active",
      );
    setId(account);
    setNotice(
      `Created ${account}. Keep the downloaded scoped runtime credential private. The commerce administrator can now register this account.`,
    );
  }
  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-mono uppercase tracking-widest text-accent-violet">
            Circuits × NEAR · {config?.network ?? "loading"}
          </p>
          <h1 className="mt-2 text-3xl font-black tracking-tight">
            Agents with limits. Payments with proof.
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-text-tertiary">
            Give an agent its own NEAR account, restrict its authority, and
            settle work through USDC escrow.
          </p>
        </div>
        <button
          className={buttonClass}
          disabled={busy || !config}
          onClick={() => run(connect)}
        >
          <Wallet className="inline h-4 w-4 mr-2" />
          {connected || "Connect NEAR wallet"}
        </button>
      </div>
      {!config?.commerce && (
        <p className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 text-sm text-amber-300">
          NEAR contracts have not been configured on this deployment. The
          reproducible local demo is available with <code>pnpm near:demo</code>.
        </p>
      )}
      <div className="grid gap-3 sm:grid-cols-3">
        {[
          [
            KeyRound,
            "Scoped keys",
            "The owner retains full access. Runtime keys have named methods and a finite gas allowance.",
          ],
          [
            ShieldCheck,
            "On-chain payment policies",
            "USDC spend caps and approved recipients are checked by the contracts.",
          ],
          [
            LockKeyhole,
            "Verified inference",
            "NEAR AI uses encrypted inference and verifies the model response before returning it.",
          ],
        ].map(([Icon, title, text]) => {
          const I = Icon as typeof KeyRound;
          return (
            <section
              key={String(title)}
              className="rounded-xl border border-border-subtle bg-bg-elevated p-5"
            >
              <I className="h-5 w-5 text-accent-violet" />
              <h2 className="mt-3 text-sm font-bold">{String(title)}</h2>
              <p className="mt-2 text-xs leading-relaxed text-text-tertiary">
                {String(text)}
              </p>
            </section>
          );
        })}
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        <section className="rounded-xl border border-border-subtle bg-bg-elevated p-5 space-y-3">
          <h2 className="font-bold flex gap-2">
            <Bot className="h-5 w-5" />
            Create an agent account
          </h2>
          <p className="text-xs text-text-tertiary">
            Creates a sub-account of your connected account. Your wallet reviews
            a 4 NEAR funding transfer, deployment, and two access keys. The
            scoped runtime credential downloads to your device.
          </p>
          <label className="block text-xs text-text-tertiary">
            Agent name
            <input
              className={inputClass}
              value={label}
              onChange={(e) => setLabel(e.target.value)}
            />
          </label>
          <label className="block text-xs text-text-tertiary">
            Owner full-access public key
            <input
              className={inputClass}
              value={ownerKey}
              onChange={(e) => setOwnerKey(e.target.value)}
              placeholder="ed25519:…"
            />
          </label>
          <button
            className={buttonClass}
            disabled={busy || !connected || !config?.commerce}
            onClick={() => run(createAgent)}
          >
            Review account creation
          </button>
        </section>
        <section className="rounded-xl border border-border-subtle bg-bg-elevated p-5 space-y-3">
          <h2 className="font-bold">Inspect agent authority</h2>
          <label className="block text-xs text-text-tertiary">
            Agent account
            <input
              className={inputClass}
              value={id}
              onChange={(e) => setId(e.target.value)}
              placeholder="agent.your-account.testnet"
            />
          </label>
          <button
            className={buttonClass}
            disabled={busy || !id || !config?.commerce}
            onClick={() => run(load)}
          >
            Read on-chain state
          </button>
          {agent && (
            <>
              <p className="text-sm">
                Escrow balance: <strong>{fmt(agent.agent.balance)} USDC</strong>
              </p>
              <p className="text-xs text-text-tertiary">
                Per job: {fmt(agent.agent.max_per_job)} USDC · Daily:{" "}
                {fmt(agent.agent.daily_limit)} USDC · Completed:{" "}
                {agent.agent.completed}
              </p>
              <button
                className="rounded-lg border border-red-500/30 px-3 py-2 text-xs text-red-300"
                disabled={
                  busy || !connected || !agent.wallet.runtime_public_key
                }
                onClick={() =>
                  run(async () => {
                    await send(id, "revoke_runtime_key", {});
                    await load();
                  })
                }
              >
                Review runtime-key revocation
              </button>
              <ul className="space-y-2 text-xs">
                {agent.keys.map((key) => (
                  <li
                    key={key.public_key}
                    className="rounded-lg bg-bg-surface p-3 break-all"
                  >
                    <span className="font-mono">{key.public_key}</span>
                    <p className="mt-1 text-text-tertiary">
                      {typeof key.access_key.permission === "string"
                        ? "Owner full-access key"
                        : `Function-call key → ${key.access_key.permission.FunctionCall.receiver_id}; methods: ${key.access_key.permission.FunctionCall.method_names.join(", ")}; gas allowance: ${key.access_key.permission.FunctionCall.allowance ?? "unlimited"} yoctoNEAR`}
                    </p>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
        <section className="rounded-xl border border-border-subtle bg-bg-elevated p-5 space-y-3">
          <h2 className="font-bold">Fund and limit commerce</h2>
          <label className="block text-xs text-text-tertiary">
            Approved provider account
            <input
              className={inputClass}
              value={provider}
              onChange={(e) => setProvider(e.target.value)}
            />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="text-xs text-text-tertiary">
              Per-job cap, USDC
              <input
                className={inputClass}
                value={perJob}
                onChange={(e) => setPerJob(e.target.value)}
              />
            </label>
            <label className="text-xs text-text-tertiary">
              Daily cap, USDC
              <input
                className={inputClass}
                value={daily}
                onChange={(e) => setDaily(e.target.value)}
              />
            </label>
          </div>
          <button
            className={buttonClass}
            disabled={busy || !agent || !connected}
            onClick={() =>
              run(async () => {
                await send(config!.commerce!, "set_policy", {
                  agent_id: id,
                  max_per_job: micros(perJob),
                  daily_limit: micros(daily),
                  providers: [provider],
                  paused: false,
                });
                await load();
              })
            }
          >
            Review policy
          </button>
          <label className="block text-xs text-text-tertiary">
            Funding / job amount, USDC
            <input
              className={inputClass}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </label>
          <button
            className={buttonClass}
            disabled={busy || !agent || !config?.token || !connected}
            onClick={() =>
              run(async () => {
                await send(
                  config!.token!,
                  "ft_transfer_call",
                  {
                    receiver_id: config!.commerce,
                    amount: micros(amount),
                    msg: JSON.stringify({ deposit_for: id }),
                  },
                  "1",
                  "150000000000000",
                );
                await load();
              })
            }
          >
            Review USDC deposit
          </button>
        </section>
        <section className="rounded-xl border border-border-subtle bg-bg-elevated p-5 space-y-3">
          <h2 className="font-bold">Complete a job</h2>
          <label className="block text-xs text-text-tertiary">
            Task
            <textarea
              className={inputClass}
              value={task}
              onChange={(e) => setTask(e.target.value)}
            />
          </label>
          <button
            className={buttonClass}
            disabled={busy || !agent || !connected}
            onClick={() =>
              run(async () => {
                await send(id, "post_job", {
                  provider,
                  amount: micros(amount),
                  task_hash: await sha(task),
                  deadline: (
                    BigInt(Date.now() + 86400000) * 1000000n
                  ).toString(),
                });
                await load();
              })
            }
          >
            Review funded job
          </button>
          <label className="block text-xs text-text-tertiary">
            Job ID
            <input
              className={inputClass}
              value={jobId}
              onChange={(e) => setJobId(e.target.value)}
            />
          </label>
          <label className="block text-xs text-text-tertiary">
            Deliverable
            <textarea
              className={inputClass}
              value={result}
              onChange={(e) => setResult(e.target.value)}
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <button
              className={buttonClass}
              disabled={busy || !connected || !jobId || !result}
              onClick={() =>
                run(async () => {
                  await send(id, "deliver", {
                    job_id: jobId,
                    deliverable_hash: await sha(result),
                  });
                  await load();
                })
              }
            >
              Deliver as provider
            </button>
            <button
              className={buttonClass}
              disabled={busy || !connected || !jobId}
              onClick={() =>
                run(async () => {
                  await send(id, "release", { job_id: jobId });
                  await load();
                })
              }
            >
              Release as buyer
            </button>
            <button
              className="rounded-lg border border-border-subtle px-4 py-2 text-sm"
              disabled={busy || !connected || !jobId}
              onClick={() =>
                run(async () => {
                  await send(id, "open_dispute", { job_id: jobId });
                })
              }
            >
              Open dispute
            </button>
          </div>
        </section>
      </div>
      <section className="rounded-xl border border-border-subtle p-5">
        <h2 className="font-bold">Cross-chain payment and inference</h2>
        <p className="mt-2 text-sm text-text-tertiary">
          Supported mainnet API listings can request Intents quotes through
          their payment endpoint. Providers receive their listed USDC amount.
          Verified NEAR AI responses appear on each agent’s profile after
          inference runs.
        </p>
        <Link
          href={
            STATIC_DEMO
              ? "https://github.com/hackcat29/CircuitsAI#intents-payment-checks"
              : "/x402-services"
          }
          className="inline-flex items-center gap-2 text-sm text-accent-violet mt-3"
        >
          {STATIC_DEMO
            ? "Explore cross-chain service payments"
            : "Browse paid agent APIs"}
          <ArrowRight className="h-4 w-4" />
        </Link>
      </section>
      {notice && (
        <p
          role="status"
          className="rounded-lg bg-emerald/10 border border-emerald/30 p-4 text-sm break-all"
        >
          {notice}
        </p>
      )}
      {error && (
        <p
          role="alert"
          className="rounded-lg border border-red-500/30 bg-red-500/5 p-4 text-sm text-red-300"
        >
          {error}
        </p>
      )}
    </div>
  );
}

const STATIC_DEMO = process.env.NEXT_PUBLIC_NEAR_STATIC_DEMO === "true";
const BASE_PATH = process.env.NEXT_PUBLIC_NEAR_DEMO_BASE_PATH ?? "";
async function loadConfig(): Promise<Config> {
  if (STATIC_DEMO)
    return {
      network: "testnet",
      commerce: "circuitsai-hackcat.testnet",
      token: "usdc.circuitsai-hackcat.testnet",
      mpc: "v1.signer-prod.testnet",
      walletWasmUrl: `${BASE_PATH}/near/agent-wallet.wasm`,
      privateInferenceConfigured: false,
    };
  const response = await fetch("/api/near");
  if (!response.ok) throw new Error("NEAR configuration unavailable");
  return response.json();
}
async function rpc(params: Record<string, unknown>) {
  const response = await fetch("https://rpc.testnet.near.org", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: "circuitsai-read",
      method: "query",
      params: { ...params, finality: "final" },
    }),
  });
  const body = await response.json();
  if (!response.ok || body.error)
    throw new Error("Unable to read NEAR account");
  return body.result;
}
async function view(
  contract: string,
  method: string,
  args: Record<string, unknown>,
) {
  const result = await rpc({
    request_type: "call_function",
    account_id: contract,
    method_name: method,
    args_base64: btoa(JSON.stringify(args)),
  });
  return JSON.parse(new TextDecoder().decode(Uint8Array.from(result.result)));
}
async function loadAgent(id: string): Promise<Agent> {
  if (!STATIC_DEMO) {
    const response = await fetch(`/api/near/agents/${encodeURIComponent(id)}`);
    const data = await response.json();
    if (!response.ok) throw new Error(data.error ?? "Agent not registered");
    return data;
  }
  if (
    id.length > 64 ||
    !/^(([a-z\d]+[-_])*[a-z\d]+\.)*([a-z\d]+[-_])*[a-z\d]+$/.test(id)
  )
    throw new Error("Invalid NEAR account ID");
  const [agent, wallet, keys] = await Promise.all([
    view("circuitsai-hackcat.testnet", "get_agent", { agent_id: id }),
    view(id, "get_config", {}),
    rpc({ request_type: "view_access_key_list", account_id: id }),
  ]);
  if (!agent)
    throw new Error("Agent is not registered with this commerce deployment");
  return { accountId: id, network: "testnet", agent, wallet, keys: keys.keys };
}
