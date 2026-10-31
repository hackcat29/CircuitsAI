// Thin re-export: the actual write-capable EVM client construction now lives in the shared
// @clawdhq/custody-core package. Kept as a re-export (not deleted) so existing imports across
// this feature don't all need touching.
export { getSigningEvmAdapter, getSigningEvmLaunchpadAdapter } from "@clawdhq/custody-core";
export { rpcUrlFor as evmRpcUrlFor, viemChainFor as evmViemChainFor, contractAddressFor as evmContractAddressFor } from "@clawdhq/custody-core";
