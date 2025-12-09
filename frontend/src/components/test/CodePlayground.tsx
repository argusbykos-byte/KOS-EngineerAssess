"use client";

import { useState, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { CodeEditor } from "./CodeEditor";
import { codeApi } from "@/lib/api";
import {
  Play,
  Loader2,
  Terminal,
  CheckCircle,
  XCircle,
  Clock,
  ChevronDown,
  ChevronUp,
  Database,
  Info,
  Copy,
  Check,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface CodePlaygroundProps {
  initialCode?: string;
  onChange?: (code: string) => void;
  height?: string;
  language?: string;
  showSampleData?: boolean;
}

interface SampleDataInfo {
  description: string;
  variables: string[];
}

export function CodePlayground({
  initialCode = "",
  onChange,
  height = "250px",
  language = "python",
  showSampleData = true,
}: CodePlaygroundProps) {
  const [code, setCode] = useState(initialCode);
  const [output, setOutput] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [executionTime, setExecutionTime] = useState<number | null>(null);
  const [success, setSuccess] = useState<boolean | null>(null);
  const [showOutput, setShowOutput] = useState(false);

  // Sample data state
  const [samples, setSamples] = useState<Record<string, SampleDataInfo>>({});
  const [selectedSample, setSelectedSample] = useState<string>("");
  const [showSampleInfo, setShowSampleInfo] = useState(false);
  const [sampleData, setSampleData] = useState<Record<string, unknown> | null>(null);
  const [copied, setCopied] = useState(false);

  // Fetch available samples
  useEffect(() => {
    if (showSampleData) {
      codeApi.listSamples().then((response) => {
        setSamples(response.data.samples);
      }).catch(console.error);
    }
  }, [showSampleData]);

  // Fetch sample data details when selection changes
  useEffect(() => {
    if (selectedSample) {
      codeApi.getSample(selectedSample).then((response) => {
        setSampleData(response.data.data);
      }).catch(console.error);
    } else {
      setSampleData(null);
    }
  }, [selectedSample]);

  const handleCodeChange = useCallback((newCode: string) => {
    setCode(newCode);
    onChange?.(newCode);
  }, [onChange]);

  const runCode = async () => {
    if (!code.trim()) {
      setError("Please enter some code to run");
      setSuccess(false);
      setShowOutput(true);
      return;
    }

    setIsRunning(true);
    setOutput("");
    setError(null);
    setSuccess(null);
    setShowOutput(true);

    try {
      const response = await codeApi.execute({
        code,
        sample_data_key: selectedSample || undefined,
      });

      setSuccess(response.data.success);
      setOutput(response.data.output);
      setError(response.data.error);
      setExecutionTime(response.data.execution_time_ms);
    } catch (err) {
      setSuccess(false);
      setError("Failed to execute code. Please try again.");
      console.error("Code execution error:", err);
    } finally {
      setIsRunning(false);
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  // Generate sample usage code
  const getSampleUsageCode = () => {
    if (!selectedSample || !sampleData) return "";

    const variables = Object.keys(sampleData).filter(k => k !== "description");
    return `# Available variables when using "${selectedSample}" sample data:\n${variables.map(v => `# - ${v}`).join("\n")}\n\n# Example:\nprint(${variables[0]})\n`;
  };

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <Button
            onClick={runCode}
            disabled={isRunning}
            size="sm"
            className="bg-green-600 hover:bg-green-700"
          >
            {isRunning ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Running...
              </>
            ) : (
              <>
                <Play className="w-4 h-4 mr-2" />
                Run Code
              </>
            )}
          </Button>

          {showSampleData && Object.keys(samples).length > 0 && (
            <div className="flex items-center gap-2">
              <Database className="w-4 h-4 text-muted-foreground" />
              <Select value={selectedSample} onValueChange={setSelectedSample}>
                <SelectTrigger className="w-[180px] h-8 text-sm">
                  <SelectValue placeholder="Load sample data..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">No sample data</SelectItem>
                  {Object.entries(samples).map(([key, info]) => (
                    <SelectItem key={key} value={key}>
                      {key.replace(/_/g, " ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {selectedSample && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowSampleInfo(!showSampleInfo)}
                  className="h-8 px-2"
                >
                  <Info className="w-4 h-4" />
                </Button>
              )}
            </div>
          )}
        </div>

        {executionTime !== null && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="w-3 h-3" />
            {executionTime.toFixed(2)}ms
          </div>
        )}
      </div>

      {/* Sample Data Info */}
      {showSampleInfo && selectedSample && sampleData && (
        <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20 text-sm">
          <div className="flex items-start justify-between">
            <div>
              <p className="font-medium text-blue-400 mb-1">
                {selectedSample.replace(/_/g, " ")}
              </p>
              <p className="text-muted-foreground text-xs mb-2">
                {samples[selectedSample]?.description}
              </p>
              <p className="text-xs text-muted-foreground">
                <strong>Available variables:</strong>{" "}
                {samples[selectedSample]?.variables.join(", ")}
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => copyToClipboard(getSampleUsageCode())}
              className="h-7 px-2"
            >
              {copied ? (
                <Check className="w-3 h-3 text-green-500" />
              ) : (
                <Copy className="w-3 h-3" />
              )}
            </Button>
          </div>
          <pre className="mt-2 p-2 rounded bg-background/50 text-xs overflow-x-auto">
            {getSampleUsageCode()}
          </pre>
        </div>
      )}

      {/* Code Editor */}
      <CodeEditor
        value={code}
        onChange={handleCodeChange}
        language={language}
        height={height}
      />

      {/* Output Panel */}
      <Collapsible open={showOutput} onOpenChange={setShowOutput}>
        <CollapsibleTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              "w-full justify-between h-8",
              showOutput && "rounded-b-none"
            )}
          >
            <div className="flex items-center gap-2">
              <Terminal className="w-4 h-4" />
              <span>Output</span>
              {success !== null && (
                success ? (
                  <CheckCircle className="w-4 h-4 text-green-500" />
                ) : (
                  <XCircle className="w-4 h-4 text-red-500" />
                )
              )}
            </div>
            {showOutput ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div
            className={cn(
              "border rounded-b-lg p-3 font-mono text-sm max-h-[300px] overflow-auto",
              error ? "bg-red-500/10 border-red-500/20" : "bg-muted"
            )}
          >
            {isRunning ? (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" />
                Executing code...
              </div>
            ) : error ? (
              <pre className="text-red-400 whitespace-pre-wrap">{error}</pre>
            ) : output ? (
              <pre className="whitespace-pre-wrap">{output}</pre>
            ) : (
              <span className="text-muted-foreground">
                Click &quot;Run Code&quot; to see output
              </span>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
