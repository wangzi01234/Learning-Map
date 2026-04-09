export interface NodeDetails {
  explanation: string;
  formula?: string;
  animation?: string;
  images?: string[];
  code?: string;
  links?: { name: string; url: string }[];
}

export interface GraphNode {
  id: string;
  name: string;
  year: number;
  category: string;
  description: string;
  details: NodeDetails;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  relation: string;
  label?: string;
}

export interface TodoItem {
  id: string;
  title: string;
  description?: string;
  relatedNodeId?: string;
  done: boolean;
}

export interface ExtendPayload {
  newNodes: GraphNode[];
  newEdges: Omit<GraphEdge, "id">[];
  newTodos: Omit<TodoItem, "id" | "done">[];
}

export interface ExtendApiResult {
  newNodes: unknown[];
  newEdges: { source: string; target: string; relation: string; label?: string }[];
  newTodos: { title: string; description?: string; relatedNodeId?: string }[];
}
