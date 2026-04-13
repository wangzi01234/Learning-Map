import { create } from "zustand";

/**
 * LLM api_key 仅会话内存：不 persist，关闭标签页即丢失。
 */
interface SessionState {
  apiKey: string;
  setApiKey: (v: string) => void;
}

export const useMdAssistLlmApiKeySessionStore = create<SessionState>((set) => ({
  apiKey: "",
  setApiKey: (apiKey) => set({ apiKey }),
}));
