import React, { useState } from 'react';
import { 
  Terminal,
  ExternalLink,
  Copy,
  Check,
  Zap
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';

function cn(...classes: any[]) {
  return classes.filter(Boolean).join(' ');
}

interface TextbookMessageContentProps {
  content: string;
  suggestions?: string[];
  onSelectSuggestion: (suggestion: string) => void;
  role: 'user' | 'assistant' | 'system';
}

function CodeBlockRenderer({ code, language }: { code: string; language: string }) {
  const [copied, setCopied] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  const linesCount = code.split('\n').length;
  const isLong = linesCount > 15;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy code: ', err);
    }
  };

  const highlightCode = (rawCode: string, lang: string) => {
    const lines = rawCode.split('\n');

    return lines.map((line, idx) => {
      // Basic keyword coloring
      const parts = line.split(/(\b(?:const|let|var|function|return|import|export|from|class|extends|if|else|for|while|async|await|interface|type|default|null|undefined|true|false)\b)/);
      return (
        <div key={idx} className="min-h-[1.25rem] hover:bg-white/2 px-4 py-0.5 transition-colors flex items-start font-mono text-xs">
          <span className="text-slate-600 mr-4 select-none inline-block w-6 text-right shrink-0">{idx + 1}</span>
          <span className="text-slate-200 break-all whitespace-pre-wrap">
            {parts.map((part, pIdx) => {
              if (/^(?:const|let|var|function|return|import|export|from|class|extends|if|else|for|while|async|await|interface|type|default)$/.test(part)) {
                return <span key={pIdx} className="text-pink-500 font-semibold">{part}</span>;
              }
              if (/^(?:true|false|null|undefined)$/.test(part)) {
                return <span key={pIdx} className="text-amber-500 font-semibold">{part}</span>;
              }
              if ((part.startsWith('"') && part.endsWith('"')) || (part.startsWith("'") && part.endsWith("'"))) {
                return <span key={pIdx} className="text-green-400 font-medium">{part}</span>;
              }
              return part;
            })}
          </span>
        </div>
      );
    });
  };

  return (
    <div className="my-4 border border-slate-200 dark:border-white/10 rounded-xl overflow-hidden shadow-lg bg-[#0F0F11]">
      <div className="bg-[#161619] px-4 py-2 border-b border-white/5 flex items-center justify-between select-none">
        <div className="flex items-center space-x-2 text-[10px] uppercase tracking-widest font-mono font-bold text-slate-400">
          <Terminal className="w-3.5 h-3.5 text-blue-500" />
          <span>{language || 'text'}</span>
        </div>
        <div className="flex items-center space-x-2">
          {isLong && (
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="flex items-center gap-1.5 text-[10px] font-bold font-mono px-2.5 py-1 rounded-md bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white transition-all border border-white/5"
            >
              {isExpanded ? "COLLAPSE" : "EXPAND"}
            </button>
          )}
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 text-[10px] font-bold font-mono px-2.5 py-1 rounded-md bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white transition-all border border-white/5"
          >
            {copied ? (
              <>
                <Check className="w-3 h-3 text-green-400" />
                <span className="text-green-400">COPIED!</span>
              </>
            ) : (
              <>
                <Copy className="w-3 h-3" />
                <span>COPY CODE</span>
              </>
            )}
          </button>
        </div>
      </div>
      <div className={cn("py-4 overflow-x-auto max-w-full custom-scrollbar", isLong && !isExpanded ? "max-h-[300px] overflow-y-hidden relative" : "")}>
        <pre className="font-mono text-xs leading-relaxed">
          <code>{highlightCode(code, language)}</code>
        </pre>
        {isLong && !isExpanded && (
          <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-[#0F0F11] to-transparent pointer-events-none flex items-end justify-center pb-2">
            <span className="text-xs text-slate-400 font-mono font-medium">{linesCount - 15} more lines...</span>
          </div>
        )}
      </div>
    </div>
  );
}

export default function TextbookMessageContent({ 
  content, 
  suggestions, 
  onSelectSuggestion,
  role 
}: TextbookMessageContentProps) {
  const isAssistant = role === 'assistant';

  if (!isAssistant) {
    return (
      <div className="text-sm font-medium tracking-wide leading-relaxed">
        {content}
      </div>
    );
  }

  // Extract <file> and <command> tags
  const fileTags: {path: string, content: string}[] = [];
  const commandTags: string[] = [];
  
  let cleanContent = content;
  
  const fileRegex = /<file\s+path="([^"]+)">([\s\S]*?)<\/file>/g;
  let fileMatch;
  while ((fileMatch = fileRegex.exec(content)) !== null) {
     fileTags.push({ path: fileMatch[1], content: fileMatch[2] });
     cleanContent = cleanContent.replace(fileMatch[0], '');
  }
  
  const cmdRegex = /<command>([\s\S]*?)<\/command>/g;
  let cmdMatch;
  while ((cmdMatch = cmdRegex.exec(content)) !== null) {
     commandTags.push(cmdMatch[1].trim());
     cleanContent = cleanContent.replace(cmdMatch[0], '');
  }

  return (
    <div className="space-y-4 w-full text-left font-sans leading-relaxed">
      {fileTags.length > 0 && (
        <div className="flex flex-col space-y-2 mb-4">
          {fileTags.map((file, i) => (
            <div key={i} className="flex items-center space-x-2 px-3 py-2 bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 rounded-xl max-w-fit">
              <div className="w-6 h-6 rounded-lg bg-blue-100 dark:bg-blue-500/20 flex items-center justify-center shrink-0">
                <Check className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600/70 dark:text-blue-400/70">Wrote File</span>
                <span className="text-xs font-mono font-medium text-slate-800 dark:text-slate-200">{file.path}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {commandTags.length > 0 && (
        <div className="flex flex-col space-y-2 mb-4">
          {commandTags.map((cmd, i) => (
            <div key={i} className="flex items-center space-x-2 px-3 py-2 bg-purple-50 dark:bg-purple-500/10 border border-purple-200 dark:border-purple-500/20 rounded-xl max-w-fit">
              <div className="w-6 h-6 rounded-lg bg-purple-100 dark:bg-purple-500/20 flex items-center justify-center shrink-0">
                <Terminal className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] font-bold uppercase tracking-wider text-purple-600/70 dark:text-purple-400/70">Ran Command</span>
                <span className="text-xs font-mono font-medium text-slate-800 dark:text-slate-200">{cmd}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {cleanContent.trim().length > 0 && (
        <div className="prose prose-slate dark:prose-invert max-w-none text-slate-800 dark:text-slate-200 markdown-body">
          <ReactMarkdown
            remarkPlugins={[remarkGfm, remarkMath]}
            rehypePlugins={[rehypeKatex]}
            components={{
            code({ node, inline, className, children, ...props }: any) {
              const match = /language-(\w+)/.exec(className || '');
              return !inline && match ? (
                <CodeBlockRenderer code={String(children).replace(/\n$/, '')} language={match[1]} />
              ) : (
                <code className="px-1.5 py-0.5 bg-slate-100 dark:bg-white/5 border border-slate-250 dark:border-white/10 rounded font-mono text-xs text-blue-600 dark:text-blue-400 font-semibold mx-0.5" {...props}>
                  {children}
                </code>
              );
            },
            table({ children }) {
              return (
                <div className="my-4 overflow-x-auto border border-slate-200 dark:border-white/5 rounded-xl bg-white dark:bg-white/1 shadow-sm">
                  <table className="w-full text-left border-collapse text-xs">
                    {children}
                  </table>
                </div>
              );
            },
            thead({ children }) {
              return <thead className="bg-slate-50 dark:bg-white/2 border-b border-slate-200 dark:border-white/5 font-bold text-slate-800 dark:text-slate-200 font-sans">{children}</thead>;
            },
            tbody({ children }) {
              return <tbody className="divide-y divide-slate-100 dark:divide-white/2">{children}</tbody>;
            },
            tr({ children }) {
              return <tr className="hover:bg-slate-50/50 dark:hover:bg-white/1 transition-colors">{children}</tr>;
            },
            th({ children }) {
              return <th className="px-4 py-3 font-semibold">{children}</th>;
            },
            td({ children }) {
              return <td className="px-4 py-2.5 text-slate-700 dark:text-slate-300 font-medium">{children}</td>;
            },
            blockquote({ children }) {
              return <blockquote className="my-4 pl-4 border-l-4 border-blue-500 bg-blue-500/5 py-3 pr-4 rounded-r-xl text-sm italic text-slate-700 dark:text-slate-300">{children}</blockquote>;
            },
            a({ children, href }) {
              return (
                <a href={href} target="_blank" rel="noopener noreferrer" className="text-blue-650 dark:text-blue-400 font-bold underline hover:text-blue-500 inline-flex items-center gap-0.5 transition-colors">
                  {children}
                  <ExternalLink className="w-2.5 h-2.5" />
                </a>
              );
            }
          }}
        >
          {cleanContent}
        </ReactMarkdown>
      </div>
      )}

      {suggestions && suggestions.length > 0 && (
        <div className="pt-2 border-t border-slate-100 dark:border-white/5">
          <p className="text-[10px] uppercase font-mono tracking-widest font-bold text-slate-400 mb-2">Engage Core Memories / Inquire Next:</p>
          <div className="flex flex-wrap gap-2">
            {suggestions.map((sug, i) => (
              <button
                key={i}
                onClick={() => onSelectSuggestion(sug)}
                className="text-xs text-left px-3.5 py-2 bg-blue-500/5 hover:bg-blue-600 hover:text-white text-blue-600 dark:text-blue-400 border border-blue-500/10 dark:border-white/5 rounded-xl transition-all font-medium flex items-center space-x-1.5 focus:outline-none shadow-sm"
              >
                <Zap className="w-3.5 h-3.5 text-blue-500 shrink-0 group-hover:text-white" />
                <span>{sug}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

