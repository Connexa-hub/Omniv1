import React, { useState, useEffect } from "react";
import { auth, db } from "@/src/lib/firebase";
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut,
  onAuthStateChanged,
  User,
  GoogleAuthProvider,
  signInWithPopup,
  sendPasswordResetEmail
} from "firebase/auth";
import { doc, getDoc, setDoc, query, collection, where, getDocs } from "firebase/firestore";
import { motion, AnimatePresence } from "motion/react";
import { Mail, Lock, User as UserIcon, Chrome, ChevronLeft } from "lucide-react";
import { cn } from "@/src/lib/utils";
import OmniWave from "./OmniWave";

const BACKGROUND_SERVICES = [
  { name: "App Development", icon: "🚀", color: "from-blue-600/40", desc: "Build production apps" },
  { name: "AI Research", icon: "🧠", color: "from-purple-600/40", desc: "Deep knowledge search" },
  { name: "Study Systems", icon: "📚", color: "from-green-600/40", desc: "Personalized learning" },
  { name: "Image Generation", icon: "🎨", color: "from-pink-600/40", desc: "Creative AI studio" },
  { name: "Web Search", icon: "🌐", color: "from-cyan-600/40", desc: "Real-time intelligence" },
  { name: "Data Canvas", icon: "📊", color: "from-yellow-600/40", desc: "Visual data flow" },
  { name: "Infographics", icon: "📈", color: "from-orange-600/40", desc: "Dynamic visualizations" },
];

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isBlocked, setIsBlocked] = useState(false);

  useEffect(() => {
    return onAuthStateChanged(auth, async (u) => {
      if (u) {
        const userDoc = await getDoc(doc(db, "users", u.uid));
        if (userDoc.exists() && userDoc.data().isBlocked) {
          setIsBlocked(true);
          await signOut(auth);
          setUser(null);
        } else {
          setUser(u);
          setIsBlocked(false);
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    });
  }, []);

  return { user, loading, isBlocked };
}

export default function Auth({ onAuthSuccess }: { onAuthSuccess: () => void }) {
  const [view, setView] = useState<'signin' | 'signup' | 'forgot'>('signin');
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    setIsDark(document.documentElement.classList.contains('dark'));
    // Observe theme class mutations
    const observer = new MutationObserver(() => {
      setIsDark(document.documentElement.classList.contains('dark'));
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setMessage("");
    setLoading(true);

    try {
      if (view === 'signup') {
        const q = query(collection(db, "blocked_emails"), where("email", "==", email));
        const blockedCheck = await getDocs(q);
        if (!blockedCheck.empty) throw new Error("This email has been permanently blocked from Omni.");

        const res = await createUserWithEmailAndPassword(auth, email, password);
        await setDoc(doc(db, "users", res.user.uid), {
          displayName: name,
          email,
          createdAt: new Date(),
          isBlocked: false,
          authProvider: 'email'
        });
      } else if (view === 'signin') {
        const res = await signInWithEmailAndPassword(auth, email, password);
        const userDoc = await getDoc(doc(db, "users", res.user.uid));
        if (userDoc.exists() && userDoc.data().isBlocked) {
          await signOut(auth);
          throw new Error("This account has been blocked.");
        }
      } else if (view === 'forgot') {
        await sendPasswordResetEmail(auth, email);
        setMessage("Check your email for password reset instructions.");
      }
      if (view !== 'forgot') onAuthSuccess();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError("");
    setLoading(true);
    const provider = new GoogleAuthProvider();
    try {
      const res = await signInWithPopup(auth, provider);
      const userEmail = res.user.email;

      // Check blocked emails first
      const qBlocked = query(collection(db, "blocked_emails"), where("email", "==", userEmail));
      const blockedSnap = await getDocs(qBlocked);
      if (!blockedSnap.empty) {
        await signOut(auth);
        throw new Error("This email has been permanently blocked from Omni.");
      }

      const userDoc = await getDoc(doc(db, "users", res.user.uid));
      if (userDoc.exists() && userDoc.data().isBlocked) {
        await signOut(auth);
        throw new Error("This account has been blocked.");
      }

      if (!userDoc.exists()) {
        await setDoc(doc(db, "users", res.user.uid), {
          displayName: res.user.displayName,
          email: res.user.email,
          createdAt: new Date(),
          isBlocked: false,
          authProvider: 'google'
        });
      }
      onAuthSuccess();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-50 dark:bg-[#0A0A0A] overflow-hidden transition-colors duration-300">
      {/* Sliding Background */}
      <div className="absolute inset-0 flex flex-col justify-center opacity-35 pointer-events-none scale-110">
        <div className="flex space-x-8 animate-scroll-slow whitespace-nowrap mb-8">
          {[...BACKGROUND_SERVICES, ...BACKGROUND_SERVICES].map((s, i) => (
            <div key={i} className="flex flex-col p-6 rounded-3xl bg-white/80 dark:bg-[#121214]/80 border border-slate-200/60 dark:border-white/10 shadow-xl min-w-[280px]">
              <span className="text-4xl mb-3">{s.icon}</span>
              <span className="text-xl font-bold text-slate-800 dark:text-white mb-1 tracking-tight">{s.name}</span>
              <span className="text-slate-500 dark:text-white/60 text-sm font-medium">{s.desc}</span>
            </div>
          ))}
        </div>
        <div className="flex space-x-8 animate-scroll-reverse whitespace-nowrap">
          {[...BACKGROUND_SERVICES, ...BACKGROUND_SERVICES].reverse().map((s, i) => (
            <div key={i} className="flex flex-col p-6 rounded-3xl bg-white/80 dark:bg-[#121214]/80 border border-slate-200/60 dark:border-white/10 shadow-xl min-w-[280px]">
              <span className="text-4xl mb-3">{s.icon}</span>
              <span className="text-xl font-bold text-slate-800 dark:text-white mb-1 tracking-tight">{s.name}</span>
              <span className="text-slate-500 dark:text-white/60 text-sm font-medium">{s.desc}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Gradients */}
      <div className="absolute inset-0 bg-gradient-to-b from-slate-50 via-transparent to-slate-50 dark:from-[#0A0A0A] dark:via-transparent dark:to-[#0A0A0A] z-10" />
      <div className="absolute inset-0 bg-gradient-to-r from-slate-50 via-transparent to-slate-50 dark:from-[#0A0A0A] dark:via-transparent dark:to-[#0A0A0A] z-10" />

      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="w-full max-w-md bg-white/90 dark:bg-[#0F0F0F]/80 backdrop-blur-xl border border-slate-200 dark:border-white/10 rounded-3xl p-8 shadow-2xl relative z-20"
      >
        <div className="flex flex-col items-center mb-8">
          <OmniWave className="w-24 h-24 mb-4" />
          <h2 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tighter">
            {view === 'signup' ? "Create Account" : view === 'signin' ? "Welcome Back" : "Reset Password"}
          </h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-2 text-center">
            {view === 'signup' ? "Join the next generation of software engineering." : "Continue your journey with Omni."}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <AnimatePresence mode="wait">
            {view === 'signup' && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="space-y-2"
              >
                <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Full Name</label>
                <div className="relative">
                  <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input 
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl px-10 py-3 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-blue-500/50 transition-colors"
                    placeholder="John Doe"
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="space-y-2">
            <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Email</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input 
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl px-10 py-3 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-blue-500/50 transition-colors"
                placeholder="name@company.com"
              />
            </div>
          </div>

          {view !== 'forgot' && (
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Password</label>
                {view === 'signin' && (
                  <button type="button" onClick={() => setView('forgot')} className="text-[10px] font-bold text-blue-500 uppercase hover:underline">Forgot?</button>
                )}
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input 
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl px-10 py-3 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-blue-500/50 transition-colors"
                  placeholder="••••••••"
                />
              </div>
            </div>
          )}

          {error && <p className="text-red-500 text-xs mt-2">{error}</p>}
          {message && <p className="text-green-500 text-xs mt-2">{message}</p>}

          <button 
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold py-4 rounded-2xl transition-all shadow-lg shadow-blue-600/20"
          >
            {loading ? "Processing..." : view === 'signup' ? "Get Started" : view === 'signin' ? "Sign In" : "Send Link"}
          </button>
        </form>

        <div className="mt-4 flex items-center space-x-2">
          <div className="flex-1 h-[1px] bg-slate-200 dark:bg-white/10" />
          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">OR</span>
          <div className="flex-1 h-[1px] bg-slate-200 dark:bg-white/10" />
        </div>

        <button 
          onClick={handleGoogleSignIn}
          className="w-full mt-4 flex items-center justify-center space-x-3 bg-white hover:bg-slate-50 dark:bg-white/10 dark:hover:bg-white/20 text-slate-900 dark:text-white border border-slate-200 dark:border-white/10 font-bold py-4 rounded-2xl transition-all"
        >
          <Chrome className="w-5 h-5 text-red-500" />
          <span>Continue with Google</span>
        </button>

        <div className="mt-6 text-center">
          {view === 'forgot' ? (
            <button onClick={() => setView('signin')} className="flex items-center space-x-2 mx-auto text-sm text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors">
              <ChevronLeft className="w-4 h-4" />
              <span>Back to Sign In</span>
            </button>
          ) : (
            <button 
              onClick={() => setView(view === 'signin' ? 'signup' : 'signin')}
              className="text-sm text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors"
            >
              {view === 'signin' ? "Don't have an account? Sign up" : "Already have an account? Sign in"}
            </button>
          )}
        </div>
      </motion.div>

      <style>{`
        @keyframes scroll-slow {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        @keyframes scroll-reverse {
          0% { transform: translateX(-50%); }
          100% { transform: translateX(0); }
        }
        .animate-scroll-slow {
          animation: scroll-slow 30s linear infinite;
        }
        .animate-scroll-reverse {
          animation: scroll-reverse 40s linear infinite;
        }
      `}</style>
    </div>
  );
}
