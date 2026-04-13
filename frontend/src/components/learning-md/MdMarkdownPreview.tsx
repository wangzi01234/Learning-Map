import { useMemo, useRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import type { Components } from "react-markdown";
import type { TocItem } from "@/utils/mdToc";
import "katex/dist/katex.min.css";
import "./MdMarkdownPreview.css";

interface Props {
  markdown: string;
  tocItems: TocItem[];
}

export function MdMarkdownPreview({ markdown, tocItems }: Props) {
  const idxRef = useRef(0);

  const components: Components = useMemo(() => {
    const heading =
      (Tag: "h1" | "h2" | "h3" | "h4" | "h5" | "h6") =>
      (props: React.HTMLAttributes<HTMLHeadingElement>) => {
        const { children, ...rest } = props;
        const i = idxRef.current;
        const id = tocItems[i]?.id ?? `heading-${i}`;
        idxRef.current += 1;
        return (
          <Tag id={id} {...rest}>
            {children}
          </Tag>
        );
      };

    return {
      h1: heading("h1"),
      h2: heading("h2"),
      h3: heading("h3"),
      h4: heading("h4"),
      h5: heading("h5"),
      h6: heading("h6"),
    };
  }, [tocItems]);

  idxRef.current = 0;

  return (
    <div className="mdmp-root">
      <div className="mdmp-md">
        <ReactMarkdown
          remarkPlugins={[remarkGfm, remarkMath]}
          rehypePlugins={[rehypeKatex]}
          components={components}
        >
          {markdown || "_（空文档）_"}
        </ReactMarkdown>
      </div>
    </div>
  );
}
