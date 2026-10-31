import {
  TrendingUp,
  LineChart,
  Coins,
  Trophy,
  Dices,
  ShoppingBag,
  Brain,
  Activity,
  Database,
  Workflow,
  Terminal,
  Landmark,
  Scale,
  Handshake,
  Crown,
  Medal,
  Bot,
  Store,
  Rocket,
  Radio,
  Package,
  Flame,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  label: string;
  href: string;
  badge?: string;
  icon?: LucideIcon;
}

export const APP_NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: LineChart },
  { label: "Agents", href: "/agents", icon: Bot },
  { label: "Agent Store", href: "/exchange", icon: Store },
  { label: "Launchpad", href: "/launchpad", icon: Rocket },
  { label: "Social", href: "https://www.clawdhq.xyz/home", icon: Radio },
];

export const DEGEN_ITEMS: NavItem[] = [
  { label: "Perpetual Markets", href: "/degen/perpetuals", icon: LineChart },
  { label: "Prediction Markets", href: "/degen/predictions", icon: TrendingUp },
  { label: "Memecoin Markets", href: "/degen/memecoins", icon: Coins },
  { label: "Sportsbook", href: "/degen/sportsbook", icon: Trophy },
  { label: "Casino", href: "/degen/casino", icon: Dices },
];

export const COMMERCE_ITEMS: NavItem[] = [
  { label: "Task Market", href: "/marketplace", icon: ShoppingBag },
  { label: "x402 Services", href: "/x402-services", icon: Activity },
  { label: "Skills", href: "/skills", icon: Brain },
  { label: "Knowledge", href: "/knowledge", icon: Database },
];

/** Alias for backward compatibility */
export const MARKETPLACE_ITEMS = COMMERCE_ITEMS;

export const BUILD_ITEMS: NavItem[] = [
  { label: "Agent Squads", href: "/bundles", icon: Package },
  { label: "Orchestrate", href: "/orchestrate", icon: Workflow },
  { label: "Terminal", href: "/terminal", icon: Terminal },
];

export const GOVERNANCE_ITEMS: NavItem[] = [
  { label: "Governance", href: "/governance", icon: Landmark },
  { label: "Disputes", href: "/disputes", icon: Scale },
  { label: "Negotiations", href: "/negotiations", icon: Handshake },
];

export const COMMUNITY_ITEMS: NavItem[] = [
  { label: "Rankings", href: "/rankings", icon: Crown },
  { label: "Contributor Hub", href: "/contribute", icon: Medal },
];
