import { useEffect, useRef, useState } from "react";
import G6 from "@antv/g6";
import { useShallow } from "zustand/react/shallow";
import { useAppStore } from "@/store/useAppStore";
import { getG6Theme, type G6VisualTheme } from "@/theme/g6Theme";
import { useUiThemeStore } from "@/theme/uiThemeStore";
import "./KnowledgeGraph.css";

/** 按字符数换行，避免长中文在窄节点内溢出 */
const MAX_LABEL_CHARS_PER_LINE = 11;
const LABEL_FONT_SIZE = 12;
const LABEL_LINE_HEIGHT = 18;
const NODE_PAD_X = 20;
const NODE_PAD_Y = 14;

function wrapLabelByChars(text: string, maxPerLine: number): string {
  const s = text.trim();
  if (!s) return "";
  const lines: string[] = [];
  for (let i = 0; i < s.length; i += maxPerLine) {
    lines.push(s.slice(i, i + maxPerLine));
  }
  return lines.join("\n");
}

function estimateRectSize(wrappedLabel: string): [number, number] {
  const lines = wrappedLabel.split("\n");
  const lineCount = Math.max(lines.length, 1);
  const longest = Math.max(...lines.map((l) => l.length), 1);
  const charW = LABEL_FONT_SIZE * 0.92;
  const width = Math.min(240, Math.max(148, Math.round(longest * charW + NODE_PAD_X * 2)));
  const height = Math.max(48, NODE_PAD_Y * 2 + lineCount * LABEL_LINE_HEIGHT);
  return [width, height];
}

function buildGraphData(
  nodes: { id: string; name: string; description: string }[],
  edges: { id: string; source: string; target: string; relation: string; label?: string }[],
  g6: G6VisualTheme
) {
  const g6Nodes = nodes.map((n, i) => {
    const wrapped = wrapLabelByChars(n.name, MAX_LABEL_CHARS_PER_LINE);
    const size = estimateRectSize(wrapped);
    return {
      id: n.id,
      label: wrapped,
      description: n.description,
      size,
      style: {
        fill: g6.fills[i % g6.fills.length],
        stroke: g6.stroke,
        lineWidth: 2,
        radius: 12,
        shadowColor: "rgba(0, 0, 0, 0.18)",
        shadowBlur: 6,
        shadowOffsetX: 2,
        shadowOffsetY: 3,
      },
      labelCfg: {
        position: "center",
        style: {
          fontFamily: g6.labelFontFamily,
          fontSize: LABEL_FONT_SIZE,
          lineHeight: LABEL_LINE_HEIGHT,
          fill: g6.label,
          fontWeight: 600,
          textAlign: "center",
          textBaseline: "middle",
        },
      },
    };
  });

  const g6Edges = edges.map((e) => ({
    id: e.id,
    source: e.source,
    target: e.target,
    label: e.label || e.relation,
    style: {
      stroke: g6.edge,
      lineWidth: 2,
      opacity: 0.88,
      lineDash: [6, 4],
      endArrow: {
        path: G6.Arrow.triangle(10, 12, 0),
        fill: g6.edge,
        d: 0,
      },
    },
    labelCfg: {
      autoRotate: true,
      refY: 0,
      style: {
        fill: g6.edgeLabel,
        fontSize: 11,
        fontFamily: '"Nunito", sans-serif',
        background: {
          fill: g6.edgeLabelBg,
          stroke: g6.edgeLabelStroke,
          padding: [2, 4, 2, 4],
          radius: 4,
        },
      },
    },
  }));

  return { nodes: g6Nodes, edges: g6Edges };
}

export function KnowledgeGraph() {
  const containerRef = useRef<HTMLDivElement>(null);
  const graphRef = useRef<InstanceType<typeof G6.Graph> | null>(null);
  const uiTheme = useUiThemeStore((s) => s.uiTheme);
  const { nodes, edges, setSelectedNodeId } = useAppStore(
    useShallow((s) => ({
      nodes: s.nodes,
      edges: s.edges,
      setSelectedNodeId: s.setSelectedNodeId,
    }))
  );

  const [tip, setTip] = useState<{
    x: number;
    y: number;
    title: string;
    desc: string;
  } | null>(null);

  /** 主题变化时重建图实例（选中态样式随主题变） */
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const g6t = getG6Theme(uiTheme);

    graphRef.current?.destroy();
    graphRef.current = null;

    const getSize = () => ({
      w: Math.max(1, el.clientWidth),
      h: Math.max(80, el.clientHeight),
    });

    const bindGraphEvents = (graph: InstanceType<typeof G6.Graph>) => {
      graph.on("node:click", (ev) => {
        const item = ev.item;
        if (!item) return;
        const model = item.getModel() as { id?: string };
        if (model.id) setSelectedNodeId(model.id);
      });

      graph.on("node:mouseenter", (ev) => {
        const item = ev.item;
        if (!item) return;
        const model = item.getModel() as { label?: string; description?: string };
        const oe = ev.originalEvent as MouseEvent;
        setTip({
          x: oe.clientX + 12,
          y: oe.clientY + 8,
          title: String(model.label ?? ""),
          desc: String(model.description ?? ""),
        });
      });

      graph.on("node:mouseleave", () => setTip(null));
      graph.on("canvas:click", () => setTip(null));
    };

    const { w, h } = getSize();
    const graph = new G6.Graph({
      container: el,
      width: w || 200,
      height: h || 200,
      fitView: true,
      fitViewPadding: [20, 20, 20, 20],
      animate: true,
      groupByTypes: false,
      modes: {
        default: ["drag-canvas", "zoom-canvas", "drag-node", "click-select"],
      },
      layout: {
        type: "dagre",
        rankdir: "TB",
        nodesep: 40,
        ranksep: 64,
        controlPoints: true,
      },
      defaultNode: {
        type: "rect",
        size: [168, 52],
        anchorPoints: [
          [0.5, 0],
          [0.5, 1],
          [0, 0.5],
          [1, 0.5],
        ],
      },
      defaultEdge: {
        type: "cubic-vertical",
        style: {
          lineAppendWidth: 12,
        },
      },
      nodeStateStyles: {
        selected: {
          stroke: g6t.selectedStroke,
          lineWidth: 3,
          shadowColor: g6t.selectedShadow,
        },
      },
    });

    bindGraphEvents(graph);
    graphRef.current = graph;

    const s = useAppStore.getState();
    graph.data(buildGraphData(s.nodes, s.edges, g6t) as never);
    graph.render();

    const syncSize = () => {
      const { w: cw, h: ch } = getSize();
      graph.changeSize(cw, ch);
      graph.fitView(24);
    };

    const ro = new ResizeObserver(() => {
      syncSize();
    });
    ro.observe(el);

    return () => {
      ro.disconnect();
      graph.destroy();
      graphRef.current = null;
    };
  }, [uiTheme, setSelectedNodeId]);

  useEffect(() => {
    const graph = graphRef.current;
    if (!graph) return;
    const g6t = getG6Theme(uiTheme);
    graph.data(buildGraphData(nodes, edges, g6t) as never);
    graph.render();
    const el = containerRef.current;
    if (!el) return;
    const w = Math.max(1, el.clientWidth);
    const h = Math.max(80, el.clientHeight);
    graph.changeSize(w, h);
    graph.fitView(24);
  }, [nodes, edges, uiTheme]);

  return (
    <div className="kg-wrap">
      <div ref={containerRef} className="kg-canvas" />
      {tip && (
        <div
          className="kg-tooltip"
          style={{ left: tip.x, top: tip.y }}
          role="tooltip"
        >
          <div className="kg-tooltip-title">{tip.title}</div>
          <div className="kg-tooltip-desc">{tip.desc}</div>
        </div>
      )}
    </div>
  );
}
