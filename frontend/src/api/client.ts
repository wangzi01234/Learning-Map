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

export interface LlmStreamHandlers {
  onDelta?: (text: string) => void;
}

type NdjsonLine<T> =
  | { type: "delta"; text?: string }
  | { type: "done"; payload: T }
  | { type: "error"; detail?: string };

function applyNdjsonLine<T>(line: string, handlers: LlmStreamHandlers | undefined, final: { payload?: T }) {
  const msg = JSON.parse(line) as NdjsonLine<T>;
  if (msg.type === "delta" && msg.text && handlers?.onDelta) {
    handlers.onDelta(msg.text);
  }
  if (msg.type === "error") {
    throw new Error(msg.detail || "流式响应错误");
  }
  if (msg.type === "done") {
    final.payload = msg.payload;
  }
}

/**
 * 消费后端 LLM NDJSON 流（application/x-ndjson）：delta 行为增量文本，done 带业务 payload。
 */
export async function postLlmNdjsonStream<T>(
  path: string,
  body: unknown,
  handlers?: LlmStreamHandlers
): Promise<T> {
  const url = apiUrl(path);
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/x-ndjson, application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    const detail = parseFastApiErrorBody(text);
    throw new Error(detail || `请求失败 (${res.status})`);
  }
  const reader = res.body?.getReader();
  if (!reader) {
    throw new Error("无法读取响应流");
  }
  const decoder = new TextDecoder();
  let buffer = "";
  const final: { payload?: T } = {};
  while (true) {
    const { done, value } = await reader.read();
    buffer += decoder.decode(value ?? new Uint8Array(), { stream: !done });
    let nl: number;
    while ((nl = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, nl).trim();
      buffer = buffer.slice(nl + 1);
      if (!line) continue;
      applyNdjsonLine(line, handlers, final);
    }
    if (done) break;
  }
  const tail = buffer.trim();
  if (tail) {
    applyNdjsonLine(tail, handlers, final);
  }
  if (final.payload === undefined) {
    throw new Error("流已结束但未收到结果");
  }
  return final.payload;
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

export async function postExtend(
  body: ExtendRequestBody,
  handlers?: LlmStreamHandlers
): Promise<ExtendApiResult> {
  return postLlmNdjsonStream<ExtendApiResult>("/api/extend", body, handlers);
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

export async function postExplainChat(
  body: ExplainChatRequestBody,
  handlers?: LlmStreamHandlers
): Promise<ExplainChatApiResult> {
  return postLlmNdjsonStream<ExplainChatApiResult>("/api/explain-chat", body, handlers);
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

/** LLM 将 Markdown 转为图谱并写入快照；返回内容与快照详情一致。 */
export async function postConvertMdToMap(body: {
  case_slug: string;
  markdown: string;
  snapshot_name?: string | null;
}): Promise<GraphSnapshotDetail> {
  return postJson<GraphSnapshotDetail>("/api/convert/md-to-map", body);
}

/** LLM 将当前图谱写成 Markdown 并保存到文档库。 */
export async function postConvertMapToMd(body: {
  case_slug: string;
  nodes: unknown[];
  edges: unknown[];
  todos: unknown[];
  path?: string | null;
}): Promise<{ path: string; content: string }> {
  return postJson<{ path: string; content: string }>("/api/convert/map-to-md", body);
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

/** 与后端 MdAssistLlmOverrides 对应，用于覆盖 init_chat_model */
export interface MdAssistLlmConfig {
  model?: string;
  model_provider?: string;
  temperature?: number;
  base_url?: string;
  api_key?: string;
  model_kwargs_extra?: Record<string, unknown>;
}

export interface MdAssistRequestBody {
  path: string;
  markdown: string;
  instruction: string;
  /** 不含本轮；按时间顺序 user/assistant 交替 */
  conversation?: { role: "user" | "assistant"; content: string }[];
  llm?: MdAssistLlmConfig;
  /** false 时一次返回 JSON（invoke），默认流式 NDJSON */
  stream?: boolean;
}

export interface MdAssistResponseBody {
  reply: string;
  applyMarkdown?: string | null;
  /** 部分模型会输出 snake_case，后端也会透传兼容 */
  apply_markdown?: string | null;
}

export async function postMdAssist(
  body: MdAssistRequestBody,
  handlers?: LlmStreamHandlers
): Promise<MdAssistResponseBody> {
  if (body.stream === false) {
    return postJson<MdAssistResponseBody>("/api/md/assist", body);
  }
  return postLlmNdjsonStream<MdAssistResponseBody>("/api/md/assist", body, handlers);
}
