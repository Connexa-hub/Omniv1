import { motion, AnimatePresence } from "motion/react";
import { useEffect, useState } from "react";

const SUBTEXTS = [
  "Building the future of AI software.",
  "Your autonomous engineering partner.",
  "Turning ideas into production-ready apps.",
  "Infinite workspace, zero friction.",
  "Context-aware intelligence at your fingertips."
];

export default function Landing() {
  const [subtextIndex, setSubtextIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setSubtextIndex((prev) => (prev + 1) % SUBTEXTS.length);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex-1 flex flex-col items-center justify-center bg-transparent">
      <motion.h1
        initial={{ opacity: 0, scale: 0.8, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ 
          duration: 1.2, 
          ease: [0.16, 1, 0.3, 1],
          scale: { type: "spring", stiffness: 100, damping: 15 }
        }}
        className="text-8xl md:text-[12rem] font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-b from-white via-white to-white/20 drop-shadow-[0_10px_30px_rgba(0,0,0,0.5)] select-none relative"
      >
        <span className="absolute inset-0 bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500 bg-clip-text text-transparent blur-2xl opacity-40 animate-pulse">OMNI</span>
        OMNI
      </motion.h1>
      
      <div className="h-12 mt-4 flex items-center justify-center">
        <AnimatePresence mode="wait">
          <motion.p
            key={subtextIndex}
            initial={{ opacity: 0, filter: "blur(10px)", y: 10 }}
            animate={{ opacity: 1, filter: "blur(0px)", y: 0 }}
            exit={{ opacity: 0, filter: "blur(10px)", y: -10 }}
            transition={{ duration: 0.8, ease: "easeInOut" }}
            className="text-xl md:text-2xl text-slate-400 font-light tracking-[0.2em] text-center uppercase"
          >
            {SUBTEXTS[subtextIndex]}
          </motion.p>
        </AnimatePresence>
      </div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1, duration: 1 }}
        className="mt-12 flex space-x-2"
      >
        <div className="w-1 h-1 bg-blue-500 rounded-full animate-ping" />
        <div className="w-1 h-1 bg-blue-500 rounded-full animate-ping [animation-delay:0.2s]" />
        <div className="w-1 h-1 bg-blue-500 rounded-full animate-ping [animation-delay:0.4s]" />
      </motion.div>
    </div>
  );
}
