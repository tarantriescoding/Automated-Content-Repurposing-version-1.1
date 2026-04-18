"use client";

import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import Image from "next/image";
import type { ClipData } from "@/lib/types";

interface PhonePreviewProps {
  clip: ClipData;
}

export function PhonePreview({ clip }: PhonePreviewProps) {
  const [activeCaptionIdx, setActiveCaptionIdx] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const hasThumbnail = clip.thumbnailUrl && clip.thumbnailUrl.length > 0;

  // Auto-cycle through captions when "playing"
  useEffect(() => {
    if (isPlaying && clip.captions.length > 0) {
      timerRef.current = setInterval(() => {
        setActiveCaptionIdx((prev) => {
          if (prev >= clip.captions.length - 1) {
            setIsPlaying(false);
            return 0;
          }
          return prev + 1;
        });
      }, 1500);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isPlaying, clip.captions.length]);

  const handleTogglePlay = () => {
    if (isPlaying) {
      setIsPlaying(false);
      setActiveCaptionIdx(0);
    } else {
      setIsPlaying(true);
      setActiveCaptionIdx(0);
    }
  };

  const currentCaption = clip.captions[activeCaptionIdx];

  return (
    <div className="flex flex-col items-center gap-4">
      {/* Phone frame */}
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="relative cursor-pointer"
        onClick={handleTogglePlay}
      >
        {/* Phone outer frame */}
        <div className="relative w-[220px] sm:w-[260px] rounded-[2.5rem] bg-zinc-800 border-2 border-zinc-700 p-2 shadow-2xl">
          {/* Notch */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-24 h-6 bg-zinc-800 rounded-b-2xl z-10" />

          {/* Screen area */}
          <div className="relative rounded-[2rem] overflow-hidden aspect-[9/16] bg-gradient-to-br from-zinc-800 via-zinc-900 to-zinc-800">
            {/* Thumbnail or gradient background */}
            {hasThumbnail ? (
              <Image
                src={clip.thumbnailUrl}
                alt={clip.title}
                fill
                className="object-cover"
                sizes="260px"
              />
            ) : (
              <div className="absolute inset-0 bg-gradient-to-br from-orange-500/10 via-transparent to-amber-500/10" />
            )}

            {/* Dark overlay for text readability */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/30" />

            {/* Subtle grid pattern */}
            {!hasThumbnail && (
              <div
                className="absolute inset-0 opacity-5"
                style={{
                  backgroundImage:
                    "linear-gradient(rgba(255,255,255,.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.1) 1px, transparent 1px)",
                  backgroundSize: "20px 20px",
                }}
              />
            )}

            {/* Hook text at top */}
            <div className="absolute top-8 left-3 right-3">
              <p className="text-white text-xs sm:text-sm font-bold leading-tight drop-shadow-lg">
                &ldquo;{clip.hook}&rdquo;
              </p>
            </div>

            {/* Center play/pause icon */}
            <div className="absolute inset-0 flex items-center justify-center">
              <motion.div
                whileHover={{ scale: 1.1 }}
                className="w-10 h-10 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center border border-white/20"
              >
                {isPlaying ? (
                  <div className="flex items-center gap-1">
                    <div className="w-1.5 h-4 bg-white rounded-sm" />
                    <div className="w-1.5 h-4 bg-white rounded-sm" />
                  </div>
                ) : (
                  <svg
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    className="w-5 h-5 text-white ml-0.5"
                  >
                    <path d="M8 5v14l11-7z" />
                  </svg>
                )}
              </motion.div>
            </div>

            {/* Caption overlay at bottom */}
            <div className="absolute bottom-8 left-3 right-3">
              {clip.captionStyle === "karaoke" && (
                <div className="space-y-1">
                  {clip.captions.map((cap, idx) => (
                    <p
                      key={idx}
                      className={`text-center text-xs sm:text-sm font-extrabold leading-tight transition-all duration-300 ${
                        idx === activeCaptionIdx
                          ? "text-white scale-105"
                          : idx < activeCaptionIdx
                          ? "text-zinc-500"
                          : "text-zinc-400"
                      }`}
                      style={{
                        textShadow:
                          idx === activeCaptionIdx
                            ? "0 0 10px rgba(249,115,22,0.5), 0 2px 4px rgba(0,0,0,0.8)"
                            : "0 2px 4px rgba(0,0,0,0.8)",
                      }}
                    >
                      {cap.text}
                      {idx === activeCaptionIdx && isPlaying && (
                        <span className="inline-block w-0.5 h-3.5 bg-orange-400 ml-0.5 animate-pulse align-middle" />
                      )}
                    </p>
                  ))}
                </div>
              )}

              {clip.captionStyle === "bold" && (
                <motion.p
                  key={activeCaptionIdx}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="text-center text-sm sm:text-base font-black text-white leading-tight uppercase drop-shadow-lg"
                  style={{ textShadow: "0 2px 4px rgba(0,0,0,0.8)" }}
                >
                  {currentCaption?.text}
                </motion.p>
              )}

              {clip.captionStyle === "minimal" && (
                <motion.p
                  key={activeCaptionIdx}
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-center text-xs sm:text-sm font-light text-white/90 leading-relaxed tracking-wide"
                  style={{ textShadow: "0 1px 3px rgba(0,0,0,0.8)" }}
                >
                  {currentCaption?.text}
                </motion.p>
              )}
            </div>

            {/* Progress indicator */}
            {isPlaying && (
              <div className="absolute bottom-2 left-3 right-3">
                <div className="h-0.5 bg-white/20 rounded-full overflow-hidden">
                  <motion.div
                    className="h-full bg-orange-400 rounded-full"
                    initial={{ width: "0%" }}
                    animate={{
                      width: `${
                        ((activeCaptionIdx + 1) / clip.captions.length) * 100
                      }%`,
                    }}
                    transition={{ duration: 0.3 }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </motion.div>

      <p className="text-zinc-500 text-xs">
        {isPlaying ? "Playing captions..." : "Click phone to play captions"}
      </p>
    </div>
  );
}
