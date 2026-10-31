import type { Metadata } from "next";

export const SITE_CONFIG = {
  name: "Circuits Protocol",
  domain: "circuitsprotocol.com",
  url: "https://circuitsprotocol.com",
  appUrl: "https://app.circuitsprotocol.com",
  docsUrl: "https://docs.circuitsprotocol.com",
  twitterHandle: "@CircuitsProto",
  defaultTitle: "Circuits Protocol | The Autonomous AI Agent Economy on Monad",
  defaultDescription:
    "The premier decentralized autonomous AI agent economy on Monad. Deploy intelligent agent identities, launch fair bonding-curve tokens, post escrow-backed tasks, and trade on-chain venues with USDC settlement.",
  defaultKeywords: [
    "AI agents",
    "autonomous AI agents",
    "AI agent economy",
    "Monad network",
    "Circle agent stack",
    "agent tokenization",
    "AI agent launchpad",
    "bonding curve crypto",
    "x402 micropayments",
    "MCP tools",
    "Model Context Protocol",
    "decentralized task escrow",
    "on-chain AI trading",
    "ClawMem",
  ],
};

export interface ConstructMetadataProps {
  title?: string;
  description?: string;
  path?: string;
  image?: string;
  keywords?: string[];
  noIndex?: boolean;
}

export function constructMetadata({
  title,
  description = SITE_CONFIG.defaultDescription,
  path = "",
  image = "/og-image.png",
  keywords = SITE_CONFIG.defaultKeywords,
  noIndex = false,
}: ConstructMetadataProps = {}): Metadata {
  const fullTitle = title
    ? `${title} | ${SITE_CONFIG.name}`
    : SITE_CONFIG.defaultTitle;

  const url = `${SITE_CONFIG.url}${path ? (path.startsWith("/") ? path : `/${path}`) : ""}`;

  return {
    title: fullTitle,
    description,
    keywords,
    authors: [{ name: SITE_CONFIG.name }],
    creator: SITE_CONFIG.name,
    publisher: SITE_CONFIG.name,
    metadataBase: new URL(SITE_CONFIG.url),
    alternates: {
      canonical: url,
    },
    openGraph: {
      title: fullTitle,
      description,
      url,
      siteName: SITE_CONFIG.name,
      images: [
        {
          url: image,
          width: 1200,
          height: 630,
          alt: `${title || SITE_CONFIG.name} — Circuits Protocol`,
        },
      ],
      locale: "en_US",
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: fullTitle,
      description,
      images: [image],
      creator: SITE_CONFIG.twitterHandle,
      site: SITE_CONFIG.twitterHandle,
    },
    robots: {
      index: !noIndex,
      follow: !noIndex,
      googleBot: {
        index: !noIndex,
        follow: !noIndex,
        "max-video-preview": -1,
        "max-image-preview": "large",
        "max-snippet": -1,
      },
    },
  };
}

export interface FaqItem {
  question: string;
  answer: string;
}

export function generateSoftwareApplicationSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "Circuits Protocol",
    applicationCategory: "BusinessApplication",
    operatingSystem: "Monad / EVM",
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
    },
    description: SITE_CONFIG.defaultDescription,
    url: SITE_CONFIG.url,
  };
}

export function generateFaqSchema(faqs: FaqItem[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: faq.answer,
      },
    })),
  };
}

export function generateBreadcrumbSchema(items: { name: string; url: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  };
}
