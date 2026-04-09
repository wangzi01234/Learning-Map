import type { GraphEdge, GraphNode } from "@/types";
import { normalizeGraphNode } from "@/utils/normalize";

export function normalizeEdgesFromApi(raw: unknown[]): GraphEdge[] {
  return raw.map((e, i) => {
    const x = e as Record<string, unknown>;
    return {
      id: String(x.id ?? `edge-${x.source}-${x.target}-${i}`),
      source: String(x.source ?? ""),
      target: String(x.target ?? ""),
      relation: String(x.relation ?? ""),
      label: x.label != null ? String(x.label) : undefined,
    };
  });
}

export function normalizeNodesFromApi(raw: unknown[]): GraphNode[] {
  return raw.map((n) => normalizeGraphNode((n ?? {}) as Record<string, unknown>));
}
