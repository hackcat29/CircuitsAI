"use client";

import { Crown, Award, Shield, Gem, Check } from "lucide-react";

export function ContributorTierPerks() {
  const tiers = [
    {
      name: "Bronze",
      range: "0 - 4 pts",
      color: "#CD7F32",
      icon: Shield,
      perks: [
        "Community Member Standing",
        "Standard Agent Indexing",
        "Activity Score Tracking",
        "Public Contributor Profile",
      ],
    },
    {
      name: "Silver",
      range: "5 - 19 pts",
      color: "#B8BCC6",
      icon: Award,
      perks: [
        "Verified Contributor Badge",
        "Priority Task Escrow Routing",
        "Enhanced Protocol Visibility",
        "Contributor Leaderboard Ranking",
      ],
    },
    {
      name: "Gold",
      range: "20 - 99 pts",
      color: "#FFB13D",
      icon: Crown,
      perks: [
        "Gold Builder & Patron Badge",
        "Evaluator Pool Priority Selection",
        "Advanced Contributor Analytics",
        "Early Feature Access",
      ],
    },
    {
      name: "Diamond",
      range: "100+ pts",
      color: "#7DD3FC",
      icon: Gem,
      perks: [
        "Diamond Tier Badge & Recognition",
        "Top-Tier Leaderboard Placement",
        "Protocol Governance Participation",
        "Priority Protocol Support",
      ],
    },
  ];

  return (
    <div className="bg-bg-elevated border border-border-subtle rounded-[16px] p-6 space-y-4 shadow-xs">
      <div className="flex items-center justify-between pb-2 border-b border-border-subtle">
        <div className="flex items-center gap-2">
          <Award className="h-4 w-4 text-accent-violet" />
          <h3 className="text-[14.5px] font-extrabold text-text-primary">Contributor Tier Recognition</h3>
        </div>
        <span className="text-xs font-mono text-text-quaternary">4 Tier Hierarchy</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {tiers.map((t) => {
          const Icon = t.icon;

          return (
            <div
              key={t.name}
              className="p-4 rounded-[14px] bg-bg-surface border border-border-subtle flex flex-col justify-between gap-3"
            >
              <div className="space-y-2">
                <div className="flex items-center gap-2 pb-2 border-b border-border-subtle">
                  <div
                    className="h-8 w-8 rounded-[9px] flex items-center justify-center border shrink-0"
                    style={{ background: `${t.color}15`, borderColor: `${t.color}35` }}
                  >
                    <Icon className="h-4 w-4" style={{ color: t.color }} />
                  </div>
                  <div>
                    <h4 className="text-[13px] font-extrabold" style={{ color: t.color }}>{t.name}</h4>
                    <span className="text-[10px] font-mono text-text-quaternary">{t.range}</span>
                  </div>
                </div>

                <ul className="space-y-1.5 text-[11px] text-text-tertiary">
                  {t.perks.map((p, idx) => (
                    <li key={idx} className="flex items-start gap-1.5">
                      <Check className="h-3 w-3 text-[#1FD487] shrink-0 mt-0.5" />
                      <span>{p}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
