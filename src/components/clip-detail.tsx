"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  Download,
  Share2,
  X,
  Type,
  AlignCenter,
  Minimize2,
  RefreshCw,
  Loader2,
  FileText,
  Clock,
  Video,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ClipVideoPlayer } from "./clip-video-player";
import { useAppStore } from "@/lib/store";
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
  neutral: {
    emoji: "💬",
    color: "text-zinc-400",
    bg: "bg-zinc-500/20 border-zinc-500/30",
  },
};

const captionStyles: {
  id: ClipData["captionStyle"];
  label: string;
  icon: React.ElementType;
}[] = [
  { id: "karaoke", label: "Karaoke", icon: Type },
  { id: "bold", label: "Bold", icon: AlignCenter },
  { id: "minimal", label: "Minimal", icon: Minimize2 },
];

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

function formatDuration(seconds: number): string {
  const dur = Math.round(seconds);
  const m = Math.floor(dur / 60);
  const s = dur % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

interface ClipDetailProps {
  clip: ClipData;
}

export function ClipDetail({ clip }: ClipDetailProps) {
  const { setSelectedClip, clips } = useAppStore();
  const emotion = emotionConfig[clip.emotion] || emotionConfig.neutral;
  const [isGeneratingThumb, setIsGeneratingThumb] = useState(false);
  const [thumbUrl, setThumbUrl] = useState(clip.thumbnailUrl);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadFormat, setDownloadFormat] = useState<"mp4" | "srt" | null>(null);

  const clipDuration = clip.endTime - clip.startTime;

  const updateCaptionStyle = (style: ClipData["captionStyle"]) => {
    const updatedClips = clips.map((c) =>
      c.id === clip.id ? { ...c, captionStyle: style } : c
    );
    useAppStore.setState({
      clips: updatedClips,
      selectedClip: { ...clip, captionStyle: style },
    });
  };

  const handleRegenerateThumbnail = async () => {
    setIsGeneratingThumb(true);
    try {
      const res = await fetch(`/api/clips/${clip.id}/thumbnail`, {
        method: "POST",
      });
      if (res.ok) {
        const data = await res.json();
        setThumbUrl(data.thumbnailUrl);
        const updatedClips = clips.map((c) =>
          c.id === clip.id
            ? { ...c, thumbnailUrl: data.thumbnailUrl }
            : c
        );
        useAppStore.setState({
          clips: updatedClips,
          selectedClip: { ...clip, thumbnailUrl: data.thumbnailUrl },
        });
      }
    } catch (err) {
      console.error("Failed to regenerate thumbnail:", err);
    } finally {
      setIsGeneratingThumb(false);
    }
  };

  const handleDownload = async (format: "mp4" | "srt") => {
    setIsDownloading(true);
    setDownloadFormat(format);
    try {
      const url =
        format === "srt"
          ? `/api/clips/${clip.id}/export?format=srt`
          : `/api/clips/${clip.id}/export`;

      const res = await fetch(url);
      if (!res.ok) throw new Error("Download failed");

      const blob = await res.blob();
      const downloadUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = downloadUrl;
      a.download =
        format === "srt"
          ? `${clip.title.replace(/[^a-zA-Z0-9]/g, "_")}.srt`
          : `${clip.title.replace(/[^a-zA-Z0-9]/g, "_")}.mp4`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(downloadUrl);
    } catch (err) {
      console.error("Download error:", err);
    } finally {
      setIsDownloading(false);
      setDownloadFormat(null);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={() => setSelectedClip(null)}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        transition={{ duration: 0.3 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-4xl max-h-[90vh] overflow-hidden"
      >
        <Card className="bg-zinc-900 border-zinc-800 shadow-2xl">
          <CardContent className="p-0">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-zinc-800">
              <div className="flex items-center gap-3">
                <Badge
                  variant="outline"
                  className={`${emotion.bg} ${emotion.color} text-sm border`}
                >
                  {emotion.emoji} {clip.emotion}
                </Badge>
                <span className="text-zinc-400 text-sm flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5" />
                  {formatTime(clip.startTime)} - {formatTime(clip.endTime)}{" "}
                  <span className="text-zinc-600">
                    ({formatDuration(clipDuration)})
                  </span>
                </span>
                {clip.clipUrl && (
                  <Badge
                    variant="outline"
                    className="bg-emerald-500/20 border-emerald-500/30 text-emerald-400 text-xs"
                  >
                    <Video className="w-3 h-3 mr-1" />
                    Video Ready
                  </Badge>
                )}
              </div>
              <button
                onClick={() => setSelectedClip(null)}
                className="w-8 h-8 rounded-lg bg-zinc-800 border border-zinc-700 flex items-center justify-center hover:bg-zinc-700 transition-colors"
                aria-label="Close"
              >
                <X className="w-4 h-4 text-zinc-400" />
              </button>
            </div>

            {/* Content */}
            <div className="flex flex-col md:flex-row max-h-[calc(90vh-64px)]">
              {/* Left: Video Player */}
              <div className="flex-shrink-0 p-6 flex items-center justify-center border-b md:border-b-0 md:border-r border-zinc-800 bg-zinc-950/50">
                <ClipVideoPlayer clip={{ ...clip, thumbnailUrl: thumbUrl || clip.thumbnailUrl }} />
              </div>

              {/* Right: Controls & Transcript */}
              <div className="flex-1 min-w-0 overflow-hidden">
                <ScrollArea className="h-full max-h-[calc(90vh-64px)]">
                  <div className="p-6 space-y-6">
                    {/* Title */}
                    <div>
                      <label className="text-zinc-500 text-xs font-medium uppercase tracking-wider mb-2 block">
                        Clip Title
                      </label>
                      <div className="bg-zinc-800/50 border border-zinc-700 rounded-lg p-3">
                        <p className="text-white font-semibold">{clip.title}</p>
                      </div>
                    </div>

                    {/* Hook text */}
                    <div>
                      <label className="text-zinc-500 text-xs font-medium uppercase tracking-wider mb-2 block">
                        Hook / Headline
                      </label>
                      <div className="bg-zinc-800/50 border border-zinc-700 rounded-lg p-3">
                        <p className="text-orange-400 font-semibold text-lg">
                          &ldquo;{clip.hook}&rdquo;
                        </p>
                      </div>
                    </div>

                    {/* Viral Score */}
                    <div>
                      <label className="text-zinc-500 text-xs font-medium uppercase tracking-wider mb-2 block">
                        Viral Score
                      </label>
                      <div className="flex items-center gap-3">
                        <div className="flex-1 h-3 bg-zinc-800 rounded-full overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{
                              width: `${clip.sentimentScore * 100}%`,
                            }}
                            transition={{ duration: 0.8 }}
                            className="h-full rounded-full bg-gradient-to-r from-orange-500 to-amber-500"
                          />
                        </div>
                        <span className="text-orange-400 font-bold text-lg">
                          {Math.round(clip.sentimentScore * 100)}%
                        </span>
                      </div>
                    </div>

                    <Separator className="bg-zinc-800" />

                    {/* Caption Style Selector */}
                    <div>
                      <label className="text-zinc-500 text-xs font-medium uppercase tracking-wider mb-3 block">
                        Caption Style
                      </label>
                      <div className="flex gap-2">
                        {captionStyles.map((style) => (
                          <button
                            key={style.id}
                            onClick={() => updateCaptionStyle(style.id)}
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium transition-all ${
                              clip.captionStyle === style.id
                                ? "bg-orange-500/20 border-orange-500/50 text-orange-400"
                                : "bg-zinc-800 border-zinc-700 text-zinc-400 hover:border-zinc-600"
                            }`}
                          >
                            <style.icon className="w-4 h-4" />
                            {style.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <Separator className="bg-zinc-800" />

                    {/* Thumbnail */}
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <label className="text-zinc-500 text-xs font-medium uppercase tracking-wider">
                          AI Thumbnail
                        </label>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-zinc-400 hover:text-orange-400 h-7 text-xs"
                          onClick={handleRegenerateThumbnail}
                          disabled={isGeneratingThumb}
                        >
                          {isGeneratingThumb ? (
                            <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                          ) : (
                            <RefreshCw className="w-3 h-3 mr-1" />
                          )}
                          Regenerate
                        </Button>
                      </div>
                      {thumbUrl ? (
                        <div className="w-20 h-36 rounded-lg overflow-hidden border border-zinc-700">
                          <img
                            src={thumbUrl}
                            alt="Clip thumbnail"
                            className="w-full h-full object-cover"
                          />
                        </div>
                      ) : (
                        <div className="w-20 h-36 rounded-lg bg-zinc-800 border border-zinc-700 flex items-center justify-center">
                          <span className="text-zinc-600 text-xs">No thumbnail</span>
                        </div>
                      )}
                    </div>

                    <Separator className="bg-zinc-800" />

                    {/* Transcript / Timestamp Captions */}
                    <div>
                      <label className="text-zinc-500 text-xs font-medium uppercase tracking-wider mb-3 block">
                        Timestamp Captions
                      </label>
                      <div className="bg-zinc-800/50 border border-zinc-700 rounded-lg p-4 space-y-2 max-h-48 overflow-y-auto">
                        {clip.captions.length > 0 ? clip.captions.map((cap, idx) => (
                          <div
                            key={idx}
                            className="flex items-start gap-3"
                          >
                            <span className="text-orange-400/70 text-xs font-mono flex-shrink-0 mt-0.5 bg-orange-500/10 px-1.5 py-0.5 rounded">
                              {formatTime(cap.start)}
                            </span>
                            <p className="text-zinc-300 text-sm">
                              {cap.text}
                            </p>
                          </div>
                        )) : (
                          <p className="text-zinc-500 text-sm">No captions generated for this clip.</p>
                        )}
                      </div>
                    </div>

                    <Separator className="bg-zinc-800" />

                    {/* Download buttons */}
                    <div>
                      <label className="text-zinc-500 text-xs font-medium uppercase tracking-wider mb-3 block">
                        Download
                      </label>
                      <div className="flex gap-3">
                        <Button
                          className="flex-1 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-semibold"
                          onClick={() => handleDownload("mp4")}
                          disabled={isDownloading}
                        >
                          {isDownloading && downloadFormat === "mp4" ? (
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          ) : (
                            <Download className="w-4 h-4 mr-2" />
                          )}
                          Download MP4
                        </Button>
                        <Button
                          variant="outline"
                          className="border-zinc-700 text-zinc-300 hover:bg-zinc-800"
                          onClick={() => handleDownload("srt")}
                          disabled={isDownloading}
                        >
                          {isDownloading && downloadFormat === "srt" ? (
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          ) : (
                            <FileText className="w-4 h-4 mr-2" />
                          )}
                          SRT
                        </Button>
                        <Button
                          variant="outline"
                          className="border-zinc-700 text-zinc-300 hover:bg-zinc-800"
                          onClick={() => {
                            if (navigator.clipboard) {
                              const text = clip.captions.map((c, i) => `${formatTime(c.start)}: ${c.text}`).join("\n");
                              navigator.clipboard.writeText(text);
                            }
                          }}
                        >
                          <Share2 className="w-4 h-4 mr-2" />
                          Copy
                        </Button>
                      </div>
                      <p className="text-zinc-600 text-xs mt-2">
                        MP4 includes the clip video. SRT is a caption file you can import into any video editor.
                      </p>
                    </div>
                  </div>
                </ScrollArea>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
}
