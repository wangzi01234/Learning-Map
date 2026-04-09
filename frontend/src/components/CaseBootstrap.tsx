import { useEffect, useRef } from "react";
import { getLearningCaseDetail } from "@/api/client";
import { useAppStore } from "@/store/useAppStore";

/**
 * 本地无缓存时，从后端拉取当前案例的初始图谱（含内置示例案例等）。
 */
export function CaseBootstrap() {
  const done = useRef(false);

  useEffect(() => {
    let cancelled = false;
    const run = () => {
      if (done.current) return;
      void (async () => {
        const { nodes, edges, currentCaseSlug, applyCaseInitial } = useAppStore.getState();
        if (nodes.length > 0 || edges.length > 0) {
          done.current = true;
          return;
        }
        try {
          const d = await getLearningCaseDetail(currentCaseSlug);
          if (cancelled) return;
          applyCaseInitial(d.initial_nodes, d.initial_edges);
        } catch {
          /* 后端或 PostgreSQL 未就绪时保持空图 */
        } finally {
          if (!cancelled) done.current = true;
        }
      })();
    };

    if (useAppStore.persist.hasHydrated()) {
      run();
      return () => {
        cancelled = true;
      };
    }
    const unsub = useAppStore.persist.onFinishHydration(run);
    return () => {
      cancelled = true;
      unsub();
    };
  }, []);

  return null;
}
