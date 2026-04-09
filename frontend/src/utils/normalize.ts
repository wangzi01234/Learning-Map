import type { GraphNode } from "@/types";

export function normalizeGraphNode(raw: Record<string, unknown>): GraphNode {
  const id = String(raw.id ?? "").trim() || "unknown";
  const detailsRaw = (raw.details ?? {}) as Record<string, unknown>;
  const linksRaw = detailsRaw.links;
  const imagesRaw = detailsRaw.images;

  return {
    id,
    name: String(raw.name ?? id),
    year: typeof raw.year === "number" ? raw.year : Number(raw.year) || 0,
    category: String(raw.category ?? ""),
    description: String(raw.description ?? ""),
    details: {
      explanation: String(detailsRaw.explanation ?? ""),
      formula: detailsRaw.formula != null ? String(detailsRaw.formula) : undefined,
      animation: detailsRaw.animation != null ? String(detailsRaw.animation) : undefined,
      images: Array.isArray(imagesRaw) ? imagesRaw.map(String) : [],
      code: detailsRaw.code != null ? String(detailsRaw.code) : undefined,
      links: Array.isArray(linksRaw)
        ? linksRaw
            .map((l: unknown) => {
              if (!l || typeof l !== "object") return null;
              const o = l as { name?: string; url?: string };
              if (!o.url) return null;
              return { name: String(o.name ?? ""), url: String(o.url) };
            })
            .filter((x): x is { name: string; url: string } => x !== null)
        : [],
    },
  };
}
