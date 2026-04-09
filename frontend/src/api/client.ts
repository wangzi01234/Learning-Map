import type { ExtendApiResult } from "@/types";

/**
 * 与 Vite 代理一致：留空则走同源相对路径（如 /api/... → 开发时转发到后端）。
 * 若填写，请只写「协议 + 主机 + 端口」，不要带尾部 /，也不要以 /api 结尾（会自动规整）。
 */
function normalizeApiBase(raw: string): string {
  let b = raw.trim();
  if (!b) return "";
  b = b.replace(/\/+$/, "");
  if (b.endsWith("/api")) {
    b = b.slice(0, -4).replace(/\/+$/, "");
  }
  return b;
}

/** 统一拼接，避免出现 // 或 /api/api/ */
export function getApiBaseUrl(): string {
  return normalizeApiBase(import.meta.env.VITE_API_BASE ?? "");
}

export function apiUrl(path: string): string {
  const base = getApiBaseUrl();
  const p = path.startsWith("/") ? path : `/${path}`;
  return base ? `${base}${p}` : p;
}

function parseFastApiErrorBody(text: string): string {
  let detail = text;
  try {
    const j = JSON.parse(text) as {
      detail?: string | { msg?: string }[];
    };
    if (typeof j.detail === "string") {
      detail = j.detail;
    } else if (Array.isArray(j.detail)) {
      detail = j.detail
        .map((x) =>
          typeof x === "object" && x && "msg" in x ? String((x as { msg: string }).msg) : String(x)
        )
        .join("；");
    }
  } catch {
    /* ignore */
  }
  return detail;
}

export async function getJson<T>(path: string): Promise<T> {
  const url = apiUrl(path);
  const res = await fetch(url);
  const text = await res.text();
  if (!res.ok) {
    const detail = parseFastApiErrorBody(text);
    throw new Error(detail || `请求失败 (${res.status})`);
  }
  return JSON.parse(text) as T;
}

/**
 * 所有后端 LLM/JSON API 的统一 POST（与 AI 通俗解释聊天使用同一套 URL 与错误解析）。
 */
export async function postJson<T>(path: string, body: unknown): Promise<T> {
  const url = apiUrl(path);
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) {
    const detail = parseFastApiErrorBody(text);
    throw new Error(detail || `请求失败 (${res.status})`);
  }
  return JSON.parse(text) as T;
}

export async function putJson<T>(path: string, body: unknown): Promise<T> {
  const url = apiUrl(path);
  const res = await fetch(url, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) {
    const detail = parseFastApiErrorBody(text);
    throw new Error(detail || `请求失败 (${res.status})`);
  }
  return JSON.parse(text) as T;
}

export interface LearningCaseMeta {
  id: string;
  slug: string;
  title: string;
  subtitle: string;
  description: string;
  sort_order: number;
}

export interface LearningCaseDetail extends LearningCaseMeta {
  initial_nodes: unknown[];
  initial_edges: unknown[];
}

export async function getLearningCases(): Promise<LearningCaseMeta[]> {
  return getJson<LearningCaseMeta[]>("/api/cases");
}

export async function getLearningCaseDetail(slug: string): Promise<LearningCaseDetail> {
  return getJson<LearningCaseDetail>(`/api/cases/${encodeURIComponent(slug)}`);
}

export interface ExtendRequestBody {
  prompt: string;
  case_slug: string;
  context: {
    existingNodes: string[];
    existingEdges: [string, string, string][];
  };
}

export async function postExtend(body: ExtendRequestBody): Promise<ExtendApiResult> {
  return postJson<ExtendApiResult>("/api/extend", body);
}

export interface ExplainChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ExplainChatRequestBody {
  nodeId: string;
  nodeName: string;
  currentExplanation: string;
  messages: ExplainChatMessage[];
  case_slug: string;
}

export interface ExplainChatApiResult {
  reply: string;
  applyExplanation?: string | null;
}

export async function postExplainChat(body: ExplainChatRequestBody): Promise<ExplainChatApiResult> {
  return postJson<ExplainChatApiResult>("/api/explain-chat", body);
}

export interface GraphSnapshotListItem {
  id: string;
  case_slug: string;
  name: string;
  created_at: string;
  updated_at: string;
}

export interface GraphSnapshotDetail {
  id: string;
  case_slug: string;
  name: string;
  nodes: unknown[];
  edges: unknown[];
  todos: unknown[];
  created_at: string;
  updated_at: string;
}

export async function listGraphSnapshots(caseSlug?: string): Promise<GraphSnapshotListItem[]> {
  const q = caseSlug != null && caseSlug !== "" ? `?case_slug=${encodeURIComponent(caseSlug)}` : "";
  return getJson<GraphSnapshotListItem[]>(`/api/graph/snapshots${q}`);
}

export async function getGraphSnapshot(id: string): Promise<GraphSnapshotDetail> {
  return getJson<GraphSnapshotDetail>(`/api/graph/snapshots/${encodeURIComponent(id)}`);
}

export async function saveGraphSnapshot(body: {
  case_slug: string;
  name: string;
  nodes: unknown[];
  edges: unknown[];
  todos: unknown[];
}): Promise<GraphSnapshotDetail> {
  return postJson<GraphSnapshotDetail>("/api/graph/snapshots", body);
}

export interface MdFileItem {
  path: string;
  title: string;
}

export async function getMdFiles(): Promise<MdFileItem[]> {
  return getJson<MdFileItem[]>("/api/md/files");
}

export async function getMdDoc(path: string): Promise<{ path: string; content: string }> {
  return getJson<{ path: string; content: string }>(
    `/api/md/doc?path=${encodeURIComponent(path)}`
  );
}

export async function putMdDoc(path: string, content: string): Promise<{ path: string; content: string }> {
  return putJson<{ path: string; content: string }>("/api/md/doc", { path, content });
}

export interface MdAssistRequestBody {
  path: string;
  markdown: string;
  instruction: string;
  /** 不含本轮；按时间顺序 user/assistant 交替 */
  conversation?: { role: "user" | "assistant"; content: string }[];
}

export interface MdAssistResponseBody {
  reply: string;
  applyMarkdown?: string | null;
  /** 部分模型会输出 snake_case，后端也会透传兼容 */
  apply_markdown?: string | null;
}

export async function postMdAssist(body: MdAssistRequestBody): Promise<MdAssistResponseBody> {
  return postJson<MdAssistResponseBody>("/api/md/assist", body);
}
