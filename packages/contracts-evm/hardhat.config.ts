import { HardhatUserConfig } from "hardhat/config";
import * as dotenv from "dotenv";
import "@nomicfoundation/hardhat-toolbox";
import "@openzeppelin/hardhat-upgrades";

require("@nomicfoundation/hardhat-toolbox");
require("@openzeppelin/hardhat-upgrades");
// Under pnpm's symlinked node_modules, hardhat-toolbox's own internal require of
// hardhat-chai-matchers doesn't trigger its chai.use() side effect, so `expect(...).to.be.reverted`
// matchers never register. Requiring it again here directly fixes that.
require("@nomicfoundation/hardhat-chai-matchers");

dotenv.config({ path: "../../.env", quiet: true });

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    return "0x0000000000000000000000000000000000000000000000000000000000000000".slice(0, 66);
  }
  return value;
}

const DEPLOYER_PRIVATE_KEY = requireEnv("EVM_DEPLOYER_PRIVATE_KEY");

const config: HardhatUserConfig = {
  solidity: {
    compilers: [
      {
        version: "0.8.24",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
          viaIR: true,
        },
      },
    ],
    overrides: {
      // ClawdHQCore bundles agent registry + job escrow + launchpad in one UUPS singleton
      // and sits right at the EIP-170 24576-byte contract-size limit (currently ~24571
      // bytes deployed — only ~5 bytes of headroom even with runs:1 + stripped metadata).
      // Optimize this one file for size over runtime gas; it's called far less frequently
      // per user than a hot-path DeFi primitive, so that tradeoff is worth it. There is
      // effectively no room left to add more logic here — any new agent-related
      // functionality (the exchange included) belongs in its own contract, not this one.
      "contracts/ClawdHQCore.sol": {
        version: "0.8.24",
        settings: {
          optimizer: {
            enabled: true,
            runs: 1,
          },
          viaIR: true,
          // Strips the ~53-byte trailing CBOR metadata hash from the deployed bytecode.
          // Purely cosmetic for Etherscan source-verification UX (still works via the
          // standard-JSON-input flow); zero effect on runtime behavior.
          metadata: {
            bytecodeHash: "none",
          },
        },
      },
    },
  },
  networks: {
    bscTestnet: {
      url: process.env.BSC_TESTNET_RPC_URL || "https://data-seed-prebsc-1-s1.binance.org:8545",
      accounts: [DEPLOYER_PRIVATE_KEY],
      chainId: 97,
    },
    baseSepolia: {
      url: process.env.BASE_SEPOLIA_RPC_URL || "https://sepolia.base.org",
      accounts: [DEPLOYER_PRIVATE_KEY],
      chainId: 84532,
    },
    ethSepolia: {
      url: process.env.ETH_SEPOLIA_RPC_URL || "https://rpc.sepolia.org",
      accounts: [DEPLOYER_PRIVATE_KEY],
      chainId: 11155111,
    },
    // Circle's Arc — USDC is the *native gas token* here (18 decimals), not a separate
    // ETH-equivalent; nothing Hardhat-specific to configure for that, gas is still quoted and
    // paid in the network's native currency same as any other chain. See chains.ts's
    // ARC_TESTNET doc comment.
    arcTestnet: {
      url: process.env.ARC_TESTNET_RPC_URL || "https://rpc.testnet.arc.network",
      accounts: [DEPLOYER_PRIVATE_KEY],
      chainId: 5042002,
    },
    // Circle's Arc Mainnet — USDC is the native gas token (18 decimals), and native ERC-20
    // at 0x3600...0000 (6 decimals). Chain ID 5042.
    arcMainnet: {
      url: process.env.ARC_MAINNET_RPC_URL || "https://rpc.mainnet.arc.io",
      accounts: [DEPLOYER_PRIVATE_KEY],
      chainId: 5042,
    },
    // Monad Testnet — 10,000 TPS parallel EVM L1, Chain ID 10143 (0x279f), native MON currency.
    monadTestnet: {
      url: process.env.MONAD_TESTNET_RPC_URL || "https://testnet-rpc.monad.xyz",
      accounts: [DEPLOYER_PRIVATE_KEY],
      chainId: 10143,
    },
    // Monad Mainnet — 10,000 TPS parallel EVM L1, Chain ID 143 (0x8f), native MON currency.
    monadMainnet: {
      url: process.env.MONAD_MAINNET_RPC_URL || "https://rpc.monad.xyz",
      accounts: [DEPLOYER_PRIVATE_KEY],
      chainId: 143,
    },
    hardhat: {},
  },
  etherscan: {
    apiKey: {
      bscTestnet: process.env.BSCSCAN_API_KEY || "",
      baseSepolia: process.env.BASESCAN_API_KEY || "",
      sepolia: process.env.ETHERSCAN_API_KEY || "",
      arcMainnet: process.env.ETHERSCAN_API_KEY || "",
      monadTestnet: process.env.MONADSCAN_API_KEY || "",
      monadMainnet: process.env.MONADSCAN_API_KEY || "",
    },
    customChains: [
      {
        network: "arcMainnet",
        chainId: 5042,
        urls: {
          apiURL: "https://api.etherscan.io/v2/api",
          browserURL: "https://arc.etherscan.io",
        },
      },
      {
        network: "monadTestnet",
        chainId: 10143,
        urls: {
          apiURL: "https://api.monadscan.com/api",
          browserURL: "https://testnet.monadscan.com",
        },
      },
      {
        network: "monadMainnet",
        chainId: 143,
        urls: {
          apiURL: "https://api.monadscan.com/api",
          browserURL: "https://monadscan.com",
        },
      },
    ],
  },
  gasReporter: {
    enabled: process.env.REPORT_GAS === "true",
    currency: "USD",
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts",
  },
};

export default config;
