import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "CircuitsAI | Scoped NEAR Agent Wallets",
  description:
    "Live NEAR testnet agent wallets, USDC escrow, and policy-gated cross-chain signing.",
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header className="border-b border-border-subtle px-5 py-4 flex items-center justify-between">
          <a
            href="https://github.com/hackcat29/CircuitsAI"
            className="font-bold text-lg"
          >
            CircuitsAI
          </a>
          <a
            className="text-xs text-text-tertiary underline"
            href="https://github.com/hackcat29/CircuitsAI#reproduce-the-demo"
          >
            Code and reproducible demo
          </a>
        </header>
        {children}
      </body>
    </html>
  );
}
