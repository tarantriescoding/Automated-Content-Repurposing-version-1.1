"use client";

import { motion } from "framer-motion";
import {
  Flame,
  Smartphone,
  Sparkles,
  Zap,
  ArrowRight,
  Video,
  Brain,
  Scissors,
} from "lucide-react";
import Image from "next/image";
import { Card, CardContent } from "@/components/ui/card";

const features = [
  {
    icon: Flame,
    title: "Emotional Peak Detection",
    description:
      "AI finds the most impactful moments in your video using sentiment analysis and audio energy detection",
    emoji: "🔥",
    gradient: "from-orange-500/20 to-red-500/20",
    borderColor: "border-orange-500/30",
  },
  {
    icon: Smartphone,
    title: "Smart Vertical Crop",
    description:
      "Face-tracking keeps speakers in frame automatically for perfect TikTok, Reels & Shorts format",
    emoji: "📱",
    gradient: "from-amber-500/20 to-orange-500/20",
    borderColor: "border-amber-500/30",
  },
  {
    icon: Sparkles,
    title: "Dynamic Captions",
    description:
      "Karaoke-style captions with catchy hooks that stop the scroll and boost engagement",
    emoji: "✨",
    gradient: "from-yellow-500/20 to-amber-500/20",
    borderColor: "border-yellow-500/30",
  },
];

const steps = [
  {
    icon: Video,
    title: "Upload Video",
    description: "Drop your long-form video (lecture, podcast, workshop)",
    step: "01",
    color: "text-orange-400",
    bgColor: "bg-orange-500/10",
    borderColor: "border-orange-500/20",
  },
  {
    icon: Brain,
    title: "AI Analysis",
    description:
      "AI transcribes, detects emotional peaks, and scores viral potential",
    step: "02",
    color: "text-amber-400",
    bgColor: "bg-amber-500/10",
    borderColor: "border-amber-500/20",
  },
  {
    icon: Scissors,
    title: "Get Clips",
    description:
      "Get ready-to-post vertical clips with captions and thumbnails",
    step: "03",
    color: "text-emerald-400",
    bgColor: "bg-emerald-500/10",
    borderColor: "border-emerald-500/20",
  },
];

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.15, delayChildren: 0.2 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 30 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: "easeOut" },
  },
};

export function HeroSection() {
  return (
    <section className="relative w-full overflow-hidden">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-zinc-950 via-zinc-900 to-zinc-950" />

      {/* Radial glow effects */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-orange-500/10 rounded-full blur-[120px]" />
      <div className="absolute top-20 right-1/4 w-[400px] h-[400px] bg-amber-500/5 rounded-full blur-[100px]" />
      <div className="absolute bottom-0 left-1/4 w-[600px] h-[300px] bg-orange-500/5 rounded-full blur-[100px]" />

      <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 pt-16 sm:pt-24 pb-12">
        {/* Hero image */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="flex justify-center mb-10"
        >
          <div className="relative w-full max-w-2xl">
            <div className="absolute -inset-2 bg-gradient-to-r from-orange-500/30 via-amber-500/30 to-orange-500/30 rounded-2xl blur-xl" />
            <Image
              src="/hero-image.png"
              alt="AttentionX - AI Video Repurposing"
              width={800}
              height={450}
              className="relative rounded-xl border border-zinc-800/50 shadow-2xl"
              priority
            />
          </div>
        </motion.div>

        {/* Headline */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="text-center mb-6"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-orange-500/10 border border-orange-500/20 mb-6">
            <Zap className="w-3.5 h-3.5 text-orange-400" />
            <span className="text-xs font-medium text-orange-400">
              Powered by Multimodal AI
            </span>
          </div>
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight mb-4">
            <span className="text-white">Turn Long Videos into</span>
            <br />
            <span className="bg-gradient-to-r from-orange-400 via-amber-400 to-orange-400 bg-clip-text text-transparent animate-neon">
              Viral Clips with AI
            </span>
          </h1>
          <p className="text-zinc-400 text-lg sm:text-xl max-w-2xl mx-auto leading-relaxed">
            Upload any long-form video and let our AI engine automatically
            detect emotional peaks, crop for vertical format, and add
            scroll-stopping captions.
          </p>
        </motion.div>

        {/* How It Works Steps */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.5 }}
          className="mb-12"
        >
          <h2 className="text-center text-zinc-500 text-sm font-medium uppercase tracking-widest mb-6">
            How It Works
          </h2>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-0">
            {steps.map((step, idx) => (
              <div key={step.step} className="flex items-center">
                <motion.div
                  whileHover={{ scale: 1.05, y: -2 }}
                  transition={{ duration: 0.2 }}
                  className={`flex items-center gap-3 px-5 py-3 rounded-xl border ${step.borderColor} ${step.bgColor} backdrop-blur-sm`}
                >
                  <span
                    className={`text-2xl font-black ${step.color} opacity-60`}
                  >
                    {step.step}
                  </span>
                  <div>
                    <div className="flex items-center gap-2">
                      <step.icon className={`w-4 h-4 ${step.color}`} />
                      <span className="text-white font-semibold text-sm">
                        {step.title}
                      </span>
                    </div>
                    <p className="text-zinc-500 text-xs mt-0.5">
                      {step.description}
                    </p>
                  </div>
                </motion.div>
                {idx < steps.length - 1 && (
                  <ArrowRight className="w-5 h-5 text-zinc-700 mx-2 hidden sm:block" />
                )}
              </div>
            ))}
          </div>
        </motion.div>

        {/* Feature Cards */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6"
        >
          {features.map((feature) => (
            <motion.div key={feature.title} variants={itemVariants}>
              <Card
                className={`relative overflow-hidden bg-gradient-to-br ${feature.gradient} ${feature.borderColor} border backdrop-blur-sm hover:scale-[1.02] transition-transform duration-300`}
              >
                <CardContent className="p-6">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-zinc-900/80 border border-zinc-700/50">
                      <feature.icon className="w-5 h-5 text-orange-400" />
                    </div>
                    <span
                      className="text-lg"
                      role="img"
                      aria-label={feature.title}
                    >
                      {feature.emoji}
                    </span>
                  </div>
                  <h3 className="text-white font-semibold text-lg mb-1">
                    {feature.title}
                  </h3>
                  <p className="text-zinc-400 text-sm leading-relaxed">
                    {feature.description}
                  </p>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
