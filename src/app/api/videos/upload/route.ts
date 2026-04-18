import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { v4 as uuidv4 } from "uuid";
import fs from "fs";
import path from "path";

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads");

export async function POST(request: NextRequest) {
  try {
    // Validate content type
    const contentType = request.headers.get("content-type") || "";
    if (!contentType.includes("multipart/form-data") && !contentType.includes("application/x-www-form-urlencoded")) {
      return NextResponse.json(
        { error: "Request must be multipart/form-data with a video file" },
        { status: 400 }
      );
    }

    // Ensure upload directory exists
    if (!fs.existsSync(UPLOAD_DIR)) {
      fs.mkdirSync(UPLOAD_DIR, { recursive: true });
    }

    const formData = await request.formData();
    const file = formData.get("video") as File | null;

    if (!file) {
      return NextResponse.json(
        { error: "No video file provided. Use 'video' as the form field name." },
        { status: 400 }
      );
    }

    // Validate file type
    const validTypes = [
      "video/mp4",
      "video/webm",
      "video/quicktime",
      "video/x-msvideo",
      "video/x-matroska",
    ];
    if (!validTypes.includes(file.type)) {
      return NextResponse.json(
        { error: `Invalid file type: ${file.type}. Supported types: MP4, WebM, MOV, AVI, MKV` },
        { status: 400 }
      );
    }

    // Generate unique filename
    const ext = path.extname(file.name) || ".mp4";
    const uniqueFilename = `${uuidv4()}${ext}`;
    const filePath = path.join(UPLOAD_DIR, uniqueFilename);

    // Save file to disk
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    fs.writeFileSync(filePath, buffer);

    const fileSize = buffer.length;
    const originalUrl = `/uploads/${uniqueFilename}`;

    // Create video record in database
    const video = await db.video.create({
      data: {
        filename: file.name,
        originalUrl,
        fileSize,
        status: "uploaded",
      },
    });

    return NextResponse.json({ video }, { status: 201 });
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json(
      { error: "Failed to upload video" },
      { status: 500 }
    );
  }
}
