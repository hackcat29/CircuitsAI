import {
  PrismaClient,
  Chain,
  Venue,
  Mode,
  WalletStatus,
  OrderStatus,
  RiskEventKind,
  BetSettlementStatus,
  Prisma,
} from "./generated/prisma/client.js";
import type {
  TradingAgentConfig,
  TradingWallet,
  TradingOrder,
  Position,
  RiskEvent,
  PendingBetSettlement,
} from "./generated/prisma/client.js";

// Standard Next.js/Prisma singleton pattern: without it, every hot-reload in dev creates a
// fresh PrismaClient (and a fresh connection pool) without closing the last one.
const globalForPrisma = globalThis as unknown as { __clawdhqDegenPrisma?: PrismaClient };

export const prisma = globalForPrisma.__clawdhqDegenPrisma ?? new PrismaClient();

globalForPrisma.__clawdhqDegenPrisma = prisma;

// Generated into a custom output dir (not node_modules/@prisma/client) — see the `output`
// comment in prisma/schema.prisma for why. Named re-exports, not `export *`: the generated
// client is CommonJS, and a wildcard re-export of a CJS module forces bundlers into an
// unoptimizable runtime proxy (Turbopack flags this explicitly) — naming the actual surface
// consumers use avoids that and keeps the package's API intentional.
export { Chain, Venue, Mode, WalletStatus, OrderStatus, RiskEventKind, BetSettlementStatus, Prisma };
export type { TradingAgentConfig, TradingWallet, TradingOrder, Position, RiskEvent, PendingBetSettlement };
