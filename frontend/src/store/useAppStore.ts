import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { ExtendApiResult, GraphEdge, GraphNode, NodeDetails, TodoItem } from "@/types";
import { normalizeEdgesFromApi, normalizeNodesFromApi } from "@/utils/graphFromApi";
import { normalizeGraphNode } from "@/utils/normalize";

function mergeNodes(base: GraphNode[], overlay: GraphNode[]): GraphNode[] {
  const m = new Map<string, GraphNode>();
  base.forEach((n) => m.set(n.id, structuredClone(n)));
  overlay.forEach((n) => m.set(n.id, structuredClone(n)));
  return Array.from(m.values());
}

function mergeEdges(base: GraphEdge[], overlay: GraphEdge[]): GraphEdge[] {
  const seen = new Set<string>();
  const out: GraphEdge[] = [];
  const push = (e: GraphEdge) => {
    if (seen.has(e.id)) return;
    seen.add(e.id);
    out.push(e);
  };
  base.forEach(push);
  overlay.forEach(push);
  return out;
}

function randomId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

export interface AppState {
  currentCaseSlug: string;
  nodes: GraphNode[];
  edges: GraphEdge[];
  todos: TodoItem[];
  selectedNodeId: string | null;
  setSelectedNodeId: (id: string | null) => void;
  setCurrentCaseSlug: (slug: string) => void;
  applyCaseInitial: (nodes: unknown[], edges: unknown[]) => void;
  hydrateSnapshot: (nodes: unknown[], edges: unknown[], todos: unknown[]) => void;
  addNode: (node: GraphNode) => void;
  addEdgeManual: (source: string, target: string, relation: string, label?: string) => void;
  addTodo: (item: Omit<TodoItem, "id" | "done">) => void;
  addTodosBatch: (items: Omit<TodoItem, "id" | "done">[]) => void;
  toggleTodo: (id: string) => void;
  removeTodo: (id: string) => void;
  applyExtendResult: (result: ExtendApiResult) => void;
  updateNodeDetails: (nodeId: string, patch: Partial<NodeDetails>) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      currentCaseSlug: "builtin-demo",
      nodes: [],
      edges: [],
      todos: [],
      selectedNodeId: null,

      setSelectedNodeId: (id) => set({ selectedNodeId: id }),

      setCurrentCaseSlug: (slug) => set({ currentCaseSlug: slug }),

      applyCaseInitial: (nodes, edges) =>
        set({
          nodes: normalizeNodesFromApi(nodes),
          edges: normalizeEdgesFromApi(edges),
          todos: [],
          selectedNodeId: null,
        }),

      hydrateSnapshot: (nodes, edges, todos) =>
        set({
          nodes: normalizeNodesFromApi(nodes),
          edges: normalizeEdgesFromApi(edges),
          todos: (todos as TodoItem[]).map((t) => ({
            id: typeof t.id === "string" && t.id ? t.id : randomId("todo"),
            title: String(t.title ?? ""),
            description: t.description,
            relatedNodeId: t.relatedNodeId,
            done: Boolean(t.done),
          })),
          selectedNodeId: null,
        }),

      addNode: (node) =>
        set((s) => {
          const ids = new Set(s.nodes.map((n) => n.id));
          if (ids.has(node.id)) return s;
          return { nodes: [...s.nodes, structuredClone(node)] };
        }),

      addEdgeManual: (source, target, relation, label) =>
        set((s) => {
          const id = `edge-${source}-${target}-${relation}-${Date.now()}`;
          if (s.edges.some((e) => e.source === source && e.target === target && e.relation === relation)) {
            return s;
          }
          const edge: GraphEdge = { id, source, target, relation, label };
          return { edges: [...s.edges, edge] };
        }),

      addTodo: (item) =>
        set((s) => ({
          todos: [
            ...s.todos,
            {
              id: randomId("todo"),
              title: item.title,
              description: item.description,
              relatedNodeId: item.relatedNodeId,
              done: false,
            },
          ],
        })),

      addTodosBatch: (items) =>
        set((s) => {
          const next = [...s.todos];
          for (const item of items) {
            if (!item.title?.trim()) continue;
            next.push({
              id: randomId("todo"),
              title: item.title.trim(),
              description: item.description,
              relatedNodeId: item.relatedNodeId,
              done: false,
            });
          }
          return { todos: next };
        }),

      toggleTodo: (id) =>
        set((s) => ({
          todos: s.todos.map((t) => (t.id === id ? { ...t, done: !t.done } : t)),
        })),

      removeTodo: (id) =>
        set((s) => ({
          todos: s.todos.filter((t) => t.id !== id),
        })),

      updateNodeDetails: (nodeId, patch) =>
        set((s) => ({
          nodes: s.nodes.map((n) =>
            n.id === nodeId
              ? { ...n, details: { ...n.details, ...structuredClone(patch) } }
              : n
          ),
        })),

      applyExtendResult: (result) =>
        set((s) => {
          const existingIds = new Set(s.nodes.map((n) => n.id));
          const rawNodes = (result.newNodes ?? []) as unknown as Record<string, unknown>[];
          const newNodes = rawNodes
            .map((r) => normalizeGraphNode(r))
            .filter((n) => n.id && n.id !== "unknown" && !existingIds.has(n.id));
          const nodes = [...s.nodes, ...newNodes.map((n) => structuredClone(n))];

          const edgeIds = new Set(s.edges.map((e) => e.id));
          const extraEdges: GraphEdge[] = [];
          for (const e of result.newEdges ?? []) {
            const id = `edge-${e.source}-${e.target}-${e.relation}-${Math.random().toString(36).slice(2, 8)}`;
            if (s.edges.some((x) => x.source === e.source && x.target === e.target && x.relation === e.relation)) {
              continue;
            }
            if (!edgeIds.has(id)) {
              edgeIds.add(id);
              extraEdges.push({
                id,
                source: e.source,
                target: e.target,
                relation: e.relation,
                label: e.label,
              });
            }
          }

          const todos = [...s.todos];
          for (const t of result.newTodos ?? []) {
            if (!t.title?.trim()) continue;
            todos.push({
              id: randomId("todo"),
              title: t.title.trim(),
              description: t.description,
              relatedNodeId: t.relatedNodeId,
              done: false,
            });
          }

          return {
            nodes,
            edges: [...s.edges, ...extraEdges],
            todos,
          };
        }),
    }),
    {
      name: "learning-map-storage",
      partialize: (s) => ({
        nodes: s.nodes,
        edges: s.edges,
        todos: s.todos,
        currentCaseSlug: s.currentCaseSlug,
      }),
      merge: (persisted, current) => {
        const wrap = persisted as { state?: Partial<AppState> } | Partial<AppState> | undefined;
        const raw = wrap && "state" in wrap && wrap.state ? wrap.state : (wrap as Partial<AppState>);
        if (!raw || (!raw.nodes && !raw.edges && !raw.todos && raw.currentCaseSlug == null)) {
          return current as AppState;
        }
        return {
          ...(current as AppState),
          currentCaseSlug:
            typeof raw.currentCaseSlug === "string" && raw.currentCaseSlug
              ? raw.currentCaseSlug
              : (current as AppState).currentCaseSlug,
          nodes: mergeNodes([], Array.isArray(raw.nodes) ? raw.nodes : []),
          edges: mergeEdges([], Array.isArray(raw.edges) ? raw.edges : []),
          todos: Array.isArray(raw.todos) ? raw.todos : [],
        };
      },
    }
  )
);

export function getNodeById(id: string | null): GraphNode | undefined {
  if (!id) return undefined;
  return useAppStore.getState().nodes.find((n) => n.id === id);
}
