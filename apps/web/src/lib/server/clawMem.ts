import { ClawMem } from "@clawdhq/clawmem";

// One process-wide ClawMem instance (it pools its own per-agent ClawDB clients internally — see
// packages/clawmem's own client.ts) shared by every route that needs to read an agent's memory.
// Today that's only the knowledge resolve route's MEMORY branch — see
// .../contributions/[id]/resolve/route.ts.
export const clawMem = new ClawMem();
