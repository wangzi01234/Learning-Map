/** 去掉围栏代码块，避免其中的 # 被误认为标题 */
function stripFencedCode(md: string): string {
  return md.replace(/```[\s\S]*?```/g, "");
}

export interface TocItem {
  level: number;
  text: string;
  id: string;
}

function slugifyHeading(text: string, used: Map<string, number>): string {
  let base = text
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^\w\u4e00-\u9fff-]/g, "");
  if (!base) base = "section";
  const n = (used.get(base) ?? 0) + 1;
  used.set(base, n);
  return n === 1 ? base : `${base}-${n}`;
}

export function extractToc(markdown: string): TocItem[] {
  const body = stripFencedCode(markdown);
  const lines = body.split(/\r?\n/);
  const used = new Map<string, number>();
  const items: TocItem[] = [];
  for (const line of lines) {
    const m = /^(#{1,6})\s+(.+)$/.exec(line.trimEnd());
    if (!m) continue;
    const level = m[1]!.length;
    const text = m[2]!.trim();
    if (!text) continue;
    const id = slugifyHeading(text, used);
    items.push({ level, text, id });
  }
  return items;
}
