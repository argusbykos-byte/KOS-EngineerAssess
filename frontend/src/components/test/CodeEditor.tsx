"use client";

import { useRef, useCallback } from "react";
import dynamic from "next/dynamic";
import { Loader2 } from "lucide-react";
import type { editor } from "monaco-editor";

const MonacoEditor = dynamic(
  () => import("@monaco-editor/react").then((mod) => mod.default),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center h-full bg-muted rounded-lg">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    ),
  }
);

export interface CopyPasteEvent {
  type: "code_copy" | "code_paste";
  chars?: number;
  lines?: number;
  timestamp: string;
}

interface CodeEditorProps {
  value: string;
  onChange: (value: string) => void;
  language?: string;
  readOnly?: boolean;
  height?: string;
  onCopyDetected?: (event: CopyPasteEvent) => void;
  onPasteDetected?: (event: CopyPasteEvent) => void;
}

export function CodeEditor({
  value,
  onChange,
  language = "javascript",
  readOnly = false,
  height = "300px",
  onCopyDetected,
  onPasteDetected,
}: CodeEditorProps) {
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);

  const handleEditorMount = useCallback(
    (editor: editor.IStandaloneCodeEditor) => {
      editorRef.current = editor;

      // Detect paste events
      editor.onDidPaste((e) => {
        if (onPasteDetected) {
          const pastedLines = e.range.endLineNumber - e.range.startLineNumber + 1;
          // Estimate character count from the pasted range
          const model = editor.getModel();
          const pastedText = model?.getValueInRange(e.range) || "";
          onPasteDetected({
            type: "code_paste",
            lines: pastedLines,
            chars: pastedText.length,
            timestamp: new Date().toISOString(),
          });
        }
      });

      // Detect copy events via DOM event listener
      const domNode = editor.getDomNode();
      if (domNode && onCopyDetected) {
        domNode.addEventListener("copy", () => {
          const selection = editor.getSelection();
          if (selection) {
            const model = editor.getModel();
            const selectedText = model?.getValueInRange(selection) || "";
            if (selectedText.length > 0) {
              onCopyDetected({
                type: "code_copy",
                chars: selectedText.length,
                timestamp: new Date().toISOString(),
              });
            }
          }
        });
      }
    },
    [onCopyDetected, onPasteDetected]
  );

  return (
    <div className="border rounded-lg overflow-hidden">
      <MonacoEditor
        height={height}
        language={language}
        value={value}
        onChange={(val) => onChange(val || "")}
        onMount={handleEditorMount}
        theme="vs-dark"
        options={{
          readOnly,
          minimap: { enabled: false },
          fontSize: 14,
          lineNumbers: "on",
          scrollBeyondLastLine: false,
          wordWrap: "on",
          automaticLayout: true,
          tabSize: 2,
          padding: { top: 16, bottom: 16 },
        }}
      />
    </div>
  );
}
