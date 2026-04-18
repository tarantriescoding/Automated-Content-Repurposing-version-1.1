"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  PartyPopper,
  TrendingUp,
  Eye,
  BarChart3,
  ArrowLeft,
  Video,
  Loader2,
  Download,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ClipCard } from "./clip-card";
import { ClipDetail } from "./clip-detail";
import { useAppStore } from "@/lib/store";
import type { ClipData } from "@/lib/types";

function ConfettiParticle({ delay, x }: { delay: number; x: number }) {
  return (
    <motion.div
      className="absolute w-2 h-2 rounded-full"
      style={{
        left: `${x}%`,
        top: "-10px",
        background: ["#f97316", "#f59e0b", "#10b981", "#ef4444", "#8b5cf6"][
          Math.floor(Math.random() * 5)
        ],
      }}
      initial={{ y: 0, opacity: 1, rotate: 0 }}
      animate={{
        y: [0, 300, 500],
        opacity: [1, 1, 0],
        rotate: [0, 180, 360],
        x: [0, (Math.random() - 0.5) * 100, (Math.random() - 0.5) * 200],
      }}
      transition={{
        duration: 2.5,
        delay,
        ease: "easeOut",
      }}
    />
  );
}

export function ClipResults() {
  const { clips, setClips, selectedClip, setSelectedClip, reset, currentVideo } = useAppStore();
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractProgress, setExtractProgress] = useState("");

  // Count clips that need video extraction
  const clipsWithoutVideo = clips.filter((c) => !c.clipUrl);
  const clipsWithVideo = clips.filter((c) => c.clipUrl);

  const extractMissingVideos = async () => {
    if (clipsWithoutVideo.length === 0 || isExtracting) return;

    setIsExtracting(true);
    const updatedClips = [...clips];

    for (let i = 0; i < clipsWithoutVideo.length; i++) {
      const clip = clipsWithoutVideo[i];
      setExtractProgress(`Extracting video ${i + 1}/${clipsWithoutVideo.length}...`);

      try {
        const res = await fetch(`/api/clips/${clip.id}/extract`, {
          method: "POST",
        });
        if (res.ok) {
          const data = await res.json();
          // Update the clip in our local state
          const idx = updatedClips.findIndex((c) => c.id === clip.id);
          if (idx !== -1) {
            updatedClips[idx] = {
              ...updatedClips[idx],
              clipUrl: data.clipUrl || "",
              srtUrl: data.srtUrl || "",
            };
          }
        }
      } catch (err) {
        console.error(`Failed to extract clip ${clip.id}:`, err);
      }
    }

    setClips(updatedClips);
    setIsExtracting(false);
    setExtractProgress("");
  };

  // Auto-extract is now triggered manually via button
  // to avoid server OOM from processing all clips at once

  const handleDownloadAll = async () => {
    for (const clip of clipsWithVideo) {
      try {
        // Direct download from static files
        const a = document.createElement("a");
        a.href = clip.clipUrl;
        a.download = `${clip.title.replace(/[^a-zA-Z0-9]/g, "_")}.mp4`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        // Small delay between downloads
        await new Promise((r) => setTimeout(r, 500));
      } catch (err) {
        console.error("Download failed for clip", clip.id, err);
      }
    }
  };

  const avgSentiment =
    clips.length > 0
      ? clips.reduce((acc, c) => acc + c.sentimentScore, 0) / clips.length
      : 0;

  const estimatedViews = Math.round(
    clips.reduce((acc, c) => acc + c.sentimentScore * 50000, 0)
  );

  const handleSelectClip = (clip: ClipData) => {
    setSelectedClip(clip);
  };

  const handleStartOver = () => {
    reset();
  };

  return (
    <section className="w-full max-w-6xl mx-auto px-4 sm:px-6 py-8">
      {/* Confetti */}
      <div className="relative overflow-hidden h-0">
        {Array.from({ length: 30 }).map((_, i) => (
          <ConfettiParticle key={i} delay={i * 0.08} x={Math.random() * 100} />
        ))}
      </div>

      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-8"
      >
        <div className="inline-flex items-center gap-2 mb-4">
          <PartyPopper className="w-8 h-8 text-orange-400" />
          <h2 className="text-3xl sm:text-4xl font-bold text-white">
            Timestamp-Based Highlights
          </h2>
          <PartyPopper className="w-8 h-8 text-amber-400" />
        </div>
        <p className="text-zinc-400 text-lg">
          {clips.length} golden nuggets extracted from your video
        </p>
      </motion.div>

      {/* Stats Bar */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="grid grid-cols-3 gap-3 sm:gap-4 mb-6"
      >
        <Card className="bg-zinc-900/80 border-zinc-800 backdrop-blur-sm">
          <CardContent className="p-4 text-center">
            <div className="flex items-center justify-center gap-2 mb-1">
              <BarChart3 className="w-4 h-4 text-orange-400" />
              <span className="text-zinc-500 text-xs font-medium uppercase tracking-wider">
                Clips
              </span>
            </div>
            <p className="text-2xl sm:text-3xl font-bold text-white">
              {clips.length}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-zinc-900/80 border-zinc-800 backdrop-blur-sm">
          <CardContent className="p-4 text-center">
            <div className="flex items-center justify-center gap-2 mb-1">
              <TrendingUp className="w-4 h-4 text-amber-400" />
              <span className="text-zinc-500 text-xs font-medium uppercase tracking-wider">
                Avg Score
              </span>
            </div>
            <p className="text-2xl sm:text-3xl font-bold text-orange-400">
              {Math.round(avgSentiment * 100)}%
            </p>
          </CardContent>
        </Card>

        <Card className="bg-zinc-900/80 border-zinc-800 backdrop-blur-sm">
          <CardContent className="p-4 text-center">
            <div className="flex items-center justify-center gap-2 mb-1">
              <Eye className="w-4 h-4 text-emerald-400" />
              <span className="text-zinc-500 text-xs font-medium uppercase tracking-wider">
                Est. Views
              </span>
            </div>
            <p className="text-2xl sm:text-3xl font-bold text-emerald-400">
              {estimatedViews > 1000
                ? `${(estimatedViews / 1000).toFixed(0)}K`
                : estimatedViews}
            </p>
          </CardContent>
        </Card>
      </motion.div>

      {/* Video extraction status / actions */}
      {isExtracting && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 flex items-center justify-center gap-3 bg-orange-500/10 border border-orange-500/20 rounded-lg px-4 py-3"
        >
          <Loader2 className="w-4 h-4 text-orange-400 animate-spin" />
          <span className="text-orange-300 text-sm">{extractProgress}</span>
        </motion.div>
      )}

      {!isExtracting && clipsWithoutVideo.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 flex items-center justify-between bg-amber-500/10 border border-amber-500/20 rounded-lg px-4 py-3"
        >
          <div className="flex items-center gap-2">
            <Video className="w-4 h-4 text-amber-400" />
            <span className="text-amber-300 text-sm">
              {clipsWithoutVideo.length} clips need video extraction
            </span>
          </div>
          <Button
            size="sm"
            className="bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white text-xs"
            onClick={extractMissingVideos}
          >
            <Video className="w-3 h-3 mr-1" />
            Extract Videos
          </Button>
        </motion.div>
      )}

      {!isExtracting && clipsWithVideo.length > 0 && clipsWithoutVideo.length === 0 && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 flex items-center justify-between bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-4 py-3"
        >
          <div className="flex items-center gap-2">
            <Video className="w-4 h-4 text-emerald-400" />
            <span className="text-emerald-300 text-sm">
              {clipsWithVideo.length}/{clips.length} clips have video ready to view & download
            </span>
          </div>
          <Button
            size="sm"
            className="bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white text-xs"
            onClick={handleDownloadAll}
          >
            <Download className="w-3 h-3 mr-1" />
            Download All
          </Button>
        </motion.div>
      )}

      {/* Clip Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 mb-8">
        {clips.map((clip, idx) => (
          <ClipCard
            key={clip.id}
            clip={clip}
            index={idx}
            onSelect={handleSelectClip}
          />
        ))}
      </div>

      {/* Start Over */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="flex justify-center"
      >
        <Button
          variant="outline"
          onClick={handleStartOver}
          className="border-zinc-700 text-zinc-400 hover:bg-zinc-800 hover:text-white"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Process Another Video
        </Button>
      </motion.div>

      {/* Clip Detail Modal */}
      {selectedClip && <ClipDetail clip={selectedClip} />}
    </section>
  );
}
