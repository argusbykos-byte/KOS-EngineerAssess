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

// Helper to check if error is a Monaco "Canceled" error
function isMonacoCanceledError(error: unknown): boolean {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    return message.includes("canceled") || message.includes("cancelled");
  }
  if (typeof error === "string") {
    const message = error.toLowerCase();
    return message.includes("canceled") || message.includes("cancelled");
  }
  return false;
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
  const isMountedRef = useRef(true);

  // Track mounted state and set up global error suppression
  useEffect(() => {
    isMountedRef.current = true;

    // Global handler to suppress Monaco "Canceled" errors from bubbling to console
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      if (isMonacoCanceledError(event.reason)) {
        event.preventDefault();
      }
    };

    const handleError = (event: ErrorEvent) => {
      if (isMonacoCanceledError(event.error) || isMonacoCanceledError(event.message)) {
        event.preventDefault();
      }
    };

    window.addEventListener("unhandledrejection", handleUnhandledRejection);
    window.addEventListener("error", handleError);

    return () => {
      isMountedRef.current = false;
      window.removeEventListener("unhandledrejection", handleUnhandledRejection);
      window.removeEventListener("error", handleError);
    };
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      try {
        // Mark as not mounted first
        isMountedRef.current = false;

        // Dispose all subscriptions
        disposablesRef.current.forEach((d) => {
          try {
            d.dispose();
          } catch (err) {
            // Suppress Monaco "Canceled" errors during cleanup
            if (!isMonacoCanceledError(err)) {
              console.warn("Disposable cleanup error:", err);
            }
          }
        });
        disposablesRef.current = [];

        // Dispose the editor instance properly
        if (editorRef.current) {
          try {
            editorRef.current.dispose();
          } catch (err) {
            // Suppress Monaco "Canceled" errors during disposal
            if (!isMonacoCanceledError(err)) {
              console.warn("Editor dispose error:", err);
            }
          }
          editorRef.current = null;
        }
      } catch (err) {
        // Suppress Monaco "Canceled" errors
        if (!isMonacoCanceledError(err)) {
          console.warn("Cleanup error:", err);
        }
      }
    };
  }, []);

  const handleEditorMount = useCallback(
    (editor: editor.IStandaloneCodeEditor) => {
      // Don't set up if already unmounted
      if (!isMountedRef.current) {
        try {
          editor.dispose();
        } catch {
          // Ignore disposal errors
        }
        return;
      }

      try {
        editorRef.current = editor;
        setEditorError(null);

        // Detect paste events
        const pasteDisposable = editor.onDidPaste((e) => {
          try {
            if (!isMountedRef.current || !editorRef.current) return;
            if (onPasteDetected) {
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
          } catch (err) {
            // Suppress Monaco "Canceled" errors
            if (!isMonacoCanceledError(err)) {
              console.warn("Paste detection error:", err);
            }
          }
        });
        disposablesRef.current.push(pasteDisposable);

        // Detect copy events via DOM event listener
        const domNode = editor.getDomNode();
        if (domNode && onCopyDetected) {
          const copyHandler = () => {
            try {
              if (!isMountedRef.current || !editorRef.current) return;
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
            } catch (err) {
              // Suppress Monaco "Canceled" errors
              if (!isMonacoCanceledError(err)) {
                console.warn("Copy detection error:", err);
              }
            }
          };
          domNode.addEventListener("copy", copyHandler);
          // Track for cleanup
          disposablesRef.current.push({
            dispose: () => domNode.removeEventListener("copy", copyHandler),
          });
        }
      } catch (error) {
        // Suppress Monaco "Canceled" errors
        if (isMonacoCanceledError(error)) {
          return;
        }
        console.error("Editor mount error:", error);
        if (isMountedRef.current) {
          setEditorError("Failed to initialize code editor");
        }
      }
    },
    [onCopyDetected, onPasteDetected]
  );

  const handleEditorChange = useCallback(
    (val: string | undefined) => {
      // Skip if unmounted
      if (!isMountedRef.current) return;

      try {
        onChange(val || "");
      } catch (err) {
        // Suppress Monaco "Canceled" errors
        if (!isMonacoCanceledError(err)) {
          console.warn("Editor change error:", err);
        }
      }
    },
    [onChange]
  );

  // Handle Monaco beforeMount to configure environment
  const handleBeforeMount = useCallback((monaco: typeof import("monaco-editor")) => {
    // Suppress Monaco's internal canceled errors
    try {
      monaco.editor.onDidCreateEditor(() => {
        // Editor created
      });
    } catch {
      // Ignore configuration errors
    }
  }, []);

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
        beforeMount={handleBeforeMount}
        theme="vs-dark"
        keepCurrentModel={true}
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
          // Additional stability options
          renderValidationDecorations: "off",
          quickSuggestions: false,
          suggestOnTriggerCharacters: false,
          parameterHints: { enabled: false },
          folding: false,
        }}
      />
    </div>
  );
}
