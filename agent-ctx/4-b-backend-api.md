# Task 4-b: Backend API Routes

## Agent: Backend API Developer

## Summary
Successfully built all 6 backend API routes for the AttentionX content repurposing engine.

## Files Created

1. **`src/app/api/videos/upload/route.ts`** - POST endpoint for video upload
   - Validates multipart/form-data content type
   - Validates file types (MP4, WebM, MOV, AVI, MKV)
   - Saves files with UUID filenames to `public/uploads/`
   - Creates Video database record
   - Returns 201 with video object

2. **`src/app/api/videos/route.ts`** - GET endpoint listing all videos
   - Returns videos ordered by creation date (newest first)
   - Includes clip count and transcript status
   - Returns compact video data for list views

3. **`src/app/api/videos/[id]/route.ts`** - GET endpoint for video details
   - Returns video with transcript and all clips
   - Parses JSON fields (transcript segments, clip captions) for convenience
   - Clips sorted by sentiment score (highest first)
   - Returns 404 for non-existent videos

4. **`src/app/api/videos/[id]/process/route.ts`** - POST endpoint for full processing pipeline
   - 4-stage async pipeline: transcribe → analyze → generate captions → generate thumbnails
   - Stage 1: ASR transcription via z-ai-web-dev-sdk, creates Transcript with segments
   - Stage 2: LLM analysis with emotional peak detection prompt, creates Clip records
   - Stage 3: LLM caption generation per clip, creates 2-5 word timed captions
   - Stage 4: Image generation for thumbnails with emotion-based prompts
   - Video status lifecycle: uploaded → transcribing → analyzing → generating → ready
   - Graceful error handling sets status to "error"
   - Returns 409 if video is already being processed
   - Runs processing in background (fire-and-forget)

5. **`src/app/api/clips/[id]/route.ts`** - GET endpoint for clip details
   - Returns clip with parsed captions JSON
   - Includes parent video info (id, filename, url, status)
   - Returns 404 for non-existent clips

6. **`src/app/api/clips/[id]/thumbnail/route.ts`** - POST endpoint to regenerate thumbnail
   - Uses z-ai-web-dev-sdk image generation
   - Emotion-aware prompt generation for thumbnails
   - Deletes old thumbnail file before saving new one
   - Saves 768x1344 portrait thumbnails to `public/uploads/`

## Directories Created
- `public/uploads/` - for video files and generated thumbnails

## Key Design Decisions
- Processing pipeline is fire-and-forget (returns immediately, runs in background)
- Caption generation has fallback: if LLM fails, creates word-chunked captions from transcript
- Thumbnail failures are non-critical (don't fail the whole pipeline)
- JSON fields (segments, captions) are parsed on GET for client convenience
- Content-type validation on upload prevents confusing errors
- 409 Conflict returned if processing is already in progress

## Testing Results
- All endpoints compile and respond correctly
- ESLint passes with zero errors
- GET /api/videos returns empty list correctly
- GET /api/videos/[id] returns 404 for non-existent IDs
- POST /api/videos/upload returns 400 for invalid requests
- POST /api/videos/[id]/process returns 404 for non-existent videos
