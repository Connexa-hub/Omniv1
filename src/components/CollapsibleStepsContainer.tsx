import React, { useState, useEffect, useRef } from 'react';
import { Loader2, ChevronDown } from 'lucide-react';
import { cn } from '../lib/utils';

export interface Step {
  id: string;
  type?: string;
  label: string;
  status: 'pending' | 'running' | 'completed' | 'error' | 'failed';
}

interface CollapsibleStepsContainerProps {
  steps: Step[];
  isGeneratingOrExecuting: boolean;
}

export const CollapsibleStepsContainer: React.FC<CollapsibleStepsContainerProps> = ({ steps, isGeneratingOrExecuting }) => {
  const [isExpanded, setIsExpanded] = useState(isGeneratingOrExecuting);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (isGeneratingOrExecuting) {
      setIsExpanded(true);
    }
  }, [isGeneratingOrExecuting]);

  useEffect(() => {
    if (isExpanded && containerRef.current) {
      const runningElement = containerRef.current.querySelector('[data-status="running"]');
      if (runningElement) {
        runningElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }
  }, [steps, isExpanded]);

  const activeStep = steps.find(s => s.status === 'running');
  const hasFailed = steps.some(s => s.status === 'error' || s.status === 'failed');
  const allCompleted = steps.every(s => s.status === 'completed');

  // Find active major step (steps that are not file-writing, command-running, or finalizing)
  const isMajorStep = (s: Step) => s.type !== 'writing' && s.type !== 'testing' && s.type !== 'handoff';
  
  const activeMajorStep = [...steps].reverse().find(s => s.status === 'running' && isMajorStep(s));
  const lastCompletedMajorStep = [...steps].reverse().find(s => s.status === 'completed' && isMajorStep(s));
  const currentMajorStep = activeMajorStep || lastCompletedMajorStep;

  let headerStatusText = "";
  if (isGeneratingOrExecuting) {
    headerStatusText = currentMajorStep 
      ? `Running: ${currentMajorStep.label}` 
      : activeStep 
        ? `Running: ${activeStep.label}` 
        : "Executing workspace tasks...";
  } else if (hasFailed) {
    headerStatusText = "Workspace tasks execution failed";
  } else if (allCompleted && steps.length > 0) {
    headerStatusText = "Workspace tasks execution completed";
  } else {
    headerStatusText = "Workspace tasks execution logs";
  }

  return (
    <div className="w-[95%] sm:w-[90%] border border-slate-200/80 dark:border-white/10 rounded-2xl bg-slate-50 dark:bg-[#121214] overflow-hidden shadow-sm mb-4 transition-all hover:border-slate-300 dark:hover:border-white/15">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-slate-100 dark:hover:bg-white/2 transition-colors select-none text-left"
      >
        <div className="flex items-center space-x-2.5 truncate flex-1 pr-4">
          {isGeneratingOrExecuting ? (
            <Loader2 className="w-4 h-4 text-blue-500 animate-spin shrink-0" />
          ) : hasFailed ? (
            <span className="text-red-500 shrink-0 text-xs">⚠️</span>
          ) : allCompleted && steps.length > 0 ? (
            <span className="text-green-500 shrink-0 text-xs">✅</span>
          ) : (
            <span className="text-slate-400 dark:text-slate-500 shrink-0 text-xs">📋</span>
          )}
          <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 truncate tracking-tight">
            {headerStatusText}
          </span>
        </div>
        <div className="flex items-center space-x-1 shrink-0">
          <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 px-1.5 py-0.5 rounded bg-slate-200/50 dark:bg-white/5 mr-1">
            {steps.filter(s => s.status === 'completed').length}/{steps.length}
          </span>
          {isExpanded ? (
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 transform rotate-180 transition-transform" />
          ) : (
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 transition-transform" />
          )}
        </div>
      </button>

      {isExpanded && (
        <div 
          ref={containerRef}
          className="px-4 pb-3 pt-1 border-t border-slate-150 dark:border-white/5 max-h-48 overflow-y-auto custom-scrollbar space-y-1.5"
        >
          {steps.map(step => {
            const isRunning = step.status === 'running';
            const isCompleted = step.status === 'completed';
            const isPending = step.status === 'pending';
            const isError = step.status === 'error' || step.status === 'failed';

            return (
              <div 
                key={step.id} 
                data-status={step.status}
                className={cn(
                  "flex items-start space-x-3 text-[11px] font-medium py-1 transition-all rounded px-2",
                  isRunning ? "bg-blue-50/50 dark:bg-blue-950/10 text-blue-600 dark:text-blue-400 font-semibold" : 
                  isPending ? "text-slate-400 dark:text-slate-500 opacity-60" :
                  isCompleted ? "text-slate-600 dark:text-slate-400" :
                  "text-red-500/90 dark:text-red-400"
                )}
              >
                <div className="mt-0.5 shrink-0">
                  {isRunning ? (
                    <div className="relative flex items-center justify-center">
                      <div className="absolute w-3.5 h-3.5 rounded-full border-2 border-blue-500/30 border-t-blue-500 animate-spin" />
                      <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                    </div>
                  ) : isCompleted ? (
                    <span className="text-green-500 text-[10px] leading-none font-bold">✓</span>
                  ) : isError ? (
                    <span className="text-red-500 text-[10px] leading-none font-bold">✗</span>
                  ) : (
                    <div className="w-1.5 h-1.5 rounded-full bg-slate-300 dark:bg-slate-700 ml-1 mt-1" />
                  )}
                </div>
                <span className="font-mono truncate flex-1">{step.label}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default CollapsibleStepsContainer;
