"use client";

import { useRef, useCallback, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { Loader2, AlertCircle } from "lucide-react";
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
  const [editorError, setEditorError] = useState<string | null>(null);
  const disposablesRef = useRef<Array<{ dispose: () => void }>>([]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      try {
        // Dispose all subscriptions
        disposablesRef.current.forEach((d) => {
          try {
            d.dispose();
          } catch {
            // Ignore disposal errors
          }
        });
        disposablesRef.current = [];

        // Clear editor reference
        if (editorRef.current) {
          editorRef.current = null;
        }
      } catch {
        // Ignore cleanup errors
      }
    };
  }, []);

  const handleEditorMount = useCallback(
    (editor: editor.IStandaloneCodeEditor) => {
      try {
        editorRef.current = editor;
        setEditorError(null);

        // Detect paste events
        const pasteDisposable = editor.onDidPaste((e) => {
          try {
            if (onPasteDetected && editorRef.current) {
              const pastedLines = e.range.endLineNumber - e.range.startLineNumber + 1;
              const model = editor.getModel();
              const pastedText = model?.getValueInRange(e.range) || "";
              onPasteDetected({
                type: "code_paste",
                lines: pastedLines,
                chars: pastedText.length,
                timestamp: new Date().toISOString(),
              });
            }
          } catch {
            // Ignore paste detection errors
          }
        });
        disposablesRef.current.push(pasteDisposable);

        // Detect copy events via DOM event listener
        const domNode = editor.getDomNode();
        if (domNode && onCopyDetected) {
          const copyHandler = () => {
            try {
              if (!editorRef.current) return;
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
            } catch {
              // Ignore copy detection errors
            }
          };
          domNode.addEventListener("copy", copyHandler);
          // Track for cleanup
          disposablesRef.current.push({
            dispose: () => domNode.removeEventListener("copy", copyHandler),
          });
        }
      } catch (error) {
        console.error("Editor mount error:", error);
        setEditorError("Failed to initialize code editor");
      }
    },
    [onCopyDetected, onPasteDetected]
  );

  const handleEditorChange = useCallback(
    (val: string | undefined) => {
      try {
        onChange(val || "");
      } catch {
        // Ignore change errors (e.g., "Cancelled")
      }
    },
    [onChange]
  );

  if (editorError) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-muted rounded-lg p-4 gap-2">
        <AlertCircle className="w-6 h-6 text-destructive" />
        <p className="text-sm text-muted-foreground">{editorError}</p>
      </div>
    );
  }

  return (
    <div className="border rounded-lg overflow-hidden">
      <MonacoEditor
        height={height}
        language={language}
        value={value}
        onChange={handleEditorChange}
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
