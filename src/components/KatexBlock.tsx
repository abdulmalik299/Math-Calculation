import React, { useMemo } from "react";
import katex from "katex";

export default function KatexBlock({ latex }: { latex: string }) {
  const html = useMemo(() => {
    try {
      return katex.renderToString(latex || "\\text{ }", {
        throwOnError: false,
        displayMode: true,
      });
    } catch (e) {
      return katex.renderToString("\\text{Invalid LaTeX}", { throwOnError: false, displayMode: true });
    }
  }, [latex]);

  return <div className="katex-wrap" dangerouslySetInnerHTML={{ __html: html }} />;
}
