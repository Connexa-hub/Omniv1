import { Sun, Moon } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/src/lib/utils";

export default function ThemeToggle() {
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('theme') as 'light' | 'dark' || 'light';
    }
    return 'light';
  });

  useEffect(() => {
    const root = window.document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
      root.classList.remove('light');
    } else {
      root.classList.add('light');
      root.classList.remove('dark');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  };

  return (
    <button
      onClick={toggleTheme}
      className={cn(
        "p-2 rounded-lg transition-all duration-300 hover:bg-white/5 dark:hover:bg-white/5",
        theme === 'dark' ? "text-yellow-500" : "text-blue-600"
      )}
    >
      {theme === 'dark' ? (
        <Sun className="w-5 h-5 transition-transform duration-500 rotate-0 scale-100" />
      ) : (
        <Moon className="w-5 h-5 transition-transform duration-500 rotate-0 scale-100" />
      )}
    </button>
  );
}
