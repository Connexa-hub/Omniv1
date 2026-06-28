import { motion, AnimatePresence } from "motion/react";
import { useState, useEffect } from "react";
import { Cpu, Code, Zap, Globe, ChevronRight } from "lucide-react";
import { cn } from "@/src/lib/utils";
import OmniWave from "./OmniWave";

const DEMO_STEPS = [
  { icon: Cpu, label: "OmniBrain Analysis", color: "text-blue-500", desc: "Understanding source context..." },
  { icon: Code, label: "Agent Orchestration", color: "text-purple-500", desc: "Routing to Frontend Agent..." },
  { icon: Zap, label: "Generating Code", color: "text-yellow-500", desc: "Applying 4 modifications..." },
  { icon: Globe, label: "Deploying Mirror", color: "text-green-500", desc: "Syncing live preview..." }
];

export default function Onboarding({ onGetStarted }: { onGetStarted: () => void }) {
  const [activeDemoStep, setActiveDemoStep] = useState(0);
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    setIsDark(document.documentElement.classList.contains('dark'));
    const observer = new MutationObserver(() => {
      setIsDark(document.documentElement.classList.contains('dark'));
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveDemoStep(prev => (prev + 1) % DEMO_STEPS.length);
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="fixed inset-0 z-[100] bg-slate-50 dark:bg-[#0A0A0A] flex flex-col items-center justify-center p-6 overflow-hidden transition-colors duration-300">
      {/* Background Glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-blue-600/5 dark:bg-blue-600/10 rounded-full blur-[120px] pointer-events-none" />
      
      <div className="max-w-4xl w-full grid grid-cols-1 md:grid-cols-2 gap-12 items-center relative z-10">
        <div className="space-y-8">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="space-y-4"
          >
            <OmniWave className="w-32 h-32 mb-6" />
            <div className="inline-flex items-center space-x-2 px-3 py-1 bg-blue-50 dark:bg-blue-600/10 border border-blue-200 dark:border-blue-500/20 rounded-full">
              <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse" />
              <span className="text-[10px] font-bold text-blue-600 dark:text-blue-500 uppercase tracking-widest">Version 1.0.0 Now Live</span>
            </div>
            <h1 className="text-6xl font-bold tracking-tight text-slate-900 dark:text-white leading-[1.1]">
              Engineered for <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-500 to-purple-500">Autonomous</span> <br />
              Creation.
            </h1>
            <p className="text-slate-500 dark:text-slate-400 text-lg max-w-md">
              Omni is the first AI-native development platform that doesn't just suggest code—it builds your vision into production.
            </p>
          </motion.div>

          <motion.button
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            onClick={onGetStarted}
            className="group flex items-center space-x-3 bg-slate-900 dark:bg-white text-white dark:text-black px-8 py-4 rounded-2xl font-bold text-lg hover:bg-blue-600 dark:hover:bg-blue-500 hover:text-white dark:hover:text-white transition-all shadow-lg hover:shadow-blue-500/40"
          >
            <span>Launch Workspace</span>
            <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </motion.button>
        </div>

        {/* Demo Simulator */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.4 }}
          className="bg-white dark:bg-[#0F0F0F] border border-slate-200 dark:border-white/5 rounded-3xl p-8 shadow-2xl relative overflow-hidden"
        >
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500" />
          <div className="flex items-center justify-between mb-8">
            <div className="flex space-x-1.5">
              <div className="w-2 h-2 rounded-full bg-red-500/50" />
              <div className="w-2 h-2 rounded-full bg-yellow-500/50" />
              <div className="w-2 h-2 rounded-full bg-green-500/50" />
            </div>
            <span className="text-[10px] text-slate-400 dark:text-slate-600 font-mono tracking-widest uppercase">Simulation Mode</span>
          </div>

          <div className="space-y-6">
            {DEMO_STEPS.map((step, i) => {
              const isActive = activeDemoStep === i;
              const isCompleted = activeDemoStep > i;
              const StepIcon = step.icon;

              return (
                <div 
                  key={i}
                  className={cn(
                    "flex items-center space-x-4 p-4 rounded-2xl border transition-all duration-500",
                    isActive ? "bg-slate-50 dark:bg-white/5 border-slate-200 dark:border-white/10 scale-[1.02]" : "border-transparent opacity-40"
                  )}
                >
                  <div className={cn("p-2 rounded-lg bg-slate-100 dark:bg-black/40", step.color)}>
                    <StepIcon className="w-5 h-5" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-bold text-slate-800 dark:text-white">{step.label}</p>
                    <p className="text-[10px] text-slate-500 font-mono mt-0.5">{step.desc}</p>
                  </div>
                  {isActive && <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />}
                  {isCompleted && <div className="w-4 h-4 bg-green-500 rounded-full flex items-center justify-center text-[10px] text-white dark:text-black font-bold">✓</div>}
                </div>
              );
            })}
          </div>

          <div className="mt-8 pt-8 border-t border-slate-100 dark:border-white/5 flex items-center justify-center space-x-2">
            <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
            <p className="text-[10px] text-slate-500 font-mono tracking-tighter uppercase">Omni Orchestrator Active</p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
