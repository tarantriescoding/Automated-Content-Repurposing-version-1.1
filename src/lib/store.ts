import { create } from "zustand";
import type { ViewType, ProcessingStage, ClipData, VideoData, ProcessingLog } from "./types";

interface AppState {
  // Current view
  view: ViewType;
  setView: (view: ViewType) => void;

  // Video being processed
  currentVideo: VideoData | null;
  setCurrentVideo: (video: VideoData | null) => void;

  // Processing status with stages
  processingStage: ProcessingStage;
  setProcessingStage: (stage: ProcessingStage) => void;
  processingProgress: number;
  setProcessingProgress: (progress: number) => void;

  // Generated clips
  clips: ClipData[];
  setClips: (clips: ClipData[]) => void;

  // Selected clip for preview
  selectedClip: ClipData | null;
  setSelectedClip: (clip: ClipData | null) => void;

  // Processing logs
  processingLogs: ProcessingLog[];
  addProcessingLog: (log: ProcessingLog) => void;
  clearProcessingLogs: () => void;

  // Upload state
  isDragging: boolean;
  setIsDragging: (dragging: boolean) => void;
  uploadFile: File | null;
  setUploadFile: (file: File | null) => void;

  // Reset
  reset: () => void;
}

const initialState = {
  view: "upload" as ViewType,
  currentVideo: null,
  processingStage: "uploading" as ProcessingStage,
  processingProgress: 0,
  clips: [],
  selectedClip: null,
  processingLogs: [],
  isDragging: false,
  uploadFile: null,
};

export const useAppStore = create<AppState>((set) => ({
  ...initialState,

  setView: (view) => set({ view }),
  setCurrentVideo: (video) => set({ currentVideo: video }),
  setProcessingStage: (stage) => set({ processingStage: stage }),
  setProcessingProgress: (progress) => set({ processingProgress: progress }),
  setClips: (clips) => set({ clips }),
  setSelectedClip: (clip) => set({ selectedClip: clip }),
  setIsDragging: (dragging) => set({ isDragging: dragging }),
  setUploadFile: (file) => set({ uploadFile: file }),

  addProcessingLog: (log) =>
    set((state) => ({ processingLogs: [...state.processingLogs, log] })),

  clearProcessingLogs: () => set({ processingLogs: [] }),

  reset: () => set(initialState),
}));
