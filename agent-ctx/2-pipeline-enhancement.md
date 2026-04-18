# Task 2: Video Clip Extraction & SRT Generation

## Summary
Added Stage 5 (Video Clip Extraction & SRT Generation) to the AttentionX processing pipeline and created a new export API endpoint.

## Changes Made

### 1. Modified: `src/app/api/videos/[id]/process/route.ts`
- **Added Stage 5** after Stage 4 (Thumbnail Generation), before the final "Mark as ready" step
- For each clip with status "ready":
  - Extracts clip as MP4 using ffmpeg with **fast seek** (`-ss` before `-i`, `-t` for duration)
  - Falls back to **accurate seek** (`-ss` after `-i`, `-to` for end time) if fast seek fails
  - Generates SRT caption file from the clip's captions JSON
  - Converts absolute timestamps to clip-relative times for SRT format
  - Saves `clipUrl` and `srtUrl` to the Clip database record
- **Robust error handling**: Individual clip extraction failures don't block other clips
- **Added helper functions**:
  - `generateSrt()`: Converts captions array to SRT format with clip-relative times
  - `formatSrtTime()`: Formats seconds as `HH:MM:SS,mmm` per SRT specification
- All existing AI pipeline stages (1-4) remain completely intact

### 2. Created: `src/app/api/clips/[id]/export/route.ts`
- `GET /api/clips/[id]/export` → serves MP4 clip video
- `GET /api/clips/[id]/export?format=srt` → downloads SRT caption file
- If `clipUrl` already exists, serves pre-extracted file directly via `fs.readFileSync`
- If no `clipUrl`, performs **on-the-fly ffmpeg extraction** and saves the result for future requests
- If no `srtUrl`, generates SRT on-the-fly from captions JSON
- Proper HTTP headers:
  - MP4: `Content-Type: video/mp4`
  - SRT: `Content-Type: text/plain; charset=utf-8` with `Content-Disposition: attachment; filename="clip_title.srt"`
- Includes ffmpeg fallback (fast seek → accurate seek) for on-the-fly extraction
- Filename sanitization for safe `Content-Disposition` headers
- Utility functions: `resolveVideoPath()`, `sanitizeFilename()`, `generateSrt()`, `formatSrtTime()`

## Technical Decisions
- Used `-t duration` instead of `-to end_time` with fast seek to avoid ambiguity in timestamp interpretation
- Fast seek (`-ss` before `-i`) prioritized for performance; accurate seek as fallback for reliability
- SRT times are clip-relative (subtracted `clipStartTime` from absolute caption timestamps)
- On-the-fly extraction in the export endpoint saves the result so subsequent requests are instant

## Verification
- ESLint: zero errors
- Dev server: running cleanly
- ffmpeg/ffprobe confirmed available at `/usr/bin/ffmpeg` and `/usr/bin/ffprobe`
- Prisma schema already has `clipUrl` and `srtUrl` fields (no migration needed)
