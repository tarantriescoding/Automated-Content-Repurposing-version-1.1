"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Zap } from "lucide-react";
import { useAppStore } from "@/lib/store";
import { HeroSection } from "@/components/hero-section";
import { UploadZone } from "@/components/upload-zone";
import { ProcessingPipeline } from "@/components/processing-pipeline";
import { ClipResults } from "@/components/clip-results";

export default function AttentionXPage() {
  const { view } = useAppStore();

  return (
    <div className="min-h-screen flex flex-col bg-zinc-950">
      {/* Header */}
      <header className="sticky top-0 z-40 w-full border-b border-zinc-800/50 bg-zinc-950/80 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center">
              <Zap className="w-5 h-5 text-white" />
            </div>
            <span className="text-white font-bold text-lg tracking-tight">
              Attention<span className="text-orange-400">X</span>
            </span>
          </div>
          <nav className="flex items-center gap-4">
            <span className="text-zinc-500 text-sm hidden sm:inline">
              Automated Content Repurposing
            </span>
            <div className="h-5 w-px bg-zinc-800 hidden sm:block" />
            <a
              href="#"
              className="text-zinc-400 text-sm hover:text-white transition-colors"
            >
              Docs
            </a>
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1">
        <AnimatePresence mode="wait">
          {view === "upload" && (
            <motion.div
              key="upload"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
            >
              <HeroSection />
              <UploadZone />
            </motion.div>
          )}

          {view === "processing" && (
            <motion.div
              key="processing"
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -50 }}
              transition={{ duration: 0.4 }}
              className="pt-8"
            >
              <ProcessingPipeline />
            </motion.div>
          )}

          {view === "results" && (
            <motion.div
              key="results"
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -50 }}
              transition={{ duration: 0.4 }}
              className="pt-8"
            >
              <ClipResults />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Sticky Footer */}
      <footer className="border-t border-zinc-800/50 bg-zinc-950/80 mt-auto">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <p className="text-zinc-600 text-xs">
            © {new Date().getFullYear()} AttentionX. All rights reserved.
          </p>
          <div className="flex items-center gap-4 text-zinc-600 text-xs">
            <a href="#" className="hover:text-zinc-400 transition-colors">
              Privacy
            </a>
            <a href="#" className="hover:text-zinc-400 transition-colors">
              Terms
            </a>
            <a href="#" className="hover:text-zinc-400 transition-colors">
              Contact
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
