"use client";

import { useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Upload,
  Mic,
  Brain,
  Scissors,
  CheckCircle2,
  Loader2,
  FileVideo,
  AlertCircle,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { useAppStore } from "@/lib/store";
import type { ProcessingStage, ClipData } from "@/lib/types";

const stages: {
  id: ProcessingStage;
  label: string;
  icon: React.ElementType;
  emoji: string;
}[] = [
  { id: "uploading", label: "Uploading", icon: Upload, emoji: "📤" },
  { id: "transcribing", label: "Transcribing", icon: Mic, emoji: "🎤" },
  { id: "analyzing", label: "Analyzing Peaks", icon: Brain, emoji: "🧠" },
  { id: "generating", label: "Generating Clips", icon: Scissors, emoji: "✂️" },
];

const stageOrder: ProcessingStage[] = [
  "uploading",
  "transcribing",
  "analyzing",
  "generating",
  "complete",
];

// Map backend video status to processing stage
function statusToStage(status: string): ProcessingStage {
  switch (status) {
    case "uploaded":
      return "uploading";
    case "transcribing":
      return "transcribing";
    case "analyzing":
      return "analyzing";
    case "generating":
      return "generating";
    case "ready":
      return "complete";
    case "error":
      return "complete";
    default:
      return "uploading";
  }
}

// Map stage to progress range
function stageToProgress(stage: ProcessingStage): number {
  switch (stage) {
    case "uploading":
      return 15;
    case "transcribing":
      return 35;
    case "analyzing":
      return 60;
    case "generating":
      return 85;
    case "complete":
      return 100;
    default:
      return 0;
  }
}

// Stage-specific log messages
const stageLogMessages: Record<string, string[]> = {
  uploading: [
    "Uploading video to processing server...",
    "Validating file integrity...",
    "Extracting metadata...",
  ],
  transcribing: [
    "Extracting audio track from video...",
    "Converting speech to text with AI transcription...",
    "Aligning transcript with timestamps...",
  ],
  analyzing: [
    "Analyzing sentiment and energy levels...",
    "Detecting emotional peaks with AI...",
    "Scoring segments for viral potential...",
    "Identifying hook moments and golden nuggets...",
  ],
  generating: [
    "Selecting optimal clip boundaries...",
    "Generating dynamic karaoke-style captions...",
    "Creating catchy hook headlines...",
    "Extracting video clips with ffmpeg...",
    "Generating SRT caption files...",
    "Rendering viral clips...",
  ],
  complete: ["Processing pipeline complete!"],
};

function formatDuration(seconds: number): string {
  if (!seconds || seconds === 0) return "--:--";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function formatFileSize(bytes: number): string {
  if (!bytes) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function ProcessingPipeline() {
  const {
    currentVideo,
    processingStage,
    setProcessingStage,
    processingProgress,
    setProcessingProgress,
    setView,
    setClips,
    processingLogs,
    addProcessingLog,
    setCurrentVideo,
  } = useAppStore();

  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const logIndexRef = useRef<Record<string, number>>({});
  const logIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const prevStageRef = useRef<ProcessingStage>(processingStage);

  // Poll the API for video status
  const pollVideoStatus = useCallback(async () => {
    if (!currentVideo) return;

    try {
      const res = await fetch(`/api/videos/${currentVideo.id}`);
      if (!res.ok) return;

      const { video } = await res.json();

      // Update current video with latest data
      setCurrentVideo({
        id: video.id,
        filename: video.filename,
        originalUrl: video.originalUrl,
        duration: video.duration,
        fileSize: video.fileSize,
        status: video.status,
        createdAt: video.createdAt,
        updatedAt: video.updatedAt,
      });

      const newStage = statusToStage(video.status);
      const newProgress = stageToProgress(newStage);

      if (newStage !== prevStageRef.current) {
        setProcessingStage(newStage);
        prevStageRef.current = newStage;
      }
      setProcessingProgress(newProgress);

      // If processing is complete, set clips and switch view
      if (video.status === "ready" && video.clips?.length > 0) {
        const clipsData: ClipData[] = video.clips.map(
          (clip: Record<string, unknown>) => ({
            id: clip.id as string,
            videoId: clip.videoId as string,
            title: (clip.title as string) || "Untitled Clip",
            hook: (clip.hook as string) || "",
            startTime: (clip.startTime as number) || 0,
            endTime: (clip.endTime as number) || 0,
            sentimentScore: (clip.sentimentScore as number) || 0.5,
            emotion:
              ((clip.emotion as string) || "neutral").charAt(0).toUpperCase() +
              ((clip.emotion as string) || "neutral").slice(1),
            captions: Array.isArray(clip.captions)
              ? (clip.captions as Array<{ text: string; start: number; end: number }>)
              : [],
            captionStyle: ((clip.captionStyle as string) || "karaoke") as
              | "karaoke"
              | "bold"
              | "minimal",
            thumbnailUrl: (clip.thumbnailUrl as string) || "",
            clipUrl: (clip.clipUrl as string) || "",
            srtUrl: (clip.srtUrl as string) || "",
            status: (clip.status as string) || "ready",
            createdAt: (clip.createdAt as string) || new Date().toISOString(),
          })
        );

        // Sort by sentiment score
        clipsData.sort((a, b) => b.sentimentScore - a.sentimentScore);
        setClips(clipsData);

        addProcessingLog({
          timestamp: new Date().toLocaleTimeString(),
          message: `All ${clipsData.length} clips generated successfully!`,
          type: "success",
        });

        setTimeout(() => setView("results"), 1500);

        // Stop polling
        if (pollIntervalRef.current) {
          clearInterval(pollIntervalRef.current);
          pollIntervalRef.current = null;
        }
      } else if (video.status === "error") {
        addProcessingLog({
          timestamp: new Date().toLocaleTimeString(),
          message: "Processing encountered an error. Please try again.",
          type: "warning",
        });

        // Stop polling
        if (pollIntervalRef.current) {
          clearInterval(pollIntervalRef.current);
          pollIntervalRef.current = null;
        }
      }
    } catch (err) {
      console.error("Poll error:", err);
    }
  }, [
    currentVideo,
    setProcessingStage,
    setProcessingProgress,
    setView,
    setClips,
    setCurrentVideo,
    addProcessingLog,
  ]);

  // Start polling when we have a video
  useEffect(() => {
    if (!currentVideo) return;

    // Initial poll
    pollVideoStatus();

    // Poll every 3 seconds
    pollIntervalRef.current = setInterval(pollVideoStatus, 3000);

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, [currentVideo, pollVideoStatus]);

  // Simulate log messages based on current stage
  useEffect(() => {
    logIntervalRef.current = setInterval(() => {
      const stage = prevStageRef.current;
      if (stage === "complete") return;

      const logs = stageLogMessages[stage];
      if (!logs) return;

      const idx = logIndexRef.current[stage] || 0;
      if (idx < logs.length) {
        addProcessingLog({
          timestamp: new Date().toLocaleTimeString(),
          message: logs[idx],
          type: idx === logs.length - 1 ? "success" : "info",
        });
        logIndexRef.current[stage] = idx + 1;
      }
    }, 2500);

    return () => {
      if (logIntervalRef.current) {
        clearInterval(logIntervalRef.current);
      }
    };
  }, [addProcessingLog]);

  const currentStageIdx = stageOrder.indexOf(processingStage);
  const hasError = currentVideo?.status === "error";

  return (
    <section className="w-full max-w-4xl mx-auto px-4 sm:px-6 py-8">
      {/* Video info card */}
      {currentVideo && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <Card className="bg-zinc-900/80 border-zinc-800 backdrop-blur-sm">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="w-12 h-12 rounded-lg bg-orange-500/10 border border-orange-500/20 flex items-center justify-center flex-shrink-0">
                <FileVideo className="w-6 h-6 text-orange-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white font-medium truncate">
                  {currentVideo.filename}
                </p>
                <div className="flex items-center gap-3 text-zinc-400 text-sm">
                  <span>
                    Duration: {formatDuration(currentVideo.duration)}
                  </span>
                  <span>Size: {formatFileSize(currentVideo.fileSize)}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Processing Pipeline Stepper */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="mb-8"
      >
        <Card className="bg-zinc-900/80 border-zinc-800 backdrop-blur-sm">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-8">
              {stages.map((stage, idx) => {
                const stageIdx = stageOrder.indexOf(stage.id);
                const isActive = stageIdx === currentStageIdx && !hasError;
                const isComplete = stageIdx < currentStageIdx || hasError;
                const isPending = stageIdx > currentStageIdx;

                return (
                  <div
                    key={stage.id}
                    className="flex items-center flex-1 last:flex-none"
                  >
                    <div className="flex flex-col items-center gap-2">
                      <motion.div
                        animate={{
                          scale: isActive ? [1, 1.1, 1] : 1,
                        }}
                        transition={{
                          duration: 1.5,
                          repeat: isActive ? Infinity : 0,
                          ease: "easeInOut",
                        }}
                        className={`w-12 h-12 rounded-full flex items-center justify-center border-2 transition-all ${
                          isComplete
                            ? "bg-emerald-500/20 border-emerald-500 text-emerald-400"
                            : isActive
                            ? "bg-orange-500/20 border-orange-500 text-orange-400"
                            : "bg-zinc-800 border-zinc-700 text-zinc-500"
                        }`}
                      >
                        {isComplete ? (
                          <CheckCircle2 className="w-6 h-6" />
                        ) : isActive ? (
                          <Loader2 className="w-6 h-6 animate-spin" />
                        ) : (
                          <stage.icon className="w-5 h-5" />
                        )}
                      </motion.div>
                      <div className="text-center">
                        <span className="text-sm" role="img">
                          {stage.emoji}
                        </span>
                        <p
                          className={`text-xs font-medium mt-0.5 ${
                            isComplete
                              ? "text-emerald-400"
                              : isActive
                              ? "text-orange-400"
                              : "text-zinc-500"
                          }`}
                        >
                          {stage.label}
                        </p>
                      </div>
                    </div>
                    {idx < stages.length - 1 && (
                      <div className="flex-1 mx-3 mt-[-24px]">
                        <div className="h-0.5 w-full bg-zinc-800 rounded-full overflow-hidden">
                          <motion.div
                            className={`h-full rounded-full ${
                              stageIdx < currentStageIdx
                                ? "bg-emerald-500"
                                : stageIdx === currentStageIdx
                                ? "bg-gradient-to-r from-orange-500 to-amber-500"
                                : "bg-transparent"
                            }`}
                            initial={{ width: "0%" }}
                            animate={{
                              width:
                                stageIdx < currentStageIdx
                                  ? "100%"
                                  : stageIdx === currentStageIdx
                                  ? "50%"
                                  : "0%",
                            }}
                            transition={{ duration: 0.5 }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Progress bar */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-zinc-400">Overall Progress</span>
                <span className="text-orange-400 font-semibold">
                  {processingProgress}%
                </span>
              </div>
              <Progress
                value={processingProgress}
                className="h-2 bg-zinc-800 [&>div]:bg-gradient-to-r [&>div]:from-orange-500 [&>div]:to-amber-500"
              />
            </div>

            {/* Status text */}
            <AnimatePresence mode="wait">
              <motion.p
                key={processingStage}
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -5 }}
                className="text-zinc-400 text-sm mt-4 text-center"
              >
                {hasError &&
                  "Processing encountered an error. Please try again."}
                {!hasError &&
                  processingStage === "uploading" &&
                  "Uploading your video to our secure servers..."}
                {!hasError &&
                  processingStage === "transcribing" &&
                  "Converting speech to text with AI transcription..."}
                {!hasError &&
                  processingStage === "analyzing" &&
                  "AI is analyzing emotional peaks and viral potential..."}
                {!hasError &&
                  processingStage === "generating" &&
                  "Generating optimized short-form clips with captions..."}
                {!hasError &&
                  processingStage === "complete" &&
                  "All clips generated successfully!"}
              </motion.p>
            </AnimatePresence>

            {/* Error state - Retry button */}
            {hasError && (
              <div className="mt-4 flex justify-center">
                <Button
                  variant="outline"
                  className="border-orange-500/50 text-orange-400 hover:bg-orange-500/10"
                  onClick={() => {
                    if (currentVideo) {
                      fetch(`/api/videos/${currentVideo.id}/process`, {
                        method: "POST",
                      });
                    }
                  }}
                >
                  <AlertCircle className="w-4 h-4 mr-2" />
                  Retry Processing
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Processing Logs */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <Card className="bg-zinc-900/80 border-zinc-800 backdrop-blur-sm">
          <CardContent className="p-4">
            <h3 className="text-zinc-400 text-sm font-medium mb-3 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              Processing Details
            </h3>
            <ScrollArea className="h-48">
              <div className="space-y-1.5 font-mono text-xs">
                {processingLogs.map((log, idx) => (
                  <motion.div
                    key={idx}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="flex items-start gap-2"
                  >
                    <span className="text-zinc-600 flex-shrink-0">
                      {log.timestamp}
                    </span>
                    <span
                      className={
                        log.type === "success"
                          ? "text-emerald-400"
                          : log.type === "warning"
                          ? "text-amber-400"
                          : "text-zinc-400"
                      }
                    >
                      {log.message}
                    </span>
                  </motion.div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </motion.div>
    </section>
  );
}
