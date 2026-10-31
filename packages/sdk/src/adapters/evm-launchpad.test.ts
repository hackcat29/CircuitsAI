import { describe, expect, it } from "vitest";
import type { Address } from "viem";
import { EvmLaunchpadAdapter } from "./evm-launchpad.js";

const LAUNCHPAD_ADDRESS = "0x1111111111111111111111111111111111111111".slice(0, 42) as Address;
const USDC_ADDRESS = "0x2222222222222222222222222222222222222222".slice(0, 42) as Address;
const TOKEN_ADDRESS = "0x3333333333333333333333333333333333333333".slice(0, 42) as Address;
const SENDER = "0x4444444444444444444444444444444444444444".slice(0, 42) as Address;

interface RecordedCall {
  functionName: string;
  args?: readonly unknown[];
}

function buildFakeClients(readResults: Record<string, unknown>) {
  const readCalls: RecordedCall[] = [];
  const writeCalls: RecordedCall[] = [];

  const publicClient = {
    async readContract(args: { functionName: string; args?: readonly unknown[] }) {
      readCalls.push({ functionName: args.functionName, args: args.args });
      if (!(args.functionName in readResults)) {
        throw new Error(`No canned result for readContract(${args.functionName})`);
      }
      return readResults[args.functionName];
    },
    async waitForTransactionReceipt() {
      return { status: "success" };
    },
  };

  const walletClient = {
    account: { address: SENDER },
    async writeContract(args: { functionName: string; args?: readonly unknown[] }) {
      writeCalls.push({ functionName: args.functionName, args: args.args });
      return "0xhash";
    },
  };

  return { publicClient, walletClient, readCalls, writeCalls };
}

describe("EvmLaunchpadAdapter", () => {
  describe("sellTokens", () => {
    it("checks token allowance and approves launchpad before calling sellTokens when allowance is insufficient", async () => {
      const { publicClient, walletClient, readCalls, writeCalls } = buildFakeClients({
        allowance: 0n, // insufficient token allowance
      });
      const adapter = new EvmLaunchpadAdapter({
        contractAddress: LAUNCHPAD_ADDRESS,
        publicClient: publicClient as never,
        walletClient: walletClient as never,
      });

      const tokenAmount = 500_000_000_000_000_000_000n; // 500 tokens (18 dec)
      const minUsdcOut = 10_000_000n; // 10 USDC (6 dec)

      await adapter.sellTokens(1n, tokenAmount, minUsdcOut, TOKEN_ADDRESS);

      // Verify allowance was checked on the token
      expect(readCalls.map((c) => c.functionName)).toEqual(["allowance"]);
      // Verify approve was called before sellTokens
      expect(writeCalls.map((c) => c.functionName)).toEqual(["approve", "sellTokens"]);
      expect(writeCalls[0].args).toEqual([LAUNCHPAD_ADDRESS, tokenAmount]);
      expect(writeCalls[1].args).toEqual([1n, tokenAmount, minUsdcOut]);
    });

    it("skips approval when token allowance is already sufficient", async () => {
      const { publicClient, walletClient, readCalls, writeCalls } = buildFakeClients({
        allowance: 1_000_000_000_000_000_000_000n,
      });
      const adapter = new EvmLaunchpadAdapter({
        contractAddress: LAUNCHPAD_ADDRESS,
        publicClient: publicClient as never,
        walletClient: walletClient as never,
      });

      const tokenAmount = 500_000_000_000_000_000_000n;
      const minUsdcOut = 10_000_000n;

      await adapter.sellTokens(1n, tokenAmount, minUsdcOut, TOKEN_ADDRESS);

      expect(readCalls.map((c) => c.functionName)).toEqual(["allowance"]);
      expect(writeCalls.map((c) => c.functionName)).toEqual(["sellTokens"]);
      expect(writeCalls[0].args).toEqual([1n, tokenAmount, minUsdcOut]);
    });

    it("resolves token address from launches mapping when tokenAddress is not provided", async () => {
      const { publicClient, walletClient, readCalls, writeCalls } = buildFakeClients({
        launches: [1n, 10n, TOKEN_ADDRESS, "Test", "TST", SENDER, 1_000_000_000n, 0n, 0n, 100_000n, 0n, 0n, 0n, 0n, 0n, false, true, 0, 0n, 0, 0n, 0n, 0n, 2000],
        allowance: 1_000_000_000_000_000_000_000n,
      });
      const adapter = new EvmLaunchpadAdapter({
        contractAddress: LAUNCHPAD_ADDRESS,
        publicClient: publicClient as never,
        walletClient: walletClient as never,
      });

      await adapter.sellTokens(1n, 100n, 10n);

      expect(readCalls.map((c) => c.functionName)).toEqual(["launches", "allowance"]);
      expect(writeCalls.map((c) => c.functionName)).toEqual(["sellTokens"]);
    });
  });

  describe("buyTokens", () => {
    it("checks USDC allowance and approves launchpad before buyTokens", async () => {
      const { publicClient, walletClient, readCalls, writeCalls } = buildFakeClients({
        usdc: USDC_ADDRESS,
        allowance: 0n,
      });
      const adapter = new EvmLaunchpadAdapter({
        contractAddress: LAUNCHPAD_ADDRESS,
        publicClient: publicClient as never,
        walletClient: walletClient as never,
      });

      await adapter.buyTokens(1n, 50_000_000n, 100_000n);

      expect(readCalls.map((c) => c.functionName)).toEqual(["usdc", "allowance"]);
      expect(writeCalls.map((c) => c.functionName)).toEqual(["approve", "buyTokens"]);
      expect(writeCalls[0].args).toEqual([LAUNCHPAD_ADDRESS, 50_000_000n]);
    });
  });
});
