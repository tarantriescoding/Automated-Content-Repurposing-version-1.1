"use client";

import { useEffect, useState, Suspense, lazy } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Zap, Loader2 } from "lucide-react";
import { useAppStore } from "@/lib/store";
import { HeroSection } from "@/components/hero-section";
import { UploadZone } from "@/components/upload-zone";
import type { ClipData } from "@/lib/types";

// Lazy load heavy components that aren't needed on initial render
const ProcessingPipeline = lazy(() =>
  import("@/components/processing-pipeline").then((m) => ({ default: m.ProcessingPipeline }))
);
const ClipResults = lazy(() =>
  import("@/components/clip-results").then((m) => ({ default: m.ClipResults }))
);

export default function AttentionXPage() {
  const {
    view,
    setView,
    setCurrentVideo,
    setProcessingStage,
    setProcessingProgress,
    setClips,
  } = useAppStore();
  const [isHydrated, setIsHydrated] = useState(false);

  // On mount, check if there are any existing videos to resume
  // Use a short delay so the initial render is not blocked
  useEffect(() => {
    let cancelled = false;

    const timer = setTimeout(async () => {
      try {
        const res = await fetch("/api/videos");
        if (!res.ok || cancelled) return;

        const { videos } = await res.json();
        if (!videos || videos.length === 0 || cancelled) return;

        // Find the most recent video
        const latestVideo = videos[0];

        if (latestVideo.status === "ready") {
          const detailRes = await fetch(`/api/videos/${latestVideo.id}`);
          if (!detailRes.ok || cancelled) return;
          const { video } = await detailRes.json();

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

          if (video.clips?.length > 0) {
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
            clipsData.sort((a, b) => b.sentimentScore - a.sentimentScore);
            setClips(clipsData);
            setProcessingStage("complete");
            setProcessingProgress(100);
            setView("results");
          }
        } else if (
          latestVideo.status === "transcribing" ||
          latestVideo.status === "analyzing" ||
          latestVideo.status === "generating"
        ) {
          setCurrentVideo({
            id: latestVideo.id,
            filename: latestVideo.filename,
            originalUrl: latestVideo.originalUrl,
            duration: latestVideo.duration,
            fileSize: latestVideo.fileSize,
            status: latestVideo.status,
            createdAt: latestVideo.createdAt,
            updatedAt: latestVideo.updatedAt,
          });

          const stageMap: Record<string, string> = {
            transcribing: "transcribing",
            analyzing: "analyzing",
            generating: "generating",
          };
          const progressMap: Record<string, number> = {
            transcribing: 35,
            analyzing: 60,
            generating: 85,
          };

          setProcessingStage(
            (stageMap[latestVideo.status] as "transcribing" | "analyzing" | "generating") || "transcribing"
          );
          setProcessingProgress(progressMap[latestVideo.status] || 35);
          setView("processing");
        }
      } catch {
        // Silently fail - user can always start fresh
      } finally {
        if (!cancelled) setIsHydrated(true);
      }
    }, 100);

    // Mark as hydrated immediately if no data fetch changes the view
    setIsHydrated(true);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [setView, setCurrentVideo, setProcessingStage, setProcessingProgress, setClips]);

  return (
    <div className="min-h-screen flex flex-col bg-zinc-950">
      {/* Header */}
      <header className="sticky top-0 z-40 w-full border-b border-zinc-800/50 bg-zinc-950/80 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center">
              <Zap className="w-5 h-5 text-white" />
            </div>
            <span className="text-white font-bold text-lg tracking-tight">
              Attention<span className="text-orange-400">X</span>
            </span>
          </div>
          <nav className="flex items-center gap-4">
            <span className="text-zinc-500 text-sm hidden sm:inline">
              Automated Content Repurposing
            </span>
            <div className="h-5 w-px bg-zinc-800 hidden sm:block" />
            <a
              href="#"
              className="text-zinc-400 text-sm hover:text-white transition-colors"
            >
              Docs
            </a>
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1">
        <AnimatePresence mode="wait">
          {view === "upload" && (
            <motion.div
              key="upload"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
            >
              <HeroSection />
              <UploadZone />
            </motion.div>
          )}

          {view === "processing" && (
            <motion.div
              key="processing"
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -50 }}
              transition={{ duration: 0.4 }}
              className="pt-8"
            >
              <Suspense
                fallback={
                  <div className="flex items-center justify-center py-20">
                    <Loader2 className="w-8 h-8 text-orange-400 animate-spin" />
                  </div>
                }
              >
                <ProcessingPipeline />
              </Suspense>
            </motion.div>
          )}

          {view === "results" && (
            <motion.div
              key="results"
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -50 }}
              transition={{ duration: 0.4 }}
              className="pt-8"
            >
              <Suspense
                fallback={
                  <div className="flex items-center justify-center py-20">
                    <Loader2 className="w-8 h-8 text-orange-400 animate-spin" />
                  </div>
                }
              >
                <ClipResults />
              </Suspense>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Sticky Footer */}
      <footer className="border-t border-zinc-800/50 bg-zinc-950/80 mt-auto">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <p className="text-zinc-600 text-xs">
            © {new Date().getFullYear()} AttentionX. All rights reserved.
          </p>
          <div className="flex items-center gap-4 text-zinc-600 text-xs">
            <a href="#" className="hover:text-zinc-400 transition-colors">
              Privacy
            </a>
            <a href="#" className="hover:text-zinc-400 transition-colors">
              Terms
            </a>
            <a href="#" className="hover:text-zinc-400 transition-colors">
              Contact
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
