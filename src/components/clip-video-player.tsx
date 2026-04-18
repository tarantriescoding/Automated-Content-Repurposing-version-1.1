"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import { Play, Pause, Volume2, VolumeX } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { ClipData, CaptionData } from "@/lib/types";

// ─── Emotion config (matches clip-card & clip-detail) ────────────────────────
const emotionConfig: Record<string, { emoji: string; color: string; bg: string }> = {
  Inspiring:   { emoji: "🔥", color: "text-orange-400",  bg: "bg-orange-500/20 border-orange-500/30" },
  Passionate:  { emoji: "💪", color: "text-red-400",     bg: "bg-red-500/20 border-red-500/30" },
  Humorous:    { emoji: "😂", color: "text-yellow-400",  bg: "bg-yellow-500/20 border-yellow-500/30" },
  Surprising:  { emoji: "😲", color: "text-purple-400",  bg: "bg-purple-500/20 border-purple-500/30" },
  Motivational:{ emoji: "🚀", color: "text-emerald-400", bg: "bg-emerald-500/20 border-emerald-500/30" },
  Profound:    { emoji: "💫", color: "text-violet-400",  bg: "bg-violet-500/20 border-violet-500/30" },
  Shocking:    { emoji: "⚡", color: "text-amber-400",   bg: "bg-amber-500/20 border-amber-500/30" },
  Joyful:      { emoji: "🎉", color: "text-green-400",   bg: "bg-green-500/20 border-green-500/30" },
  Angry:       { emoji: "😤", color: "text-red-500",     bg: "bg-red-600/20 border-red-600/30" },
  neutral:     { emoji: "💬", color: "text-zinc-400",    bg: "bg-zinc-500/20 border-zinc-500/30" },
};

// ─── Helpers ─────────────────────────────────────────────────────────────────
function formatTimestamp(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

/** Convert absolute caption times to clip-relative, or pass through if already relative */
function toRelative(captions: CaptionData[], clipStart: number): CaptionData[] {
  if (captions.length === 0) return captions;
  // Detect if captions are already relative (first caption starts near 0)
  const firstStart = captions[0].start;
  const isAlreadyRelative = firstStart < 5;
  if (isAlreadyRelative) return captions;
  return captions.map((c) => ({
    text: c.text,
    start: Math.max(0, c.start - clipStart),
    end: Math.max(0, c.end - clipStart),
  }));
}

// ─── Props ───────────────────────────────────────────────────────────────────
interface ClipVideoPlayerProps {
  clip: ClipData;
  autoPlay?: boolean;
}

// ─── Component ───────────────────────────────────────────────────────────────
export function ClipVideoPlayer({ clip, autoPlay = false }: ClipVideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const hasClipUrl = Boolean(clip.clipUrl);
  const hasThumbnail = Boolean(clip.thumbnailUrl);
  const emotion = emotionConfig[clip.emotion] || emotionConfig.neutral;
  const relativeCaptions = toRelative(clip.captions, clip.startTime);

  // ── Determine active caption index from currentTime (derived, not state) ──
  const activeCaptionIdx = useMemo(() => {
    for (let i = 0; i < relativeCaptions.length; i++) {
      const cap = relativeCaptions[i];
      if (currentTime >= cap.start && currentTime < cap.end) {
        return i;
      }
    }
    return -1;
  }, [currentTime, relativeCaptions]);

  // ── Video event handlers ──
  const handleTimeUpdate = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    setCurrentTime(video.currentTime);
  }, []);

  const handleLoadedMetadata = useCallback(() => {
    const video = videoRef.current;
    if (video) {
      setDuration(video.duration);
    }
  }, []);

  const handleEnded = useCallback(() => {
    setIsPlaying(false);
    setCurrentTime(0);
  }, []);

  const handlePlay = useCallback(() => setIsPlaying(true), []);
  const handlePause = useCallback(() => setIsPlaying(false), []);

  // ── Toggle play / pause ──
  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      video.play().catch(() => {});
    } else {
      video.pause();
    }
  }, []);

  // ── Toggle mute ──
  const toggleMute = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
    setIsMuted(video.muted);
  }, []);

  // ── Seek via progress bar click ──
  const handleProgressClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const video = videoRef.current;
      const bar = progressRef.current;
      if (!video || !bar || !duration) return;

      const rect = bar.getBoundingClientRect();
      const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
      const pct = x / rect.width;
      video.currentTime = pct * duration;
      setCurrentTime(pct * duration);
    },
    [duration]
  );

  // ── Auto-play ──
  useEffect(() => {
    if (autoPlay && hasClipUrl) {
      const video = videoRef.current;
      if (video) {
        video.play().catch(() => {});
      }
    }
  }, [hasClipUrl, autoPlay]);

  // ── Computed ──
  const progressPct = duration > 0 ? (currentTime / duration) * 100 : 0;
  const clipDuration = clip.endTime - clip.startTime;

  // ═══════════════════════════════════════════════════════════════════════════
  //  FALLBACK: No clipUrl → static thumbnail preview (like PhonePreview)
  // ═══════════════════════════════════════════════════════════════════════════
  if (!hasClipUrl) {
    return (
      <div className="flex flex-col items-center gap-3">
        <motion.div
          initial={{ opacity: 0, scale: 0.92 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4 }}
          className="relative"
        >
          {/* Phone-style frame */}
          <div className="relative w-[240px] sm:w-[280px] rounded-[2rem] bg-zinc-800 border-2 border-zinc-700 p-2 shadow-2xl">
            {/* Notch */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-24 h-6 bg-zinc-800 rounded-b-2xl z-10" />

            {/* Screen */}
            <div className="relative rounded-[1.75rem] overflow-hidden aspect-[9/16] bg-gradient-to-br from-zinc-800 via-zinc-900 to-zinc-800">
              {/* Thumbnail or gradient bg */}
              {hasThumbnail ? (
                <Image
                  src={clip.thumbnailUrl}
                  alt={clip.title}
                  fill
                  className="object-cover"
                  sizes="280px"
                />
              ) : (
                <div className="absolute inset-0 bg-gradient-to-br from-orange-500/10 via-transparent to-amber-500/10" />
              )}

              {/* Dark overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/30" />

              {/* Hook at top */}
              <div className="absolute top-8 left-3 right-3">
                <p className="text-white text-xs sm:text-sm font-bold leading-tight drop-shadow-lg">
                  &ldquo;{clip.hook}&rdquo;
                </p>
              </div>

              {/* Emotion badge */}
              <div className="absolute top-8 right-3">
                <Badge
                  variant="outline"
                  className={`${emotion.bg} ${emotion.color} text-[10px] font-medium border px-1.5 py-0`}
                >
                  {emotion.emoji}
                </Badge>
              </div>

              {/* Caption preview at bottom */}
              <div className="absolute bottom-8 left-3 right-3 space-y-1">
                {clip.captions.slice(0, 3).map((cap, idx) => (
                  <p
                    key={idx}
                    className={`text-center text-xs font-extrabold leading-tight drop-shadow-lg ${
                      idx === 0 ? "text-white" : "text-zinc-400"
                    }`}
                    style={{ textShadow: "0 2px 4px rgba(0,0,0,0.8)" }}
                  >
                    {cap.text}
                  </p>
                ))}
              </div>

              {/* Duration badge */}
              <div className="absolute bottom-2 right-3">
                <span className="text-zinc-400 text-[10px] font-mono">
                  {formatTimestamp(clipDuration)}
                </span>
              </div>
            </div>
          </div>
        </motion.div>

        <p className="text-zinc-500 text-xs text-center">
          Video preview unavailable — showing thumbnail
        </p>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  //  MAIN: Video player with caption overlay
  // ═══════════════════════════════════════════════════════════════════════════
  return (
    <div className="flex flex-col items-center gap-3">
      <motion.div
        initial={{ opacity: 0, scale: 0.92 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4 }}
        className="relative"
      >
        {/* Phone-style frame */}
        <div className="relative w-[240px] sm:w-[280px] rounded-[2rem] bg-zinc-800 border-2 border-zinc-700 p-2 shadow-2xl">
          {/* Notch */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-24 h-6 bg-zinc-800 rounded-b-2xl z-20" />

          {/* Screen area */}
          <div
            className="relative rounded-[1.75rem] overflow-hidden aspect-[9/16] bg-black cursor-pointer"
            onClick={togglePlay}
          >
            {/* Video element */}
            <video
              ref={videoRef}
              src={clip.clipUrl}
              className="absolute inset-0 w-full h-full object-cover"
              playsInline
              preload="metadata"
              onTimeUpdate={handleTimeUpdate}
              onLoadedMetadata={handleLoadedMetadata}
              onEnded={handleEnded}
              onPlay={handlePlay}
              onPause={handlePause}
            />

            {/* ── Overlays (only show when not playing or on hover) ── */}

            {/* Hook / Headline at top */}
            <div className="absolute top-6 left-3 right-10 z-10 pointer-events-none">
              <motion.p
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2, duration: 0.4 }}
                className="text-white text-[11px] sm:text-xs font-bold leading-tight drop-shadow-lg line-clamp-2"
                style={{ textShadow: "0 2px 6px rgba(0,0,0,0.9)" }}
              >
                &ldquo;{clip.hook}&rdquo;
              </motion.p>
            </div>

            {/* Emotion badge top-right */}
            <div className="absolute top-6 right-3 z-10 pointer-events-none">
              <Badge
                variant="outline"
                className={`${emotion.bg} ${emotion.color} text-[10px] font-medium border px-1.5 py-0 backdrop-blur-sm`}
              >
                {emotion.emoji} {clip.emotion}
              </Badge>
            </div>

            {/* ── Caption overlay ── */}
            <div className="absolute bottom-12 left-3 right-3 z-10 pointer-events-none">
              {/* Karaoke style: all captions visible, current highlighted */}
              {clip.captionStyle === "karaoke" && relativeCaptions.length > 0 && (
                <div className="space-y-0.5 max-h-32 overflow-hidden">
                  {relativeCaptions.map((cap, idx) => {
                    const isActive = idx === activeCaptionIdx;
                    const isPast = idx < activeCaptionIdx;

                    return (
                      <motion.p
                        key={idx}
                        initial={false}
                        animate={{
                          scale: isActive ? 1.03 : 1,
                          opacity: isActive ? 1 : isPast ? 0.4 : 0.55,
                        }}
                        transition={{ duration: 0.2 }}
                        className="text-center text-[11px] sm:text-xs font-extrabold leading-tight"
                        style={{
                          color: isActive
                            ? "#ffffff"
                            : isPast
                            ? "rgba(161,161,170,0.7)"
                            : "rgba(161,161,170,0.55)",
                          textShadow: isActive
                            ? "0 0 12px rgba(249,115,22,0.6), 0 0 24px rgba(249,115,22,0.3), 0 2px 4px rgba(0,0,0,0.9)"
                            : "0 2px 4px rgba(0,0,0,0.8)",
                        }}
                      >
                        {cap.text}
                        {isActive && isPlaying && (
                          <span className="inline-block w-[2px] h-3 bg-orange-400 ml-0.5 animate-pulse align-middle" />
                        )}
                      </motion.p>
                    );
                  })}
                </div>
              )}

              {/* Bold style: only current caption, large pop animation */}
              {clip.captionStyle === "bold" && activeCaptionIdx >= 0 && (
                <AnimatePresence mode="wait">
                  <motion.p
                    key={activeCaptionIdx}
                    initial={{ opacity: 0, scale: 0.85, y: 8 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 1.05, y: -4 }}
                    transition={{ duration: 0.2, ease: "easeOut" }}
                    className="text-center text-sm sm:text-base font-black text-white leading-tight uppercase drop-shadow-lg"
                    style={{
                      textShadow:
                        "0 0 2px rgba(0,0,0,1), 0 2px 4px rgba(0,0,0,0.9), 0 4px 8px rgba(0,0,0,0.6)",
                    }}
                  >
                    {relativeCaptions[activeCaptionIdx]?.text}
                  </motion.p>
                </AnimatePresence>
              )}

              {/* Minimal style: only current caption, subtle fade */}
              {clip.captionStyle === "minimal" && activeCaptionIdx >= 0 && (
                <AnimatePresence mode="wait">
                  <motion.p
                    key={activeCaptionIdx}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.25, ease: "easeInOut" }}
                    className="text-center text-xs sm:text-sm font-light text-white/90 leading-relaxed tracking-wide"
                    style={{
                      textShadow: "0 1px 3px rgba(0,0,0,0.8)",
                    }}
                  >
                    {relativeCaptions[activeCaptionIdx]?.text}
                  </motion.p>
                </AnimatePresence>
              )}
            </div>

            {/* ── Center play/pause overlay ── */}
            <AnimatePresence>
              {!isPlaying && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="absolute inset-0 flex items-center justify-center z-10"
                >
                  <motion.div
                    whileHover={{ scale: 1.12 }}
                    whileTap={{ scale: 0.95 }}
                    className="w-12 h-12 rounded-full bg-black/40 backdrop-blur-md flex items-center justify-center border border-white/20 shadow-xl"
                  >
                    <Play className="w-5 h-5 text-white ml-0.5" fill="currentColor" />
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* ── Bottom control bar ── */}
            <div
              className="absolute bottom-0 left-0 right-0 z-20"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Progress / seek bar */}
              <div
                ref={progressRef}
                className="mx-3 mb-1 h-1 bg-white/20 rounded-full cursor-pointer group relative"
                onClick={handleProgressClick}
              >
                {/* Buffered / played fill */}
                <div
                  className="absolute top-0 left-0 h-full bg-gradient-to-r from-orange-500 to-amber-400 rounded-full transition-[width] duration-100"
                  style={{ width: `${progressPct}%` }}
                />
                {/* Thumb dot */}
                <div
                  className="absolute top-1/2 -translate-y-1/2 w-2.5 h-2.5 bg-white rounded-full shadow-md opacity-0 group-hover:opacity-100 transition-opacity"
                  style={{ left: `calc(${progressPct}% - 5px)` }}
                />
              </div>

              {/* Controls row */}
              <div className="flex items-center justify-between px-3 pb-2">
                {/* Play / Pause */}
                <button
                  onClick={togglePlay}
                  className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-white/10 transition-colors"
                  aria-label={isPlaying ? "Pause" : "Play"}
                >
                  {isPlaying ? (
                    <Pause className="w-3.5 h-3.5 text-white" fill="currentColor" />
                  ) : (
                    <Play className="w-3.5 h-3.5 text-white ml-0.5" fill="currentColor" />
                  )}
                </button>

                {/* Timestamp */}
                <span className="text-white/70 text-[10px] font-mono tracking-wide">
                  {formatTimestamp(currentTime)} / {formatTimestamp(duration || clipDuration)}
                </span>

                {/* Mute toggle */}
                <button
                  onClick={toggleMute}
                  className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-white/10 transition-colors"
                  aria-label={isMuted ? "Unmute" : "Mute"}
                >
                  {isMuted ? (
                    <VolumeX className="w-3.5 h-3.5 text-white/60" />
                  ) : (
                    <Volume2 className="w-3.5 h-3.5 text-white/60" />
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      <p className="text-zinc-500 text-xs text-center">
        {isPlaying ? "Playing clip…" : "Tap video to play"}
      </p>
    </div>
  );
}
