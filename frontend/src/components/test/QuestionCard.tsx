"use client";

import { useState, useEffect, useRef, ClipboardEvent } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CodeEditor } from "./CodeEditor";
import { Question } from "@/types";
import { answersApi, testsApi } from "@/lib/api";
import { getCategoryLabel } from "@/lib/utils";
import { Loader2, Send, CheckCircle, Lightbulb, Clock, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

interface QuestionCardProps {
  question: Question;
  questionNumber: number;
  totalQuestions: number;
  onAnswerSubmitted: () => void;
  testToken?: string;
}

export function QuestionCard({
  question,
  questionNumber,
  totalQuestions,
  onAnswerSubmitted,
  testToken,
}: QuestionCardProps) {
  const [answer, setAnswer] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(question.is_answered || false);
  const [showHint, setShowHint] = useState(false);
  const [pasteAttempted, setPasteAttempted] = useState(false);

  // Time tracking
  const [timeSpent, setTimeSpent] = useState(0);
  const startTimeRef = useRef<number>(Date.now());
  const hasStartedRef = useRef(false);

  const isCodeQuestion =
    question.category === "coding" || question.category === "code_review";

  // Start time tracking when user starts interacting
  useEffect(() => {
    if (!submitted && !hasStartedRef.current) {
      startTimeRef.current = Date.now();
      hasStartedRef.current = true;
    }
  }, [submitted]);

  // Update time display
  useEffect(() => {
    if (submitted) return;

    const interval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
      setTimeSpent(elapsed);
    }, 1000);

    return () => clearInterval(interval);
  }, [submitted]);

  // Format time display
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  // Handle paste blocking
  const handlePaste = (e: ClipboardEvent<HTMLTextAreaElement>) => {
    e.preventDefault();
    setPasteAttempted(true);

    // Log paste attempt to backend
    if (testToken) {
      testsApi.logAntiCheatEvent(testToken, {
        event_type: "paste_attempt",
        timestamp: new Date().toISOString(),
      }).catch(console.error);
    }

    // Reset warning after 3 seconds
    setTimeout(() => setPasteAttempted(false), 3000);
  };

  const handleSubmit = async () => {
    if (!answer.trim() && !code.trim()) return;

    const finalTimeSpent = Math.floor((Date.now() - startTimeRef.current) / 1000);

    setLoading(true);
    try {
      await answersApi.submit({
        question_id: question.id,
        candidate_answer: answer || undefined,
        candidate_code: code || undefined,
        time_spent_seconds: finalTimeSpent,
      });
      setSubmitted(true);
      onAnswerSubmitted();
    } catch (error) {
      console.error("Error submitting answer:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className={cn(submitted && "border-green-500/50")}>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              Question {questionNumber}
              {submitted && (
                <CheckCircle className="w-5 h-5 text-green-500" />
              )}
            </CardTitle>
            <CardDescription>
              {questionNumber} of {totalQuestions} in {getCategoryLabel(question.category)}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="text-xs">
              <Clock className="w-3 h-3 mr-1" />
              {formatTime(timeSpent)}
            </Badge>
            <Badge variant="outline">{question.max_score} pts</Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="prose prose-invert max-w-none">
          <p className="text-foreground whitespace-pre-wrap">
            {question.question_text}
          </p>
        </div>

        {question.question_code && (
          <div>
            <p className="text-sm text-muted-foreground mb-2">Given Code:</p>
            <pre className="p-4 rounded-lg bg-muted overflow-x-auto text-sm">
              {question.question_code}
            </pre>
          </div>
        )}

        {question.hints && question.hints.length > 0 && (
          <div>
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground"
              onClick={() => setShowHint(!showHint)}
            >
              <Lightbulb className="w-4 h-4 mr-2" />
              {showHint ? "Hide Hint" : "Show Hint"}
            </Button>
            {showHint && (
              <div className="mt-2 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                <ul className="text-sm space-y-1">
                  {question.hints.map((hint, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="text-yellow-500">•</span>
                      {hint}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        <div className="pt-4 border-t">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium">Your Answer:</p>
            {pasteAttempted && (
              <span className="flex items-center gap-1 text-xs text-red-500 animate-pulse">
                <AlertTriangle className="w-3 h-3" />
                Paste is disabled
              </span>
            )}
          </div>

          {isCodeQuestion ? (
            <div className="space-y-4">
              <CodeEditor
                value={code}
                onChange={setCode}
                language={question.category === "coding" ? "python" : "javascript"}
                readOnly={submitted}
                height="250px"
              />
              <Textarea
                placeholder="Explain your solution..."
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                onPaste={handlePaste}
                disabled={submitted}
                rows={3}
              />
            </div>
          ) : (
            <Textarea
              placeholder="Type your answer here..."
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              onPaste={handlePaste}
              disabled={submitted}
              rows={6}
            />
          )}
        </div>

        <div className="flex justify-end">
          <Button
            onClick={handleSubmit}
            disabled={loading || submitted || (!answer.trim() && !code.trim())}
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Submitting...
              </>
            ) : submitted ? (
              <>
                <CheckCircle className="w-4 h-4 mr-2" />
                Submitted
              </>
            ) : (
              <>
                <Send className="w-4 h-4 mr-2" />
                Submit Answer
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
