export interface VideoData {
  id: string;
  filename: string;
  originalUrl: string;
  duration: number;
  fileSize: number;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface TranscriptData {
  id: string;
  videoId: string;
  fullText: string;
  segments: TranscriptSegment[];
}

export interface TranscriptSegment {
  text: string;
  start: number;
  end: number;
}

export interface ClipData {
  id: string;
  videoId: string;
  title: string;
  hook: string;
  startTime: number;
  endTime: number;
  sentimentScore: number;
  emotion: string;
  captions: CaptionData[];
  captionStyle: "karaoke" | "bold" | "minimal";
  thumbnailUrl: string;
  status: string;
  createdAt: string;
}

export interface CaptionData {
  text: string;
  start: number;
  end: number;
}

export type ViewType = "upload" | "processing" | "results";

export type ProcessingStage =
  | "uploading"
  | "transcribing"
  | "analyzing"
  | "generating"
  | "complete";

export interface ProcessingLog {
  timestamp: string;
  message: string;
  type: "info" | "success" | "warning";
}
