import { Venue } from "@clawdhq/degen-db";
import type { VenueAdapter } from "./types";
import { hyperliquidAdapter } from "./hyperliquid";
import { clawdhqLaunchAdapter } from "./clawdhqLaunch";
import { sportystakePredictionsAdapter, sportystakeSportsbookAdapter } from "./sportystakeBetting";
import { sportystakeCasinoAdapter } from "./sportystakeCasino";

export const VENUE_ADAPTERS: Record<Venue, VenueAdapter> = {
  [Venue.HYPERLIQUID]: hyperliquidAdapter,
  [Venue.CLAWDHQ_LAUNCH]: clawdhqLaunchAdapter,
  [Venue.SPORTYSTAKE_PREDICTIONS]: sportystakePredictionsAdapter,
  [Venue.SPORTYSTAKE_SPORTSBOOK]: sportystakeSportsbookAdapter,
  [Venue.SPORTYSTAKE_CASINO]: sportystakeCasinoAdapter,
};
