import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import fs from "fs";
import path from "path";
import { execFile } from "child_process";
import { promisify } from "util";

const execFileAsync = promisify(execFile);
const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads");

/**
 * POST /api/clips/[id]/extract
 * Extract the video clip file and SRT for an existing clip that doesn't have them yet.
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const clip = await db.clip.findUnique({
      where: { id },
      include: {
        video: {
          select: { id: true, filename: true, originalUrl: true },
        },
      },
    });

    if (!clip) {
      return NextResponse.json({ error: "Clip not found" }, { status: 404 });
    }

    const videoPath = resolveVideoPath(clip.video.originalUrl);
    if (!videoPath) {
      return NextResponse.json(
        { error: "Source video file not found" },
        { status: 404 }
      );
    }

    if (!fs.existsSync(UPLOAD_DIR)) {
      fs.mkdirSync(UPLOAD_DIR, { recursive: true });
    }

    let clipUrl = clip.clipUrl;
    let srtUrl = clip.srtUrl;

    // Extract video clip if not already done
    if (!clipUrl) {
      const clipStart = clip.startTime;
      const clipEnd = clip.endTime;
      const clipDuration = clipEnd - clipStart;

      if (clipDuration > 0) {
        const clipFilename = `clip_${clip.id}_${Date.now()}.mp4`;
        const clipPath = path.join(UPLOAD_DIR, clipFilename);

        try {
          // Use stream copy for fast extraction (no re-encoding)
          await execFileAsync("ffmpeg", [
            "-ss", clipStart.toString(),
            "-i", videoPath,
            "-t", clipDuration.toString(),
            "-c", "copy",
            "-avoid_negative_ts", "make_zero",
            "-y",
            clipPath,
          ], { timeout: 30000 });

          if (fs.existsSync(clipPath)) {
            clipUrl = `/uploads/${clipFilename}`;
          }
        } catch {
          // Fallback: accurate seek with stream copy
          try {
            await execFileAsync("ffmpeg", [
              "-i", videoPath,
              "-ss", clipStart.toString(),
              "-to", clipEnd.toString(),
              "-c", "copy",
              "-avoid_negative_ts", "make_zero",
              "-y",
              clipPath,
            ], { timeout: 30000 });
            if (fs.existsSync(clipPath)) {
              clipUrl = `/uploads/${clipFilename}`;
            }
          } catch (fallbackErr) {
            console.error("[Extract] Fallback also failed:", fallbackErr);
          }
        }
      }
    }

    // Generate SRT if not already done
    if (!srtUrl) {
      try {
        let captions: Array<{ text: string; start: number; end: number }> = [];
        try {
          captions = JSON.parse(clip.captions || "[]");
        } catch {}

        if (captions.length > 0) {
          const srtContent = generateSrt(captions, clip.startTime);
          const srtFilename = `clip_${clip.id}_${Date.now()}.srt`;
          const srtPath = path.join(UPLOAD_DIR, srtFilename);
          fs.writeFileSync(srtPath, srtContent, "utf-8");
          srtUrl = `/uploads/${srtFilename}`;
        }
      } catch (srtErr) {
        console.error("[Extract] SRT generation failed:", srtErr);
      }
    }

    // Update the clip record
    await db.clip.update({
      where: { id },
      data: { clipUrl, srtUrl },
    });

    return NextResponse.json({
      message: "Clip extraction complete",
      clipUrl,
      srtUrl,
    });
  } catch (error) {
    console.error("[Extract] Error:", error);
    return NextResponse.json(
      { error: "Failed to extract clip" },
      { status: 500 }
    );
  }
}

function resolveVideoPath(originalUrl: string): string | null {
  if (originalUrl.startsWith("/")) {
    const publicPath = path.join(process.cwd(), "public", originalUrl);
    if (fs.existsSync(publicPath)) return publicPath;
  }
  if (originalUrl.startsWith("/upload/")) {
    const uploadPath = path.join(process.cwd(), originalUrl);
    if (fs.existsSync(uploadPath)) return uploadPath;
  }
  if (fs.existsSync(originalUrl)) return originalUrl;
  return null;
}

function generateSrt(
  captions: Array<{ text: string; start: number; end: number }>,
  clipStartTime: number
): string {
  const lines: string[] = [];

  // Detect if captions are already relative (start near 0) or absolute
  const firstStart = captions.length > 0 ? captions[0].start : 0;
  const isAlreadyRelative = firstStart < 5;

  for (let i = 0; i < captions.length; i++) {
    const c = captions[i];
    const relStart = isAlreadyRelative ? c.start : Math.max(0, c.start - clipStartTime);
    const relEnd = isAlreadyRelative ? c.end : Math.max(0, c.end - clipStartTime);
    lines.push(String(i + 1));
    lines.push(`${formatSrtTime(relStart)} --> ${formatSrtTime(relEnd)}`);
    lines.push(c.text);
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
