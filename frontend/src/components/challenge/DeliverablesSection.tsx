"use client";

import { useState, useRef } from "react";
import { Deliverable } from "@/types";
import { challengesApi } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  FileText,
  Upload,
  Trash2,
  Loader2,
  CheckCircle,
  Code,
  FileCode,
  File,
} from "lucide-react";

interface DeliverablesSectionProps {
  testId: number;
  deliverableSpecs: string[];
  existingDeliverables: Deliverable[];
  onDeliverableChanged: () => void;
}

interface DeliverableInputState {
  type: string;
  title: string;
  content: string;
  file: File | null;
  isUploading: boolean;
  isSaving: boolean;
}

function getDeliverableIcon(type: string) {
  switch (type) {
    case "code":
      return Code;
    case "readme":
      return FileCode;
    case "report":
      return FileText;
    default:
      return File;
  }
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function DeliverablesSection({
  testId,
  deliverableSpecs,
  existingDeliverables,
  onDeliverableChanged,
}: DeliverablesSectionProps) {
  const [inputs, setInputs] = useState<Record<string, DeliverableInputState>>(() => {
    const initial: Record<string, DeliverableInputState> = {};
    deliverableSpecs.forEach((spec, index) => {
      const type = `deliverable_${index}`;
      const existing = existingDeliverables.find(
        (d) => d.deliverable_type === type
      );
      initial[type] = {
        type,
        title: existing?.title || spec.split(" ")[0],
        content: existing?.inline_content || "",
        file: null,
        isUploading: false,
        isSaving: false,
      };
    });
    return initial;
  });

  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const handleTextSave = async (type: string) => {
    const input = inputs[type];
    if (!input.content.trim()) return;

    setInputs((prev) => ({
      ...prev,
      [type]: { ...prev[type], isSaving: true },
    }));

    try {
      await challengesApi.saveTextDeliverable(testId, {
        deliverable_type: type,
        title: input.title,
        inline_content: input.content,
      });
      onDeliverableChanged();
    } catch (error) {
      console.error("Error saving deliverable:", error);
    } finally {
      setInputs((prev) => ({
        ...prev,
        [type]: { ...prev[type], isSaving: false },
      }));
    }
  };

  const handleFileUpload = async (type: string, file: File) => {
    setInputs((prev) => ({
      ...prev,
      [type]: { ...prev[type], file, isUploading: true },
    }));

    try {
      await challengesApi.uploadDeliverable(
        testId,
        type,
        file,
        inputs[type].title
      );
      onDeliverableChanged();
    } catch (error) {
      console.error("Error uploading file:", error);
    } finally {
      setInputs((prev) => ({
        ...prev,
        [type]: { ...prev[type], isUploading: false },
      }));
    }
  };

  const handleFileSelect = (type: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileUpload(type, file);
    }
  };

  const handleDelete = async (deliverableId: number, type: string) => {
    try {
      await challengesApi.deleteDeliverable(deliverableId);
      setInputs((prev) => ({
        ...prev,
        [type]: { ...prev[type], content: "", file: null },
      }));
      onDeliverableChanged();
    } catch (error) {
      console.error("Error deleting deliverable:", error);
    }
  };

  return (
    <section className="space-y-4">
      <h3 className="text-lg font-semibold text-white flex items-center gap-2">
        <FileText className="w-5 h-5 text-amber-400" />
        Deliverables
      </h3>

      <div className="space-y-4">
        {deliverableSpecs.map((spec, index) => {
          const type = `deliverable_${index}`;
          const input = inputs[type];
          const existing = existingDeliverables.find(
            (d) => d.deliverable_type === type
          );
          const Icon = getDeliverableIcon(type);

          return (
            <Card key={type} className="bg-slate-800/50 border-slate-700">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2 text-white">
                  <Icon className="w-4 h-4 text-amber-400" />
                  Deliverable {index + 1}
                  {existing && (
                    <Badge variant="outline" className="border-green-500 text-green-500">
                      <CheckCircle className="w-3 h-3 mr-1" />
                      Uploaded
                    </Badge>
                  )}
                </CardTitle>
                <CardDescription className="text-slate-400">
                  {spec}
                </CardDescription>
              </CardHeader>

              <CardContent className="space-y-3">
                <Input
                  placeholder="Title (optional)"
                  value={input.title}
                  onChange={(e) =>
                    setInputs((prev) => ({
                      ...prev,
                      [type]: { ...prev[type], title: e.target.value },
                    }))
                  }
                  className="bg-slate-900/50 border-slate-700"
                />

                {existing?.file_name ? (
                  <div className="flex items-center justify-between p-3 rounded-lg bg-slate-900/50 border border-slate-700">
                    <div className="flex items-center gap-3">
                      <File className="w-8 h-8 text-slate-400" />
                      <div>
                        <p className="text-sm text-white">{existing.file_name}</p>
                        <p className="text-xs text-slate-400">
                          {existing.file_size_bytes
                            ? formatFileSize(existing.file_size_bytes)
                            : "Unknown size"}
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(existing.id, type)}
                      className="text-red-400 hover:text-red-300"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ) : existing?.inline_content ? (
                  <div className="space-y-2">
                    <Textarea
                      placeholder="Paste your content here..."
                      value={input.content || existing.inline_content}
                      onChange={(e) =>
                        setInputs((prev) => ({
                          ...prev,
                          [type]: { ...prev[type], content: e.target.value },
                        }))
                      }
                      rows={6}
                      className="bg-slate-900/50 border-slate-700 text-slate-200 font-mono text-sm"
                    />
                    <div className="flex justify-between">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(existing.id, type)}
                        className="text-red-400 hover:text-red-300"
                      >
                        <Trash2 className="w-4 h-4 mr-1" />
                        Delete
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => handleTextSave(type)}
                        disabled={input.isSaving}
                      >
                        {input.isSaving ? (
                          <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                        ) : (
                          <CheckCircle className="w-4 h-4 mr-1" />
                        )}
                        Save
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <Textarea
                      placeholder="Paste your content here (code, markdown, text)..."
                      value={input.content}
                      onChange={(e) =>
                        setInputs((prev) => ({
                          ...prev,
                          [type]: { ...prev[type], content: e.target.value },
                        }))
                      }
                      rows={6}
                      className="bg-slate-900/50 border-slate-700 text-slate-200 font-mono text-sm"
                    />

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <input
                          type="file"
                          ref={(el) => {
                            fileInputRefs.current[type] = el;
                          }}
                          onChange={(e) => handleFileSelect(type, e)}
                          className="hidden"
                        />
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => fileInputRefs.current[type]?.click()}
                          disabled={input.isUploading}
                          className="border-slate-600"
                        >
                          {input.isUploading ? (
                            <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                          ) : (
                            <Upload className="w-4 h-4 mr-1" />
                          )}
                          Upload File
                        </Button>
                        <span className="text-xs text-slate-500">or paste text above</span>
                      </div>

                      <Button
                        size="sm"
                        onClick={() => handleTextSave(type)}
                        disabled={input.isSaving || !input.content.trim()}
                      >
                        {input.isSaving ? (
                          <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                        ) : (
                          <CheckCircle className="w-4 h-4 mr-1" />
                        )}
                        Save Text
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </section>
  );
}
