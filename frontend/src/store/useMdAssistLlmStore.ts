import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { MdAssistLlmConfig } from "@/api/client";

export interface MdAssistLlmUiState {
  model: string;
  model_provider: string;
  base_url: string;
  /** 空字符串表示交给后端默认温度（0.3） */
  temperatureStr: string;
  stream: boolean;
  /** 合并进 model_kwargs 的 JSON（须为对象）；空则忽略 */
  model_kwargs_extra: string;
}

type Actions = {
  setAll: (p: Partial<MdAssistLlmUiState>) => void;
  reset: () => void;
  buildLlmPayload: () => MdAssistLlmConfig | undefined;
};

const defaults: MdAssistLlmUiState = {
  model: "",
  model_provider: "openai",
  base_url: "",
  temperatureStr: "",
  stream: true,
  model_kwargs_extra: "",
};

function buildLlmPayloadFromState(s: MdAssistLlmUiState): MdAssistLlmConfig | undefined {
  const llm: MdAssistLlmConfig = {};
  if (s.model.trim()) llm.model = s.model.trim();
  if (s.model_provider.trim()) llm.model_provider = s.model_provider.trim();
  if (s.base_url.trim()) llm.base_url = s.base_url.trim();
  if (s.temperatureStr.trim()) {
    const t = Number(s.temperatureStr);
    if (!Number.isNaN(t)) llm.temperature = t;
  }
  if (s.model_kwargs_extra.trim()) {
    try {
      const parsed = JSON.parse(s.model_kwargs_extra) as unknown;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        llm.model_kwargs_extra = parsed as Record<string, unknown>;
      }
    } catch {
      /*无效 JSON，发送前由表单校验拦截 */
    }
  }
  return Object.keys(llm).length ? llm : undefined;
}

type Store = MdAssistLlmUiState & Actions;

type PersistedSlice = Pick<Store, keyof MdAssistLlmUiState>;

function stripLegacyApiKeyFromPersisted(raw: unknown): unknown {
  if (!raw || typeof raw !== "object") return raw;
  const o = raw as { state?: Record<string, unknown> };
  if (o.state && typeof o.state === "object" && "api_key" in o.state) {
    const { api_key: _removed, ...rest } = o.state;
    return { ...o, state: rest };
  }
  return raw;
}

export const useMdAssistLlmStore = create<Store>()(
  persist(
    (set, get) => ({
      ...defaults,
      setAll: (p) => set((s) => ({ ...s, ...p })),
      reset: () => set(defaults),
      buildLlmPayload: () => buildLlmPayloadFromState(get()),
    }),
    {
      name: "learning-map-md-assist-llm",
      version: 2,
      migrate: (persisted) => stripLegacyApiKeyFromPersisted(persisted) as PersistedSlice,
      merge: (persistedState, currentState) => {
        const wrap = persistedState as { state?: Record<string, unknown> } | undefined;
        const raw = wrap?.state;
        if (!raw || typeof raw !== "object") return currentState as Store;
        const { api_key: _drop, ...rest } = raw;
        void _drop;
        return { ...(currentState as Store), ...(rest as Partial<MdAssistLlmUiState>) };
      },
      partialize: (s): PersistedSlice => ({
        model: s.model,
        model_provider: s.model_provider,
        base_url: s.base_url,
        temperatureStr: s.temperatureStr,
        stream: s.stream,
        model_kwargs_extra: s.model_kwargs_extra,
      }),
    }
  )
);
