import { motion } from "motion/react";

export default function OmniWave({ className }: { className?: string }) {
  return (
    <div className={`relative flex items-center justify-center overflow-hidden ${className}`}>
      <svg
        viewBox="0 0 200 200"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full"
      >
        <defs>
          <linearGradient id="waveGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#3b82f6" />
            <stop offset="50%" stopColor="#8b5cf6" />
            <stop offset="100%" stopColor="#ec4899" />
          </linearGradient>
          <filter id="glow">
            <feGaussianBlur stdDeviation="5" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Outer Wave 1 */}
        <motion.path
          animate={{
            d: [
              "M20,100 Q50,70 100,100 T180,100",
              "M20,100 Q50,130 100,100 T180,100",
              "M20,100 Q50,70 100,100 T180,100",
            ],
          }}
          transition={{
            duration: 4,
            repeat: Infinity,
            ease: "easeInOut",
          }}
          fill="none"
          stroke="url(#waveGradient)"
          strokeWidth="4"
          strokeLinecap="round"
          filter="url(#glow)"
          className="opacity-40"
        />

        {/* Outer Wave 2 */}
        <motion.path
          animate={{
            d: [
              "M40,100 Q70,130 120,100 T160,100",
              "M40,100 Q70,70 120,100 T160,100",
              "M40,100 Q70,130 120,100 T160,100",
            ],
          }}
          transition={{
            duration: 3,
            repeat: Infinity,
            ease: "easeInOut",
            delay: 0.5,
          }}
          fill="none"
          stroke="url(#waveGradient)"
          strokeWidth="3"
          strokeLinecap="round"
          filter="url(#glow)"
          className="opacity-60"
        />

        {/* Central "O" Wave */}
        <motion.circle
          cx="100"
          cy="100"
          r="40"
          fill="none"
          stroke="url(#waveGradient)"
          strokeWidth="6"
          filter="url(#glow)"
          animate={{
            r: [35, 45, 35],
            strokeWidth: [4, 8, 4],
            opacity: [0.8, 1, 0.8],
          }}
          transition={{
            duration: 3,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />

        {/* Internal Flow */}
        <motion.path
          d="M70,100 C70,80 130,80 130,100 C130,120 70,120 70,100"
          fill="none"
          stroke="white"
          strokeWidth="1"
          animate={{
            pathLength: [0, 1, 0],
            opacity: [0, 0.5, 0],
          }}
          transition={{
            duration: 2.5,
            repeat: Infinity,
            ease: "linear",
          }}
        />
      </svg>
    </div>
  );
}
