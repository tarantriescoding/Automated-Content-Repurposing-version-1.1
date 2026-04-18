---
Task ID: 1-8
Agent: Main
Task: Fix AttentionX to fully solve the problem statement - make clips viewable and downloadable

Work Log:
- Updated Prisma schema to add `clipUrl` and `srtUrl` fields to Clip model
- Ran `bun run db:push` to migrate the database
- Updated TypeScript types (ClipData interface) with new fields
- Rewrote processing pipeline (process/route.ts) to add Stage 5: Video Clip Extraction & SRT Generation using ffmpeg
- Created `/api/clips/[id]/export` API endpoint for streaming MP4 downloads and SRT caption file downloads
- Created `/api/clips/[id]/extract` API endpoint for on-demand clip extraction for existing clips
- Built `ClipVideoPlayer` component with native HTML5 video player, dynamic caption overlay synced to video time, 3 caption styles (karaoke/bold/minimal), play/pause/mute controls, progress bar, and timestamp display
- Rewrote `ClipDetail` modal to use the new video player with real download functionality (MP4 + SRT)
- Updated `ClipCard` to show video preview on hover, timestamp highlight badge, and "Video Ready" indicator
- Updated `ClipResults` with auto-extraction for existing clips, "Download All" button, and progress indicator
- Updated data mapping in page.tsx and processing-pipeline.tsx to include clipUrl and srtUrl
- Fixed export endpoint to use streaming instead of reading entire file into memory
- Ran lint checks and fixed all errors
- Tested full pipeline end-to-end: upload → transcription → analysis → caption generation → clip extraction → video playback → download

Stage Summary:
- The app now fully solves the problem statement: long-form videos are transformed into viewable, downloadable timestamp-based highlight clips
- Key new features: Video clip extraction (ffmpeg), SRT caption file generation, Video player with synced captions, MP4/SRT download, Auto-extraction for existing clips
- All API endpoints working: /export (MP4+SRT), /extract (on-demand)
- Build and lint pass cleanly
