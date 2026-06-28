import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AlertTriangle, X, RefreshCcw, ShieldAlert, WifiOff } from 'lucide-react';

export type ErrorType = 'rate-limit' | 'internal' | 'unavailable' | 'network' | null;

interface ErrorModalProps {
  type: ErrorType;
  onClose: () => void;
  onRetry?: () => void;
}

const ERROR_CONFIGS = {
  'rate-limit': {
    title: 'Quota Exceeded',
    message: 'The selected AI platform is currently overcrowded or you have reached your free tier limit. Please try again in a few minutes or switch to a different intelligence model.',
    icon: ShieldAlert,
    color: 'text-amber-500',
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/20'
  },
  'internal': {
    title: 'Core Engine Error',
    message: 'Omni Core encountered an unexpected internal error while processing your request. Our systems are investigating the breach.',
    icon: AlertTriangle,
    color: 'text-red-500',
    bg: 'bg-red-500/10',
    border: 'border-red-500/20'
  },
  'unavailable': {
    title: 'Model Unavailable',
    message: 'The requested intelligence model is currently offline or undergoing maintenance. We suggest switching to Gemini 2.0 or Mistral.',
    icon: WifiOff,
    color: 'text-slate-500',
    bg: 'bg-slate-500/10',
    border: 'border-slate-500/20'
  },
  'network': {
    title: 'Connection Lost',
    message: 'We lost contact with the brain server. Please check your internet connection or the sandbox status.',
    icon: WifiOff,
    color: 'text-blue-500',
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/20'
  }
};

export const ErrorModal: React.FC<ErrorModalProps> = ({ type, onClose, onRetry }) => {
  if (!type) return null;

  const config = ERROR_CONFIGS[type] || ERROR_CONFIGS['internal'];
  const Icon = config.icon;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          className={`w-full max-w-md ${config.bg} ${config.border} border rounded-3xl p-8 shadow-2xl relative overflow-hidden`}
        >
          <div className="absolute top-0 right-0 p-4">
            <button 
              onClick={onClose}
              className="p-2 hover:bg-white/10 rounded-full transition-colors text-slate-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex flex-col items-center text-center space-y-6">
            <div className={`p-4 rounded-2xl ${config.bg} ${config.color}`}>
              <Icon className="w-12 h-12" />
            </div>

            <div className="space-y-2">
              <h3 className={`text-xl font-bold ${config.color}`}>{config.title}</h3>
              <p className="text-sm text-slate-400 dark:text-slate-300 leading-relaxed">
                {config.message}
              </p>
            </div>

            <div className="flex flex-col w-full space-y-3 pt-4">
              {onRetry && (
                <button
                  onClick={onRetry}
                  className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold flex items-center justify-center space-x-2 transition-all shadow-lg shadow-blue-600/20"
                >
                  <RefreshCcw className="w-4 h-4" />
                  <span>Try Again Now</span>
                </button>
              )}
              <button
                onClick={onClose}
                className="w-full py-3 bg-white/5 hover:bg-white/10 text-slate-300 rounded-xl font-bold transition-all"
              >
                Dismiss
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default ErrorModal;

