import React, { useEffect, useRef } from "react";

// MathLive provides a <math-field> web component loaded from index.html
type MathfieldElement = HTMLElement & {
  value: string;
  getValue: (format?: string) => string;
  setValue: (latex: string) => void;
  executeCommand?: (cmd: string) => void;
};

export default function EquationEditor(props: {
  latex: string;
  onChange: (next: { latex: string; ascii: string }) => void;
  placeholder?: string;
}) {
  const ref = useRef<MathfieldElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // initial value
    if (props.latex && el.value !== props.latex) {
      el.setValue(props.latex);
    }

    const handler = () => {
      const latex = el.getValue("latex-expanded") || el.value || "";
      // ascii-math is more evaluatable by math.js than raw latex
      const ascii = el.getValue("ascii-math") || "";
      props.onChange({ latex, ascii });
    };

    el.addEventListener("input", handler);
    return () => el.removeEventListener("input", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // keep in sync (external set)
    if (props.latex && el.getValue("latex-expanded") !== props.latex) {
      el.setValue(props.latex);
    }
  }, [props.latex]);

  return (
    <div>
      {/* @ts-expect-error: web component */}
      <math-field
        ref={ref as any}
        style={{
          width: "100%",
          minHeight: 52,
          padding: "10px 12px",
          borderRadius: 12,
          border: "1px solid rgba(255,255,255,0.10)",
          background: "rgba(0,0,0,0.22)",
          color: "white",
        }}
        placeholder={props.placeholder ?? "Type an equation…"}
      />
      <div className="small" style={{ marginTop: 8 }}>
        Tip: You can type <span className="mono">sum</span>, <span className="mono">sqrt</span>, <span className="mono">pi</span>, subscripts, fractions, etc.
      </div>
    </div>
  );
}
