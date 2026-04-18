"use client";

import { motion } from "framer-motion";
import { Clock, TrendingUp } from "lucide-react";
import Image from "next/image";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { ClipData } from "@/lib/types";

const emotionConfig: Record<
  string,
  { emoji: string; color: string; bg: string }
> = {
  Inspiring: {
    emoji: "🔥",
    color: "text-orange-400",
    bg: "bg-orange-500/20 border-orange-500/30",
  },
  Passionate: {
    emoji: "💪",
    color: "text-red-400",
    bg: "bg-red-500/20 border-red-500/30",
  },
  Humorous: {
    emoji: "😂",
    color: "text-yellow-400",
    bg: "bg-yellow-500/20 border-yellow-500/30",
  },
  Surprising: {
    emoji: "😲",
    color: "text-purple-400",
    bg: "bg-purple-500/20 border-purple-500/30",
  },
  Motivational: {
    emoji: "🚀",
    color: "text-emerald-400",
    bg: "bg-emerald-500/20 border-emerald-500/30",
  },
  Profound: {
    emoji: "💫",
    color: "text-violet-400",
    bg: "bg-violet-500/20 border-violet-500/30",
  },
  Shocking: {
    emoji: "⚡",
    color: "text-amber-400",
    bg: "bg-amber-500/20 border-amber-500/30",
  },
  Joyful: {
    emoji: "🎉",
    color: "text-green-400",
    bg: "bg-green-500/20 border-green-500/30",
  },
  Angry: {
    emoji: "😤",
    color: "text-red-500",
    bg: "bg-red-600/20 border-red-600/30",
  },
};

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

interface ClipCardProps {
  clip: ClipData;
  index: number;
  onSelect: (clip: ClipData) => void;
}

export function ClipCard({ clip, index, onSelect }: ClipCardProps) {
  const emotion = emotionConfig[clip.emotion] || emotionConfig.Inspiring;
  const hasThumbnail = clip.thumbnailUrl && clip.thumbnailUrl.length > 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.1 }}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={() => onSelect(clip)}
      className="cursor-pointer"
    >
      <Card className="bg-zinc-900/80 border-zinc-800 backdrop-blur-sm hover:border-orange-500/30 transition-all duration-300 overflow-hidden">
        <CardContent className="p-0">
          {/* Vertical preview area (9:16 aspect) */}
          <div className="relative aspect-[9/16] bg-gradient-to-br from-zinc-800 via-zinc-900 to-zinc-800 overflow-hidden">
            {/* Thumbnail image if available */}
            {hasThumbnail ? (
              <Image
                src={clip.thumbnailUrl}
                alt={clip.title}
                fill
                className="object-cover"
                sizes="(max-width: 640px) 50vw, 20vw"
              />
            ) : (
              <>
                {/* Gradient overlay for placeholder */}
                <div className="absolute inset-0 bg-gradient-to-br from-orange-500/10 via-zinc-800 to-amber-500/10" />
                {/* Subtle pattern */}
                <div
                  className="absolute inset-0 opacity-5"
                  style={{
                    backgroundImage:
                      "linear-gradient(rgba(255,255,255,.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.1) 1px, transparent 1px)",
                    backgroundSize: "20px 20px",
                  }}
                />
              </>
            )}

            {/* Dark overlay for text readability */}
            <div className="absolute inset-0 bg-gradient-to-t from-zinc-900/90 via-transparent to-zinc-900/40" />

            {/* Hook text overlay at top */}
            <div className="absolute top-3 left-3 right-3">
              <p className="text-white text-sm font-semibold leading-tight drop-shadow-lg line-clamp-2">
                &ldquo;{clip.hook}&rdquo;
              </p>
            </div>

            {/* Emotion badge */}
            <div className="absolute top-3 right-3">
              <Badge
                variant="outline"
                className={`${emotion.bg} ${emotion.color} text-xs font-medium border`}
              >
                {emotion.emoji} {clip.emotion}
              </Badge>
            </div>

            {/* Caption preview at bottom */}
            <div className="absolute bottom-4 left-3 right-3 space-y-1">
              {clip.captions.slice(0, 2).map((cap, idx) => (
                <p
                  key={idx}
                  className={`text-center text-sm font-bold drop-shadow-lg ${
                    idx === 0
                      ? "text-white"
                      : "text-zinc-300"
                  }`}
                >
                  {cap.text}
                </p>
              ))}
            </div>

            {/* Play button overlay */}
            <div className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity bg-black/30">
              <div className="w-12 h-12 rounded-full bg-orange-500/80 flex items-center justify-center">
                <svg
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  className="w-6 h-6 text-white ml-1"
                >
                  <path d="M8 5v14l11-7z" />
                </svg>
              </div>
            </div>
          </div>

          {/* Clip info */}
          <div className="p-3 space-y-3">
            {/* Title */}
            <p className="text-white text-sm font-medium truncate">
              {clip.title}
            </p>

            {/* Time range */}
            <div className="flex items-center gap-1.5 text-zinc-400 text-xs">
              <Clock className="w-3 h-3" />
              <span>
                {formatTime(clip.startTime)} - {formatTime(clip.endTime)}
              </span>
            </div>

            {/* Sentiment score bar */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-zinc-400 text-xs flex items-center gap-1">
                  <TrendingUp className="w-3 h-3" />
                  Viral Score
                </span>
                <span className="text-orange-400 text-xs font-semibold">
                  {Math.round(clip.sentimentScore * 100)}%
                </span>
              </div>
              <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{
                    width: `${clip.sentimentScore * 100}%`,
                  }}
                  transition={{ duration: 0.8, delay: index * 0.1 + 0.3 }}
                  className="h-full rounded-full bg-gradient-to-r from-orange-500 to-amber-500"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
