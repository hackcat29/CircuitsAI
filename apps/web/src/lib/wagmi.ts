import { createConfig, http } from "wagmi";
import { BASE_SEPOLIA, ETH_SEPOLIA, BSC_TESTNET, MONAD_MAINNET } from "./chains";
import { env } from "./env";

// No connectors, on purpose: EVM signing goes through Circle now (see useCircleWalletClient.ts),
// not wagmi's useConnect/useAccount — nothing in the app calls those anymore. wagmi here is
// purely a read client (usePublicClient) for chain reads. The old injected()/coinbaseWallet()/
// walletConnect() connectors used to be required for that, but merely *constructing* them was
// itself the problem: injected() broadcasts an EIP-6963 "announce yourself" request that every
// installed EVM-capable extension (Phantom included — it exposes an EIP-1193 interface for EVM
// alongside its Solana one) answers, and wagmi's own reconnect-on-mount then tried silently
// reconnecting whatever was last connected — that's what was popping Phantom on every reload,
// not anything in the Solana wallet-adapter code. walletConnect() was separately booting
// AppKit/web3modal against a placeholder project ID, hence those 403s to web3modal.org/
// walletconnect.org. An empty connectors list needs none of this.
// `batch.multicall` folds every `readContract` call issued in the same tick into a single
// `eth_call` against Multicall3, which keeps request volume down for pages that do N per-agent
// `getAgent(id)` reads plus a handful of protocol-stat reads.
export const wagmiConfig = createConfig({
  chains: [MONAD_MAINNET.viemChain, BASE_SEPOLIA.viemChain, ETH_SEPOLIA.viemChain, BSC_TESTNET.viemChain],
  connectors: [],
  transports: {
    [MONAD_MAINNET.viemChain.id]: http(MONAD_MAINNET.rpcUrl),
    [BASE_SEPOLIA.viemChain.id]: http(env.NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL),
    [ETH_SEPOLIA.viemChain.id]: http(env.NEXT_PUBLIC_ETH_SEPOLIA_RPC_URL),
    [BSC_TESTNET.viemChain.id]: http(BSC_TESTNET.rpcUrl),
  },
  batch: { multicall: { wait: 20 } },
  ssr: true,
});

declare module "wagmi" {
  interface Register {
    config: typeof wagmiConfig;
  }
}
