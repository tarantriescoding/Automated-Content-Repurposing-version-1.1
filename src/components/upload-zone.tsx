"use client";

import { useCallback, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Upload,
  Film,
  FileVideo,
  X,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAppStore } from "@/lib/store";

const ACCEPTED_TYPES = [
  "video/mp4",
  "video/quicktime",
  "video/x-msvideo",
  "video/webm",
];
const MAX_SIZE_MB = 500;
const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024;

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function UploadZone() {
  const {
    isDragging,
    setIsDragging,
    uploadFile,
    setUploadFile,
    setView,
    setProcessingStage,
    setProcessingProgress,
    setCurrentVideo,
    addProcessingLog,
    clearProcessingLogs,
  } = useAppStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const validateFile = useCallback((file: File): boolean => {
    if (!ACCEPTED_TYPES.includes(file.type)) {
      setError(
        "Unsupported file type. Please upload MP4, MOV, AVI, or WebM."
      );
      return false;
    }
    if (file.size > MAX_SIZE_BYTES) {
      setError(`File too large. Maximum size is ${MAX_SIZE_MB}MB.`);
      return false;
    }
    setError(null);
    return true;
  }, []);

  const handleDragOver = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(true);
    },
    [setIsDragging]
  );

  const handleDragLeave = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);
    },
    [setIsDragging]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file && validateFile(file)) {
        setUploadFile(file);
      }
    },
    [setIsDragging, setUploadFile, validateFile]
  );

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file && validateFile(file)) {
        setUploadFile(file);
      }
    },
    [setUploadFile, validateFile]
  );

  const handleRemoveFile = useCallback(() => {
    setUploadFile(null);
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, [setUploadFile]);

  const handleUpload = useCallback(async () => {
    if (!uploadFile) return;

    setIsUploading(true);
    clearProcessingLogs();
    addProcessingLog({
      timestamp: new Date().toLocaleTimeString(),
      message: `Starting upload: ${uploadFile.name}`,
      type: "info",
    });

    try {
      // Step 1: Upload the video file
      const formData = new FormData();
      formData.append("video", uploadFile);

      setProcessingStage("uploading");
      setProcessingProgress(5);

      const uploadRes = await fetch("/api/videos/upload", {
        method: "POST",
        body: formData,
      });

      if (!uploadRes.ok) {
        const errData = await uploadRes.json();
        throw new Error(errData.error || "Upload failed");
      }

      const { video } = await uploadRes.json();

      addProcessingLog({
        timestamp: new Date().toLocaleTimeString(),
        message: `Upload complete! Video ID: ${video.id}`,
        type: "success",
      });

      setCurrentVideo(video);
      setProcessingProgress(15);

      // Step 2: Switch to processing view
      setView("processing");

      // Step 3: Start the processing pipeline
      addProcessingLog({
        timestamp: new Date().toLocaleTimeString(),
        message: "Starting AI processing pipeline...",
        type: "info",
      });

      setProcessingStage("transcribing");
      setProcessingProgress(20);

      const processRes = await fetch(`/api/videos/${video.id}/process`, {
        method: "POST",
      });

      if (!processRes.ok) {
        const errData = await processRes.json();
        throw new Error(errData.error || "Processing failed to start");
      }

      addProcessingLog({
        timestamp: new Date().toLocaleTimeString(),
        message: "AI processing pipeline started!",
        type: "success",
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Upload failed";
      setError(message);
      addProcessingLog({
        timestamp: new Date().toLocaleTimeString(),
        message: `Error: ${message}`,
        type: "warning",
      });
      setIsUploading(false);
    }
  }, [
    uploadFile,
    setView,
    setProcessingStage,
    setProcessingProgress,
    setCurrentVideo,
    addProcessingLog,
    clearProcessingLogs,
  ]);

  return (
    <section className="w-full max-w-3xl mx-auto px-4 sm:px-6 py-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.6 }}
      >
        {/* Drag and Drop Zone */}
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`relative rounded-2xl border-2 border-dashed transition-all duration-300 ${
            isUploading
              ? "border-orange-400/50 bg-orange-500/5 pointer-events-none"
              : isDragging
              ? "border-orange-400 bg-orange-500/10 scale-[1.02]"
              : uploadFile
              ? "border-emerald-500/50 bg-emerald-500/5"
              : "border-zinc-700 bg-zinc-900/50 hover:border-zinc-600 hover:bg-zinc-900/80"
          }`}
        >
          <AnimatePresence mode="wait">
            {isUploading ? (
              <motion.div
                key="uploading"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="p-12 sm:p-16 flex flex-col items-center gap-4"
              >
                <Loader2 className="w-12 h-12 text-orange-400 animate-spin" />
                <p className="text-white font-semibold text-lg">
                  Uploading your video...
                </p>
                <p className="text-zinc-400 text-sm">
                  This may take a moment for large files
                </p>
              </motion.div>
            ) : uploadFile ? (
              <motion.div
                key="file-selected"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="p-8 flex flex-col items-center gap-4"
              >
                <div className="flex items-center gap-3 w-full max-w-sm">
                  <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center">
                    <FileVideo className="w-6 h-6 text-emerald-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-medium truncate">
                      {uploadFile.name}
                    </p>
                    <p className="text-zinc-400 text-sm">
                      {formatFileSize(uploadFile.size)}
                    </p>
                  </div>
                  <button
                    onClick={handleRemoveFile}
                    className="flex-shrink-0 w-8 h-8 rounded-lg bg-zinc-800 border border-zinc-700 flex items-center justify-center hover:bg-zinc-700 transition-colors"
                    aria-label="Remove file"
                  >
                    <X className="w-4 h-4 text-zinc-400" />
                  </button>
                </div>

                <Button
                  onClick={handleUpload}
                  size="lg"
                  className="w-full max-w-sm bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-semibold text-base shadow-lg shadow-orange-500/25 animate-pulse-glow"
                >
                  <Upload className="w-5 h-5 mr-2" />
                  Start Processing
                </Button>
              </motion.div>
            ) : (
              <motion.div
                key="upload-zone"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="p-12 sm:p-16 flex flex-col items-center gap-4 cursor-pointer"
                onClick={() => fileInputRef.current?.click()}
              >
                <div className="w-16 h-16 rounded-2xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center mb-2">
                  <Film className="w-8 h-8 text-orange-400" />
                </div>
                <div className="text-center">
                  <p className="text-white font-semibold text-lg mb-1">
                    Drop your video here
                  </p>
                  <p className="text-zinc-400 text-sm">
                    or click to browse your files
                  </p>
                </div>
                <div className="flex items-center gap-2 text-zinc-500 text-xs">
                  <span className="px-2 py-1 rounded bg-zinc-800 border border-zinc-700">
                    MP4
                  </span>
                  <span className="px-2 py-1 rounded bg-zinc-800 border border-zinc-700">
                    MOV
                  </span>
                  <span className="px-2 py-1 rounded bg-zinc-800 border border-zinc-700">
                    AVI
                  </span>
                  <span className="px-2 py-1 rounded bg-zinc-800 border border-zinc-700">
                    WebM
                  </span>
                </div>
                <p className="text-zinc-500 text-xs">
                  Maximum file size: {MAX_SIZE_MB}MB
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={ACCEPTED_TYPES.join(",")}
                  onChange={handleFileChange}
                  className="hidden"
                  aria-label="Upload video file"
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Error message */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="mt-4 flex items-center gap-2 text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3"
            >
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {error}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </section>
  );
}
