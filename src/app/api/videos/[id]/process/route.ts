import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import ZAI from "z-ai-web-dev-sdk";
import fs from "fs";
import path from "path";
import { execFile } from "child_process";
import { promisify } from "util";

const execFileAsync = promisify(execFile);
const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads");
const TEMP_DIR = path.join(process.cwd(), "tmp");
const ASR_CHUNK_SECONDS = 25; // ASR limit is 30s, use 25s for safety

const ANALYSIS_SYSTEM_PROMPT = `You are an expert content strategist who specializes in identifying viral moments in long-form video content. Your job is to analyze a video transcript and identify the 3-5 most emotionally impactful "golden nugget" moments that would make great 30-60 second short-form clips for TikTok, Reels, or Shorts.

For each moment, provide:
- start_time: approximate start time in seconds (estimate from transcript context)
- end_time: approximate end time in seconds
- emotion: the primary emotion (inspiring, passionate, humorous, shocking, motivational, profound, angry, joyful)
- hook: a catchy 3-6 word headline that would stop someone from scrolling (e.g., "This changed everything for me", "Why 90% of people fail", "The secret nobody tells you")
- sentiment_score: how emotionally charged this moment is (0.0 to 1.0, where 1.0 is maximum emotion)
- title: a short descriptive title for the clip

Look for:
- Sudden energy shifts (quiet to loud, calm to passionate)
- Profound statements or revelations
- Humorous punchlines or unexpected turns
- Motivational peaks
- Story climaxes

Respond with ONLY valid JSON in this format:
{
  "clips": [
    {
      "start_time": 120,
      "end_time": 155,
      "emotion": "inspiring",
      "hook": "This one habit changes everything",
      "sentiment_score": 0.85,
      "title": "The Power of Morning Routines"
    }
  ]
}`;

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  // Verify video exists
  const video = await db.video.findUnique({ where: { id } });
  if (!video) {
    return NextResponse.json({ error: "Video not found" }, { status: 404 });
  }

  if (video.status === "transcribing" || video.status === "analyzing" || video.status === "generating") {
    return NextResponse.json(
      { error: "Video is already being processed", status: video.status },
      { status: 409 }
    );
  }

  // Reset status from error if retrying
  if (video.status === "error") {
    await db.video.update({
      where: { id },
      data: { status: "uploaded" },
    });
  }

  // Start processing in the background
  processVideo(id).catch((err) => {
    console.error(`Background processing failed for video ${id}:`, err);
  });

  return NextResponse.json({
    message: "Processing started",
    videoId: id,
  });
}

// ── Utility Functions ──────────────────────────────────────────────

async function getVideoDuration(videoPath: string): Promise<number> {
  try {
    const { stdout } = await execFileAsync("ffprobe", [
      "-v", "error",
      "-show_entries", "format=duration",
      "-of", "default=noprint_wrappers=1:nokey=1",
      videoPath,
    ]);
    return parseFloat(stdout.trim()) || 0;
  } catch {
    console.error("[Process] Could not get video duration with ffprobe");
    return 0;
  }
}

async function extractAudioAsWav(videoPath: string, outputPath: string): Promise<boolean> {
  try {
    await execFileAsync("ffmpeg", [
      "-i", videoPath,
      "-vn",
      "-acodec", "pcm_s16le",
      "-ar", "16000",
      "-ac", "1",
      "-y",
      outputPath,
    ]);
    return fs.existsSync(outputPath);
  } catch (err) {
    console.error("[Process] ffmpeg audio extraction failed:", err);
    return false;
  }
}

// Extract a specific time range of audio as WAV (for chunking)
async function extractAudioChunk(
  videoPath: string,
  outputPath: string,
  startTime: number,
  duration: number
): Promise<boolean> {
  try {
    await execFileAsync("ffmpeg", [
      "-i", videoPath,
      "-vn",
      "-acodec", "pcm_s16le",
      "-ar", "16000",
      "-ac", "1",
      "-ss", startTime.toString(),
      "-t", duration.toString(),
      "-y",
      outputPath,
    ]);
    return fs.existsSync(outputPath);
  } catch (err) {
    console.error(`[Process] ffmpeg chunk extraction failed (${startTime}s-${startTime + duration}s):`, err);
    return false;
  }
}

// Transcribe audio with ASR, handling the 30-second limit by chunking
async function transcribeWithChunking(
  zai: Awaited<ReturnType<typeof ZAI.create>>,
  videoPath: string,
  totalDuration: number
): Promise<{ text: string; segments: Array<{ text: string; start: number; end: number }> }> {
  const allText: string[] = [];
  const allSegments: Array<{ text: string; start: number; end: number }> = [];

  // Ensure temp directory exists
  if (!fs.existsSync(TEMP_DIR)) {
    fs.mkdirSync(TEMP_DIR, { recursive: true });
  }

  if (totalDuration <= ASR_CHUNK_SECONDS) {
    // Short audio - transcribe directly
    const wavPath = path.join(TEMP_DIR, `asr_full_${Date.now()}.wav`);
    const extracted = await extractAudioAsWav(videoPath, wavPath);

    if (extracted) {
      try {
        const wavBuffer = fs.readFileSync(wavPath);
        const base64Wav = wavBuffer.toString("base64");

        console.log(`[Process] ASR: Transcribing full audio (${(wavBuffer.length / 1024).toFixed(0)} KB)`);
        const asrResponse = await zai.audio.asr.create({ file_base64: base64Wav });
        const text = asrResponse.text || "";

        if (text) {
          allText.push(text);
          // Create segments from the transcript
          const sentences = text
            .split(/[.!?]+/)
            .map((s) => s.trim())
            .filter((s) => s.length > 0);

          if (sentences.length > 0 && totalDuration > 0) {
            const segmentDuration = totalDuration / sentences.length;
            sentences.forEach((sentence, i) => {
              allSegments.push({
                text: sentence,
                start: Math.round(i * segmentDuration * 100) / 100,
                end: Math.round((i + 1) * segmentDuration * 100) / 100,
              });
            });
          }
        }
      } catch (asrError) {
        console.error("[Process] ASR error:", asrError);
      } finally {
        try { fs.unlinkSync(wavPath); } catch {}
      }
    }
  } else {
    // Long audio - chunk it
    const numChunks = Math.ceil(totalDuration / ASR_CHUNK_SECONDS);
    console.log(`[Process] ASR: Audio is ${totalDuration.toFixed(1)}s, splitting into ${numChunks} chunks of ${ASR_CHUNK_SECONDS}s`);

    for (let i = 0; i < numChunks; i++) {
      const chunkStart = i * ASR_CHUNK_SECONDS;
      const chunkDuration = Math.min(ASR_CHUNK_SECONDS, totalDuration - chunkStart);
      const chunkWavPath = path.join(TEMP_DIR, `asr_chunk_${i}_${Date.now()}.wav`);

      console.log(`[Process] ASR: Processing chunk ${i + 1}/${numChunks} (${chunkStart}s-${chunkStart + chunkDuration}s)`);

      const extracted = await extractAudioChunk(videoPath, chunkWavPath, chunkStart, chunkDuration);

      if (extracted) {
        try {
          const chunkBuffer = fs.readFileSync(chunkWavPath);
          const base64Chunk = chunkBuffer.toString("base64");

          const asrResponse = await zai.audio.asr.create({ file_base64: base64Chunk });
          const chunkText = asrResponse.text || "";

          if (chunkText) {
            allText.push(chunkText);

            // Create segments with correct time offsets
            const sentences = chunkText
              .split(/[.!?]+/)
              .map((s) => s.trim())
              .filter((s) => s.length > 0);

            if (sentences.length > 0 && chunkDuration > 0) {
              const segmentDuration = chunkDuration / sentences.length;
              sentences.forEach((sentence, j) => {
                allSegments.push({
                  text: sentence,
                  start: Math.round((chunkStart + j * segmentDuration) * 100) / 100,
                  end: Math.round((chunkStart + (j + 1) * segmentDuration) * 100) / 100,
                });
              });
            }
          }

          console.log(`[Process] ASR: Chunk ${i + 1} transcribed (${chunkText.length} chars)`);
        } catch (chunkError) {
          console.error(`[Process] ASR: Chunk ${i + 1} failed:`, chunkError);
        } finally {
          try { fs.unlinkSync(chunkWavPath); } catch {}
        }
      }
    }
  }

  return {
    text: allText.join(" ").trim(),
    segments: allSegments,
  };
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

  // Detect if captions are already relative (start near 0) or absolute
  const firstStart = captions.length > 0 ? captions[0].start : 0;
  const isAlreadyRelative = firstStart < 5;

  for (let i = 0; i < captions.length; i++) {
    const caption = captions[i];
    const relativeStart = isAlreadyRelative ? caption.start : Math.max(0, caption.start - clipStartTime);
    const relativeEnd = isAlreadyRelative ? caption.end : Math.max(0, caption.end - clipStartTime);

    lines.push(String(i + 1));
    lines.push(`${formatSrtTime(relativeStart)} --> ${formatSrtTime(relativeEnd)}`);
    lines.push(caption.text);
    lines.push("");
  }

  return lines.join("\n");
}

/**
 * Format seconds into SRT time format: HH:MM:SS,mmm
 */
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

function resolveVideoPath(originalUrl: string): string | null {
  // 1. Files in public/uploads/ (web uploads like /uploads/xxx.mp4)
  if (originalUrl.startsWith("/")) {
    const publicPath = path.join(process.cwd(), "public", originalUrl);
    if (fs.existsSync(publicPath)) {
      return publicPath;
    }
  }

  // 2. Files in upload/ directory (server imports like /upload/video.mp4)
  if (originalUrl.startsWith("/upload/")) {
    const uploadPath = path.join(process.cwd(), originalUrl);
    if (fs.existsSync(uploadPath)) {
      return uploadPath;
    }
  }

  // 3. Try as absolute path
  if (fs.existsSync(originalUrl)) {
    return originalUrl;
  }

  return null;
}

// ── Main Processing Pipeline ──────────────────────────────────────

async function processVideo(videoId: string) {
  const zai = await ZAI.create();

  try {
    // ── Stage 1: Transcription ─────────────────────────────────────
    await db.video.update({
      where: { id: videoId },
      data: { status: "transcribing" },
    });

    const video = await db.video.findUnique({ where: { id: videoId } });
    if (!video) throw new Error("Video not found");

    const videoPath = resolveVideoPath(video.originalUrl);
    if (!videoPath) {
      throw new Error(`Video file not found for URL: ${video.originalUrl}`);
    }

    console.log(`[Process] Starting transcription for video ${videoId}`);
    console.log(`[Process] Video path: ${videoPath}`);

    // Get video duration with ffprobe
    const duration = await getVideoDuration(videoPath);
    const effectiveDuration = duration || video.duration || 60;

    if (duration > 0 && video.duration === 0) {
      await db.video.update({
        where: { id: videoId },
        data: { duration },
      });
    }

    console.log(`[Process] Video duration: ${effectiveDuration.toFixed(1)}s`);

    // Strategy 1: Chunked ASR transcription
    let transcriptText = "";
    let transcriptSegments: Array<{ text: string; start: number; end: number }> = [];

    try {
      const asrResult = await transcribeWithChunking(zai, videoPath, effectiveDuration);
      transcriptText = asrResult.text;
      transcriptSegments = asrResult.segments;
      console.log(`[Process] ASR complete: ${transcriptText.length} chars, ${transcriptSegments.length} segments`);
    } catch (asrError) {
      console.error("[Process] ASR transcription failed:", asrError);
    }

    // Strategy 2: If ASR failed or returned empty, use VLM to analyze the video
    if (!transcriptText || transcriptText.trim().length === 0) {
      console.log(`[Process] ASR returned empty, using VLM for video analysis...`);

      try {
        const videoBuffer = fs.readFileSync(videoPath);
        const base64Video = videoBuffer.toString("base64");
        const videoMimeType = videoPath.endsWith(".webm") ? "video/webm" : "video/mp4";

        const vlmResponse = await zai.chat.completions.createVision({
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: `Analyze this video and provide: 1) A full transcript or detailed summary of what is being said, 2) The 3-5 most emotionally impactful moments that would make great 30-60 second viral clips for TikTok/Reels/Shorts.

For each clip moment, provide the start_time, end_time (in seconds), emotion, a catchy 3-6 word hook headline, sentiment_score (0.0-1.0), and title.

Respond with ONLY valid JSON:
{
  "transcript": "Full transcript or detailed summary of the video content",
  "clips": [
    {
      "start_time": 10,
      "end_time": 45,
      "emotion": "inspiring",
      "hook": "This changed everything for me",
      "sentiment_score": 0.85,
      "title": "The Power of Morning Routines"
    }
  ]
}`,
                },
                {
                  type: "video_url",
                  video_url: {
                    url: `data:${videoMimeType};base64,${base64Video}`,
                  },
                },
              ],
            },
          ],
          thinking: { type: "disabled" },
        });

        const vlmContent = vlmResponse.choices[0]?.message?.content || "";
        console.log(`[Process] VLM analysis received (${vlmContent.length} chars)`);

        if (vlmContent) {
          try {
            const jsonMatch = vlmContent.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              const parsed = JSON.parse(jsonMatch[0]);
              if (parsed.transcript) {
                transcriptText = parsed.transcript;
              }
            }
          } catch {
            transcriptText = vlmContent;
          }

          // Create segments from VLM transcript
          if (transcriptText && transcriptSegments.length === 0) {
            const sentences = transcriptText
              .split(/[.!?]+/)
              .map((s) => s.trim())
              .filter((s) => s.length > 0);

            if (sentences.length > 0 && effectiveDuration > 0) {
              const segmentDuration = effectiveDuration / sentences.length;
              transcriptSegments = sentences.map((text, i) => ({
                text,
                start: Math.round(i * segmentDuration * 100) / 100,
                end: Math.round((i + 1) * segmentDuration * 100) / 100,
              }));
            }
          }
        }
      } catch (vlmError) {
        console.error("[Process] VLM analysis error:", vlmError);
      }
    }

    // If we still have no transcript, create a minimal fallback
    if (!transcriptText || transcriptText.trim().length === 0) {
      transcriptText = `[Video: ${video.filename}, duration: ${effectiveDuration.toFixed(0)}s. Speech could not be transcribed. AI will suggest clips based on video characteristics.]`;
      transcriptSegments = [];
    }

    // Save transcript
    await db.transcript.upsert({
      where: { videoId },
      update: {
        fullText: transcriptText,
        segments: JSON.stringify(transcriptSegments),
      },
      create: {
        videoId,
        fullText: transcriptText,
        segments: JSON.stringify(transcriptSegments),
      },
    });

    console.log(`[Process] Transcription complete for video ${videoId}`);

    // ── Stage 2: Emotional Peak Analysis ───────────────────────────
    await db.video.update({
      where: { id: videoId },
      data: { status: "analyzing" },
    });

    console.log(`[Process] Analyzing content for video ${videoId}`);

    let clipsData: Array<{
      start_time: number;
      end_time: number;
      emotion: string;
      hook: string;
      sentiment_score: number;
      title: string;
    }> = [];

    const analysisCompletion = await zai.chat.completions.create({
      messages: [
        { role: "assistant", content: ANALYSIS_SYSTEM_PROMPT },
        {
          role: "user",
          content: `Analyze this video transcript and identify the 3-5 best viral moments. The video is ${effectiveDuration.toFixed(0)} seconds long.\n\nTranscript:\n${transcriptText}`,
        },
      ],
      thinking: { type: "disabled" },
    });

    const analysisContent = analysisCompletion.choices[0]?.message?.content || "";

    try {
      const jsonMatch = analysisContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        clipsData = parsed.clips || [];
      }
    } catch (parseError) {
      console.error("[Process] Failed to parse analysis JSON:", parseError);
      console.error("[Process] Raw analysis content:", analysisContent);
    }

    if (clipsData.length === 0) {
      throw new Error("AI analysis returned no clip suggestions");
    }

    // Validate and fix clip times
    clipsData = clipsData.map(clip => {
      let start = clip.start_time || 0;
      let end = clip.end_time || 0;

      if (start >= end) {
        start = Math.max(0, end - 30);
      }

      if (effectiveDuration > 0) {
        end = Math.min(end, effectiveDuration);
        start = Math.min(start, Math.max(0, effectiveDuration - 5));
      }

      if (end - start < 10) {
        end = start + 30;
        if (effectiveDuration > 0) {
          end = Math.min(end, effectiveDuration);
        }
      }

      return {
        ...clip,
        start_time: Math.max(0, start),
        end_time: end,
      };
    });

    console.log(`[Process] Found ${clipsData.length} potential clips for video ${videoId}`);

    // Create Clip records
    const createdClips = [];
    for (const clipData of clipsData) {
      const clip = await db.clip.create({
        data: {
          videoId,
          title: clipData.title || "Untitled Clip",
          hook: clipData.hook || "",
          startTime: clipData.start_time || 0,
          endTime: clipData.end_time || 0,
          sentimentScore: clipData.sentiment_score || 0.5,
          emotion: clipData.emotion || "neutral",
          status: "pending",
        },
      });
      createdClips.push(clip);
    }

    // ── Stage 3: Caption Generation ────────────────────────────────
    await db.video.update({
      where: { id: videoId },
      data: { status: "generating" },
    });

    for (const clip of createdClips) {
      try {
        await db.clip.update({
          where: { id: clip.id },
          data: { status: "generating" },
        });

        // Get transcript segments relevant to this clip
        const relevantSegments = transcriptSegments.filter(
          (seg) => seg.start >= clip.startTime && seg.end <= clip.endTime
        );
        const clipTranscript = relevantSegments.length > 0
          ? relevantSegments.map((s) => s.text).join(" ")
          : transcriptText.slice(0, 500);

        console.log(`[Process] Generating captions for clip "${clip.title}"`);

        const captionCompletion = await zai.chat.completions.create({
          messages: [
            {
              role: "assistant",
              content: `You are a short-form content caption expert. Given a transcript segment, break it into short, punchy caption segments of 2-5 words each for TikTok/Reels/Shorts. Each caption should have an approximate start and end time within the clip duration.

Respond with ONLY valid JSON:
{
  "hook": "A catchy 3-6 word headline for this clip",
  "captions": [
    {"text": "short caption", "start": 0.0, "end": 1.5},
    {"text": "next caption", "start": 1.5, "end": 3.0}
  ]
}`,
            },
            {
              role: "user",
              content: `Clip title: "${clip.title}"\nClip emotion: "${clip.emotion}"\nHook: "${clip.hook}"\nClip duration: ${(clip.endTime - clip.startTime).toFixed(0)} seconds (starts at ${clip.startTime}s, ends at ${clip.endTime}s)\n\nTranscript:\n${clipTranscript}`,
            },
          ],
          thinking: { type: "disabled" },
        });

        const captionContent = captionCompletion.choices[0]?.message?.content || "";

        let captions: Array<{ text: string; start: number; end: number }> = [];
        let hook = clip.hook;

        try {
          const jsonMatch = captionContent.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            captions = parsed.captions || [];
            if (parsed.hook) hook = parsed.hook;
          }
        } catch (parseError) {
          console.error(`[Process] Failed to parse caption JSON for clip ${clip.id}:`, parseError);
          // Fallback: create basic captions from transcript words
          const words = clipTranscript.split(/\s+/).filter(Boolean);
          const clipDuration = clip.endTime - clip.startTime || 10;
          const wordsPerCaption = 4;
          captions = [];
          for (let wi = 0; wi < words.length; wi += wordsPerCaption) {
            const chunk = words.slice(wi, wi + wordsPerCaption).join(" ");
            const st = clip.startTime + (wi / words.length) * clipDuration;
            const et = clip.startTime + ((wi + wordsPerCaption) / words.length) * clipDuration;
            captions.push({
              text: chunk,
              start: Math.round(st * 100) / 100,
              end: Math.round(et * 100) / 100,
            });
          }
        }

        await db.clip.update({
          where: { id: clip.id },
          data: {
            hook,
            captions: JSON.stringify(captions),
            status: "ready",
          },
        });
      } catch (captionError) {
        console.error(`[Process] Caption generation failed for clip ${clip.id}:`, captionError);
        await db.clip.update({
          where: { id: clip.id },
          data: { status: "error" },
        });
      }
    }

    // ── Stage 4: Thumbnail Generation ──────────────────────────────
    for (const clip of createdClips) {
      try {
        const clipRecord = await db.clip.findUnique({ where: { id: clip.id } });
        if (!clipRecord || clipRecord.status === "error") continue;

        console.log(`[Process] Generating thumbnail for clip "${clipRecord.title}"`);

        const emotionPrompts: Record<string, string> = {
          inspiring: "inspiring motivational scene with golden light and upward energy",
          passionate: "intense passionate scene with vibrant warm colors and dynamic energy",
          humorous: "fun playful scene with bright cheerful colors and comedic energy",
          shocking: "dramatic shocking scene with bold contrasting colors and tension",
          motivational: "powerful motivational scene with strong lighting and determined energy",
          profound: "deep thoughtful scene with ethereal lighting and contemplative mood",
          angry: "intense fiery scene with red tones and powerful energy",
          joyful: "joyful celebratory scene with bright warm colors and happy energy",
          neutral: "engaging scene with warm professional lighting",
        };

        const emotionVisual = emotionPrompts[clipRecord.emotion] || emotionPrompts.neutral;
        const thumbnailPrompt = `Vertical thumbnail for a short-form video clip titled "${clipRecord.title}". ${emotionVisual}. Bold, eye-catching composition designed to stop social media scrolling. Clean modern design with vivid colors. No text overlay.`;

        const imageResponse = await zai.images.generations.create({
          prompt: thumbnailPrompt,
          size: "768x1344",
        });

        if (imageResponse.data?.[0]?.base64) {
          if (!fs.existsSync(UPLOAD_DIR)) {
            fs.mkdirSync(UPLOAD_DIR, { recursive: true });
          }

          const thumbnailFilename = `thumb_${clip.id}_${Date.now()}.png`;
          const thumbnailPath = path.join(UPLOAD_DIR, thumbnailFilename);
          const thumbnailBuffer = Buffer.from(imageResponse.data[0].base64, "base64");
          fs.writeFileSync(thumbnailPath, thumbnailBuffer);

          const thumbnailUrl = `/uploads/${thumbnailFilename}`;

          await db.clip.update({
            where: { id: clip.id },
            data: { thumbnailUrl },
          });

          console.log(`[Process] Thumbnail saved for clip ${clip.id}`);
        }
      } catch (thumbError) {
        console.error(`[Process] Thumbnail generation failed for clip ${clip.id}:`, thumbError);
        // Thumbnail failure is non-critical; continue processing
      }
    }

    // ── Stage 5: Video Clip Extraction & SRT Generation ──────────
    console.log(`[Process] Stage 5: Extracting video clips and generating SRT files`);

    // Ensure upload directory exists
    if (!fs.existsSync(UPLOAD_DIR)) {
      fs.mkdirSync(UPLOAD_DIR, { recursive: true });
    }

    for (const clip of createdClips) {
      try {
        const clipRecord = await db.clip.findUnique({ where: { id: clip.id } });
        if (!clipRecord || clipRecord.status === "error") {
          console.log(`[Process] Skipping clip ${clip.id} (status: ${clipRecord?.status || "missing"})`);
          continue;
        }

        const clipStart = clipRecord.startTime;
        const clipEnd = clipRecord.endTime;
        const clipDuration = clipEnd - clipStart;

        if (clipDuration <= 0) {
          console.error(`[Process] Invalid clip duration for ${clip.id}: ${clipDuration}s`);
          continue;
        }

        // ── Extract clip video with ffmpeg (fast seek) ────────────────
        const clipFilename = `clip_${clip.id}_${Date.now()}.mp4`;
        const clipPath = path.join(UPLOAD_DIR, clipFilename);

        console.log(`[Process] Extracting clip "${clipRecord.title}" (${clipStart.toFixed(1)}s - ${clipEnd.toFixed(1)}s, ${clipDuration.toFixed(1)}s)`);

        try {
          // Use fast seek: -ss before -i for speed, stream copy for speed
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
            const clipUrl = `/uploads/${clipFilename}`;
            await db.clip.update({
              where: { id: clip.id },
              data: { clipUrl },
            });
            console.log(`[Process] Clip video saved: ${clipFilename}`);
          } else {
            console.error(`[Process] Clip video file not created: ${clipFilename}`);
          }
        } catch (ffmpegError) {
          console.error(`[Process] ffmpeg clip extraction failed for ${clip.id}:`, ffmpegError);
          // Try fallback with -ss after -i (slower but more accurate)
          try {
            console.log(`[Process] Retrying clip extraction with accurate seek for ${clip.id}`);
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
              const clipUrl = `/uploads/${clipFilename}`;
              await db.clip.update({
                where: { id: clip.id },
                data: { clipUrl },
              });
              console.log(`[Process] Clip video saved (fallback): ${clipFilename}`);
            }
          } catch (fallbackError) {
            console.error(`[Process] Fallback clip extraction also failed for ${clip.id}:`, fallbackError);
          }
        }

        // ── Generate SRT caption file ────────────────────────────────
        try {
          const captionsRaw = clipRecord.captions || "[]";
          let captions: Array<{ text: string; start: number; end: number }> = [];
          try {
            captions = JSON.parse(captionsRaw);
          } catch {
            captions = [];
          }

          if (captions.length > 0) {
            const srtContent = generateSrt(captions, clipStart);
            const srtFilename = `clip_${clip.id}_${Date.now()}.srt`;
            const srtPath = path.join(UPLOAD_DIR, srtFilename);
            fs.writeFileSync(srtPath, srtContent, "utf-8");

            const srtUrl = `/uploads/${srtFilename}`;
            await db.clip.update({
              where: { id: clip.id },
              data: { srtUrl },
            });
            console.log(`[Process] SRT file saved: ${srtFilename} (${captions.length} captions)`);
          } else {
            console.log(`[Process] No captions for clip ${clip.id}, skipping SRT generation`);
          }
        } catch (srtError) {
          console.error(`[Process] SRT generation failed for clip ${clip.id}:`, srtError);
          // SRT failure is non-critical; continue processing
        }
      } catch (clipExtractionError) {
        console.error(`[Process] Clip extraction pipeline failed for clip ${clip.id}:`, clipExtractionError);
        // Continue with other clips — one failure should not block the rest
      }
    }

    // ── Final: Mark as ready ───────────────────────────────────────
    await db.video.update({
      where: { id: videoId },
      data: { status: "ready" },
    });

    console.log(`[Process] ✅ Processing complete for video ${videoId}`);
  } catch (error) {
    console.error(`[Process] ❌ Pipeline failed for video ${videoId}:`, error);
    await db.video.update({
      where: { id: videoId },
      data: { status: "error" },
    });
  }
}
