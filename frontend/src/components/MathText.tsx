import React, { useMemo } from "react";
import katex from "katex";

interface MathTextProps {
  text: string | null | undefined;
  className?: string;
  style?: React.CSSProperties;
}

export const MathText: React.FC<MathTextProps> = ({ text, className, style }) => {
  const renderedContent = useMemo(() => {
    if (!text) return "";

    // Match LaTeX delimiters: \[...\], \(...\), $$...$$, or $...$
    const regex = /(\\\[[\s\S]*?\\\]|\\\([\s\S]*?\\\)|\\\$[\s\S]*?\\\$|\$\$[\s\S]*?\$\$|\$[^$\n]+?\$)/g;

    const parts = text.split(regex);

    return parts.map((part, index) => {
      if (!part) return null;

      let isBlock = false;
      let math: string | null = null;

      if (part.startsWith("\\[") && part.endsWith("\\]")) {
        isBlock = true;
        math = part.slice(2, -2);
      } else if (part.startsWith("$$") && part.endsWith("$$")) {
        isBlock = true;
        math = part.slice(2, -2);
      } else if (part.startsWith("\\(") && part.endsWith("\\)")) {
        isBlock = false;
        math = part.slice(2, -2);
      } else if (part.startsWith("$") && part.endsWith("$") && part.length > 2) {
        isBlock = false;
        math = part.slice(1, -1);
      }

      if (math !== null) {
        try {
          const html = katex.renderToString(math.trim(), {
            displayMode: isBlock,
            throwOnError: false,
          });
          return (
            <span
              key={index}
              dangerouslySetInnerHTML={{ __html: html }}
              style={isBlock ? { display: "block", margin: "0.5em 0" } : { display: "inline-block" }}
            />
          );
        } catch {
          return <span key={index}>{part}</span>;
        }
      }

      return <span key={index}>{part}</span>;
    });
  }, [text]);

  return (
    <span className={className} style={style}>
      {renderedContent}
    </span>
  );
};
