import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import ZAI from "z-ai-web-dev-sdk";
import fs from "fs";
import path from "path";

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads");

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

  // Start processing in the background
  processVideo(id).catch((err) => {
    console.error(`Background processing failed for video ${id}:`, err);
  });

  return NextResponse.json({
    message: "Processing started",
    videoId: id,
  });
}

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

    const videoPath = path.join(process.cwd(), "public", video.originalUrl);
    if (!fs.existsSync(videoPath)) {
      throw new Error(`Video file not found at ${videoPath}`);
    }

    const videoBuffer = fs.readFileSync(videoPath);
    const base64Audio = videoBuffer.toString("base64");

    console.log(`[Process] Transcribing video ${videoId} (${(videoBuffer.length / 1024 / 1024).toFixed(2)} MB)`);

    let transcriptText = "";
    let transcriptSegments: Array<{ text: string; start: number; end: number }> = [];

    try {
      const asrResponse = await zai.audio.asr.create({ file_base64: base64Audio });
      transcriptText = asrResponse.text || "";

      // Create basic segments from the transcript
      // If ASR provides word-level or sentence-level timing, use it
      // Otherwise, create evenly-distributed segments
      const sentences = transcriptText
        .split(/[.!?]+/)
        .map((s) => s.trim())
        .filter((s) => s.length > 0);

      if (sentences.length > 0 && video.duration > 0) {
        const segmentDuration = video.duration / sentences.length;
        transcriptSegments = sentences.map((text, i) => ({
          text,
          start: Math.round(i * segmentDuration * 100) / 100,
          end: Math.round((i + 1) * segmentDuration * 100) / 100,
        }));
      } else if (sentences.length > 0) {
        // If we don't have duration, estimate ~3 seconds per sentence
        transcriptSegments = sentences.map((text, i) => ({
          text,
          start: i * 3,
          end: (i + 1) * 3,
        }));
      }
    } catch (asrError) {
      console.error("[Process] ASR error:", asrError);
      // If ASR fails (e.g., file too large), try with a note
      transcriptText = "[Transcription failed - audio could not be processed]";
      transcriptSegments = [];
    }

    // Create or update transcript
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

    // Update video duration estimate if it was 0
    if (video.duration === 0 && transcriptSegments.length > 0) {
      const estimatedDuration = transcriptSegments[transcriptSegments.length - 1].end;
      await db.video.update({
        where: { id: videoId },
        data: { duration: estimatedDuration },
      });
    }

    console.log(`[Process] Transcription complete for video ${videoId}`);

    // ── Stage 2: Analysis ──────────────────────────────────────────
    await db.video.update({
      where: { id: videoId },
      data: { status: "analyzing" },
    });

    if (!transcriptText || transcriptText.startsWith("[Transcription failed")) {
      throw new Error("Cannot analyze video: transcription failed or is empty");
    }

    console.log(`[Process] Analyzing transcript for video ${videoId}`);

    const analysisCompletion = await zai.chat.completions.create({
      messages: [
        { role: "assistant", content: ANALYSIS_SYSTEM_PROMPT },
        {
          role: "user",
          content: `Analyze this video transcript and identify the 3-5 best viral moments:\n\n${transcriptText}`,
        },
      ],
      thinking: { type: "disabled" },
    });

    const analysisContent = analysisCompletion.choices[0]?.message?.content || "";

    // Parse the JSON response - extract JSON from possible markdown code blocks
    let clipsData: Array<{
      start_time: number;
      end_time: number;
      emotion: string;
      hook: string;
      sentiment_score: number;
      title: string;
    }> = [];

    try {
      const jsonMatch = analysisContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        clipsData = parsed.clips || [];
      }
    } catch (parseError) {
      console.error("[Process] Failed to parse analysis JSON:", parseError);
      console.error("[Process] Raw analysis content:", analysisContent);
      throw new Error("Failed to parse AI analysis response");
    }

    if (clipsData.length === 0) {
      throw new Error("AI analysis returned no clip suggestions");
    }

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

        // Get the transcript segment relevant to this clip
        const relevantSegments = transcriptSegments.filter(
          (seg) => seg.start >= clip.startTime && seg.end <= clip.endTime
        );
        const clipTranscript = relevantSegments.length > 0
          ? relevantSegments.map((s) => s.text).join(" ")
          : transcriptText.slice(0, 500); // fallback: use beginning of transcript

        console.log(`[Process] Generating captions for clip ${clip.id}`);

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
              content: `Clip title: "${clip.title}"\nClip emotion: "${clip.emotion}"\nHook: "${clip.hook}"\nClip duration: ${clip.endTime - clip.startTime} seconds (starts at ${clip.startTime}s, ends at ${clip.endTime}s)\n\nTranscript:\n${clipTranscript}`,
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
          for (let i = 0; i < words.length; i += wordsPerCaption) {
            const chunk = words.slice(i, i + wordsPerCaption).join(" ");
            const startTime = clip.startTime + (i / words.length) * clipDuration;
            const endTime = clip.startTime + ((i + wordsPerCaption) / words.length) * clipDuration;
            captions.push({
              text: chunk,
              start: Math.round(startTime * 100) / 100,
              end: Math.round(endTime * 100) / 100,
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

        console.log(`[Process] Generating thumbnail for clip ${clip.id}`);

        const emotionPrompts: Record<string, string> = {
          inspiring: "inspiring motivational scene with golden light and upward energy",
          passionate: "intense passionate scene with vibrant warm colors and dynamic energy",
          humorous: "fun playful scene with bright cheerful colors and comedic energy",
          shocking: "dramatic shocking scene with bold contrasting colors and tension",
          motivational: "powerful motivational scene with strong lighting and determined energy",
          profound: "deep thoughtful scene with ethereal lighting and contemplative mood",
          angry: "intense fiery scene with red tones and powerful energy",
          joyful: "joyful celebratory scene with bright warm colors and happy energy",
        };

        const emotionVisual = emotionPrompts[clipRecord.emotion] || "engaging scene with dynamic lighting";
        const thumbnailPrompt = `Vertical thumbnail for a short-form video clip titled "${clipRecord.title}". ${emotionVisual}. Bold, eye-catching composition designed to stop social media scrolling. Clean modern design with vivid colors. No text overlay.`;

        const imageResponse = await zai.images.generations.create({
          prompt: thumbnailPrompt,
          size: "768x1344",
        });

        if (imageResponse.data?.[0]?.base64) {
          // Ensure upload directory exists
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

    // ── Final: Mark as ready ───────────────────────────────────────
    await db.video.update({
      where: { id: videoId },
      data: { status: "ready" },
    });

    console.log(`[Process] Processing complete for video ${videoId}`);
  } catch (error) {
    console.error(`[Process] Pipeline failed for video ${videoId}:`, error);
    await db.video.update({
      where: { id: videoId },
      data: { status: "error" },
    });
  }
}
