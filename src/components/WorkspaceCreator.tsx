import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Code, Layout, PieChart, MousePointer2, Smartphone, Monitor, Database, Globe, X } from 'lucide-react';
import { cn } from '../lib/utils';

interface WorkspaceCreatorProps {
  projectName: string;
  setProjectName: (val: string) => void;
  projectDescription: string;
  setProjectDescription: (val: string) => void;
  projectPurpose: string;
  setProjectPurpose: (val: string) => void;
  onCreate: () => void;
  onClose: () => void;
}

export function WorkspaceCreator({
  projectName,
  setProjectName,
  projectDescription,
  setProjectDescription,
  projectPurpose,
  setProjectPurpose,
  onCreate,
  onClose
}: WorkspaceCreatorProps) {
  const [step, setStep] = useState(1);
  const [isCreating, setIsCreating] = useState(false);
  const [loadingText, setLoadingText] = useState('Creating your workspace...');

  const loadingSequence = [
    'Creating your workspace...',
    'Setting up your tools...',
    'Creating your environment...',
    'Machine is booting up...'
  ];

  const handleNext = () => {
    if (step === 1 && projectName.trim()) setStep(2);
    else if (step === 2 && projectDescription.trim()) setStep(3);
  };

  const handleCreate = async () => {
    setIsCreating(true);
    let index = 0;
    const interval = setInterval(() => {
      index++;
      if (index < loadingSequence.length) {
        setLoadingText(loadingSequence[index]);
      }
    }, 1500);

    setTimeout(() => {
      clearInterval(interval);
      onCreate();
    }, 6000);
  };

  const floatingElements = [
    { icon: Code, delay: 0, x: -280, y: -220, size: 'w-24 h-24' },
    { icon: Layout, delay: 1, x: 280, y: -180, size: 'w-32 h-32' },
    { icon: PieChart, delay: 2, x: -350, y: 150, size: 'w-20 h-20' },
    { icon: MousePointer2, delay: 1.5, x: 250, y: 220, size: 'w-16 h-16' },
    { icon: Monitor, delay: 0.5, x: 380, y: -20, size: 'w-28 h-28' },
    { icon: Smartphone, delay: 2.5, x: -400, y: -50, size: 'w-16 h-32' },
    { icon: Database, delay: 3, x: 50, y: 320, size: 'w-20 h-20' },
    { icon: Globe, delay: 1.2, x: -150, y: 350, size: 'w-24 h-24' },
  ];

  const codeBlocks = [
    { text: 'const app = express();', x: -450, y: -300, delay: 0.5 },
    { text: 'export default function App() {', x: 400, y: -350, delay: 1.5 },
    { text: '<motion.div animate={{ scale: 1.2 }} />', x: -500, y: 200, delay: 2.5 },
    { text: 'npm run build && node server.js', x: 450, y: 300, delay: 3.5 },
  ];

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-slate-50 dark:bg-[#05050A] overflow-hidden transition-colors duration-700"
    >
      {/* Dynamic Animated Background Objects */}
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
        {/* Ambient Gradients */}
        <motion.div 
          animate={{ x: [0, 100, -50, 0], y: [0, -100, 50, 0], scale: [1, 1.2, 0.8, 1] }}
          transition={{ repeat: Infinity, duration: 15, ease: "easeInOut" }}
          className="absolute top-1/4 left-1/4 w-[40rem] h-[40rem] bg-blue-600/10 dark:bg-blue-600/20 rounded-full mix-blend-multiply dark:mix-blend-screen filter blur-[100px]"
        />
        <motion.div 
          animate={{ x: [0, -100, 50, 0], y: [0, 50, -100, 0], scale: [1, 0.8, 1.2, 1] }}
          transition={{ repeat: Infinity, duration: 20, ease: "easeInOut" }}
          className="absolute top-1/3 right-1/4 w-[35rem] h-[35rem] bg-purple-600/10 dark:bg-purple-600/20 rounded-full mix-blend-multiply dark:mix-blend-screen filter blur-[100px]"
        />

        {/* Floating UI Elements */}
        {floatingElements.map((el, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, scale: 0.5, x: 0, y: 0 }}
            animate={{ 
              opacity: [0, 0.2, 0], 
              scale: [0.8, 1.1, 0.8],
              x: el.x,
              y: el.y,
              rotate: [0, 15, -15, 0]
            }}
            transition={{ 
              duration: 12, 
              repeat: Infinity, 
              delay: el.delay,
              ease: "easeInOut" 
            }}
            className={cn("absolute left-1/2 top-1/2 flex items-center justify-center bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl shadow-2xl backdrop-blur-md", el.size)}
          >
            <el.icon className="w-1/2 h-1/2 text-slate-300 dark:text-slate-600" />
          </motion.div>
        ))}

        {/* Floating Code Blocks */}
        {codeBlocks.map((block, i) => (
          <motion.div
            key={`code-${i}`}
            initial={{ opacity: 0, x: 0, y: 0 }}
            animate={{ 
              opacity: [0, 0.25, 0],
              x: block.x,
              y: block.y,
            }}
            transition={{ 
              duration: 15, 
              repeat: Infinity, 
              delay: block.delay,
              ease: "linear"
            }}
            className="absolute left-1/2 top-1/2 px-4 py-2 bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-lg shadow-xl backdrop-blur-xl font-mono text-[10px] text-blue-600 dark:text-blue-400 whitespace-nowrap"
          >
            {block.text}
          </motion.div>
        ))}
      </div>

      {/* Persistent Cancel Button (Top Left) */}
      {!isCreating && (
        <motion.button
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          onClick={onClose}
          className="absolute top-12 left-12 z-50 flex items-center space-x-3 px-6 py-3 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-full text-slate-500 hover:text-slate-900 dark:text-white/40 dark:hover:text-white transition-all shadow-xl backdrop-blur-2xl group"
        >
          <X className="w-5 h-5 group-hover:rotate-90 transition-transform duration-300" />
          <span className="text-[10px] font-black uppercase tracking-[0.2em]">Cancel Project</span>
        </motion.button>
      )}

      <div className="relative z-10 w-full max-w-2xl p-8">
        <AnimatePresence mode="wait">
          {!isCreating ? (
            <motion.div
              key={`form-step-${step}`}
              initial={{ opacity: 0, y: 40, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -40, scale: 0.95 }}
              transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
              className="flex flex-col items-center w-full"
            >
              {step === 1 && (
                <div className="w-full space-y-12">
                  <div className="space-y-4">
                    <h2 className="text-5xl md:text-7xl font-black text-slate-900 dark:text-white text-center tracking-tight leading-none">Name your workspace</h2>
                    <p className="text-center text-slate-500 dark:text-slate-400 font-semibold tracking-wide">Every great project starts with a name</p>
                  </div>
                  <div className="relative w-full">
                    <input 
                      type="text"
                      value={projectName}
                      onChange={e => setProjectName(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleNext()}
                      className="w-full bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white text-3xl md:text-4xl p-8 rounded-[2.5rem] focus:outline-none focus:ring-8 focus:ring-blue-500/10 focus:border-blue-500 transition-all shadow-2xl backdrop-blur-2xl text-center"
                      placeholder="e.g. Project Omni"
                    />
                  </div>
                  <button 
                    onClick={handleNext}
                    disabled={!projectName.trim()}
                    className="w-full py-6 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-full font-black text-2xl disabled:opacity-50 transition-all hover:scale-[1.02] active:scale-[0.98] shadow-2xl hover:shadow-blue-500/10"
                  >
                    Next Step
                  </button>
                </div>
              )}
              {step === 2 && (
                <div className="w-full space-y-12">
                  <div className="space-y-4">
                    <h2 className="text-5xl md:text-7xl font-black text-slate-900 dark:text-white text-center tracking-tight leading-none">Describe your vision</h2>
                    <p className="text-center text-slate-500 dark:text-slate-400 font-semibold tracking-wide">Tell Omni what you want to build today</p>
                  </div>
                  <textarea 
                    value={projectDescription}
                    onChange={e => setProjectDescription(e.target.value)}
                    className="w-full bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white text-xl p-10 rounded-[3rem] focus:outline-none focus:ring-8 focus:ring-blue-500/10 focus:border-blue-500 transition-all shadow-2xl backdrop-blur-2xl min-h-[320px] resize-none leading-relaxed"
                    placeholder="Describe features, themes, or core logic..."
                  />
                  <div className="flex space-x-4 w-full">
                    <button 
                      onClick={() => setStep(1)}
                      className="flex-1 py-6 bg-slate-200 dark:bg-white/10 text-slate-600 dark:text-white rounded-full font-black text-2xl transition-all hover:scale-[1.02] active:scale-[0.98]"
                    >
                      Back
                    </button>
                    <button 
                      onClick={handleNext}
                      disabled={!projectDescription.trim()}
                      className="flex-[2] py-6 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-full font-black text-2xl disabled:opacity-50 transition-all hover:scale-[1.02] active:scale-[0.98] shadow-2xl"
                    >
                      Next Step
                    </button>
                  </div>
                </div>
              )}
              {step === 3 && (
                <div className="w-full space-y-12">
                  <div className="space-y-4">
                    <h2 className="text-5xl md:text-7xl font-black text-slate-900 dark:text-white text-center tracking-tight leading-none">Choose your stack</h2>
                    <p className="text-center text-slate-500 dark:text-slate-400 font-semibold tracking-wide">Optional. Let Omni optimize your environment.</p>
                  </div>
                  <input 
                    type="text"
                    value={projectPurpose}
                    onChange={e => setProjectPurpose(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleCreate()}
                    className="w-full bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white text-3xl md:text-4xl p-8 rounded-[2.5rem] focus:outline-none focus:ring-8 focus:ring-blue-500/10 focus:border-blue-500 transition-all shadow-2xl backdrop-blur-2xl text-center"
                    placeholder="e.g. React, Next.js, Node.js..."
                  />
                  <div className="flex space-x-4 w-full">
                    <button 
                      onClick={() => setStep(2)}
                      className="flex-1 py-6 bg-slate-200 dark:bg-white/10 text-slate-600 dark:text-white rounded-full font-black text-2xl transition-all hover:scale-[1.02] active:scale-[0.98]"
                    >
                      Back
                    </button>
                    <button 
                      onClick={handleCreate}
                      className="flex-[2] py-6 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white rounded-full font-black text-2xl transition-all hover:scale-[1.02] active:scale-[0.98] shadow-2xl shadow-blue-500/30"
                    >
                      Create Workspace
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          ) : (
            <motion.div
              key="loading-state"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.8, ease: "circOut" }}
              className="flex flex-col items-center justify-center space-y-16"
            >
              <div className="relative">
                <motion.div 
                  animate={{ rotate: 360 }}
                  transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
                  className="absolute -inset-12 border-[2px] border-dashed border-blue-500/30 rounded-full"
                />
                <motion.div 
                  animate={{ rotate: -360 }}
                  transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
                  className="absolute -inset-20 border-[1px] border-dashed border-purple-500/20 rounded-full"
                />
                <h1 className="text-[120px] md:text-[160px] font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-br from-blue-400 via-purple-400 to-pink-400 animate-pulse drop-shadow-2xl select-none leading-none">
                  OMNI
                </h1>
              </div>
              <div className="flex flex-col items-center space-y-10">
                <div className="flex space-x-6">
                  <motion.div animate={{ y: [-10, 10, -10], scale: [1, 1.3, 1] }} transition={{ repeat: Infinity, duration: 1.5 }} className="w-5 h-5 bg-blue-500 rounded-full shadow-[0_0_30px_rgba(59,130,246,0.8)]" />
                  <motion.div animate={{ y: [-10, 10, -10], scale: [1, 1.3, 1] }} transition={{ repeat: Infinity, duration: 1.5, delay: 0.2 }} className="w-5 h-5 bg-purple-500 rounded-full shadow-[0_0_30px_rgba(168,85,247,0.8)]" />
                  <motion.div animate={{ y: [-10, 10, -10], scale: [1, 1.3, 1] }} transition={{ repeat: Infinity, duration: 1.5, delay: 0.4 }} className="w-5 h-5 bg-pink-500 rounded-full shadow-[0_0_30px_rgba(236,72,153,0.8)]" />
                </div>
                <div className="space-y-3 flex flex-col items-center">
                  <motion.p 
                    key={loadingText}
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-2xl md:text-3xl text-slate-900 dark:text-blue-100 font-mono tracking-[0.3em] uppercase text-center font-black"
                  >
                    {loadingText}
                  </motion.p>
                  <p className="text-slate-400 dark:text-slate-500 text-sm font-mono tracking-widest animate-pulse font-bold">Neural Architect Initialized</p>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
