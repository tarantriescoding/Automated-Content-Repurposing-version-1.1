import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import fs from "fs";
import path from "path";
import { execFile } from "child_process";
import { promisify } from "util";

const execFileAsync = promisify(execFile);
const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads");

/**
 * GET /api/clips/[id]/export
 * Export a clip as MP4 video or SRT caption file.
 *
 * Query params:
 *   format=srt  →  download SRT caption file
 *   (default)   →  stream/download MP4 clip video
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const format = request.nextUrl.searchParams.get("format"); // "srt" or undefined

    const clip = await db.clip.findUnique({
      where: { id },
      include: {
        video: {
          select: {
            id: true,
            filename: true,
            originalUrl: true,
          },
        },
      },
    });

    if (!clip) {
      return NextResponse.json({ error: "Clip not found" }, { status: 404 });
    }

    // ── SRT export ──────────────────────────────────────────────
    if (format === "srt") {
      return await handleSrtExport(clip);
    }

    // ── MP4 video export ────────────────────────────────────────
    return await handleVideoExport(clip);
  } catch (error) {
    console.error("[Export] Error exporting clip:", error);
    return NextResponse.json(
      { error: "Failed to export clip" },
      { status: 500 }
    );
  }
}

// ── SRT Export Handler ────────────────────────────────────────────

async function handleSrtExport(clip: {
  id: string;
  title: string;
  startTime: number;
  captions: string;
  srtUrl: string;
}) {
  // If we already have an SRT file, serve it directly
  if (clip.srtUrl) {
    const srtPath = path.join(process.cwd(), "public", clip.srtUrl);
    if (fs.existsSync(srtPath)) {
      const srtContent = fs.readFileSync(srtPath);
      const safeTitle = sanitizeFilename(clip.title || "clip");
      return new Response(srtContent, {
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Content-Disposition": `attachment; filename="${safeTitle}.srt"`,
        },
      });
    }
  }

  // Otherwise, generate SRT on-the-fly from captions JSON
  try {
    let captions: Array<{ text: string; start: number; end: number }> = [];
    try {
      captions = JSON.parse(clip.captions || "[]");
    } catch {
      captions = [];
    }

    if (captions.length === 0) {
      return NextResponse.json(
        { error: "No captions available for this clip" },
        { status: 404 }
      );
    }

    const srtContent = generateSrt(captions, clip.startTime);
    const safeTitle = sanitizeFilename(clip.title || "clip");

    return new Response(srtContent, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Content-Disposition": `attachment; filename="${safeTitle}.srt"`,
      },
    });
  } catch (error) {
    console.error("[Export] Failed to generate SRT on-the-fly:", error);
    return NextResponse.json(
      { error: "Failed to generate SRT file" },
      { status: 500 }
    );
  }
}

// ── Video Export Handler ──────────────────────────────────────────

async function handleVideoExport(clip: {
  id: string;
  title: string;
  startTime: number;
  endTime: number;
  clipUrl: string;
  video: { id: string; filename: string; originalUrl: string };
}) {
  // If we already have an extracted clip file, serve it
  if (clip.clipUrl) {
    const clipPath = path.join(process.cwd(), "public", clip.clipUrl);
    if (fs.existsSync(clipPath)) {
      const stat = fs.statSync(clipPath);
      const fileStream = fs.createReadStream(clipPath);
      return new Response(fileStream as unknown as ReadableStream, {
        headers: {
          "Content-Type": "video/mp4",
          "Content-Disposition": `inline; filename="${sanitizeFilename(clip.title || "clip")}.mp4"`,
          "Content-Length": stat.size.toString(),
        },
      });
    }
  }

  // Otherwise, extract on-the-fly using ffmpeg
  console.log(`[Export] Extracting clip ${clip.id} on-the-fly (no pre-extracted file)`);

  const videoPath = resolveVideoPath(clip.video.originalUrl);
  if (!videoPath) {
    return NextResponse.json(
      { error: "Source video file not found" },
      { status: 404 }
    );
  }

  const clipStart = clip.startTime;
  const clipEnd = clip.endTime;
  const clipDuration = clipEnd - clipStart;

  if (clipDuration <= 0) {
    return NextResponse.json(
      { error: "Invalid clip duration" },
      { status: 400 }
    );
  }

  // Ensure upload directory exists for on-the-fly extraction
  if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  }

  const tempClipFilename = `clip_${clip.id}_export_${Date.now()}.mp4`;
  const tempClipPath = path.join(UPLOAD_DIR, tempClipFilename);

  try {
    // Fast seek: -ss before -i, -t for duration
    await execFileAsync("ffmpeg", [
      "-ss", clipStart.toString(),
      "-i", videoPath,
      "-t", clipDuration.toString(),
      "-c:v", "libx264",
      "-c:a", "aac",
      "-y",
      tempClipPath,
    ]);

    if (!fs.existsSync(tempClipPath)) {
      throw new Error("ffmpeg did not produce output file");
    }

    const stat = fs.statSync(tempClipPath);
    const fileStream = fs.createReadStream(tempClipPath);

    // Save the clip URL for future requests
    const clipUrl = `/uploads/${tempClipFilename}`;
    await db.clip.update({
      where: { id: clip.id },
      data: { clipUrl },
    });

    console.log(`[Export] On-the-fly extraction complete for clip ${clip.id}`);

    return new Response(fileStream as unknown as ReadableStream, {
      headers: {
        "Content-Type": "video/mp4",
        "Content-Disposition": `inline; filename="${sanitizeFilename(clip.title || "clip")}.mp4"`,
        "Content-Length": stat.size.toString(),
      },
    });
  } catch (ffmpegError) {
    console.error(`[Export] ffmpeg on-the-fly extraction failed for clip ${clip.id}:`, ffmpegError);

    // Try fallback: -ss after -i (slower but more accurate)
    try {
      await execFileAsync("ffmpeg", [
        "-i", videoPath,
        "-ss", clipStart.toString(),
        "-to", clipEnd.toString(),
        "-c:v", "libx264",
        "-c:a", "aac",
        "-y",
        tempClipPath,
      ]);

      if (!fs.existsSync(tempClipPath)) {
        throw new Error("Fallback ffmpeg did not produce output file");
      }

      const stat = fs.statSync(tempClipPath);
      const fileStream = fs.createReadStream(tempClipPath);

      const clipUrl = `/uploads/${tempClipFilename}`;
      await db.clip.update({
        where: { id: clip.id },
        data: { clipUrl },
      });

      console.log(`[Export] On-the-fly extraction (fallback) complete for clip ${clip.id}`);

      return new Response(fileStream as unknown as ReadableStream, {
        headers: {
          "Content-Type": "video/mp4",
          "Content-Disposition": `inline; filename="${sanitizeFilename(clip.title || "clip")}.mp4"`,
          "Content-Length": stat.size.toString(),
        },
      });
    } catch (fallbackError) {
      console.error(`[Export] Fallback extraction also failed for clip ${clip.id}:`, fallbackError);

      // Clean up temp file if it exists
      try { fs.unlinkSync(tempClipPath); } catch {}

      return NextResponse.json(
        { error: "Failed to extract clip video" },
        { status: 500 }
      );
    }
  }
}

// ── Utility Functions ─────────────────────────────────────────────

function resolveVideoPath(originalUrl: string): string | null {
  if (originalUrl.startsWith("/")) {
    const publicPath = path.join(process.cwd(), "public", originalUrl);
    if (fs.existsSync(publicPath)) {
      return publicPath;
    }
  }

  if (originalUrl.startsWith("/upload/")) {
    const uploadPath = path.join(process.cwd(), originalUrl);
    if (fs.existsSync(uploadPath)) {
      return uploadPath;
    }
  }

  if (fs.existsSync(originalUrl)) {
    return originalUrl;
  }

  return null;
}

function sanitizeFilename(name: string): string {
  return name
    .replace(/[^a-zA-Z0-9_\-\s]/g, "")
    .replace(/\s+/g, "_")
    .slice(0, 50)
    || "clip";
}

/**
 * Generate SRT content from captions array.
 * Captions have absolute times; we convert to clip-relative times
 * by subtracting clipStartTime.
 */
function generateSrt(
  captions: Array<{ text: string; start: number; end: number }>,
  clipStartTime: number
): string {
  const lines: string[] = [];

  for (let i = 0; i < captions.length; i++) {
    const caption = captions[i];
    const relativeStart = Math.max(0, caption.start - clipStartTime);
    const relativeEnd = Math.max(0, caption.end - clipStartTime);

    lines.push(String(i + 1));
    lines.push(`${formatSrtTime(relativeStart)} --> ${formatSrtTime(relativeEnd)}`);
    lines.push(caption.text);
    lines.push("");
  }

  return lines.join("\n");
}

function formatSrtTime(seconds: number): string {
  const totalMs = Math.round(seconds * 1000);
  const ms = totalMs % 1000;
  const totalSeconds = Math.floor(totalMs / 1000);
  const s = totalSeconds % 60;
  const totalMinutes = Math.floor(totalSeconds / 60);
  const m = totalMinutes % 60;
  const h = Math.floor(totalMinutes / 60);

  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")},${String(ms).padStart(3, "0")}`;
}
