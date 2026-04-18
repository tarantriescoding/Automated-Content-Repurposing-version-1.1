import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(
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
            originalUrl: true,
            status: true,
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

    // Parse captions JSON for convenience
    const parsedClip = {
      ...clip,
      captions: JSON.parse(clip.captions),
    };

    return NextResponse.json({ clip: parsedClip });
  } catch (error) {
    console.error("Get clip error:", error);
    return NextResponse.json(
      { error: "Failed to fetch clip" },
      { status: 500 }
    );
  }
}
