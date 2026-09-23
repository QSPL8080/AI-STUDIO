// Single authoritative pricing definition for Quickupp AI Studio
// Used across client UI and validated on server for all PayPal transactions.

export type IndividualServiceId =
  | "ai-ugc"
  | "ai-cartoon"
  | "ai-avatar"
  | "hyper-realistic"
  | "digital-twin-video"
  | "digital-twin-setup";

export type PackageTierId =
  | "single-video"
  | "starter"
  | "growth"
  | "scale"
  | "pro"
  | "enterprise";

export type PackageServiceFormat =
  | "ai-ugc"
  | "ai-avatar"
  | "ai-cartoon"
  | "hyper-realistic"
  | "digital-twin";

export interface PricingServiceMeta {
  id: IndividualServiceId;
  name: string;
  price: number;
  formattedPrice: string;
  description: string;
  badge?: string;
}

export interface PackageTierMeta {
  id: PackageTierId;
  name: string;
  videos: number;
  delivery: string;
  badge?: string;
  popular?: boolean;
  prices: Record<PackageServiceFormat, number>;
}

export const INDIVIDUAL_PRICING: Record<IndividualServiceId, PricingServiceMeta> = {
  "ai-ugc": {
    id: "ai-ugc",
    name: "AI UGC Video",
    price: 79,
    formattedPrice: "$79",
    description: "Authentic creator-style product review & demo reels",
  },
  "ai-cartoon": {
    id: "ai-cartoon",
    name: "AI Cartoon Animation",
    price: 79,
    formattedPrice: "$79",
    description: "Engaging 3D & 2D character animation storytelling",
  },
  "ai-avatar": {
    id: "ai-avatar",
    name: "AI Avatar Video",
    price: 99,
    formattedPrice: "$99",
    description: "Professional presenter-style spokesperson reels",
  },
  "hyper-realistic": {
    id: "hyper-realistic",
    name: "Hyper-Realistic AI Video",
    price: 149,
    formattedPrice: "$149",
    description: "Cinematic commercial-grade visual storytelling",
  },
  "digital-twin-video": {
    id: "digital-twin-video",
    name: "Digital Twin Video",
    price: 179,
    formattedPrice: "$179",
    description: "Recurring content with your custom AI twin & voice",
  },
  "digital-twin-setup": {
    id: "digital-twin-setup",
    name: "Digital Twin Setup",
    price: 499,
    formattedPrice: "$499",
    badge: "One-Time",
    description: "Full avatar model training, voice clone & speaking setup",
  },
};

export const PACKAGE_TIERS: Record<PackageTierId, PackageTierMeta> = {
  "single-video": {
    id: "single-video",
    name: "Single Video",
    videos: 1,
    delivery: "24 Hrs",
    prices: {
      "ai-ugc": 79,
      "ai-avatar": 99,
      "ai-cartoon": 79,
      "hyper-realistic": 149,
      "digital-twin": 179,
    },
  },
  starter: {
    id: "starter",
    name: "Starter Package",
    videos: 5,
    delivery: "72 Hrs",
    prices: {
      "ai-ugc": 349,
      "ai-avatar": 449,
      "ai-cartoon": 349,
      "hyper-realistic": 649,
      "digital-twin": 799,
    },
  },
  growth: {
    id: "growth",
    name: "Growth Package",
    videos: 10,
    delivery: "Within 7 Days",
    popular: true,
    badge: "Most Popular",
    prices: {
      "ai-ugc": 649,
      "ai-avatar": 799,
      "ai-cartoon": 649,
      "hyper-realistic": 1199,
      "digital-twin": 1499,
    },
  },
  scale: {
    id: "scale",
    name: "Scale Package",
    videos: 15,
    delivery: "Within 14 Days",
    badge: "High Growth",
    prices: {
      "ai-ugc": 899,
      "ai-avatar": 1099,
      "ai-cartoon": 899,
      "hyper-realistic": 1699,
      "digital-twin": 2099,
    },
  },
  pro: {
    id: "pro",
    name: "Pro Package",
    videos: 20,
    delivery: "Within 16 Days",
    badge: "Best Value",
    prices: {
      "ai-ugc": 1099,
      "ai-avatar": 1399,
      "ai-cartoon": 1099,
      "hyper-realistic": 2199,
      "digital-twin": 2599,
    },
  },
  enterprise: {
    id: "enterprise",
    name: "Enterprise Package",
    videos: 30,
    delivery: "Within 20 Days",
    badge: "Maximum Scale",
    prices: {
      "ai-ugc": 1499,
      "ai-avatar": 1999,
      "ai-cartoon": 1499,
      "hyper-realistic": 3299,
      "digital-twin": 3799,
    },
  },
};

export const PACKAGE_SERVICE_LABELS: Record<PackageServiceFormat, string> = {
  "ai-ugc": "AI UGC",
  "ai-avatar": "AI Avatar",
  "ai-cartoon": "AI Cartoon",
  "hyper-realistic": "Hyper-Realistic",
  "digital-twin": "Digital Twin",
};

export interface ResolvedPurchaseItem {
  itemType: "individual" | "package" | "setup";
  itemId: string;
  itemName: string;
  tierId?: PackageTierId;
  format?: PackageServiceFormat;
  amount: number;
  amountFormatted: string;
  currency: "USD";
  delivery?: string;
  videosCount?: number;
}

/**
 * Server-authoritative price resolver.
 * Given purchase identifiers, returns validated price and descriptions.
 * Never trust client amounts.
 */
export function resolvePurchaseItem(params: {
  itemType: "individual" | "package" | "setup" | string;
  itemId?: string;
  tierId?: string;
  format?: string;
}): ResolvedPurchaseItem | null {
  const { itemType, itemId, tierId, format } = params;

  // 1. Digital Twin Setup (One-time)
  if (itemType === "setup" || itemId === "digital-twin-setup" || itemId === "setup") {
    return {
      itemType: "setup",
      itemId: "digital-twin-setup",
      itemName: "Digital Twin Setup (One-time)",
      amount: 499,
      amountFormatted: "$499.00 USD",
      currency: "USD",
      delivery: "Within 72 Hrs",
      videosCount: 1,
    };
  }

  // 2. Individual Services
  if (itemType === "individual") {
    const serviceKey = (itemId || "").toLowerCase().replace(/_/g, "-") as IndividualServiceId;
    const service = INDIVIDUAL_PRICING[serviceKey];
    if (service) {
      return {
        itemType: "individual",
        itemId: service.id,
        itemName: service.name,
        amount: service.price,
        amountFormatted: `$${service.price.toFixed(2)} USD`,
        currency: "USD",
        delivery: "48–72 Hrs",
        videosCount: 1,
      };
    }
  }

  // 3. Packages
  if (itemType === "package" || (tierId && format)) {
    const tierKey = (tierId || itemId || "single-video").toLowerCase().replace(/_/g, "-") as PackageTierId;
    const formatKey = (format || "ai-ugc").toLowerCase().replace(/_/g, "-") as PackageServiceFormat;

    const tier = PACKAGE_TIERS[tierKey];
    if (tier && tier.prices[formatKey] !== undefined) {
      const price = tier.prices[formatKey];
      const formatLabel = PACKAGE_SERVICE_LABELS[formatKey] || formatKey;
      return {
        itemType: "package",
        itemId: `${tier.id}_${formatKey}`,
        tierId: tier.id,
        format: formatKey,
        itemName: `${tier.name} — ${formatLabel} (${tier.videos} ${tier.videos === 1 ? "Video" : "Videos"})`,
        amount: price,
        amountFormatted: `$${price.toFixed(2)} USD`,
        currency: "USD",
        delivery: tier.delivery,
        videosCount: tier.videos,
      };
    }
  }

  // Fallback by service name matching (e.g. from individualPricingList or cards)
  if (itemId) {
    const normalized = itemId.toLowerCase().trim();
    if (normalized.includes("cartoon")) {
      return resolvePurchaseItem({ itemType: "individual", itemId: "ai-cartoon" });
    }
    if (normalized.includes("avatar")) {
      return resolvePurchaseItem({ itemType: "individual", itemId: "ai-avatar" });
    }
    if (normalized.includes("hyper")) {
      return resolvePurchaseItem({ itemType: "individual", itemId: "hyper-realistic" });
    }
    if (normalized.includes("setup")) {
      return resolvePurchaseItem({ itemType: "setup" });
    }
    if (normalized.includes("twin")) {
      return resolvePurchaseItem({ itemType: "individual", itemId: "digital-twin-video" });
    }
    if (normalized.includes("ugc")) {
      return resolvePurchaseItem({ itemType: "individual", itemId: "ai-ugc" });
    }
  }

  return null;
}
