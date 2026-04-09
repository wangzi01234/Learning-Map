import { create } from "zustand";
import { getMdDoc, getMdFiles, putMdDoc, type MdFileItem } from "@/api/client";

interface LearningMdState {
  files: MdFileItem[];
  currentPath: string | null;
  draft: string;
  loadedFingerprint: string;
  dirty: boolean;
  loadingList: boolean;
  loadingDoc: boolean;
  saving: boolean;
  listError: string | null;
  docError: string | null;

  refreshFileList: () => Promise<void>;
  openPath: (path: string) => Promise<void>;
  setDraft: (s: string) => void;
  reloadDoc: () => Promise<void>;
  saveDoc: () => Promise<void>;
  /** 在根目录下新建 .md 并切换为当前文档（已写入默认标题） */
  createNewDoc: () => Promise<void>;
  reset: () => void;
}

const empty = () => ({
  files: [] as MdFileItem[],
  currentPath: null as string | null,
  draft: "",
  loadedFingerprint: "",
  dirty: false,
  loadingList: false,
  loadingDoc: false,
  saving: false,
  listError: null as string | null,
  docError: null as string | null,
});

export const useLearningMdStore = create<LearningMdState>((set, get) => ({
  ...empty(),

  reset: () => set(empty()),

  refreshFileList: async () => {
    set({ loadingList: true, listError: null });
    try {
      const files = await getMdFiles();
      set({ files, loadingList: false });
      const cur = get().currentPath;
      const pick = files[0]?.path;
      if (pick && (!cur || !files.some((f) => f.path === cur))) {
        await get().openPath(pick);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      set({ files: [], loadingList: false, listError: msg });
    }
  },

  openPath: async (path: string) => {
    if (path === get().currentPath) {
      return;
    }
    set({ loadingDoc: true, docError: null });
    try {
      const doc = await getMdDoc(path);
      set({
        currentPath: doc.path,
        draft: doc.content,
        loadedFingerprint: doc.content,
        dirty: false,
        loadingDoc: false,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      set({ loadingDoc: false, docError: msg });
    }
  },

  setDraft: (s: string) => {
    const fp = get().loadedFingerprint;
    set({ draft: s, dirty: s !== fp });
  },

  reloadDoc: async () => {
    const path = get().currentPath;
    if (!path) return;
    set({ loadingDoc: true, docError: null });
    try {
      const doc = await getMdDoc(path);
      set({
        draft: doc.content,
        loadedFingerprint: doc.content,
        dirty: false,
        loadingDoc: false,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      set({ loadingDoc: false, docError: msg });
      throw new Error(msg);
    }
  },

  saveDoc: async () => {
    const path = get().currentPath;
    if (!path) return;
    set({ saving: true, docError: null });
    try {
      const doc = await putMdDoc(path, get().draft);
      set({
        loadedFingerprint: doc.content,
        draft: doc.content,
        dirty: false,
        saving: false,
      });
      await get().refreshFileList();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      set({ saving: false, docError: msg });
      throw e instanceof Error ? e : new Error(msg);
    }
  },

  createNewDoc: async () => {
    const path = `新文档-${Date.now()}.md`;
    const content = "# 新文档\n\n";
    set({ saving: true, docError: null });
    try {
      const doc = await putMdDoc(path, content);
      set({
        currentPath: doc.path,
        draft: doc.content,
        loadedFingerprint: doc.content,
        dirty: false,
        saving: false,
      });
      await get().refreshFileList();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      set({ saving: false, docError: msg });
      throw e instanceof Error ? e : new Error(msg);
    }
  },
}));
