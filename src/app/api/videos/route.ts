import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  try {
    const videos = await db.video.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        _count: {
          select: { clips: true },
        },
        transcript: {
          select: { id: true },
        },
      },
    });

    const videosWithClipCount = videos.map((video) => ({
      id: video.id,
      filename: video.filename,
      originalUrl: video.originalUrl,
      duration: video.duration,
      fileSize: video.fileSize,
      status: video.status,
      hasTranscript: !!video.transcript,
      clipCount: video._count.clips,
      createdAt: video.createdAt,
      updatedAt: video.updatedAt,
    }));

    return NextResponse.json({ videos: videosWithClipCount });
  } catch (error) {
    console.error("List videos error:", error);
    return NextResponse.json(
      { error: "Failed to fetch videos" },
      { status: 500 }
    );
  }
}
