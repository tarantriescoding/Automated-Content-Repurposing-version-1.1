import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import ZAI from "z-ai-web-dev-sdk";
import fs from "fs";
import path from "path";

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads");

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
          select: {
            id: true,
            filename: true,
          },
        },
      },
    });

    if (!clip) {
      return NextResponse.json(
        { error: "Clip not found" },
        { status: 404 }
      );
    }

    // Ensure upload directory exists
    if (!fs.existsSync(UPLOAD_DIR)) {
      fs.mkdirSync(UPLOAD_DIR, { recursive: true });
    }

    const zai = await ZAI.create();

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

    const emotionVisual = emotionPrompts[clip.emotion] || "engaging scene with dynamic lighting";
    const thumbnailPrompt = `Vertical thumbnail for a short-form video clip titled "${clip.title}". ${emotionVisual}. Bold, eye-catching composition designed to stop social media scrolling. Clean modern design with vivid colors. No text overlay.`;

    console.log(`[Thumbnail] Generating thumbnail for clip ${id}`);

    const imageResponse = await zai.images.generations.create({
      prompt: thumbnailPrompt,
      size: "768x1344",
    });

    if (!imageResponse.data?.[0]?.base64) {
      return NextResponse.json(
        { error: "Image generation returned no data" },
        { status: 500 }
      );
    }

    // Delete old thumbnail if it exists
    if (clip.thumbnailUrl) {
      const oldPath = path.join(process.cwd(), "public", clip.thumbnailUrl);
      if (fs.existsSync(oldPath)) {
        try {
          fs.unlinkSync(oldPath);
        } catch {
          // Ignore deletion errors
        }
      }
    }

    const thumbnailFilename = `thumb_${clip.id}_${Date.now()}.png`;
    const thumbnailPath = path.join(UPLOAD_DIR, thumbnailFilename);
    const thumbnailBuffer = Buffer.from(imageResponse.data[0].base64, "base64");
    fs.writeFileSync(thumbnailPath, thumbnailBuffer);

    const thumbnailUrl = `/uploads/${thumbnailFilename}`;

    await db.clip.update({
      where: { id },
      data: { thumbnailUrl },
    });

    console.log(`[Thumbnail] Thumbnail saved for clip ${id}`);

    return NextResponse.json({
      message: "Thumbnail generated successfully",
      thumbnailUrl,
    });
  } catch (error) {
    console.error("Thumbnail generation error:", error);
    return NextResponse.json(
      { error: "Failed to generate thumbnail" },
      { status: 500 }
    );
  }
}
