import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  MessageSquare, 
  Files, 
  Settings as SettingsIcon, 
  Play, 
  Terminal as TerminalIcon, 
  Code, 
  Eye, 
  ChevronRight, 
  ChevronDown,
  ChevronLeft,
  Plus,
  Trash2,
  Save,
  Check,
  Loader2,
  Rocket,
  Search,
  User,
  Bot,
  History,
  LogOut,
  Moon,
  Sun,
  Menu,
  X,
  Minimize2,
  Maximize2,
  Cpu,
  Zap,
  Square,
  Pin,
  Globe,
  BookOpen,
  ThumbsUp,
  ThumbsDown,
  RotateCcw,
  RefreshCw,
  Sliders,
  KeyRound,
  MoreVertical,
  Copy,
  ExternalLink
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Message, FileNode, ProjectState, Project } from './types';
import { cn } from './lib/utils';
import Landing from './components/Landing';
import { WorkspaceCreator } from './components/WorkspaceCreator';
import ThemeToggle from './components/ThemeToggle';
import Auth, { useAuth } from './components/Auth';
import Onboarding from './components/Onboarding';
import OmniWave from './components/OmniWave';
import TextbookMessageContent from './components/TextbookMessageContent';
import { ErrorModal, ErrorType } from './components/ErrorModal';
import CollapsibleStepsContainer from './components/CollapsibleStepsContainer';
import { auth, db, handleFirestoreError, OperationType } from './lib/firebase';
import { signOut, deleteUser } from 'firebase/auth';
import { doc, updateDoc, collection, query, where, getDocs, addDoc, orderBy, limit, deleteDoc } from 'firebase/firestore';

const sanitizeForFirestore = (val: any): any => {
  if (val === undefined) return null;
  if (val === null) return null;
  if (val instanceof Date) return val; // Dates are supported
  if (val && typeof val === 'object' && val.constructor.name === 'Timestamp') return val; // Firestore Timestamps are supported
  if (Array.isArray(val)) return val.map(sanitizeForFirestore);
  if (typeof val === 'object') {
    const res: any = {};
    for (const key of Object.keys(val)) {
      if (val[key] !== undefined) {
        res[key] = sanitizeForFirestore(val[key]);
      }
    }
    return res;
  }
  return val;
};

export default function App() {
  // Fast path for Preview mode (rendered inside iframe)
  const isPreviewMode = typeof window !== 'undefined' && window.location.search.includes('preview=true');

  useEffect(() => {
    if (isPreviewMode) {
      const syncTheme = () => {
        const theme = localStorage.getItem('theme') || 'light';
        const root = window.document.documentElement;
        if (theme === 'dark') {
          root.classList.add('dark');
          root.classList.remove('light');
        } else {
          root.classList.add('light');
          root.classList.remove('dark');
        }
      };
      syncTheme();
      // Poll theme changes from parent every 500ms
      const interval = setInterval(syncTheme, 500);
      return () => clearInterval(interval);
    }
  }, [isPreviewMode]);

  if (isPreviewMode) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-[#0A0A0B] text-slate-400 font-mono text-sm">
        <p>Omni Universal Sandbox Environment</p>
        <p className="text-[10px] mt-2 opacity-50">Awaiting intelligent application generation...</p>
      </div>
    );
  }

  const { user, loading: authLoading, isBlocked } = useAuth();
  const [showOnboarding, setShowOnboarding] = useState(() => {
    return localStorage.getItem('omni_onboarded') !== 'true';
  });
  const [activePanel, setActivePanel] = useState<'history' | 'files' | 'settings' | null>(null);
  const [activeView, setActiveView] = useState<'editor' | 'preview'>('editor');
  const [isTerminalOpen, setIsTerminalOpen] = useState(true);
  const [project, setProject] = useState<ProjectState>({
    name: 'Omni Workspace',
    description: 'An AI-powered application',
    files: [],
    messages: [],
    status: 'idle'
  });
  const [activeFileContent, setActiveFileContent] = useState<string>('');
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);
  const chatIdRef = useRef<string | null>(null);
  const messagesRef = useRef<Message[]>([]);

  useEffect(() => {
    chatIdRef.current = currentChatId;
  }, [currentChatId]);

  useEffect(() => {
    messagesRef.current = project.messages;
  }, [project.messages]);
  const [chatInput, setChatInput] = useState('');
  const [aiMode, setAiMode] = useState<'agent' | 'learning' | 'study'>('learning');
  const [systemStatus, setSystemStatus] = useState<any>(null);
  const [chatHistory, setChatHistory] = useState<any[]>([]);
  const [historyError, setHistoryError] = useState(false);
  const [messageFeedbacks, setMessageFeedbacks] = useState<Record<string, 'up' | 'down'>>({});
  const [selectedModel, setSelectedModel] = useState('omni-google');
  const [isChatExpanded, setIsChatExpanded] = useState(false);
  const [selectedChatForActions, setSelectedChatForActions] = useState<any | null>(null);
  const [terminalInput, setTerminalInput] = useState('');
  const [terminalLogs, setTerminalLogs] = useState<{ id: string; text: string; type: 'cmd' | 'system' | 'output' | 'error' }[]>([
    { id: '1', text: 'Environment initialized on port 3000.', type: 'system' },
    { id: '2', text: 'Type a shell command below to run (e.g. ls, npm run build, help).', type: 'system' }
  ]);
  const [commandRunning, setCommandRunning] = useState(false);
  const terminalEndRef = useRef<HTMLDivElement | null>(null);
  const chatContainerRef = useRef<HTMLDivElement | null>(null);
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  // File editor states and terminal input refs
  const [isSavingFile, setIsSavingFile] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const terminalInputRef = useRef<HTMLInputElement | null>(null);
  const mobileTerminalInputRef = useRef<HTMLInputElement | null>(null);

  // Custom responsive, resizable, and UI toggle states
  const [isMobile, setIsMobile] = useState(false);
  const [mobileTab, setMobileTab] = useState<'chat' | 'terminal' | 'preview'>('chat');
  const [isMobileLogsOpen, setIsMobileLogsOpen] = useState(false);
  const [showMobileLogs, setShowMobileLogs] = useState(true);
  const [greetingIndex, setGreetingIndex] = useState(0);
  const greetings = [
    "What do you want to build today?",
    "How can Omni assist your engineering vision?",
    "Let's architect something extraordinary.",
    "Ready to design, code, or research?",
    "Describe your project and let's bring it to life.",
    "Need a full-stack system, interactive game, or simulation?",
    "How can I help you streamline your workflow?",
    "Let's prototype your next breakthrough idea.",
    "Explore physics, code applications, or analyze data with me.",
    "Tell me your vision—I am ready to build."
  ];

  useEffect(() => {
    const interval = setInterval(() => {
      setGreetingIndex(prev => (prev + 1) % greetings.length);
    }, 5000);
    return () => clearInterval(interval);
  }, []);
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(false);
  const [isFilesSectionExpanded, setIsFilesSectionExpanded] = useState(true);
  const [isHistorySectionExpanded, setIsHistorySectionExpanded] = useState(true);
  const [isWorkspaceSectionExpanded, setIsWorkspaceSectionExpanded] = useState(true);
  const longPressTimeoutRef = useRef<any>(null);
  const isLongPressActive = useRef(false);

  const handleItemPressStart = (chat: any) => {
    isLongPressActive.current = false;
    if (longPressTimeoutRef.current) clearTimeout(longPressTimeoutRef.current);
    longPressTimeoutRef.current = setTimeout(() => {
      setSelectedChatForActions(chat);
      isLongPressActive.current = true;
    }, 600);
  };

  const handleItemPressEnd = () => {
    if (longPressTimeoutRef.current) {
      clearTimeout(longPressTimeoutRef.current);
      longPressTimeoutRef.current = null;
    }
  };

  const getModelDisplayName = (modelId: string): string => {
    const map: Record<string, string> = {
      'gemini-3.5-flash': 'Gemini 3.5 Flash',
      'gemini-3.1-pro-preview': 'Gemini 3.1 Pro',
      'claude-3-5-sonnet-20241022': 'Claude 3.5 Sonnet',
      'claude-opus-4-5': 'Claude Opus 4',
      'gpt-4o': 'GPT-4o',
      'gpt-4o-mini': 'GPT-4o mini',
      'llama-3.3-70b-versatile': 'Llama 3.3 70B',
      'mixtral-8x7b-32768': 'Mixtral 8x7B',
      'mistral-large-latest': 'Mistral Large',
    };
    return map[modelId] || modelId || 'Omni AI';
  };

  const getPlatformColor = (platform: string): string => {
    const colors: Record<string, string> = {
      'Google AI': 'bg-blue-500',
      'Anthropic': 'bg-orange-500',
      'OpenAI': 'bg-slate-400',
      'Groq': 'bg-amber-500',
      'Mistral': 'bg-purple-500',
      'OpenRouter': 'bg-green-500',
      'Hugging Face': 'bg-yellow-500',
    };
    return colors[platform] || 'bg-slate-500';
  };

  const [terminalHeight, setTerminalHeight] = useState(240);
  const [isResizing, setIsResizing] = useState(false);
  const [isTerminalCollapsed, setIsTerminalCollapsed] = useState(false);
  const [isTerminalFullScreen, setIsTerminalFullScreen] = useState(false);
  const [isModelModalOpen, setIsModelModalOpen] = useState(false);
  const [isModeModalOpen, setIsModeModalOpen] = useState(false);
  const [isWorkspaceSettingsOpen, setIsWorkspaceSettingsOpen] = useState(false);
  const [errorType, setErrorType] = useState<ErrorType>(null);
  const [selectedAgent, setSelectedAgent] = useState<'agent' | 'fast' | 'thinking'>('fast');
  const [activeTool, setActiveTool] = useState<'none' | 'search' | 'deep_research' | 'plan' | 'research' | 'learn' | 'study'>('none');
  const [isToolSheetOpen, setIsToolSheetOpen] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  // New State Variables
  const [activeProject, setActiveProject] = useState<Project | null>(null);
  const [showTemplateSelector, setShowTemplateSelector] = useState(false);
  const [setupStep, setSetupStep] = useState(1);
  const [showProjectSetup, setShowProjectSetup] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState('blank');
  const [projectName, setProjectName] = useState('');
  const [projectDescription, setProjectDescription] = useState('');
  const [projectPurpose, setProjectPurpose] = useState('');
  const [userProjects, setUserProjects] = useState<Project[]>([]);
  
  const [isToolsMenuOpen, setIsToolsMenuOpen] = useState(false);
  const [isConfigureOpen, setIsConfigureOpen] = useState(false);
  const [isSecretsOpen, setIsSecretsOpen] = useState(false);
  const [isAgentsOpen, setIsAgentsOpen] = useState(false);

  const [secrets, setSecrets] = useState<{key: string, value: string, scope: 'frontend' | 'backend' | 'both'}[]>([]);
  const [newSecretKey, setNewSecretKey] = useState('');
  const [newSecretValue, setNewSecretValue] = useState('');
  const [newSecretScope, setNewSecretScope] = useState<'frontend' | 'backend' | 'both'>('both');
  const [secretValues, setSecretValues] = useState<Record<string, boolean>>({});

  const [agentsPanelExpanded, setAgentsPanelExpanded] = useState(false);
  const [userApiKeys, setUserApiKeys] = useState<Record<string, {apiKey: string, enabled: boolean}>>({});
  const [editingPlatform, setEditingPlatform] = useState<string | null>(null);
  const [editingApiKey, setEditingApiKey] = useState('');
  const [savingKey, setSavingKey] = useState(false);

  // Multi-Provider AI Mesh States
  const [meshStatuses, setMeshStatuses] = useState<any[]>([]);
  const [routingConfig, setRoutingConfig] = useState<any>({
    preferredProviderId: null,
    priorityMode: 'balanced',
    autoFailover: true,
    autoHealthCheck: true
  });
  const [providerSearch, setProviderSearch] = useState('');
  const [testingKeyId, setTestingKeyId] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<any>(null);
  const [savingConfig, setSavingConfig] = useState(false);
  const [editingProviderId, setEditingProviderId] = useState<string | null>(null);
  const [providerApiKey, setProviderApiKey] = useState('');
  const [providerPriority, setProviderPriority] = useState(5);
  const [tempApiKeys, setTempApiKeys] = useState<string[]>([]);
  const [cloudflareAccountIdInput, setCloudflareAccountIdInput] = useState('');
  const [huggingFaceModelIdInput, setHuggingFaceModelIdInput] = useState('');

  const fetchMeshStatus = useCallback(async () => {
    try {
      const res = await fetch(`/api/provider/status?userId=${user?.uid || ''}`);
      const data = await res.json();
      if (data.success && data.providers) {
        setMeshStatuses(data.providers);
      }
    } catch (e) {
      console.error("Failed to fetch provider status:", e);
    }
  }, [user]);

  const fetchRoutingConfig = useCallback(async () => {
    try {
      const res = await fetch(`/api/provider/config?userId=${user?.uid || ''}`);
      const data = await res.json();
      if (data.success && data.config) {
        setRoutingConfig(data.config);
      }
    } catch (e) {
      console.error("Failed to fetch routing config:", e);
    }
  }, [user]);

  useEffect(() => {
    if (isAgentsOpen) {
      fetchMeshStatus();
      fetchRoutingConfig();
    }
  }, [isAgentsOpen, fetchMeshStatus, fetchRoutingConfig]);
  
  const [openModelMenu, setOpenModelMenu] = useState<string | null>(null);

  const [isDeployModalOpen, setIsDeployModalOpen] = useState(false);
  const [deployPlatform, setDeployPlatform] = useState<'vercel' | 'netlify' | null>(null);
  const [deployToken, setDeployToken] = useState('');
  const [isDeploying, setIsDeploying] = useState(false);
  const [deployResult, setDeployResult] = useState<{url: string; platform: string} | null>(null);

  const TEMPLATES = [
    { id: 'blank', name: 'Blank Canvas', desc: 'Start from scratch with a clean slate', tech: ['Any Stack'], gradient: 'from-slate-700 to-slate-900', icon: '⬜' },
    { id: 'webapp', name: 'Web App', desc: 'React frontend with modern UI', tech: ['React', 'TypeScript', 'Tailwind'], gradient: 'from-blue-700 to-indigo-900', icon: '🌐' },
    { id: 'fullstack', name: 'Full Stack', desc: 'React + Node.js + Database', tech: ['React', 'Node.js', 'MongoDB'], gradient: 'from-purple-700 to-pink-900', icon: '🏗️' },
    { id: 'mobile', name: 'Mobile App', desc: 'Flutter cross-platform mobile app', tech: ['Flutter', 'Dart', 'Firebase'], gradient: 'from-green-700 to-teal-900', icon: '📱' },
    { id: 'api', name: 'API Backend', desc: 'RESTful API server with auth', tech: ['Node.js', 'Express', 'JWT'], gradient: 'from-orange-700 to-red-900', icon: '⚙️' },
    { id: 'landing', name: 'Landing Page', desc: 'Beautiful marketing site', tech: ['React', 'CSS', 'Animations'], gradient: 'from-cyan-700 to-blue-900', icon: '🚀' },
  ];

  const AI_PLATFORMS = [
    { 
      id: 'google', name: 'Google AI Studio', icon: '🔵', color: 'blue',
      models: ['gemini-3.5-flash', 'gemini-3.1-pro-preview'],
      keyPlaceholder: 'AIzaSy...', keyHint: 'Get at aistudio.google.com/apikey',
      modelId: 'omni-google'
    },
    { 
      id: 'groq', name: 'Groq', icon: '🟠', color: 'amber',
      models: ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'mixtral-8x7b-32768'],
      keyPlaceholder: 'gsk_...', keyHint: 'Get free at console.groq.com/keys',
      modelId: 'omni-groq'
    },
    { 
      id: 'openrouter', name: 'OpenRouter', icon: '🟢', color: 'green',
      models: ['google/gemini-2.0-flash-001', 'anthropic/claude-3.5-sonnet', 'meta-llama/llama-3.1-70b-instruct'],
      keyPlaceholder: 'sk-or-...', keyHint: 'Get at openrouter.ai/keys (free tier available)',
      modelId: 'omni-openrouter'
    },
    { 
      id: 'deepseek', name: 'DeepSeek', icon: '🐋', color: 'cyan',
      models: ['deepseek-chat', 'deepseek-coder'],
      keyPlaceholder: 'sk-...', keyHint: 'Get at platform.deepseek.com/api_keys',
      modelId: 'omni-deepseek'
    },
    { 
      id: 'mistral', name: 'Mistral', icon: '🟣', color: 'purple',
      models: ['mistral-large-latest', 'mistral-medium-latest', 'mistral-small-latest'],
      keyPlaceholder: '...', keyHint: 'Get at console.mistral.ai/api-keys',
      modelId: 'omni-mistral'
    },
    { 
      id: 'huggingface', name: 'Hugging Face', icon: '🤗', color: 'yellow',
      models: ['google/gemma-2-9b-it', 'mistralai/Mistral-Nemo-Instruct-2407', 'meta-llama/Llama-3.2-11B-Vision-Instruct'],
      keyPlaceholder: 'hf_...', keyHint: 'Get at huggingface.co/settings/tokens',
      modelId: 'omni-huggingface'
    },
    { 
      id: 'cerebras', name: 'Cerebras', icon: '⚡', color: 'rose',
      models: ['llama3.1-70b', 'llama3.1-8b'],
      keyPlaceholder: 'csk-...', keyHint: 'Get at cloud.cerebras.ai',
      modelId: 'omni-cerebras'
    },
    { 
      id: 'github', name: 'GitHub Models', icon: '🐱', color: 'slate',
      models: ['gpt-4o', 'gpt-4o-mini', 'cohere-command-r-plus'],
      keyPlaceholder: 'ghp_...', keyHint: 'Get at github.com/marketplace/models',
      modelId: 'omni-github'
    },
    { 
      id: 'cloudflare', name: 'Cloudflare Workers AI', icon: '☁️', color: 'orange',
      models: ['@cf/meta/llama-3.1-8b-instruct', '@cf/meta/llama-3.3-70b-instruct'],
      keyPlaceholder: '...', keyHint: 'Get token at dash.cloudflare.com',
      modelId: 'omni-cloudflare'
    },
    { 
      id: 'together', name: 'Together AI', icon: '🧬', color: 'teal',
      models: ['meta-llama/Llama-3.3-70B-Instruct-Turbo', 'mistralai/Mixtral-8x22B-Instruct-v0.1'],
      keyPlaceholder: '...', keyHint: 'Get key at api.together.xyz',
      modelId: 'omni-together'
    },
    { 
      id: 'fireworks', name: 'Fireworks AI', icon: '🎆', color: 'indigo',
      models: ['accounts/fireworks/models/llama-v3p1-70b-instruct', 'accounts/fireworks/models/mixtral-8x22b-instruct'],
      keyPlaceholder: '...', keyHint: 'Get key at fireworks.ai',
      modelId: 'omni-fireworks'
    },
    { 
      id: 'nvidia', name: 'NVIDIA Build', icon: '💚', color: 'emerald',
      models: ['meta/llama-3.1-70b-instruct', 'nvidia/llama-3.1-nemotron-70b-instruct'],
      keyPlaceholder: 'nvapi-...', keyHint: 'Get key at build.nvidia.com',
      modelId: 'omni-nvidia'
    }
  ];

  // Mobile layout detection effect
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd/Ctrl + Enter = send message
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        if (chatInput.trim()) handleSendMessage();
      }
      // Cmd/Ctrl + K = focus chat input
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
      }
      // Cmd/Ctrl + B = toggle sidebar
      if ((e.metaKey || e.ctrlKey) && e.key === 'b') {
        e.preventDefault();
        setIsSidebarExpanded(prev => !prev);
      }
      // Escape = close any open modal
      if (e.key === 'Escape') {
        setIsToolsMenuOpen(false);
        setIsSecretsOpen(false);
        setIsAgentsOpen(false);
        setIsConfigureOpen(false);
        setIsDeployModalOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [chatInput]);

  useEffect(() => {
    if (activeProject === null && aiMode === 'agent') {
      setAiMode('learning');
    }
  }, [activeProject, aiMode]);

  // Drag-to-resize terminal on Desktop handler
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      const newHeight = window.innerHeight - e.clientY;
      const clampedHeight = Math.max(80, Math.min(window.innerHeight - 200, newHeight));
      setTerminalHeight(clampedHeight);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      window.document.addEventListener('mousemove', handleMouseMove);
      window.document.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.document.removeEventListener('mousemove', handleMouseMove);
      window.document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing]);

  const fetchFiles = useCallback(async (retryCount = 0) => {
    try {
      console.log(`[App] Fetching files (attempt ${retryCount + 1})...`);
      const res = await fetch(`/api/files${activeProject ? `?projectId=${activeProject.id}` : ''}`);
      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`HTTP error! status: ${res.status}, body: ${errorText}`);
      }
      const data = await res.json();
      console.log(`[App] Successfully fetched ${data.length} files`);
      setProject(prev => ({ ...prev, files: data }));
    } catch (e: any) {
      console.error("[App] Failed to fetch files", e);
      if (retryCount < 2) {
        console.log("[App] Retrying fetchFiles in 2s...");
        setTimeout(() => fetchFiles(retryCount + 1), 2000);
      }
    }
  }, [activeProject]);

  const fetchHistory = useCallback(async () => {
    if (!user) return;
    try {
      // Primary query with ordering
      const q = query(collection(db, "chats"), where("userId", "==", user.uid), orderBy("lastModified", "desc"), limit(30));
      const snapshot = await getDocs(q);
      const chats = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const unique = Array.from(new Map(chats.map(c => [c.id, c])).values());
      setChatHistory(unique);
    } catch (e: any) {
      console.warn("Ordered history fetch failed, falling back to unordered", e.message);
      try {
        // Fallback query without ordering (in case index is missing)
        const qFallback = query(collection(db, "chats"), where("userId", "==", user.uid), limit(30));
        const snapshot = await getDocs(qFallback);
        const chats = snapshot.docs.map(doc => {
          const data = doc.data();
          return { 
            id: doc.id, 
            ...data, 
            // Handle timestamp to Date conversion if needed
            lastModified: data.lastModified?.toDate?.() || data.lastModified || new Date()
          };
        });
        // Sort in memory
        chats.sort((a, b) => {
          const tA = a.lastModified instanceof Date ? a.lastModified.getTime() : 0;
          const tB = b.lastModified instanceof Date ? b.lastModified.getTime() : 0;
          return tB - tA;
        });
        const unique = Array.from(new Map(chats.map(c => [c.id, c])).values());
        setChatHistory(unique);
      } catch (err) {
        handleFirestoreError(err, OperationType.LIST, "chats");
        setHistoryError(true);
      }
    }
  }, [user]);

  const fetchProjects = useCallback(async () => {
    if (!user) return;
    try {
      const q = query(collection(db, 'projects'), where('userId', '==', user.uid), orderBy('lastModified', 'desc'));
      const snap = await getDocs(q);
      setUserProjects(snap.docs.map(d => ({ id: d.id, ...d.data() } as Project)));
    } catch (err) {
      console.warn("Ordered projects fetch failed, falling back", err);
      try {
        const q = query(collection(db, 'projects'), where('userId', '==', user.uid));
        const snap = await getDocs(q);
        setUserProjects(snap.docs.map(d => ({ id: d.id, ...d.data() } as Project)));
      } catch (e) {
        console.error("Failed to fetch projects", e);
      }
    }
  }, [user]);

  const handleCreateProject = async () => {
    if (!user || !projectName.trim()) return;
    try {
      const projectData = {
        userId: user.uid,
        name: projectName,
        description: projectDescription,
        purpose: projectPurpose,
        template: selectedTemplate,
        createdAt: new Date(),
        lastModified: new Date(),
        messages: [{
          id: Date.now().toString(),
          role: 'assistant',
          content: `Workspace **${projectName}** has been initialized.\n\nBefore I get to work on ${projectDescription}, could you provide some more details? Specifically, how should the app look? Are there any specific themes, color palettes, or layout styles you'd like me to use?`,
          timestamp: Date.now()
        }],
        files: [],
        status: 'idle'
      };
      
      const docRef = await addDoc(collection(db, 'projects'), sanitizeForFirestore(projectData));
      const newProject = { id: docRef.id, ...projectData } as Project;
      
      setActiveProject(newProject);
      setShowMobileLogs(true);
      setShowProjectSetup(false);
      setShowTemplateSelector(false);
      setCurrentChatId(null);
      setProject(prev => ({...prev, name: projectName, messages: newProject.messages}));
      fetchProjects();
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'projects');
    }
  };

  useEffect(() => {
    if (user) {
      fetchFiles();
      fetchHistory();
      fetchProjects();
      // Delayed refetch to catch any race conditions
      const t = setTimeout(() => fetchHistory(), 2000);
      const fetchStatus = async () => {
        try {
          const res = await fetch('/api/system/status');
          if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
          const data = await res.json();
          setSystemStatus(data);
        } catch (e) {
          console.error("Failed to fetch system status", e);
        }
      };
      fetchStatus();
      const interval = setInterval(fetchStatus, 30000);
      return () => {
        clearInterval(interval);
        clearTimeout(t);
      };
    }
  }, [user, fetchFiles, fetchHistory]);

  // Auto-scroll chat to bottom as the AI is writing or executing
  useEffect(() => {
    if (project.status === 'generating' || project.status === 'executing') {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [project.messages, project.status]);

  const handleSendMessage = async () => {
    if (!chatInput.trim() || project.status === 'generating' || project.status === 'executing') return;

    const promptText = chatInput;
    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: promptText,
      timestamp: Date.now()
    };

    const currentHistory = project.messages.map(m => ({ role: m.role, content: m.content, thought: m.thought, steps: m.steps }));
    
    const assistantMsgId = (Date.now() + 1).toString();
    const assistantMsg: Message = {
      id: assistantMsgId,
      role: 'assistant',
      content: '',
      thought: '',
      steps: [],
      suggestions: [],
      timestamp: Date.now()
    };

    const nextMessages = [...project.messages, userMsg, assistantMsg];
    messagesRef.current = nextMessages;

    setProject(prev => ({
      ...prev,
      messages: nextMessages,
      status: 'generating'
    }));
    setChatInput('');

    const controller = new AbortController();
    abortControllerRef.current = controller;
    let hasReceivedContent = false;

    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
    const localTimeStr = new Date().toLocaleString();
    const userDisplayName = user?.displayName || (user?.email ? user.email.split('@')[0] : 'Explorer');
    const userEmail = user?.email || undefined;

    try {
      const response = await fetch('/api/chat-stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          message: promptText, 
          agentId: selectedAgent, 
          modelId: selectedModel, 
          mode: activeTool !== 'none' ? activeTool : selectedAgent,
          history: currentHistory,
          userEmail,
          userDisplayName,
          localTime: localTimeStr,
          timezone: tz,
          projectId: activeProject?.id
        }),
        signal: controller.signal
      });
      
      if (!response.ok) {
        const errText = await response.text();
        throw new Error(errText || `Server responded with status ${response.status}`);
      }
      
      let currentThought = "";
      let currentContent = "";
      let currentSteps: any[] = [];

      if (!response.body) throw new Error("No response body");
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let done = false;
      
      let rawText = "";

      while (!done) {
        const { value, done: doneReading } = await reader.read();
        done = doneReading;
        if (value) {
          const chunkStr = decoder.decode(value, { stream: true });
          const lines = chunkStr.split('\n');
          
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const dataStr = line.replace('data: ', '').trim();
              if (dataStr === '[DONE]') {
                done = true;
                break;
              }
              let isStreamError = false;
              let streamErrorMsg = "";
              try {
                const chunkObj = JSON.parse(dataStr);
                if (chunkObj.error) {
                  isStreamError = true;
                  streamErrorMsg = typeof chunkObj.error === 'object' ? (chunkObj.error.message || JSON.stringify(chunkObj.error)) : String(chunkObj.error);
                } else if (chunkObj.modelUsed) {
                  // Update the assistant message with the model info  
                  setProject(prev => {
                    const msgs = [...prev.messages];
                    const idx = msgs.findIndex(m => m.id === assistantMsgId);
                    if (idx !== -1) {
                      msgs[idx] = {
                        ...msgs[idx],
                        modelId: chunkObj.modelUsed,
                        providerName: chunkObj.providerName || chunkObj.modelUsed,
                        providerPlatform: chunkObj.providerPlatform || 'Google AI',
                        latency: chunkObj.latency,
                        byok: chunkObj.byok
                      };
                    }
                    return { ...prev, messages: msgs };
                  });
                } else if (chunkObj.raw) {
                  rawText += chunkObj.raw;
                  
                  // Parse XML tags on the fly with robust fallback handling
                  let currentThought = "";
                  let currentContent = "";
                  
                  const hasThoughtTag = rawText.includes("<thought>");
                  const hasContentTag = rawText.includes("<content>");
                  
                  if (hasThoughtTag) {
                    const thoughtMatch = rawText.match(/<thought>([\s\S]*?)(?:<\/thought>|$)/);
                    if (thoughtMatch) {
                      currentThought = thoughtMatch[1];
                    }
                  }
                  
                  if (hasContentTag) {
                    const contentMatch = rawText.match(/<content>([\s\S]*?)(?:<\/content>|$)/);
                    if (contentMatch) {
                      currentContent = contentMatch[1];
                    }
                  } else {
                    // Fallback when there's no <content> tag
                    if (hasThoughtTag) {
                      const thoughtCloseIndex = rawText.indexOf("</thought>");
                      if (thoughtCloseIndex !== -1) {
                        let remainingText = rawText.substring(thoughtCloseIndex + "</thought>".length);
                        // Clean up other tags
                        remainingText = remainingText.replace(/<steps>[\s\S]*?(?:<\/steps>|$)/g, "");
                        remainingText = remainingText.replace(/<suggestions>[\s\S]*?(?:<\/suggestions>|$)/g, "");
                        remainingText = remainingText.replace(/<\/?content>/g, "");
                        remainingText = remainingText.replace(/<\/?thought>/g, "");
                        currentContent = remainingText;
                      } else {
                        // If the thought block is getting extremely long (> 350 chars) and hasn't been closed,
                        // it's highly likely the model is writing its main response inside the thought block,
                        // or forgot to close it. Let's start streaming the content from it!
                        if (currentThought.length > 350) {
                          // Find a good sentence boundary or space to split
                          const splitIndex = 200;
                          currentContent = currentThought.substring(splitIndex);
                          currentThought = currentThought.substring(0, splitIndex) + "...";
                        } else {
                          currentContent = "";
                        }
                      }
                    } else {
                      // No tags at all - treat everything as content
                      currentContent = rawText;
                    }
                  }
                  
                  if (currentContent.trim().length > 0) {
                    hasReceivedContent = true;
                  }
                  
                  // Parse steps dynamically
                  currentSteps = [];
                  const stepRegex = /<step\s+status=["']([^"']+)["']>([\s\S]*?)(?:<\/step>|$)/g;
                  let match;
                  let stepId = 1;
                  while ((match = stepRegex.exec(rawText)) !== null) {
                    currentSteps.push({
                       id: String(stepId++),
                       type: "thinking",
                       status: match[1],
                       label: match[2].trim()
                    });
                  }
                  
                  let displayContent = currentContent;
                  displayContent = displayContent.replace(/<file[\s\S]*?(?:<\/file>|$)/g, '');
                  displayContent = displayContent.replace(/<command[\s\S]*?(?:<\/command>|$)/g, '');
                  displayContent = displayContent.replace(/<step[\s\S]*?(?:<\/step>|$)/g, '');
                  displayContent = displayContent.trim();
                  
                  setProject(prev => {
                    const msgs = [...prev.messages];
                    const idx = msgs.findIndex(m => m.id === assistantMsgId);
                    if (idx !== -1) {
                      msgs[idx] = { 
                        ...msgs[idx], 
                        thought: currentThought, 
                        content: displayContent,
                        steps: currentSteps.length > 0 ? currentSteps : msgs[idx].steps
                      };
                    }
                    messagesRef.current = msgs;
                    return { ...prev, messages: msgs };
                  });
                }
              } catch (e) {
                // Ignore incomplete JSON chunks or parsing errors
              }
              if (isStreamError) {
                throw new Error(streamErrorMsg || "API Stream Error");
              }
            }
          }
        }
      }

      // Finalize suggestions extraction and update local state to idle
      if (!currentContent.trim()) {
        if (currentThought.trim()) {
          currentContent = currentThought;
          currentThought = "Refining response...";
        } else {
          throw new Error("No response was given or shown in the user interface.");
        }
      }

      // Execute files and commands, and remove them from the visible content
      const fileRegex = /<file\s+path=["']([^"']+)["']>([\s\S]*?)(?:<\/file>|$)/g;
      const cmdRegex = /<command>([\s\S]*?)(?:<\/command>|$)/g;
      const stepClearRegex = /<step\s+status=["'][^"']+["']>[\s\S]*?(?:<\/step>|$)/g;
      
      const filesToWrite: {path: string, content: string}[] = [];
      let fileMatch;
      while ((fileMatch = fileRegex.exec(currentContent)) !== null) {
        filesToWrite.push({ path: fileMatch[1], content: fileMatch[2].trim() });
      }

      const commandsToRun: string[] = [];
      let cmdMatch;
      while ((cmdMatch = cmdRegex.exec(currentContent)) !== null) {
        commandsToRun.push(cmdMatch[1].trim());
      }

       // Remove the raw XML tags from the content so they aren't shown to the user as "rubbish"
      let cleanContent = currentContent.replace(fileRegex, '').replace(cmdRegex, '').replace(stepClearRegex, '').trim();
      
      if (!cleanContent) {
        cleanContent = "I've written the files and executed the commands for you.";
      }

      const suggestionsMatch = rawText.match(/<suggestion>([\s\S]*?)<\/suggestion>/g);
      const currentSuggestions = suggestionsMatch ? suggestionsMatch.map(s => s.replace(/<\/?suggestion>/g, '').trim()) : [];

      // Generate dynamically expanded steps
      const finalSteps: any[] = currentSteps.length > 0 ? [...currentSteps] : [];
      let stepIdCounter = finalSteps.length + 1;

      const hasExecutions = filesToWrite.length > 0 || commandsToRun.length > 0;

      if (hasExecutions) {
        filesToWrite.forEach((file) => {
          finalSteps.push({
            id: `file-write-${stepIdCounter++}`,
            type: 'writing',
            label: `Creating/Writing file: ${file.path}`,
            status: 'pending'
          });
        });

        commandsToRun.forEach((cmd) => {
          finalSteps.push({
            id: `command-run-${stepIdCounter++}`,
            type: 'testing',
            label: `Running command: ${cmd}`,
            status: 'pending'
          });
        });

        finalSteps.push({
          id: `finalize-${stepIdCounter++}`,
          type: 'handoff',
          label: 'Refreshing preview & completing build',
          status: 'pending'
        });
      }

      // Calculate final messages using the latest ref state
      const finalMsgs = [...messagesRef.current];
      const mIdx = finalMsgs.findIndex(m => m.id === assistantMsgId);
      const finalAssistantMsg: Message = {
        id: assistantMsgId,
        role: 'assistant',
        content: cleanContent,
        thought: currentThought,
        steps: finalSteps,
        suggestions: currentSuggestions,
        timestamp: Date.now()
      };

      if (mIdx !== -1) {
        finalMsgs[mIdx] = finalAssistantMsg;
      } else {
        finalMsgs.push(finalAssistantMsg);
      }
      messagesRef.current = finalMsgs;

      // Update state for UI and set state to 'executing' if there are files or commands to run
      setProject(prev => ({
        ...prev,
        messages: finalMsgs,
        status: hasExecutions ? 'executing' : 'idle'
      }));

      // Helper to update a step's status in real-time
      const updateStepStatus = (stepLabel: string, newStatus: 'pending' | 'running' | 'completed' | 'error' | 'failed') => {
        setProject(prev => {
          const msgs = [...prev.messages];
          const idx = msgs.findIndex(m => m.id === assistantMsgId);
          if (idx !== -1) {
            const steps = msgs[idx].steps ? [...msgs[idx].steps] : [];
            const stepIdx = steps.findIndex(s => s.label === stepLabel);
            if (stepIdx !== -1) {
              steps[stepIdx] = { ...steps[stepIdx], status: newStatus === 'failed' ? 'error' : newStatus };
            }
            msgs[idx] = { ...msgs[idx], steps };
          }
          messagesRef.current = msgs;
          return { ...prev, messages: msgs };
        });
      };

      // Execute extracted files and commands sequentially in the background/foreground
      if (hasExecutions) {
        // Write files one by one to show realistic, high-fidelity real-time progress
        for (const file of filesToWrite) {
          const label = `Creating/Writing file: ${file.path}`;
          updateStepStatus(label, 'running');
          try {
            await fetch('/api/files/write', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ projectId: activeProject?.id, filePath: file.path, content: file.content })
            });
            updateStepStatus(label, 'completed');
          } catch (e) {
            console.error(`Failed to write file ${file.path}:`, e);
            updateStepStatus(label, 'error');
          }
        }

        fetchFiles();

        // Run commands one by one and stream to terminal
        for (const cmd of commandsToRun) {
          const label = `Running command: ${cmd}`;
          updateStepStatus(label, 'running');
          try {
            setTerminalLogs(prev => [...prev, { id: Date.now().toString(), text: `$ ${cmd}`, type: 'cmd' }]);
            const res = await fetch('/api/terminal/run', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ projectId: activeProject?.id, command: cmd })
            });
            const data = await res.json();
            if (data.output) {
               setTerminalLogs(prev => [...prev, { id: Date.now().toString(), text: data.output, type: 'output' }]);
            }
            updateStepStatus(label, 'completed');
          } catch (e) {
            console.error(`Failed to run command ${cmd}:`, e);
            updateStepStatus(label, 'error');
          }
        }

        // Finalize state
        const finalizeLabel = 'Refreshing preview & completing build';
        updateStepStatus(finalizeLabel, 'running');
        await new Promise(resolve => setTimeout(resolve, 800));
        const iframe = document.getElementById('preview-iframe') as HTMLIFrameElement;
        if (iframe) iframe.src = iframe.src;
        updateStepStatus(finalizeLabel, 'completed');

        // Persist final executed messages to Firestore
        const finalExecutedMsgs = [...messagesRef.current];
        if (user && finalExecutedMsgs.length > 0) {
          try {
            if (activeProject) {
              await updateDoc(doc(db, "projects", activeProject.id), {
                messages: sanitizeForFirestore(finalExecutedMsgs),
                lastModified: new Date()
              });
              setTimeout(() => fetchProjects(), 500);
              setUserProjects(prev => prev.map(p => 
                p.id === activeProject.id 
                  ? { ...p, messages: finalExecutedMsgs, lastModified: new Date() } 
                  : p
              ));
              setActiveProject(prev => prev ? { ...prev, messages: finalExecutedMsgs, lastModified: new Date() } : null);
            } else {
              const chatId = chatIdRef.current;
              if (chatId) {
                await updateDoc(doc(db, "chats", chatId), {
                  messages: sanitizeForFirestore(finalExecutedMsgs),
                  lastModified: new Date()
                });
                setTimeout(() => fetchHistory(), 500);
              }
            }
          } catch (dbErr) {
            console.error("Failed to save final executed steps to DB:", dbErr);
          }
        }

        setProject(prev => ({ ...prev, status: 'idle' }));
      } else {
        // If no files/commands, just refresh and save initial finalMsgs
        fetchFiles();
        setTimeout(() => {
          const iframe = document.getElementById('preview-iframe') as HTMLIFrameElement;
          if (iframe) iframe.src = iframe.src;
        }, 500);

        if (user && finalMsgs.length > 0) {
          try {
            if (activeProject) {
              await updateDoc(doc(db, "projects", activeProject.id), {
                messages: sanitizeForFirestore(finalMsgs),
                lastModified: new Date()
              });
              setTimeout(() => fetchProjects(), 500);
              setUserProjects(prev => prev.map(p => 
                p.id === activeProject.id 
                  ? { ...p, messages: finalMsgs, lastModified: new Date() } 
                  : p
              ));
              setActiveProject(prev => prev ? { ...prev, messages: finalMsgs, lastModified: new Date() } : null);
            } else {
              const chatId = chatIdRef.current;
              if (chatId) {
                await updateDoc(doc(db, "chats", chatId), {
                  messages: sanitizeForFirestore(finalMsgs),
                  lastModified: new Date()
                });
                setTimeout(() => fetchHistory(), 500);
              }
            }
          } catch (dbErr) {
            console.error("Failed to save final steps to DB:", dbErr);
          }
        }
        setProject(prev => ({ ...prev, status: 'idle' }));
      }
      
    } catch (error: any) {
      if (error.name === 'AbortError') {
        console.log("Chat generation stopped by user");
      } else {
        console.error("Chat generation failed:", error);
        
        // Determine error type for modal
        const errMsg = error.message?.toLowerCase() || "";
        if (errMsg.includes("quota") || errMsg.includes("429") || errMsg.includes("rate limit")) {
          setErrorType('rate-limit');
        } else if (errMsg.includes("unavailable") || errMsg.includes("404") || errMsg.includes("not found")) {
          setErrorType('unavailable');
        } else if (errMsg.includes("network") || errMsg.includes("fetch")) {
          setErrorType('network');
        } else {
          setErrorType('internal');
        }
      }
      
      // Stop the generation, return the screen to previous state, and display error inline in chat history
      const finalErrorMsg = error.message || "An unexpected error occurred during execution.";
      setProject(prev => {
        const msgs = [...prev.messages];
        const idx = msgs.findIndex(m => m.id === assistantMsgId);
        if (idx !== -1) {
          const steps = msgs[idx].steps ? [...msgs[idx].steps] : [];
          const updatedSteps = steps.map(s => {
            if (s.status === 'running' || s.status === 'pending') {
              return { ...s, status: 'failed' as const };
            }
            return s;
          });
          msgs[idx] = { 
            ...msgs[idx], 
            steps: updatedSteps,
            error: finalErrorMsg
          };
        }
        return {
          ...prev,
          messages: msgs,
          status: 'idle'
        };
      });
    } finally {
      abortControllerRef.current = null;
    }
  };

  const handleMessageFeedback = async (msgId: string, type: 'up' | 'down', content: string) => {
    setMessageFeedbacks(prev => ({ ...prev, [msgId]: type }));

    // Persist feedback to local messages state and to Firestore document
    setProject(prev => {
      const msgs = prev.messages.map(m => m.id === msgId ? { ...m, feedback: type } : m);
      
      // Background save to Firestore
      if (user) {
        (async () => {
          try {
            if (activeProject) {
              await updateDoc(doc(db, "projects", activeProject.id), {
                messages: sanitizeForFirestore(msgs),
                lastModified: new Date()
              });
              setUserProjects(pPrev => pPrev.map(p => 
                p.id === activeProject.id 
                  ? { ...p, messages: msgs, lastModified: new Date() } 
                  : p
              ));
              setActiveProject(pPrev => pPrev ? { ...pPrev, messages: msgs, lastModified: new Date() } : null);
            } else {
              const chatId = chatIdRef.current;
              if (chatId) {
                await updateDoc(doc(db, "chats", chatId), {
                  messages: sanitizeForFirestore(msgs),
                  lastModified: new Date()
                });
              }
            }
          } catch (err) {
            console.error("Failed to update message feedback in Firestore:", err);
          }
        })();
      }

      return { ...prev, messages: msgs };
    });

    try {
      await fetch('/api/learn-feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          msgId,
          type,
          content
        })
      });
    } catch (err) {
      console.error("Failed to submit reinforcement feedback learning:", err);
    }
  };

  const handleStopGeneration = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  };

  const handleDeleteHistory = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      await deleteDoc(doc(db, "chats", id));
      setChatHistory(prev => prev.filter(c => c.id !== id));
      if (currentChatId === id) {
        setCurrentChatId(null);
        setProject(prev => ({ ...prev, messages: [] }));
      }
      setSelectedChatForActions(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `chats/${id}`);
    }
  };

  const handleDeleteProject = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!confirm("Are you absolutely sure you want to permanently delete this project? This will remove all files and project history.")) return;
    try {
      await deleteDoc(doc(db, "projects", id));
      setUserProjects(prev => prev.filter(p => p.id !== id));
      if (activeProject?.id === id) {
        setActiveProject(null);
        setMobileTab('chat');
        setProject({
          name: 'Omni Workspace',
          description: 'An AI-powered application',
          files: [],
          messages: [],
          status: 'idle'
        });
        setCurrentChatId(null);
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `projects/${id}`);
    }
  };

  const handleRunTerminalCommand = async (commandOverride?: string) => {
    const cmd = (commandOverride || terminalInput).trim();
    if (!cmd) return;
    setTerminalInput('');

    // Append command to logs
    setTerminalLogs(prev => [...prev, { id: Date.now().toString(), text: cmd, type: 'cmd' }]);

    try {
      setCommandRunning(true);
      const res = await fetch('/api/terminal/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: cmd, projectId: activeProject?.id })
      });
      const data = await res.json();

      setTerminalLogs(prev => [
        ...prev, 
        { id: (Date.now() + 1).toString(), text: data.output || "(No output)", type: data.success ? 'output' : 'error' }
      ]);
      
      // Auto-refresh workspace files
      fetchFiles();
    } catch (error: any) {
      setTerminalLogs(prev => [
        ...prev, 
        { id: (Date.now() + 1).toString(), text: `Execution failed: ${error.message}`, type: 'error' }
      ]);
    } finally {
      setCommandRunning(false);
      // Auto scroll terminal to end
      setTimeout(() => {
        terminalEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 50);
    }
  };

  const handleTogglePinChat = async (id: string, currentPinned: boolean) => {
    // Optimistic local state update
    setChatHistory(prev => prev.map(c => c.id === id ? { ...c, pinned: !currentPinned } : c));
    if (selectedChatForActions && selectedChatForActions.id === id) {
      setSelectedChatForActions(prev => prev ? { ...prev, pinned: !currentPinned } : null);
    }
    setSelectedChatForActions(null);

    try {
      const chatRef = doc(db, "chats", id);
      await updateDoc(chatRef, { pinned: !currentPinned });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `chats/${id}`);
      // Revert local state on error
      setChatHistory(prev => prev.map(c => c.id === id ? { ...c, pinned: currentPinned } : c));
      if (selectedChatForActions && selectedChatForActions.id === id) {
        setSelectedChatForActions(prev => prev ? { ...prev, pinned: currentPinned } : null);
      }
    }
  };

  useEffect(() => {
    const handleClickOutside = () => setOpenModelMenu(null);
    if (openModelMenu) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [openModelMenu]);

  const handleFileSelect = async (path: string) => {
    try {
      setProject(prev => ({ ...prev, activeFile: path }));
      const res = await fetch(`/api/files/content?path=${encodeURIComponent(path)}${activeProject ? `&projectId=${activeProject.id}` : ''}`);
      const data = await res.json();
      setActiveFileContent(data.content);
      setActiveView('editor');
      if (isMobile) {
        setMobileTab('preview');
      }
    } catch (e) {
      console.error("Failed to fetch file content", e);
    }
  };

  const handleSaveFile = async () => {
    if (!project.activeFile) return;
    setIsSavingFile(true);
    setSaveSuccess(false);
    try {
      const res = await fetch('/api/files/write', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          path: project.activeFile,
          content: activeFileContent,
          projectId: activeProject?.id
        })
      });
      if (res.ok) {
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3500);
        // Add system log in terminal
        setTerminalLogs(prev => [
          ...prev,
          { id: Date.now().toString(), text: `Saved and synchronized file: ${project.activeFile}`, type: 'system' }
        ]);
        // Scroll terminal to end
        setTimeout(() => {
          terminalEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }, 50);
      } else {
        throw new Error('Failed to save file');
      }
    } catch (e: any) {
      console.error(e);
      // Fallback log to terminal instead of raw window alert if iframe restrictions block it
      setTerminalLogs(prev => [
        ...prev,
        { id: Date.now().toString(), text: `Error saving file: ${e.message}`, type: 'error' }
      ]);
    } finally {
      setIsSavingFile(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!user) return;
    if (confirm("Are you absolutely sure? This will permanently block your email from using Omni again and delete your account.")) {
      try {
        const userEmail = user.email;
        if (userEmail) {
          await addDoc(collection(db, "blocked_emails"), {
            email: userEmail,
            blockedAt: new Date(),
            reason: "User requested account deletion"
          });
        }
        await deleteUser(user);
        window.location.reload();
      } catch (e) {
        console.error("Failed to delete account", e);
        alert("Account deletion failed. You might need to re-authenticate first (sign out and sign in again).");
      }
    }
  };

  if (authLoading) return (
    <div className="h-screen bg-[#0A0A0A] flex flex-col items-center justify-center text-white p-4">
      <div className="relative">
        <OmniWave className="w-48 h-48 mb-8" />
        <motion.div 
          animate={{ opacity: [0.3, 1, 0.3] }}
          transition={{ duration: 2, repeat: Infinity }}
          className="absolute inset-0 bg-blue-500/20 blur-3xl rounded-full"
        />
      </div>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col items-center space-y-4"
      >
        <h2 className="text-2xl font-bold tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400">
          Initializing Omni
        </h2>
        <div className="flex space-x-1">
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              animate={{ height: [4, 12, 4] }}
              transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }}
              className="w-1 bg-blue-500 rounded-full"
            />
          ))}
        </div>
      </motion.div>
    </div>
  );

  if (showOnboarding) return (
    <Onboarding 
      onGetStarted={() => {
        setShowOnboarding(false);
      }} 
    />
  );

  if (!user || isBlocked) return <Auth onAuthSuccess={() => {
    localStorage.setItem('omni_onboarded', 'true');
    window.location.reload();
  }} />;

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-[#0A0A0A] text-slate-900 dark:text-slate-300 font-sans selection:bg-blue-500/30 overflow-hidden relative">
      
      {/* Sidebar Backdrop Overlay */}
      {isSidebarExpanded && (
        <div 
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-45 transition-opacity" 
          onClick={() => {
            setIsSidebarExpanded(false);
            setActivePanel(null);
          }}
        />
      )}

      {/* BOTTOM MODALS (SLIDING UP BOTTOM SHEETS) */}

      {/* GEAR / TOOLS MENU OVERLAY */}
      <AnimatePresence>
        {isToolsMenuOpen && (
          <div className="fixed inset-0 z-[145] flex items-end justify-center">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setIsToolsMenuOpen(false)}
              className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            />
            <motion.div
              initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 280 }}
              className="bg-white dark:bg-[#0F0F0F] border-t border-slate-200 dark:border-white/10 w-full max-w-lg rounded-t-[2.5rem] p-6 shadow-2xl relative z-10 flex flex-col"
            >
              <div className="w-12 h-1.5 bg-slate-200 dark:bg-white/10 rounded-full mx-auto mb-5 shrink-0" />
              <h3 className="text-base font-bold text-slate-950 dark:text-white mb-6 text-center">Workspace Tools</h3>
              
              <div className="grid grid-cols-2 gap-4">
                <button 
                  onClick={() => {
                    setIsToolsMenuOpen(false);
                    const iframe = document.getElementById('preview-iframe') as HTMLIFrameElement;
                    if (iframe) iframe.src = iframe.src;
                  }}
                  className="flex flex-col items-start p-4 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 hover:scale-[1.02] transition-all text-left group"
                >
                  <div className="p-2 bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 rounded-xl mb-3 group-hover:scale-110 transition-transform"><RefreshCw className="w-5 h-5" /></div>
                  <span className="font-bold text-slate-900 dark:text-white mb-1">Reload App</span>
                  <span className="text-[10px] text-slate-500">Restart frontend preview</span>
                </button>
                
                <button 
                  onClick={() => {
                    setIsToolsMenuOpen(false);
                    setIsConfigureOpen(true);
                  }}
                  className="flex flex-col items-start p-4 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 hover:scale-[1.02] transition-all text-left group"
                >
                  <div className="p-2 bg-purple-100 dark:bg-purple-500/20 text-purple-600 dark:text-purple-400 rounded-xl mb-3 group-hover:scale-110 transition-transform"><Sliders className="w-5 h-5" /></div>
                  <span className="font-bold text-slate-900 dark:text-white mb-1">Configure</span>
                  <span className="text-[10px] text-slate-500">Environment & ports</span>
                </button>
                
                <button 
                  onClick={() => {
                    setIsToolsMenuOpen(false);
                    setIsSecretsOpen(true);
                  }}
                  className="flex flex-col items-start p-4 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 hover:scale-[1.02] transition-all text-left group"
                >
                  <div className="p-2 bg-orange-100 dark:bg-orange-500/20 text-orange-600 dark:text-orange-400 rounded-xl mb-3 group-hover:scale-110 transition-transform"><KeyRound className="w-5 h-5" /></div>
                  <span className="font-bold text-slate-900 dark:text-white mb-1">Secrets</span>
                  <span className="text-[10px] text-slate-500">Environment variables</span>
                </button>
                
                <button 
                  onClick={() => {
                    setIsToolsMenuOpen(false);
                    setIsAgentsOpen(true);
                  }}
                  className="flex flex-col items-start p-4 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 hover:scale-[1.02] transition-all text-left group"
                >
                  <div className="p-2 bg-green-100 dark:bg-green-500/20 text-green-600 dark:text-green-400 rounded-xl mb-3 group-hover:scale-110 transition-transform"><Bot className="w-5 h-5" /></div>
                  <span className="font-bold text-slate-900 dark:text-white mb-1">Agents</span>
                  <span className="text-[10px] text-slate-500">Configure AI providers</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* SECRETS PANEL */}
      <AnimatePresence>
        {isSecretsOpen && (
          <div className="fixed inset-0 z-[150] flex items-end justify-center">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setIsSecretsOpen(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 280 }}
              className="bg-white dark:bg-[#0F0F0F] border-t border-slate-200 dark:border-white/10 w-full max-w-2xl rounded-t-[2.5rem] p-6 shadow-2xl relative z-10 flex flex-col h-[66vh]"
            >
              <div className="w-12 h-1.5 bg-slate-200 dark:bg-white/10 rounded-full mx-auto mb-5 shrink-0" />
              <div className="flex items-center justify-between mb-4 shrink-0">
                <div className="flex items-center space-x-2.5">
                  <KeyRound className="w-5 h-5 text-orange-500" />
                  <h3 className="text-base font-bold text-slate-950 dark:text-white">Environment Secrets</h3>
                </div>
                <button onClick={() => setIsSecretsOpen(false)} className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-white/10 text-slate-500 hover:text-slate-950 dark:hover:text-white"><X className="w-5 h-5" /></button>
              </div>
              <p className="text-xs text-slate-500 mb-6 shrink-0">Secrets are injected into your app's environment variables. They are stored securely and never exposed in code.</p>
              
              <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-6">
                <div>
                  <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider mb-3">CONFIGURED SECRETS</h4>
                  {secrets.length === 0 ? (
                    <div className="p-4 rounded-xl border border-dashed border-slate-200 dark:border-white/10 text-center text-xs text-slate-500">No secrets configured yet.</div>
                  ) : (
                    <div className="space-y-2">
                      {secrets.map((s, i) => (
                        <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/10">
                          <div className="flex items-center space-x-3 truncate">
                            <span className="font-mono text-xs text-green-600 dark:text-green-400 truncate">{s.key}</span>
                            <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-slate-200 dark:bg-white/10 text-slate-600 dark:text-slate-300 uppercase tracking-wider">{s.scope}</span>
                          </div>
                          <div className="flex items-center space-x-2 shrink-0">
                            <div className="font-mono text-xs text-slate-500 bg-black/5 dark:bg-black/20 px-2 py-1 rounded truncate max-w-[120px]">
                              {secretValues[s.key] ? s.value : '●●●●●●●●'}
                            </div>
                            <button onClick={() => setSecretValues(prev => ({...prev, [s.key]: !prev[s.key]}))} className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"><Eye className="w-4 h-4" /></button>
                            <button onClick={() => setSecrets(prev => prev.filter(x => x.key !== s.key))} className="p-1.5 text-red-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                
                <div>
                  <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider mb-3">ADD NEW SECRET</h4>
                  <div className="space-y-3 p-4 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10">
                    <input type="text" value={newSecretKey} onChange={e => setNewSecretKey(e.target.value)} placeholder="Key (e.g. REACT_APP_API_KEY)" className="w-full bg-white dark:bg-[#0A0A0A] border border-slate-200 dark:border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-500 font-mono text-slate-900 dark:text-white" />
                    <input type="password" value={newSecretValue} onChange={e => setNewSecretValue(e.target.value)} placeholder="Value (your-secret-value)" className="w-full bg-white dark:bg-[#0A0A0A] border border-slate-200 dark:border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-500 font-mono text-slate-900 dark:text-white" />
                    <div className="flex items-center space-x-2 bg-white dark:bg-[#0A0A0A] border border-slate-200 dark:border-white/10 rounded-lg p-1">
                      {['frontend', 'backend', 'both'].map(scope => (
                        <button key={scope} onClick={() => setNewSecretScope(scope as any)} className={`flex-1 py-1.5 text-xs font-bold rounded-md capitalize transition-all ${newSecretScope === scope ? 'bg-orange-500 text-white shadow' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>{scope}</button>
                      ))}
                    </div>
                    <button onClick={() => {
                      if (newSecretKey && newSecretValue) {
                        setSecrets(prev => [...prev, { key: newSecretKey, value: newSecretValue, scope: newSecretScope }]);
                        setNewSecretKey('');
                        setNewSecretValue('');
                      }
                    }} disabled={!newSecretKey || !newSecretValue} className="w-full py-2 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-lg font-bold text-xs disabled:opacity-50 transition-all">Add Secret</button>
                  </div>
                </div>
              </div>
              <div className="pt-4 mt-4 border-t border-slate-200 dark:border-white/10 shrink-0">
                <button onClick={async () => {
                  try {
                    await fetch('/api/secrets/save', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: user?.uid, secrets }) });
                    setIsSecretsOpen(false);
                  } catch (e) {
                    console.error(e);
                  }
                }} className="w-full py-3 bg-orange-600 hover:bg-orange-500 text-white rounded-xl font-bold transition-all shadow-lg shadow-orange-600/20 flex items-center justify-center space-x-2"><Check className="w-4 h-4" /><span>Save & Inject</span></button>
                <p className="text-center text-[10px] text-slate-500 mt-3">Note: Secrets prefixed with REACT_APP_ or VITE_ are available to the frontend. Others go to the backend.</p>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* CONFIGURE PANEL */}
      <AnimatePresence>
        {isConfigureOpen && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsConfigureOpen(false)} className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="bg-white dark:bg-[#0F0F0F] w-full h-full md:w-[90vw] md:h-[90vh] md:max-w-5xl md:rounded-[2.5rem] p-6 md:p-10 shadow-2xl relative z-10 flex flex-col border border-white/10 overflow-hidden">
              <div className="flex items-center justify-between mb-8 shrink-0">
                <div className="flex items-center space-x-3">
                  <Sliders className="w-6 h-6 text-purple-500" />
                  <h2 className="text-xl font-bold text-slate-900 dark:text-white">Environment Configuration</h2>
                </div>
                <button onClick={() => setIsConfigureOpen(false)} className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-white/10 text-slate-500 hover:text-slate-900 dark:hover:text-white"><X className="w-6 h-6" /></button>
              </div>
              
              <div className="flex-1 overflow-y-auto custom-scrollbar grid grid-cols-1 md:grid-cols-2 gap-8 pr-2">
                <div className="space-y-6">
                  <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">PORT CONFIGURATION</h4>
                  <div className="space-y-3">
                    {['Frontend', 'Backend', 'Preview'].map((type, i) => (
                      <div key={type} className="flex items-center justify-between p-4 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10">
                        <div className="flex items-center space-x-3">
                          <div className="w-2 h-2 rounded-full bg-green-500" />
                          <span className="font-bold text-sm text-slate-900 dark:text-white">{type}</span>
                        </div>
                        <input type="number" defaultValue={3000 + i} className="w-20 bg-white dark:bg-[#0A0A0A] border border-slate-200 dark:border-white/10 rounded-lg px-2 py-1 text-sm text-center font-mono focus:outline-none focus:border-purple-500" />
                      </div>
                    ))}
                  </div>
                  <button onClick={() => {}} className="w-full py-2.5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl font-bold text-sm transition-all shadow-md">Apply Ports</button>
                </div>
                
                <div className="space-y-6">
                  <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">RUNTIME SETTINGS</h4>
                  <div className="space-y-4">
                    <div className="p-4 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 flex items-center justify-between">
                      <span className="text-sm font-bold text-slate-900 dark:text-white">Node.js Version</span>
                      <select className="bg-white dark:bg-[#0A0A0A] border border-slate-200 dark:border-white/10 rounded-lg px-3 py-1.5 text-sm font-mono focus:outline-none focus:border-purple-500 text-slate-900 dark:text-white"><option>20.x</option><option>22.x</option><option>18.x</option></select>
                    </div>
                    <div className="p-4 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 flex items-center justify-between">
                      <span className="text-sm font-bold text-slate-900 dark:text-white">Package Manager</span>
                      <div className="flex bg-white dark:bg-[#0A0A0A] border border-slate-200 dark:border-white/10 rounded-lg p-1"><button className="px-3 py-1 bg-purple-500 text-white rounded text-xs font-bold shadow">npm</button><button className="px-3 py-1 text-slate-500 hover:text-white text-xs font-bold">yarn</button></div>
                    </div>
                    <div className="p-4 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 flex items-center justify-between">
                      <div className="flex flex-col"><span className="text-sm font-bold text-slate-900 dark:text-white">Restart on file change</span><span className="text-[10px] text-slate-500">Auto-restarts dev server</span></div>
                      <div className="w-10 h-5 bg-purple-500 rounded-full relative cursor-pointer"><div className="absolute right-1 top-1 w-3 h-3 bg-white rounded-full" /></div>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="mt-8 pt-6 border-t border-slate-200 dark:border-white/10 shrink-0 grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
                <div className="flex items-center space-x-6 text-xs text-slate-500 font-mono">
                  <div className="flex flex-col"><span>OS</span><span className="text-slate-900 dark:text-white font-bold">Linux (Ubuntu 22.04)</span></div>
                  <div className="flex flex-col"><span>Node</span><span className="text-slate-900 dark:text-white font-bold">v20.x.x</span></div>
                  <div className="flex flex-col"><span>Dir</span><span className="text-slate-900 dark:text-white font-bold truncate max-w-[150px]">/workspace</span></div>
                </div>
                <div className="flex items-center space-x-3 justify-end">
                  <button onClick={() => {}} className="px-4 py-2 border border-slate-200 dark:border-white/10 rounded-lg text-xs font-bold hover:bg-slate-50 dark:hover:bg-white/5 transition-all text-slate-900 dark:text-white">Run Diagnostics</button>
                  <button onClick={() => handleRunTerminalCommand('pkill -f server && npm run dev')} className="px-4 py-2 bg-red-600/10 text-red-500 hover:bg-red-600/20 rounded-lg text-xs font-bold transition-all">Restart Server</button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* AGENTS PANEL: OMNIV1 MULTI-PROVIDER AI MESH CONTROL HUB */}
      <AnimatePresence>
        {isAgentsOpen && (
          <div className="fixed inset-0 z-[150] flex items-end justify-center">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setIsAgentsOpen(false)}
              className="absolute inset-0 bg-black/70 backdrop-blur-md"
            />
            <motion.div
              initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 280 }}
              className={`bg-white dark:bg-[#090909] border-t border-slate-200 dark:border-white/10 w-full max-w-6xl rounded-t-[2.5rem] p-6 shadow-2xl relative z-10 flex flex-col transition-all duration-300 ${agentsPanelExpanded ? 'h-[100vh]' : 'h-[85vh]'}`}
            >
              <div className="w-12 h-1.5 bg-slate-200 dark:bg-white/10 rounded-full mx-auto mb-4 shrink-0 cursor-pointer" onClick={() => setAgentsPanelExpanded(!agentsPanelExpanded)} />
              
              <div className="flex items-center justify-between mb-4 shrink-0">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-green-500/10 text-green-500 rounded-xl">
                    <Cpu className="w-6 h-6 animate-pulse" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-slate-950 dark:text-white">OMNIV1 Multi-Provider AI Mesh</h3>
                    <p className="text-xs text-slate-500">Autonomous self-healing LLM infrastructure with real-time failovers & BYOK key routing</p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <button onClick={() => setAgentsPanelExpanded(!agentsPanelExpanded)} className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-white/10 text-slate-500 hover:text-slate-950 dark:hover:text-white">
                    {agentsPanelExpanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                  </button>
                  <button onClick={() => setIsAgentsOpen(false)} className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-white/10 text-slate-500 hover:text-slate-950 dark:hover:text-white"><X className="w-5 h-5" /></button>
                </div>
              </div>

              {/* DUAL COLUMN CONTROL LAYOUT */}
              <div className="flex-1 flex flex-col lg:flex-row gap-6 overflow-hidden min-h-0">
                
                {/* LEFT COLUMN: GLOBAL AI MESH ROUTER SETTINGS */}
                <div className="w-full lg:w-80 shrink-0 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl p-4 flex flex-col justify-between overflow-y-auto">
                  <div className="space-y-5">
                    <div>
                      <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider mb-3 flex items-center space-x-1.5">
                        <Sliders className="w-3.5 h-3.5 text-purple-500" />
                        <span>Mesh Routing Parameters</span>
                      </h4>
                      <p className="text-[11px] text-slate-500">Tune the autonomous failover algorithm's provider ranking priorities.</p>
                    </div>

                    {/* PRIORITY MODE */}
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">Optimization Goal (Priority Mode)</label>
                      <select 
                        value={routingConfig.priorityMode}
                        onChange={(e) => setRoutingConfig((prev: any) => ({ ...prev, priorityMode: e.target.value }))}
                        className="w-full bg-white dark:bg-[#0A0A0A] border border-slate-200 dark:border-white/10 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-green-500 text-slate-900 dark:text-white"
                      >
                        <option value="balanced">Balanced (Inference Stability & Latency)</option>
                        <option value="fastest">Fastest (Sort by lowest provider latency)</option>
                        <option value="cheapest">Cheapest (Sort by lowest compute cost weight)</option>
                        <option value="best_quality">Best Quality (Sort by model capabilities weight)</option>
                      </select>
                    </div>

                    {/* PREFERRED PROVIDER */}
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">Preferred Primary Provider</label>
                      <select 
                        value={routingConfig.preferredProviderId || ''}
                        onChange={(e) => setRoutingConfig((prev: any) => ({ ...prev, preferredProviderId: e.target.value || null }))}
                        className="w-full bg-white dark:bg-[#0A0A0A] border border-slate-200 dark:border-white/10 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-green-500 text-slate-900 dark:text-white"
                      >
                        <option value="">No Preferred (Let router rank autonomously)</option>
                        {AI_PLATFORMS.map(p => (
                          <option key={p.id} value={p.id}>{p.icon} {p.name}</option>
                        ))}
                      </select>
                    </div>

                    {/* FAILOVER SETTING */}
                    <div className="flex items-center justify-between p-2 rounded-xl bg-white dark:bg-black/20 border border-slate-100 dark:border-white/5">
                      <div className="flex flex-col pr-2">
                        <span className="text-[11px] font-bold text-slate-800 dark:text-slate-200">Auto Failovers</span>
                        <span className="text-[9px] text-slate-500">Survive provider errors seamlessly</span>
                      </div>
                      <div 
                        onClick={() => setRoutingConfig((prev: any) => ({ ...prev, autoFailover: !prev.autoFailover }))}
                        className={`w-9 h-5 rounded-full relative cursor-pointer transition-colors shrink-0 ${routingConfig.autoFailover ? 'bg-green-500' : 'bg-slate-300 dark:bg-white/10'}`}
                      >
                        <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all ${routingConfig.autoFailover ? 'right-0.5' : 'left-0.5'}`} />
                      </div>
                    </div>

                    {/* HEALTH CHECK SETTING */}
                    <div className="flex items-center justify-between p-2 rounded-xl bg-white dark:bg-black/20 border border-slate-100 dark:border-white/5">
                      <div className="flex flex-col pr-2">
                        <span className="text-[11px] font-bold text-slate-800 dark:text-slate-200">Periodic Health Checks</span>
                        <span className="text-[9px] text-slate-500">Auto ping health diagnostics every 5m</span>
                      </div>
                      <div 
                        onClick={() => setRoutingConfig((prev: any) => ({ ...prev, autoHealthCheck: !prev.autoHealthCheck }))}
                        className={`w-9 h-5 rounded-full relative cursor-pointer transition-colors shrink-0 ${routingConfig.autoHealthCheck ? 'bg-green-500' : 'bg-slate-300 dark:bg-white/10'}`}
                      >
                        <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all ${routingConfig.autoHealthCheck ? 'right-0.5' : 'left-0.5'}`} />
                      </div>
                    </div>
                  </div>

                  <button 
                    onClick={async () => {
                      setSavingConfig(true);
                      try {
                        await fetch('/api/provider/config/save', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ userId: user?.uid, ...routingConfig })
                        });
                        await fetchMeshStatus();
                        alert("Multi-Provider AI Mesh settings saved successfully!");
                      } catch (e) {
                        console.error(e);
                      } finally {
                        setSavingConfig(false);
                      }
                    }}
                    disabled={savingConfig}
                    className="w-full mt-6 py-2 bg-green-600 hover:bg-green-500 text-white rounded-xl font-bold text-xs transition-all flex items-center justify-center space-x-1.5 disabled:opacity-50"
                  >
                    {savingConfig ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                    <span>Save Mesh Configuration</span>
                  </button>
                </div>

                {/* RIGHT COLUMN: SEARCH + PROVIDER MESH DIRECTORY */}
                <div className="flex-1 flex flex-col overflow-hidden">
                  <div className="relative mb-4 shrink-0">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input 
                      type="text" 
                      placeholder="Search and configure 12 providers (e.g. Groq, Cerebras, OpenRouter...)" 
                      value={providerSearch}
                      onChange={(e) => setProviderSearch(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl pl-9 pr-4 py-2.5 text-sm focus:outline-none focus:border-green-500 transition-all text-slate-900 dark:text-white" 
                    />
                  </div>

                  {/* ACTIVE PROVIDER CARDS SCROLLABLE CONTAINER */}
                  <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {AI_PLATFORMS.filter(p => p.name.toLowerCase().includes(providerSearch.toLowerCase())).map(platform => {
                        const s = meshStatuses.find(status => status.id === platform.id);
                        const isEditing = editingProviderId === platform.id;
                        
                        // Status styling
                        const healthState = s?.healthState || (s?.enabled === false ? 'disabled' : 'healthy');
                        const statusColors: Record<string, { label: string, badge: string, dot: string }> = {
                          healthy: { label: "Healthy", badge: "bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20", dot: "bg-green-500" },
                          rate_limited: { label: "Rate Limited", badge: "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/20", dot: "bg-yellow-500" },
                          quota_low: { label: "Quota Low", badge: "bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20", dot: "bg-orange-500" },
                          offline: { label: "Circuit Open / Offline", badge: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20", dot: "bg-red-500 animate-pulse" },
                          disabled: { label: "Disabled", badge: "bg-slate-500/10 text-slate-500 border-slate-500/20", dot: "bg-slate-500" }
                        };
                        const activeStyle = statusColors[healthState] || statusColors.healthy;

                        return (
                          <div 
                            key={platform.id} 
                            className={`p-4 rounded-2xl border transition-all duration-300 relative overflow-hidden flex flex-col justify-between ${
                              s?.enabled === false 
                                ? 'bg-slate-50/50 dark:bg-white/[0.01] border-slate-200 dark:border-white/5 opacity-70' 
                                : 'bg-slate-50 dark:bg-white/[0.03] border-slate-200 dark:border-white/10 hover:border-green-500/30'
                            }`}
                          >
                            <div className="space-y-3">
                              {/* HEADER */}
                              <div className="flex items-start justify-between">
                                <div className="flex items-center space-x-2.5">
                                  <span className="text-2xl filter drop-shadow-md">{platform.icon}</span>
                                  <div>
                                    <h4 className="font-bold text-slate-900 dark:text-white text-sm">{platform.name}</h4>
                                    <span className="text-[9px] text-slate-400 font-mono block">{platform.keyHint}</span>
                                  </div>
                                </div>
                                <div className="flex items-center space-x-2">
                                  {/* HEALTH STATE BADGE */}
                                  <span className={`text-[8px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border flex items-center space-x-1 ${activeStyle.badge}`}>
                                    <span className={`w-1.5 h-1.5 rounded-full ${activeStyle.dot}`} />
                                    <span>{activeStyle.label}</span>
                                  </span>
                                  
                                  {/* ENABLE/DISABLE TOGGLE */}
                                  <div 
                                    onClick={async () => {
                                      const nextEnabled = !(s?.enabled ?? true);
                                      try {
                                        await fetch('/api/provider/settings/save', {
                                          method: 'POST',
                                          headers: { 'Content-Type': 'application/json' },
                                          body: JSON.stringify({ userId: user?.uid, providerId: platform.id, enabled: nextEnabled, priority: s?.metrics?.priority || 5 })
                                        });
                                        await fetchMeshStatus();
                                      } catch (err) {
                                        console.error(err);
                                      }
                                    }}
                                    className={`w-8 h-4.5 rounded-full relative cursor-pointer transition-colors shrink-0 ${s?.enabled !== false ? 'bg-green-500' : 'bg-slate-300 dark:bg-white/10'}`}
                                  >
                                    <div className={`absolute top-0.5 w-3.5 h-3.5 bg-white rounded-full transition-all ${s?.enabled !== false ? 'right-0.5' : 'left-0.5'}`} />
                                  </div>
                                </div>
                              </div>

                              {/* MODELS LIST */}
                              <p className="text-[10px] text-slate-500"><span className="text-slate-400 font-bold font-sans">Mesh Models:</span> <span className="font-mono text-[9px]">{platform.models.join(', ')}</span></p>

                              {/* METRICS ROW */}
                              {s?.metrics && s.enabled !== false && (
                                <div className="grid grid-cols-4 gap-2 py-1.5 px-2 bg-slate-100 dark:bg-white/5 rounded-xl text-center border border-slate-200/50 dark:border-white/5">
                                  <div className="flex flex-col">
                                    <span className="text-[8px] text-slate-400 uppercase">Success</span>
                                    <span className="text-[10px] font-bold font-mono text-green-500">{(s.metrics.successRate * 100).toFixed(0)}%</span>
                                  </div>
                                  <div className="flex flex-col">
                                    <span className="text-[8px] text-slate-400 uppercase">Latency</span>
                                    <span className="text-[10px] font-bold font-mono text-blue-400">{s.metrics.latency}ms</span>
                                  </div>
                                  <div className="flex flex-col">
                                    <span className="text-[8px] text-slate-400 uppercase">Fails</span>
                                    <span className="text-[10px] font-bold font-mono text-red-500">{s.metrics.consecutiveFailures}</span>
                                  </div>
                                  <div className="flex flex-col">
                                    <span className="text-[8px] text-slate-400 uppercase">Requests</span>
                                    <span className="text-[10px] font-bold font-mono text-slate-300">{s.metrics.totalRequests}</span>
                                  </div>
                                </div>
                              )}

                              {/* KEY TYPE BADGE */}
                              {s && s.enabled !== false && (
                                <div className="text-[9px] text-slate-500 flex items-center space-x-1">
                                  <KeyRound className="w-3 h-3 text-slate-400" />
                                  <span>{s.hasUserKey ? "Authorized via User BYOK API key" : (s.hasBuiltInKey ? "Authorized via Built-in Shared Mesh key" : "No Key Set")}</span>
                                </div>
                              )}
                            </div>

                            {/* FOOTER & KEY FIELD EDIT CONTROLS */}
                            <div className="mt-4 pt-3 border-t border-slate-200/50 dark:border-white/5">
                              {!isEditing ? (
                                <div className="flex items-center justify-between">
                                  <button 
                                    onClick={() => {
                                      setEditingProviderId(platform.id);
                                      setProviderApiKey('');
                                      setProviderPriority(s?.metrics?.priority || 5);
                                      setTempApiKeys(s?.apiKeys || []);
                                      setCloudflareAccountIdInput(s?.cloudflareAccountId || '');
                                      setHuggingFaceModelIdInput(s?.huggingFaceModelId || '');
                                      setTestResult(null);
                                    }}
                                    className="px-3 py-1 bg-slate-200 dark:bg-white/10 hover:bg-slate-300 dark:hover:bg-white/20 text-slate-800 dark:text-slate-200 rounded-lg font-bold text-[11px] transition-all"
                                  >
                                    Configure Key
                                  </button>
                                  {s?.quotaStatus && <span className="text-[9px] font-mono text-slate-500">{s.quotaStatus}</span>}
                                </div>
                              ) : (
                                <div className="space-y-4 p-3 bg-slate-100 dark:bg-black/25 rounded-xl border border-slate-200/60 dark:border-white/5">
                                  {/* Existing Keys list */}
                                  <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-slate-400 block">Authorized API Key(s)</label>
                                    {tempApiKeys.length === 0 ? (
                                      <p className="text-[10px] text-slate-500 italic">No keys added yet. Add at least one key to use BYOK.</p>
                                    ) : (
                                      <div className="space-y-1 max-h-32 overflow-y-auto custom-scrollbar">
                                        {tempApiKeys.map((k, idx) => (
                                          <div key={idx} className="flex items-center justify-between bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 px-2 py-1 rounded-lg">
                                            <span className="text-[10px] font-mono text-slate-700 dark:text-slate-300">
                                              Key #{idx + 1}: {k ? (k.length > 10 ? `${k.substring(0, 6)}••••${k.substring(k.length - 4)}` : "••••••••") : ""}
                                            </span>
                                            <button
                                              onClick={() => {
                                                setTempApiKeys(prev => prev.filter((_, i) => i !== idx));
                                              }}
                                              className="text-[10px] text-red-500 hover:text-red-400 font-bold px-1"
                                              title="Delete Key"
                                            >
                                              Remove
                                            </button>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>

                                  {/* Input to add a new key */}
                                  <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-white/5">
                                    <div className="flex gap-2 items-end">
                                      <div className="flex-1 space-y-1">
                                        <label className="text-[9px] font-bold text-slate-400 block">Add New API Key</label>
                                        <input 
                                          type="password" 
                                          value={providerApiKey}
                                          onChange={(e) => setProviderApiKey(e.target.value)}
                                          placeholder={`Add Key (${platform.keyPlaceholder})`}
                                          className="w-full bg-white dark:bg-[#0A0A0A] border border-slate-200 dark:border-white/10 rounded-lg px-2.5 py-1.5 text-xs font-mono text-slate-900 dark:text-white focus:outline-none focus:border-green-500"
                                        />
                                      </div>
                                      <button 
                                        onClick={async () => {
                                          if (!providerApiKey) return;
                                          setTestingKeyId(platform.id);
                                          setTestResult(null);
                                          try {
                                            const res = await fetch('/api/provider/test-key', {
                                              method: 'POST',
                                              headers: { 'Content-Type': 'application/json' },
                                              body: JSON.stringify({ 
                                                providerId: platform.id, 
                                                apiKey: providerApiKey,
                                                accountId: platform.id === 'cloudflare' ? cloudflareAccountIdInput : (platform.id === 'huggingface' ? huggingFaceModelIdInput : undefined)
                                              })
                                            });
                                            const data = await res.json();
                                            setTestResult(data);
                                            if (data.success) {
                                              // Add key to tempApiKeys list
                                              setTempApiKeys(prev => [...prev, providerApiKey]);
                                              setProviderApiKey('');
                                            }
                                          } catch (e: any) {
                                            setTestResult({ success: false, error: e.message });
                                          } finally {
                                            setTestingKeyId(null);
                                          }
                                        }}
                                        disabled={!providerApiKey || testingKeyId === platform.id}
                                        className="px-2.5 py-1.5 bg-slate-200 dark:bg-white/10 hover:bg-slate-300 dark:hover:bg-white/20 rounded-lg font-bold text-[10px] text-slate-800 dark:text-slate-200 transition-all disabled:opacity-40 whitespace-nowrap h-[34px]"
                                      >
                                        {testingKeyId === platform.id ? "Testing..." : "Test & Add"}
                                      </button>
                                    </div>
                                  </div>

                                  {/* Cloudflare Account ID Field */}
                                  {platform.id === 'cloudflare' && (
                                    <div className="space-y-1 pt-2 border-t border-slate-200 dark:border-white/5">
                                      <label className="text-[10px] font-bold text-slate-400 block">Cloudflare Account ID (Required)</label>
                                      <input 
                                        type="text" 
                                        value={cloudflareAccountIdInput}
                                        onChange={(e) => setCloudflareAccountIdInput(e.target.value)}
                                        placeholder="Enter Cloudflare Account ID"
                                        className="w-full bg-white dark:bg-[#0A0A0A] border border-slate-200 dark:border-white/10 rounded-lg px-2.5 py-1.5 text-xs font-mono text-slate-900 dark:text-white focus:outline-none focus:border-green-500"
                                      />
                                    </div>
                                  )}

                                  {/* Hugging Face Model ID Field */}
                                  {platform.id === 'huggingface' && (
                                    <div className="space-y-1 pt-2 border-t border-slate-200 dark:border-white/5">
                                      <label className="text-[10px] font-bold text-slate-400 block">Default Hugging Face Model ID</label>
                                      <input 
                                        type="text" 
                                        value={huggingFaceModelIdInput}
                                        onChange={(e) => setHuggingFaceModelIdInput(e.target.value)}
                                        placeholder="e.g. google/gemma-2-9b-it"
                                        className="w-full bg-white dark:bg-[#0A0A0A] border border-slate-200 dark:border-white/10 rounded-lg px-2.5 py-1.5 text-xs font-mono text-slate-900 dark:text-white focus:outline-none focus:border-green-500"
                                      />
                                      <span className="text-[8px] text-slate-400 block">Suggestions: deepseek-ai/DeepSeek-R1-Distill-Qwen-1.5B, meta-llama/Llama-3.2-3B-Instruct</span>
                                    </div>
                                  )}

                                  {/* PRIORITY SLIDER */}
                                  <div className="space-y-1 pt-2 border-t border-slate-200 dark:border-white/5">
                                    <div className="flex justify-between text-[10px] font-bold text-slate-400">
                                      <span>Router Priority weight</span>
                                      <span className="font-mono">{providerPriority}/10</span>
                                    </div>
                                    <input 
                                      type="range" min="1" max="10" 
                                      value={providerPriority}
                                      onChange={(e) => setProviderPriority(Number(e.target.value))}
                                      className="w-full accent-green-500 h-1 bg-slate-200 dark:bg-white/10 rounded-lg appearance-none cursor-pointer"
                                    />
                                  </div>

                                  {/* TEST RESULT MESSAGE */}
                                  {testResult && (
                                    <div className={`p-2 rounded-xl text-[10px] font-mono border ${testResult.success ? 'bg-green-500/15 border-green-500/30 text-green-400' : 'bg-red-500/15 border-red-500/30 text-red-400'}`}>
                                      {testResult.success ? `🟢 Validation Successful! Models found: ${testResult.models.slice(0, 3).join(', ')}` : `🔴 Validation Failed: ${testResult.error}`}
                                    </div>
                                  )}

                                  {/* BUTTONS */}
                                  <div className="flex items-center space-x-2 pt-2 border-t border-slate-200 dark:border-white/5">
                                    <button 
                                      onClick={async () => {
                                        try {
                                          await fetch('/api/provider/settings/save', {
                                            method: 'POST',
                                            headers: { 'Content-Type': 'application/json' },
                                            body: JSON.stringify({ 
                                              userId: user?.uid, 
                                              providerId: platform.id, 
                                              enabled: true, 
                                              apiKeys: tempApiKeys,
                                              cloudflareAccountId: platform.id === 'cloudflare' ? cloudflareAccountIdInput : undefined,
                                              huggingFaceModelId: platform.id === 'huggingface' ? huggingFaceModelIdInput : undefined,
                                              priority: providerPriority 
                                            })
                                          });
                                          await fetchMeshStatus();
                                          setEditingProviderId(null);
                                        } catch (err) {
                                          console.error(err);
                                        }
                                      }}
                                      className="flex-1 py-1.5 bg-green-600 hover:bg-green-500 text-white rounded-lg font-bold text-[10px] transition-all text-center"
                                    >
                                      Save Settings
                                    </button>

                                    <button 
                                      onClick={() => setEditingProviderId(null)}
                                      className="px-2.5 py-1.5 border border-slate-200 dark:border-white/5 hover:bg-slate-100 dark:hover:bg-white/5 text-slate-500 rounded-lg text-[10px] font-bold"
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
              <div className="mt-4 pt-4 border-t border-slate-200 dark:border-white/10 shrink-0 text-center">
                <p className="text-[10px] text-slate-500 italic">"The autonomous multi-provider AI Mesh self-heals by routing through circuits, preserving active memory states."</p>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* DEPLOY MODAL */}
      <AnimatePresence>
        {isDeployModalOpen && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsDeployModalOpen(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-xl bg-white dark:bg-[#0A0A0A] border border-slate-200 dark:border-white/10 rounded-2xl p-6 shadow-2xl flex flex-col"
            >
              <button 
                onClick={() => setIsDeployModalOpen(false)}
                className="absolute top-4 right-4 p-2 rounded-full hover:bg-slate-100 dark:hover:bg-white/10 transition-colors text-slate-500"
              >
                <X className="w-5 h-5" />
              </button>

              <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2 flex items-center gap-3">
                <Rocket className="w-6 h-6 text-blue-500" />
                Deploy to Production
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-8">
                Ship your project instantly to a global edge network.
              </p>

              {deployResult ? (
                <div className="flex flex-col items-center justify-center py-8 space-y-4">
                  <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mb-2">
                    <Check className="w-8 h-8 text-green-500" />
                  </div>
                  <h3 className="text-xl font-bold text-slate-900 dark:text-white">Deployed Successfully!</h3>
                  <a 
                    href={deployResult.url} 
                    target="_blank" 
                    rel="noreferrer"
                    className="text-blue-500 hover:text-blue-400 font-mono underline underline-offset-4 flex items-center gap-2"
                  >
                    {deployResult.url} <ExternalLink className="w-4 h-4" />
                  </a>
                  <button 
                    onClick={() => setIsDeployModalOpen(false)}
                    className="mt-6 px-6 py-2 bg-slate-900 dark:bg-white text-white dark:text-black rounded-lg font-bold"
                  >
                    Done
                  </button>
                </div>
              ) : isDeploying ? (
                <div className="flex flex-col items-center justify-center py-12 space-y-6">
                  <div className="relative">
                    <div className="w-16 h-16 border-4 border-blue-500/20 rounded-full"></div>
                    <div className="w-16 h-16 border-4 border-blue-500 rounded-full border-t-transparent animate-spin absolute inset-0"></div>
                  </div>
                  <div className="text-center space-y-2">
                    <p className="text-lg font-bold text-slate-900 dark:text-white animate-pulse">
                      Deploying to {deployPlatform === 'vercel' ? 'Vercel' : 'Netlify'}...
                    </p>
                    <p className="text-sm text-slate-500 font-mono">Zipping files & Uploading</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="grid grid-cols-2 gap-4">
                    <button
                      onClick={() => setDeployPlatform('vercel')}
                      className={cn(
                        "p-6 rounded-xl border-2 text-left transition-all flex flex-col items-center gap-4",
                        deployPlatform === 'vercel' 
                          ? "border-black dark:border-white bg-slate-50 dark:bg-white/5" 
                          : "border-slate-200 dark:border-white/10 hover:border-slate-300 dark:hover:border-white/20"
                      )}
                    >
                      <div className="w-12 h-12 flex items-center justify-center bg-black dark:bg-white text-white dark:text-black rounded-full text-2xl font-bold">V</div>
                      <span className="font-bold text-lg dark:text-white">Vercel</span>
                    </button>
                    <button
                      onClick={() => setDeployPlatform('netlify')}
                      className={cn(
                        "p-6 rounded-xl border-2 text-left transition-all flex flex-col items-center gap-4 opacity-50 cursor-not-allowed",
                        deployPlatform === 'netlify' 
                          ? "border-[#00C7B7] bg-[#00C7B7]/10" 
                          : "border-slate-200 dark:border-white/10"
                      )}
                      disabled
                    >
                      <div className="w-12 h-12 flex items-center justify-center bg-[#00C7B7] text-white rounded-full text-2xl font-bold">N</div>
                      <span className="font-bold text-lg dark:text-white flex items-center gap-2">Netlify <span className="text-[10px] bg-slate-200 dark:bg-white/10 px-2 py-0.5 rounded uppercase tracking-wider text-slate-500">Soon</span></span>
                    </button>
                  </div>

                  {deployPlatform === 'vercel' && (
                    <div className="space-y-4 animate-in fade-in slide-in-from-top-4 duration-300">
                      <div>
                        <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Vercel Token</label>
                        <input
                          type="password"
                          value={deployToken}
                          onChange={(e) => setDeployToken(e.target.value)}
                          placeholder="Your Vercel Access Token"
                          className="w-full bg-slate-50 dark:bg-black/50 border border-slate-200 dark:border-white/10 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-blue-500 font-mono dark:text-white transition-colors"
                        />
                        <p className="mt-2 text-xs text-slate-500">
                          Create a token at <a href="https://vercel.com/account/tokens" target="_blank" rel="noreferrer" className="text-blue-500 hover:underline">vercel.com/account/tokens</a>
                        </p>
                      </div>

                      <button
                        onClick={async () => {
                          if (!deployToken) return alert("Please enter a token");
                          setIsDeploying(true);
                          try {
                            const res = await fetch('/api/deploy/vercel', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ token: deployToken, projectId: activeProject?.id })
                            });
                            const data = await res.json();
                            if (data.error) throw new Error(data.error);
                            setDeployResult({ url: data.url, platform: 'vercel' });
                          } catch (err: any) {
                            alert(err.message);
                          } finally {
                            setIsDeploying(false);
                          }
                        }}
                        disabled={!deployToken || isDeploying}
                        className="w-full py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg font-bold shadow-lg shadow-blue-600/20 transition-all flex items-center justify-center gap-2"
                      >
                        <Rocket className="w-5 h-5" /> Deploy to Vercel
                      </button>
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 1. MODEL SELECTION MODAL */}
      <AnimatePresence>
        {isModelModalOpen && (
          <div className="fixed inset-0 z-[150] flex items-end justify-center">
            {/* Backdrop */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModelModalOpen(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />

            {/* Sliding Drawer Sheet */}
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 280 }}
              className="bg-white dark:bg-[#0F0F0F] border-t border-slate-200 dark:border-white/10 w-full max-w-lg rounded-t-[2.5rem] p-6 shadow-2xl relative z-10 max-h-[85vh] overflow-y-auto custom-scrollbar flex flex-col"
            >
              {/* Pill Handle */}
              <div className="w-12 h-1.5 bg-slate-200 dark:bg-white/10 rounded-full mx-auto mb-5 shrink-0" />

              <div className="flex items-center justify-between mb-4 shrink-0">
                <div className="flex items-center space-x-2.5">
                  <Cpu className="w-5 h-5 text-blue-500" />
                  <h3 className="text-base font-bold text-slate-950 dark:text-white">Switch Intelligence Model</h3>
                </div>
                <button 
                  onClick={() => setIsModelModalOpen(false)}
                  className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-white/10 text-slate-500 hover:text-slate-950 dark:hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-2.5 overflow-y-auto custom-scrollbar pr-1">
                 {[
                  { id: "omni-google", name: "Omni Google", providerId: "google", desc: "Powered by Gemini 3.5 Flash. Multi-modal, fast, and highly capable for most tasks.", icon: Zap, badge: "LATEST" },
                  { id: "omni-groq", name: "Omni Groq", providerId: "groq", desc: "Powered by Groq. Ultra-fast LLaMA models with instant response times.", icon: Zap, badge: "FASTEST" },
                  { id: "omni-openrouter", name: "Omni OpenRouter", providerId: "openrouter", desc: "Access 100+ models via a single API key. Highly flexible.", icon: Globe, badge: "VERSATILE" },
                  { id: "omni-deepseek", name: "Omni DeepSeek", providerId: "deepseek", desc: "Powered by DeepSeek V3 and DeepSeek R1 models. Exceptional code and reasoning.", icon: Cpu, badge: "INTELLIGENT" },
                  { id: "omni-mistral", name: "Omni Mistral", providerId: "mistral", desc: "European efficiency. Powerful models like Mistral Large and Pixtral.", icon: Cpu, badge: "EFFICIENT" },
                  { id: "omni-huggingface", name: "Omni Hugging Face", providerId: "huggingface", desc: "Open-source excellence. Access thousands of community models.", icon: Bot, badge: "OPEN-SOURCE" },
                  { id: "omni-cerebras", name: "Omni Cerebras", providerId: "cerebras", desc: "Ultra-low-latency Cerebras CS-3 computer systems powering LLaMA models.", icon: Zap, badge: "CS-3 CHIP" },
                  { id: "omni-github", name: "Omni GitHub Models", providerId: "github", desc: "Microsoft and GitHub's ecosystem. Integrated development models.", icon: Bot, badge: "DEV" },
                  { id: "omni-cloudflare", name: "Omni Cloudflare", providerId: "cloudflare", desc: "Edge-computed Workers AI model deployments. Fast and globally distributed.", icon: Globe, badge: "EDGE" },
                  { id: "omni-together", name: "Omni Together AI", providerId: "together", desc: "Together.xyz's high-performance open model inference engine.", icon: Cpu, badge: "PRO" },
                  { id: "omni-fireworks", name: "Omni Fireworks", providerId: "fireworks", desc: "Fireworks.ai high-speed model execution platform.", icon: Zap, badge: "FASTEST" },
                  { id: "omni-nvidia", name: "Omni NVIDIA Build", providerId: "nvidia", desc: "Nvidia API catalog. Hardware-optimized world-class models.", icon: Cpu, badge: "PRO" },
                  ...AI_PLATFORMS
                    .filter(p => userApiKeys[p.id]?.enabled)
                    .flatMap(p => p.models.map(m => ({
                      id: `user-${p.id}-${m}`,
                      name: `${m}`,
                      providerId: p.id,
                      desc: `Your ${p.name} key • ${m}`,
                      badge: 'YOUR KEY',
                      icon: Bot,
                      platform: p.id
                    })))
                ].map((m) => {
                  const isSelected = selectedModel === m.id;
                  const IconComponent = m.icon;
                  
                  // Extract provider info
                  const providerId = m.providerId;
                  const s = meshStatuses.find(st => st.id === providerId);
                  const isEnabled = s?.enabled !== false;
                  const healthState = s?.healthState || (isEnabled ? 'healthy' : 'disabled');
                  
                  // Status style mapping
                  const stateLabels: Record<string, { text: string; css: string }> = {
                    healthy: { text: "🟢 Healthy", css: "text-green-500" },
                    rate_limited: { text: "🟡 Rate Limited", css: "text-yellow-500" },
                    quota_low: { text: "🟠 Quota Low", css: "text-orange-500" },
                    offline: { text: "🔴 Offline", css: "text-red-500" },
                    disabled: { text: "⚫ Disabled", css: "text-slate-500" }
                  };
                  const statusInfo = stateLabels[healthState] || stateLabels.healthy;

                  return (
                    <button
                      key={m.id}
                      onClick={() => {
                        setSelectedModel(m.id);
                        setIsModelModalOpen(false);
                      }}
                      className={cn(
                        "w-full text-left p-3.5 rounded-2xl border transition-all flex items-start space-x-3.5",
                        isSelected 
                          ? "bg-blue-50/50 dark:bg-blue-600/10 border-blue-500/50 dark:border-blue-500/30 shadow-md scale-[1.01]" 
                          : "bg-transparent border-slate-100 dark:border-white/5 hover:bg-slate-50 dark:hover:bg-white/5 hover:border-slate-200 dark:hover:border-white/10"
                      )}
                    >
                      <div className={cn(
                        "p-2 rounded-xl shrink-0 mt-0.5",
                        isSelected ? "bg-blue-500 text-white" : "bg-slate-100 dark:bg-white/5 text-slate-500"
                      )}>
                        <IconComponent className="w-4.5 h-4.5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            <span className="font-bold text-slate-900 dark:text-white text-sm">{m.name}</span>
                            <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-slate-200 dark:bg-white/10 font-bold text-slate-500 dark:text-slate-400">{m.badge}</span>
                          </div>
                          <span className={`text-[9px] font-mono font-semibold ${statusInfo.css}`}>{statusInfo.text}</span>
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">{m.desc}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 2. TOOL SELECTION MODAL */}
      <AnimatePresence>
        {isToolSheetOpen && (
          <div className="fixed inset-0 z-[150] flex items-end justify-center">
            {/* Backdrop */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsToolSheetOpen(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />

            {/* Sliding Drawer Sheet */}
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 280 }}
              className="bg-white dark:bg-[#0F0F0F] border-t border-slate-200 dark:border-white/10 w-full max-w-lg rounded-t-[2.5rem] p-6 shadow-2xl relative z-10 max-h-[85vh] overflow-y-auto custom-scrollbar flex flex-col"
            >
              {/* Pill Handle */}
              <div className="w-12 h-1.5 bg-slate-200 dark:bg-white/10 rounded-full mx-auto mb-5 shrink-0" />

              <div className="flex items-center justify-between mb-4 shrink-0">
                <div className="flex items-center space-x-2.5">
                  <Search className="w-5 h-5 text-blue-500" />
                  <h3 className="text-base font-bold text-slate-950 dark:text-white">AI Tools & Modes</h3>
                </div>
                <button 
                  onClick={() => setIsToolSheetOpen(false)}
                  className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-white/10 text-slate-500 hover:text-slate-950 dark:hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-2.5">
                {[
                  { id: "none", name: "Standard Chat", desc: "Balanced conversation without extra tools.", icon: MessageSquare, color: "text-slate-500" },
                  { id: "search", name: "Web Search", desc: "Browse the live web for real-time information and references.", icon: Globe, color: "text-blue-500" },
                  { id: "deep_research", name: "Deep Research", desc: "Extensive multi-step research with progress tracking.", icon: Search, color: "text-indigo-500" },
                  { id: "plan", name: "Plan Mode", desc: "Structured planning for complex multi-step tasks.", icon: Sliders, color: "text-emerald-500" },
                  { id: "research", name: "Technical Research", desc: "Deep dive into technical docs and codebases.", icon: Cpu, color: "text-purple-500" },
                  { id: "learn", name: "Learning Mode", desc: "Interactive teaching and conceptual explanations.", icon: Zap, color: "text-amber-500" },
                  { id: "study", name: "Study Companion", desc: "Helping you master subjects and subjects with structured guidance.", icon: BookOpen, color: "text-orange-500" }
                ].map((tool) => {
                  const isSelected = activeTool === tool.id;
                  const IconComponent = tool.icon;
                  return (
                    <button
                      key={tool.id}
                      onClick={() => {
                        setActiveTool(tool.id as any);
                        setIsToolSheetOpen(false);
                      }}
                      className={cn(
                        "w-full text-left p-3.5 rounded-2xl border transition-all flex items-start space-x-3.5",
                        isSelected 
                          ? "bg-blue-50/50 dark:bg-blue-600/10 border-blue-500/50 dark:border-blue-500/30 shadow-md scale-[1.01]" 
                          : "bg-transparent border-slate-100 dark:border-white/5 hover:bg-slate-50 dark:hover:bg-white/5 hover:border-slate-200 dark:hover:border-white/10"
                      )}
                    >
                      <div className={cn(
                        "p-2 rounded-xl shrink-0 mt-0.5",
                        isSelected ? "bg-slate-900 dark:bg-white/10" : "bg-slate-100 dark:bg-white/5"
                      )}>
                        <IconComponent className={cn("w-4.5 h-4.5", tool.color)} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className="font-bold text-slate-900 dark:text-white text-sm">{tool.name}</span>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">{tool.desc}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 3. WORKSPACE SETTINGS MODAL */}
      <AnimatePresence>
        {isWorkspaceSettingsOpen && (
          <div className="fixed inset-0 z-[150] flex items-end justify-center">
            {/* Backdrop */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsWorkspaceSettingsOpen(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />

            {/* Sliding Drawer Sheet */}
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 280 }}
              className="bg-white dark:bg-[#0F0F0F] border-t border-slate-200 dark:border-white/10 w-full max-w-lg rounded-t-[2.5rem] p-6 shadow-2xl relative z-10 max-h-[85vh] overflow-y-auto custom-scrollbar flex flex-col"
            >
              {/* Pill Handle */}
              <div className="w-12 h-1.5 bg-slate-200 dark:bg-white/10 rounded-full mx-auto mb-5 shrink-0" />

              <div className="flex items-center justify-between mb-5 shrink-0">
                <div className="flex items-center space-x-2.5">
                  <SettingsIcon className="w-5 h-5 text-blue-500" />
                  <h3 className="text-base font-bold text-slate-950 dark:text-white">
                    {activeProject !== null ? "Workspace Settings" : "Account Settings"}
                  </h3>
                </div>
                <button 
                  onClick={() => setIsWorkspaceSettingsOpen(false)}
                  className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-white/10 text-slate-500 hover:text-slate-950 dark:hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4 flex-1">
                {/* Project Name Field */}
                {activeProject !== null && (
                  <div className="p-4 bg-slate-50 dark:bg-white/2 rounded-2xl border border-slate-150 dark:border-white/5 space-y-1.5">
                    <label className="text-[10px] text-slate-400 dark:text-slate-500 uppercase font-mono font-bold tracking-wider">Project Name</label>
                    <input 
                      defaultValue={project.name}
                      onChange={(e) => setProject(prev => ({ ...prev, name: e.target.value }))}
                      className="w-full bg-transparent text-sm font-semibold text-slate-900 dark:text-white focus:outline-none"
                    />
                  </div>
                )}

                {/* Preference Section */}
                <div className="p-4 bg-slate-50 dark:bg-white/2 rounded-2xl border border-slate-150 dark:border-white/5 space-y-3">
                  <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase font-mono tracking-wider">Preferences</span>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <Sun className="w-4.5 h-4.5 text-slate-500" />
                      <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">Theme</span>
                    </div>
                    <ThemeToggle />
                  </div>
                </div>

                {/* Model Configuration Selector in settings */}
                {activeProject !== null && (
                  <div className="p-4 bg-slate-50 dark:bg-white/2 rounded-2xl border border-slate-150 dark:border-white/5 space-y-2">
                    <label className="text-[10px] text-slate-400 dark:text-slate-500 uppercase font-mono font-bold tracking-wider">Default Model</label>
                    <button 
                      onClick={() => {
                        setIsWorkspaceSettingsOpen(false);
                        setIsModelModalOpen(true);
                      }}
                      className="w-full flex items-center justify-between text-left text-xs font-bold text-blue-600 dark:text-blue-400 p-2.5 bg-white dark:bg-[#1E1E1F] border border-slate-200 dark:border-white/5 rounded-xl shadow-xs"
                    >
                      <span>{selectedModel}</span>
                      <ChevronRight className="w-4 h-4 text-slate-400" />
                    </button>
                  </div>
                )}

                {/* Actions Block */}
                <div className="pt-4 border-t border-slate-100 dark:border-white/5 flex flex-col space-y-2">
                  <button 
                    onClick={() => {
                      signOut(auth);
                      setIsWorkspaceSettingsOpen(false);
                    }} 
                    className="w-full flex items-center justify-center space-x-2 py-3 bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white text-xs font-mono font-bold rounded-xl transition-all border border-red-500/20"
                  >
                    <LogOut className="w-4 h-4" />
                    <span>SIGN OUT ACCOUNT</span>
                  </button>
                  
                  <button 
                    onClick={() => {
                      handleDeleteAccount();
                      setIsWorkspaceSettingsOpen(false);
                    }}
                    className="w-full flex items-center justify-center space-x-2 py-2 text-slate-400 hover:text-red-500 text-[10px] font-mono transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Permanently Delete Account</span>
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* PROJECT CREATION WIZARD MODAL */}
      <AnimatePresence>
        {showTemplateSelector && (
          <WorkspaceCreator
            projectName={projectName}
            setProjectName={setProjectName}
            projectDescription={projectDescription}
            setProjectDescription={setProjectDescription}
            projectPurpose={projectPurpose}
            setProjectPurpose={setProjectPurpose}
            onCreate={handleCreateProject}
            onClose={() => setShowTemplateSelector(false)}
          />
        )}
      </AnimatePresence>


      {/* 4. CHAT ACTIONS BOTTOM BANNER (LONG PRESS / HOLD BANNER) */}
      <AnimatePresence>
        {selectedChatForActions && (
          <div className="fixed inset-x-0 bottom-6 z-[160] flex justify-center px-4 pointer-events-none">
            <motion.div
              initial={{ y: 100, opacity: 0, scale: 0.95 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 100, opacity: 0, scale: 0.95 }}
              transition={{ type: "spring", damping: 20, stiffness: 180 }}
              className="pointer-events-auto bg-white dark:bg-[#0F0F0F] border border-slate-200 dark:border-white/10 w-full max-w-sm rounded-2xl p-4 shadow-2xl flex items-center justify-between space-x-4 backdrop-blur-md"
            >
              <div className="flex-1 min-w-0">
                <p className="text-[10px] text-slate-400 dark:text-slate-500 uppercase font-mono font-bold tracking-wider">Selected Chat</p>
                <p className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                  {selectedChatForActions.title || "Untitled Conversation"}
                </p>
              </div>
              <div className="flex items-center space-x-1.5 shrink-0">
                {/* Pin/Unpin Action */}
                <button
                  onClick={() => handleTogglePinChat(selectedChatForActions.id, !!selectedChatForActions.pinned)}
                  className="p-2 rounded-xl bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-300 hover:bg-blue-500 hover:text-white dark:hover:bg-blue-600 transition-all"
                  title={selectedChatForActions.pinned ? "Unpin Chat" : "Pin Chat"}
                >
                  <Pin className={cn("w-4 h-4", selectedChatForActions.pinned && "fill-current text-blue-500 hover:text-white")} />
                </button>

                {/* Delete Action */}
                <button
                  onClick={() => handleDeleteHistory(selectedChatForActions.id)}
                  className="p-2 rounded-xl bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white transition-all"
                  title="Delete Chat"
                >
                  <Trash2 className="w-4 h-4" />
                </button>

                {/* Cancel Action */}
                <button
                  onClick={() => setSelectedChatForActions(null)}
                  className="p-2 rounded-xl bg-slate-100 dark:bg-white/5 text-slate-400 hover:text-slate-900 dark:hover:text-white transition-all"
                  title="Cancel"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Sliding Side Panel Drawer Overlay */}
      <AnimatePresence>
        {isSidebarExpanded && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                setIsSidebarExpanded(false);
              }}
              className="fixed inset-0 bg-slate-950/45 backdrop-blur-xs z-45"
            />
            <motion.aside
              initial={{ x: -320 }}
              animate={{ x: 0 }}
              exit={{ x: -320 }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="fixed top-0 left-0 h-full bg-white dark:bg-[#0F0F0F] border-r border-slate-200 dark:border-white/5 shadow-2xl z-50 flex flex-col"
              style={{ width: isMobile ? "min(320px, 85vw)" : "320px" }}
            >
              {/* Top Row: Logo & Title (Single Line, No Divider Below) */}
              <div className="p-5 flex items-center justify-between shrink-0">
                <div className="flex items-center space-x-2.5">
                  <div className="w-8 h-8">
                    <OmniWave />
                  </div>
                  <span className="text-sm font-bold tracking-tight text-slate-950 dark:text-white">Omni Workspace</span>
                </div>
                <button 
                  onClick={() => {
                    setIsSidebarExpanded(false);
                  }} 
                  className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-white/5 text-slate-500 hover:text-slate-950 dark:hover:text-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Scrollable Center Pane */}
              <div className="flex-1 overflow-y-auto px-4 py-2 custom-scrollbar flex flex-col space-y-4">
                {/* STATE 4 ONLY: File Explorer */}
                {activeProject !== null && (
                  <div>
                    <button 
                      onClick={() => setIsFilesSectionExpanded(!isFilesSectionExpanded)}
                      className="w-full flex items-center justify-between px-2 pb-2 mb-1 border-b border-slate-100 dark:border-white/2 text-[10.5px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                    >
                      <div className="flex items-center space-x-2">
                        <Files className="w-3.5 h-3.5" />
                        <span>Files</span>
                      </div>
                      {isFilesSectionExpanded ? (
                        <ChevronDown className="w-3.5 h-3.5" />
                      ) : (
                        <ChevronRight className="w-3.5 h-3.5" />
                      )}
                    </button>
                    {isFilesSectionExpanded && (
                      <div className="space-y-0.5 max-h-[220px] overflow-y-auto custom-scrollbar">
                        {project.files.map((file, i) => (
                          <div key={`file-root-${i}`}>
                            <FileItem node={file} level={0} onSelect={(path) => {
                              handleFileSelect(path);
                              setIsSidebarExpanded(false);
                            }} />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* STATE 1: Workspace Section */}
                {activeProject === null ? (
                  <div>
                    <button 
                      onClick={() => setIsWorkspaceSectionExpanded(!isWorkspaceSectionExpanded)}
                      className="w-full flex items-center justify-between px-2 pb-2 mb-1 border-b border-slate-100 dark:border-white/2 text-[10.5px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                    >
                      <div className="flex items-center space-x-2">
                        <Plus className="w-3.5 h-3.5" />
                        <span>Workspace</span>
                      </div>
                      {isWorkspaceSectionExpanded ? (
                        <ChevronDown className="w-3.5 h-3.5" />
                      ) : (
                        <ChevronRight className="w-3.5 h-3.5" />
                      )}
                    </button>
                    
                    {isWorkspaceSectionExpanded && (
                      <div className="space-y-1 mt-1">
                        <button
                          onClick={() => {
                            setSetupStep(1);
                            setProjectName('');
                            setProjectDescription('');
                            setProjectPurpose('');
                            setSelectedTemplate('blank');
                            setShowTemplateSelector(true);
                            setIsSidebarExpanded(false);
                          }}
                          className="w-full flex items-center space-x-2 px-3 py-2 text-xs font-semibold rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5 hover:text-slate-950 dark:hover:text-white transition-all text-left"
                        >
                          <Plus className="w-3.5 h-3.5 text-blue-500" />
                          <span>Create Project</span>
                        </button>

                        {/* Previously Created Projects List */}
                        {userProjects.length > 0 && (
                          <div className="pt-2 border-t border-slate-100 dark:border-white/5 mt-2 space-y-1">
                            <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block px-3">Saved Projects</span>
                            {userProjects.map((p) => (
                              <div
                                key={p.id}
                                className="group flex items-center justify-between px-3 py-1 rounded-xl hover:bg-slate-100 dark:hover:bg-white/5 transition-all"
                              >
                                <button
                                  onClick={() => {
                                    setActiveProject(p);
                                    setProject(prev => ({ ...prev, name: p.name, messages: p.messages || [] }));
                                    setCurrentChatId(null);
                                    setShowMobileLogs(true);
                                    setIsSidebarExpanded(false);
                                  }}
                                  className="flex-1 flex items-center space-x-2.5 text-xs text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-md text-left truncate font-medium transition-all"
                                >
                                  <span className="shrink-0 text-blue-500">📁</span>
                                  <span className="truncate">{p.name}</span>
                                </button>
                                <button
                                  onClick={(e) => handleDeleteProject(p.id, e)}
                                  className="p-1 rounded-md opacity-0 group-hover:opacity-100 hover:bg-red-500/10 text-slate-400 hover:text-red-500 transition-all shrink-0"
                                  title="Delete Project"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  /* STATE 4: Workspace Info and New Project Button */
                  <div className="space-y-2 border-t border-slate-100 dark:border-white/5 pt-2">
                    <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block px-2">Current Workspace</span>
                    <div className="px-3 py-2 bg-slate-50 dark:bg-white/2 rounded-xl border border-slate-150 dark:border-white/5 flex items-center justify-between space-x-2">
                      <div className="flex items-center space-x-2 truncate flex-1">
                        <span className="text-blue-500">📁</span>
                        <span className="text-xs font-bold text-slate-800 dark:text-white truncate">{activeProject.name}</span>
                      </div>
                      <button
                        onClick={(e) => handleDeleteProject(activeProject.id, e)}
                        className="p-1 rounded-md hover:bg-red-500/10 text-slate-400 hover:text-red-500 transition-all shrink-0"
                        title="Delete Active Project"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <button
                      onClick={() => {
                        setActiveProject(null);
                        setMobileTab('chat');
                        setProject({
                          name: 'Omni Workspace',
                          description: 'An AI-powered application',
                          files: [],
                          messages: [],
                          status: 'idle'
                        });
                        setCurrentChatId(null);
                        setIsSidebarExpanded(false);
                      }}
                      className="w-full flex items-center space-x-2 px-3 py-2 text-xs font-semibold rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5 hover:text-slate-950 dark:hover:text-white transition-all text-left"
                    >
                      <LogOut className="w-3.5 h-3.5 text-slate-500" />
                      <span>Exit Project Workspace</span>
                    </button>

                    <button
                      onClick={() => {
                        setSetupStep(1);
                        setProjectName('');
                        setProjectDescription('');
                        setProjectPurpose('');
                        setSelectedTemplate('blank');
                        setShowTemplateSelector(true);
                        setIsSidebarExpanded(false);
                      }}
                      className="w-full flex items-center space-x-2 px-3 py-2 text-xs font-semibold rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5 hover:text-slate-950 dark:hover:text-white transition-all text-left"
                    >
                      <Plus className="w-3.5 h-3.5 text-blue-500" />
                      <span>Create New Project</span>
                    </button>
                  </div>
                )}

                {/* Divider for State 1 */}
                {activeProject === null && (
                  <div className="border-t border-slate-150 dark:border-white/5" />
                )}

                {/* Section 2: Recent Chats (History) - Shown in STATE 1 only */}
                {activeProject === null && (
                  <div className="flex-1 flex flex-col min-h-[200px]">
                    <div className="flex items-center justify-between px-2 pb-2 mb-2 border-b border-slate-100 dark:border-white/2 text-[10.5px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest shrink-0">
                      <button 
                        onClick={() => setIsHistorySectionExpanded(!isHistorySectionExpanded)}
                        className="flex items-center space-x-2 hover:text-slate-600 dark:hover:text-slate-300 transition-colors text-left"
                      >
                        <History className="w-3.5 h-3.5" />
                        <span>Recent Chats</span>
                        {isHistorySectionExpanded ? (
                          <ChevronDown className="w-3 h-3" />
                        ) : (
                          <ChevronRight className="w-3 h-3" />
                        )}
                      </button>

                      {activeProject === null && (
                        <button
                          onClick={() => {
                            setCurrentChatId(null);
                            chatIdRef.current = null;
                            setProject(prev => ({ ...prev, messages: [] }));
                          }}
                          className="px-2 py-0.5 rounded bg-blue-500/10 text-blue-500 hover:bg-blue-500/20 transition-colors"
                        >
                          + New Chat
                        </button>
                      )}
                    </div>

                    {isHistorySectionExpanded && (
                      <div className="flex-1 overflow-y-auto custom-scrollbar space-y-1 pr-1">
                        {historyError && (
                          <div className="mx-2 mb-2 p-2 bg-yellow-500/10 border border-yellow-500/20 rounded-xl relative">
                            <button onClick={() => setHistoryError(false)} className="absolute top-1.5 right-1.5 text-yellow-600 hover:text-yellow-800"><X className="w-3.5 h-3.5" /></button>
                            <p className="text-[10px] text-yellow-600 dark:text-yellow-400 font-medium leading-tight">⚠️ Could not load history. Create a Firestore index: chats [userId ASC, lastModified DESC]</p>
                          </div>
                        )}
                        {(() => {
                          const uniqueChats: any[] = Array.from(new Map((chatHistory as any[]).map((chat: any) => [chat.id, chat])).values());
                          if (uniqueChats.length === 0) {
                            if (!historyError) {
                              return (
                                <div className="space-y-2 px-2">
                                  {[1, 2, 3].map(i => (
                                    <div key={i} className="h-10 bg-slate-200 dark:bg-white/5 rounded-lg animate-pulse" />
                                  ))}
                                </div>
                              );
                            }
                            return <p className="text-xs text-slate-500 text-center py-4">No recent chats.</p>;
                          }
                          const sortedChats = [...uniqueChats].sort((a, b) => {
                            if (a.pinned && !b.pinned) return -1;
                            if (!a.pinned && b.pinned) return 1;
                            return 0;
                          });

                          return sortedChats.map((chat: any) => {
                            const isSelected = currentChatId === chat.id;
                            return (
                              <div 
                                key={chat.id} 
                                onClick={() => {
                                  if (isLongPressActive.current) {
                                    isLongPressActive.current = false;
                                    return;
                                  }
                                  setCurrentChatId(chat.id);
                                  setProject(prev => ({
                                    ...prev,
                                    messages: chat.messages || []
                                  }));
                                  setIsSidebarExpanded(false);
                                }}
                                className={cn(
                                  "w-full text-left px-3 py-2 rounded-xl transition-all group flex items-center justify-between gap-2 cursor-pointer select-none",
                                  isSelected 
                                    ? "bg-blue-50/50 dark:bg-blue-600/10 text-blue-600 dark:text-white font-semibold" 
                                    : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5 hover:text-slate-900 dark:hover:text-slate-200"
                                )}
                              >
                                <div className="flex items-center space-x-2.5 min-w-0 flex-1">
                                  <MessageSquare className={cn("w-4 h-4 shrink-0", isSelected ? "text-blue-500" : "text-slate-400 dark:text-slate-500")} />
                                  <p className="text-xs truncate">{chat.title || "Untitled Conversation"}</p>
                                </div>
                              </div>
                            );
                          });
                        })()}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Sidebar Footer */}
              <div className="p-4 border-t border-slate-100 dark:border-white/5 shrink-0 space-y-3">
                {/* Brain Online indicator */}
                {systemStatus && (
                  <div className="flex items-center space-x-2 px-2 pb-1.5">
                    <div className={`w-2 h-2 rounded-full ${systemStatus.brain.status === 'active' ? 'bg-green-500 shadow-[0_0_8px_#22c55e]' : 'bg-red-500'} animate-pulse`} />
                    <span className="text-[10px] text-slate-500 font-mono uppercase font-bold tracking-wider">Brain Online</span>
                  </div>
                )}

                {/* State 4 Footer vs State 1 Footer */}
                {activeProject !== null ? (
                  <button
                    onClick={() => {
                      setActiveProject(null);
                      setMobileTab('chat');
                      setProject({
                        name: 'Omni Workspace',
                        description: 'An AI-powered application',
                        files: [],
                        messages: [],
                        status: 'idle'
                      });
                      setCurrentChatId(null);
                      setIsSidebarExpanded(false);
                    }}
                    className="w-full flex items-center justify-center space-x-2.5 p-3.5 rounded-2xl bg-red-600/10 border border-red-500/10 text-red-500 font-bold hover:bg-red-600 hover:text-white transition-all text-xs"
                  >
                    <X className="w-4 h-4" />
                    <span>Exit Project</span>
                  </button>
                ) : (
                  <div className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-50/50 dark:bg-white/2 border border-slate-150 dark:border-white/5">
                    {user && (
                      <div className="flex items-center space-x-2.5 min-w-0 flex-1">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-600 to-purple-600 flex items-center justify-center text-white font-bold text-xs shadow-md shrink-0">
                          {user.email?.[0].toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-slate-800 dark:text-white truncate">{user.displayName || user.email?.split('@')[0]}</p>
                          <p className="text-[10px] text-slate-500 truncate">{user.email}</p>
                        </div>
                      </div>
                    )}
                    
                    <button 
                      onClick={() => setIsWorkspaceSettingsOpen(true)}
                      className="p-1.5 rounded-xl hover:bg-slate-200 dark:hover:bg-white/5 text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors"
                      title="Workspace Settings"
                    >
                      <SettingsIcon className="w-5 h-5" />
                    </button>
                  </div>
                )}
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Main Layout */}
      <main className="flex-1 flex flex-row-reverse overflow-hidden relative">
        
        {/* Workspace Area: Left Panel on Desktop (Only shown when activeProject is not null) */}
        {activeProject !== null && (!isMobile || mobileTab === 'preview') && (
          <section className={cn(
            "flex-1 flex flex-col relative overflow-hidden h-full",
            isMobile && mobileTab === 'preview' ? 'w-full' : 'hidden md:flex'
          )}>
            {/* Header Top Bar */}
            <header className="h-14 bg-white dark:bg-[#0F0F0F] border-b border-slate-200 dark:border-white/5 flex items-center justify-between px-6 z-10 shrink-0">
              <div className="flex items-center space-x-2">
                {/* Menu Toggle Trigger for Mobile */}
                {isMobile && (
                  <button 
                    onClick={() => setIsSidebarExpanded(true)}
                    className="p-2 mr-1 rounded-lg hover:bg-slate-100 dark:hover:bg-white/5 text-slate-600 dark:text-slate-300 transition-colors"
                    title="Expand Sidebar"
                  >
                    <Menu className="w-5 h-5" />
                  </button>
                )}

                {isMobile ? (
                  /* Mobile Navigation Tabs Toggle */
                  <div className="flex bg-slate-100 dark:bg-white/5 rounded-lg p-0.5">
                    <button 
                      onClick={() => setMobileTab('chat')}
                      className={`px-3 py-1 rounded-md text-xs font-semibold transition-all ${
                        mobileTab === 'chat' ? 'bg-white dark:bg-[#1A1A1A] text-blue-600 dark:text-white shadow-sm' : 'text-slate-500 hover:text-blue-600'
                      }`}
                    >
                      Chat
                    </button>
                    <button 
                      onClick={() => {
                        setMobileTab('preview');
                        setActiveView('editor');
                      }}
                      className={`px-3 py-1 rounded-md text-xs font-semibold transition-all ${
                        mobileTab === 'preview' && activeView === 'editor' ? 'bg-white dark:bg-[#1A1A1A] text-blue-600 dark:text-white shadow-sm' : 'text-slate-500 hover:text-blue-600'
                      }`}
                    >
                      Code
                    </button>
                    <button 
                      onClick={() => {
                        setMobileTab('preview');
                        setActiveView('preview');
                      }}
                      className={`px-3 py-1 rounded-md text-xs font-semibold transition-all ${
                        mobileTab === 'preview' && activeView === 'preview' ? 'bg-white dark:bg-[#1A1A1A] text-blue-600 dark:text-white shadow-sm' : 'text-slate-500 hover:text-blue-600'
                      }`}
                    >
                      App
                    </button>
                  </div>
                ) : (
                  /* Desktop Editor/Preview Toggles */
                  <div className="flex bg-slate-100 dark:bg-white/5 rounded-lg p-0.5">
                    <button 
                      onClick={() => setActiveView('editor')}
                      className={`px-3 py-1.5 rounded-md text-xs font-semibold flex items-center space-x-2 transition-all ${
                        activeView === 'editor' ? 'bg-white dark:bg-[#1A1A1A] text-blue-600 dark:text-white shadow-sm' : 'hover:text-blue-600 dark:hover:text-white'
                      }`}
                    >
                      <Code className="w-3.5 h-3.5" />
                      <span>Code Editor</span>
                    </button>
                    <button 
                      onClick={() => setActiveView('preview')}
                      className={`px-3 py-1.5 rounded-md text-xs font-semibold flex items-center space-x-2 transition-all ${
                        activeView === 'preview' ? 'bg-white dark:bg-[#1A1A1A] text-blue-600 dark:text-white shadow-sm' : 'hover:text-blue-600 dark:hover:text-white'
                      }`}
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>App Preview</span>
                    </button>
                  </div>
                )}
                
                {!isMobile && (
                  <span className="text-xs text-slate-500 ml-4 font-mono truncate max-w-[200px]">{project.activeFile || 'No file selected'}</span>
                )}
              </div>

              <div className="flex items-center space-x-3">
                <button 
                  onClick={() => setIsDeployModalOpen(true)}
                  className="flex items-center space-x-2 px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold transition-all shadow-lg shadow-blue-600/20"
                >
                  <Rocket className="w-3.5 h-3.5" />
                  <span>Deploy</span>
                </button>
              </div>
            </header>

            {/* Canvas Area */}
            {(!isMobile || mobileTab === 'preview') && (
              <div className="flex-1 relative bg-slate-50 dark:bg-[#0D0D0D] overflow-hidden">
                {activeView === 'editor' && project.activeFile ? (
                  <div className="h-full w-full bg-[#08080C] flex flex-col overflow-hidden relative">
                    {/* Editor toolbar */}
                    <div className="h-10 bg-[#0E0E12] border-b border-white/5 px-4 flex items-center justify-between font-mono text-[11px] select-none text-slate-400">
                      <div className="flex items-center space-x-2 truncate">
                        <Code className="w-3.5 h-3.5 text-blue-400" />
                        <span className="font-bold text-slate-200">{project.activeFile}</span>
                        <span className="text-[9px] opacity-60">({activeFileContent.length} chars)</span>
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        {saveSuccess && (
                          <span className="text-emerald-400 text-[10px] font-bold flex items-center gap-1 animate-pulse">
                            <Check className="w-3.5 h-3.5 text-emerald-500" /> Saved!
                          </span>
                        )}
                        <button
                          onClick={handleSaveFile}
                          disabled={isSavingFile}
                          className="px-3 py-1 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded text-[10px] font-bold transition-all flex items-center gap-1 shadow"
                        >
                          {isSavingFile ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <Save className="w-3 h-3" />
                          )}
                          <span>Save & Sync</span>
                        </button>
                      </div>
                    </div>

                    {/* Text editor body with line gutter */}
                    <div className="flex-1 flex font-mono text-[11px] text-slate-300 overflow-hidden relative">
                      {/* Dynamic Gutter */}
                      <div className="w-12 bg-[#0A0A0E] text-slate-600 text-right pr-2 py-4 select-none border-r border-white/5 overflow-y-hidden text-[10px] space-y-px leading-[18px]">
                        {Array.from({ length: Math.max(1, (activeFileContent || "").split('\n').length) }).map((_, i) => (
                          <div key={i}>{i + 1}</div>
                        ))}
                      </div>

                      {/* Code Input */}
                      <textarea
                        value={activeFileContent}
                        onChange={(e) => setActiveFileContent(e.target.value)}
                        className="flex-1 bg-transparent border-none outline-none focus:ring-0 p-4 font-mono text-slate-100 resize-none overflow-y-auto leading-[18px] select-text focus:outline-none placeholder-slate-600 h-full w-full"
                        placeholder="Select a file or start writing code here..."
                      />
                    </div>
                  </div>
                ) : activeView === 'editor' ? (
                  <div className="h-full w-full bg-[#08080C] flex flex-col items-center justify-center text-slate-600">
                    <Code className="w-12 h-12 mb-4 opacity-20" />
                    <p className="text-xs font-mono">Select a file to edit</p>
                  </div>
                ) : activeView === 'preview' ? (
                  <div className="h-full w-full bg-white dark:bg-[#0A0A0C] flex flex-col relative">
                    <div className="h-10 bg-white dark:bg-[#0E0E12] border-b border-slate-200 dark:border-white/5 px-4 flex items-center justify-between text-xs text-slate-500">
                      <div className="flex items-center space-x-2">
                        <Globe className="w-3.5 h-3.5 text-blue-500" />
                        <span className="font-mono">localhost:3002</span>
                      </div>
                      <button onClick={() => {
                        const iframe = document.getElementById('preview-iframe') as HTMLIFrameElement;
                        if (iframe) iframe.src = iframe.src;
                      }} className="hover:text-slate-900 dark:hover:text-white transition-colors">
                        <RefreshCw className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    {project.status === 'initializing' || project.files.length === 0 ? (
                      <div className="flex-1 flex flex-col items-center justify-center bg-[#08080C]">
                        <Landing />
                        <div className="mt-12 flex flex-col items-center">
                          <Loader2 className="w-16 h-16 text-blue-500 animate-spin opacity-50" />
                          <p className="mt-6 text-sm text-slate-400 font-mono tracking-wider">Your app is loading...</p>
                        </div>
                      </div>
                    ) : (
                      <iframe id="preview-iframe" src="http://localhost:3002" title="Preview" className="w-full flex-1 border-none bg-white" referrerPolicy="no-referrer" />
                    )}
                  </div>
                ) : null}
              </div>
            )}

            {/* Draggable & Resizable Terminal/Logs Panel (Desktop) or Tab-switch Terminal (Mobile) */}
            {(!isMobile && !isTerminalCollapsed) && (
              <div 
                style={{ height: isTerminalFullScreen ? '100%' : terminalHeight }}
                onClick={() => terminalInputRef.current?.focus()}
                className={cn(
                  "bg-[#0A0A0A] border-t border-white/5 flex flex-col font-mono relative transition-all duration-150 shrink-0",
                  isTerminalFullScreen && "absolute inset-x-0 bottom-0 top-14 h-auto z-30"
                )}
              >
                {/* Top drag handle line */}
                <div 
                  onMouseDown={(e) => {
                    e.stopPropagation(); // prevent focusing input on dragging
                    setIsResizing(true);
                  }}
                  className="absolute top-0 inset-x-0 h-1 cursor-row-resize bg-transparent hover:bg-blue-500/50 transition-colors z-20"
                />

                <div className="h-9 border-b border-white/5 px-4 flex items-center justify-between text-[10px] text-slate-500 tracking-widest uppercase">
                  <div className="flex items-center space-x-4">
                    <span className="flex items-center space-x-1 text-blue-500">
                      <TerminalIcon className="w-3 h-3" />
                      <span>Terminal Logs</span>
                    </span>
                    <span>System Status</span>
                  </div>
                  <div className="flex items-center space-x-3 normal-case font-sans">
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsTerminalFullScreen(!isTerminalFullScreen);
                      }} 
                      className="hover:text-white flex items-center"
                      title={isTerminalFullScreen ? "Restore Down" : "Maximize logs"}
                    >
                      {isTerminalFullScreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
                    </button>
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsTerminalCollapsed(true);
                      }} 
                      className="hover:text-white"
                    >
                      Collapse
                    </button>
                  </div>
                </div>
                <div className="flex-1 p-4 text-xs space-y-1.5 overflow-y-auto custom-scrollbar font-mono text-left select-text">
                  {terminalLogs.map(log => (
                    <div key={log.id} className="flex space-x-2">
                      {log.type === 'system' && <span className="text-blue-500">ℹ</span>}
                      {log.type === 'cmd' && <span className="text-green-500">$</span>}
                      {log.type === 'output' && <span className="text-slate-300"> </span>}
                      {log.type === 'error' && <span className="text-red-500">✗</span>}
                      <span className={cn(
                        log.type === 'cmd' ? "text-white font-bold" :
                        log.type === 'error' ? "text-red-400" :
                        log.type === 'system' ? "text-slate-400" : "text-slate-300"
                      )}>{log.text}</span>
                    </div>
                  ))}
                  {commandRunning && (
                    <div className="text-blue-400 flex items-center gap-1.5 font-mono">
                      <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce" />
                      <span>Executing in sandbox context...</span>
                    </div>
                  )}
                  <div ref={terminalEndRef} />
                </div>

                {/* Desktop Command Line Input Bar */}
                <div 
                  className="h-10 border-t border-white/5 bg-[#050505] px-4 flex items-center space-x-2 text-xs shrink-0"
                  onClick={(e) => e.stopPropagation()} // Let standard focus work directly on input click
                >
                  <span className="text-green-500 font-bold">omni@sandbox:~$</span>
                  <input
                    ref={terminalInputRef}
                    type="text"
                    value={terminalInput}
                    onChange={(e) => setTerminalInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleRunTerminalCommand();
                      }
                    }}
                    placeholder="Run shell command (e.g., ls, touch test.js, npm run build, help)..."
                    className="flex-1 bg-transparent border-none outline-none text-white font-mono placeholder-slate-600 focus:ring-0 text-xs"
                  />
                </div>
              </div>
            )}

            {/* Desktop Terminal Collapsed Bar */}
            {(!isMobile && isTerminalCollapsed) && (
              <div className="h-8 bg-[#0A0A0A] border-t border-white/5 px-4 flex items-center justify-between text-[10px] text-slate-500 tracking-widest uppercase shrink-0">
                <span>Terminal Collapsed</span>
                <button onClick={() => setIsTerminalCollapsed(false)} className="hover:text-white capitalize font-sans text-xs">Restore logs</button>
              </div>
            )}


          </section>
        )}

        {/* Persistent Chat Screen: Full screen on State 1 (mainly chat), otherwise side panel */}
        {(!isMobile || mobileTab === 'chat' || (activeProject !== null && mobileTab === 'terminal')) && (
          <aside className={cn(
            "bg-white dark:bg-[#0F0F0F] flex flex-col h-full shadow-2xl shrink-0 relative transition-all duration-300",
            activeProject !== null && "border-r border-slate-200 dark:border-white/5",
            activeProject === null 
              ? 'w-full flex-1' 
              : (isMobile ? 'w-full' : (isChatExpanded ? 'w-[750px] max-w-full' : 'w-[380px]'))
          )}>
            <div className="h-14 border-b border-slate-200 dark:border-white/5 flex items-center justify-between px-6 shrink-0">
              <div className="flex items-center space-x-3">
                {/* Sidebar Menu Button */}
                <button 
                  onClick={() => setIsSidebarExpanded(true)}
                  className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-white/5 text-slate-600 dark:text-slate-300 transition-colors"
                  title="Open Sidebar"
                >
                  <Menu className="w-5 h-5" />
                </button>
                
                <span className="text-xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 select-none">
                  OMNI
                </span>

                {/* Expand / Collapse Chat panel (desktop only, only if project active) */}
                {!isMobile && activeProject !== null && (
                  <button
                    onClick={() => setIsChatExpanded(!isChatExpanded)}
                    className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-white/5 text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors ml-1"
                    title={isChatExpanded ? "Collapse Chat Window" : "Expand Chat Window (Textbook Mode)"}
                  >
                    {isChatExpanded ? (
                      <Minimize2 className="w-4 h-4" />
                    ) : (
                      <Maximize2 className="w-4 h-4" />
                    )}
                  </button>
                )}
              </div>

              {isMobile && activeProject !== null && (
                /* Mobile Navigation Tabs Toggle within Chat View (Now supports Terminal!) */
                <div className="flex bg-slate-100 dark:bg-white/5 rounded-lg p-0.5">
                  <button 
                    onClick={() => setMobileTab('chat')}
                    className={`px-3 py-1 rounded-md text-xs font-semibold transition-all ${
                      mobileTab === 'chat' ? 'bg-white dark:bg-[#1A1A1A] text-blue-600 dark:text-white shadow-sm' : 'text-slate-500 hover:text-blue-600'
                    }`}
                  >
                    Chat
                  </button>
                  <button 
                    onClick={() => setMobileTab('terminal')}
                    className={`px-3 py-1 rounded-md text-xs font-semibold transition-all ${
                      mobileTab === 'terminal' ? 'bg-white dark:bg-[#1A1A1A] text-blue-600 dark:text-white shadow-sm' : 'text-slate-500 hover:text-blue-600'
                    }`}
                  >
                    Terminal
                  </button>
                  <button 
                    onClick={() => {
                      setMobileTab('preview');
                      setActiveView('editor');
                    }}
                    className={`px-3 py-1 rounded-md text-xs font-semibold transition-all ${
                      mobileTab === 'preview' && activeView === 'editor' ? 'bg-white dark:bg-[#1A1A1A] text-blue-600 dark:text-white shadow-sm' : 'text-slate-500 hover:text-blue-600'
                    }`}
                  >
                    Code
                  </button>
                  <button 
                    onClick={() => {
                      setMobileTab('preview');
                      setActiveView('preview');
                    }}
                    className={`px-3 py-1 rounded-md text-xs font-semibold transition-all ${
                      mobileTab === 'preview' && activeView === 'preview' ? 'bg-white dark:bg-[#1A1A1A] text-blue-600 dark:text-white shadow-sm' : 'text-slate-500 hover:text-blue-600'
                    }`}
                  >
                    App
                  </button>
                </div>
              )}
            </div>

            {isMobile && activeProject !== null && mobileTab === 'terminal' ? (
              /* Interactive Mobile Terminal View */
              <div 
                className="flex-1 flex flex-col bg-[#050505] text-white overflow-hidden font-mono text-left"
                onClick={(e) => {
                  // Only focus input if they didn't click on a button or link
                  if ((e.target as HTMLElement).tagName !== 'BUTTON') {
                    mobileTerminalInputRef.current?.focus();
                  }
                }}
              >
                {/* Header info bar */}
                <div className="h-8 bg-[#0D0D10] border-b border-white/5 px-4 flex items-center justify-between text-[10px] text-slate-500 tracking-wider select-none shrink-0">
                  <span>SANDBOX SHELL EXECUTOR</span>
                  <span className="text-green-500 font-bold">● ONLINE</span>
                </div>

                {/* Logs Content */}
                <div className="flex-1 p-4 font-mono text-[11px] space-y-2 overflow-y-auto custom-scrollbar text-left select-text relative">
                  {terminalLogs.map(log => (
                    <div key={log.id} className="flex space-x-2">
                      {log.type === 'system' && <span className="text-blue-500 shrink-0">ℹ</span>}
                      {log.type === 'cmd' && <span className="text-green-500 shrink-0">$</span>}
                      {log.type === 'output' && <span className="text-slate-300 shrink-0"> </span>}
                      {log.type === 'error' && <span className="text-red-500 shrink-0">✗</span>}
                      <span className={cn(
                        "break-all whitespace-pre-wrap",
                        log.type === 'cmd' ? "text-white font-bold" :
                        log.type === 'error' ? "text-red-400" :
                        log.type === 'system' ? "text-slate-400" : "text-slate-300"
                      )}>{log.text}</span>
                    </div>
                  ))}
                  {commandRunning && (
                    <div className="text-blue-400 flex items-center gap-1.5 font-mono animate-pulse">
                      <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce" />
                      <span>Running command in container...</span>
                    </div>
                  )}
                  <div ref={terminalEndRef} className="h-4" />
                </div>

                {/* Quick Touch-friendly Command Helper Chips */}
                <div 
                  className="px-4 py-2 bg-[#0A0A0B] border-t border-white/5 flex gap-2 overflow-x-auto shrink-0 custom-scrollbar select-none"
                >
                  {[
                    { label: 'List Files', cmd: 'ls -la' },
                    { label: 'Build App', cmd: 'npm run build' },
                    { label: 'Check Disk', cmd: 'df -h' },
                    { label: 'Show Node version', cmd: 'node -v' },
                    { label: 'Help', cmd: 'echo "Available helpers: ls, npm run build, node server.ts"' }
                  ].map((helper) => (
                    <button
                      key={helper.label}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRunTerminalCommand(helper.cmd);
                      }}
                      className="px-2.5 py-1 bg-white/5 hover:bg-white/10 text-[10px] font-mono text-slate-400 hover:text-white rounded border border-white/5 transition-all whitespace-nowrap active:scale-95"
                    >
                      {helper.label}
                    </button>
                  ))}
                </div>

                {/* Mobile Terminal Input Bar */}
                <div 
                  className="h-12 border-t border-white/5 bg-[#030303] px-4 flex items-center space-x-2 text-xs shrink-0 font-mono"
                >
                  <span className="text-green-500 font-bold">$</span>
                  <input
                    ref={mobileTerminalInputRef}
                    type="text"
                    value={terminalInput}
                    onChange={(e) => setTerminalInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleRunTerminalCommand();
                      }
                    }}
                    placeholder="Type command..."
                    className="flex-1 bg-transparent border-none outline-none text-white font-mono placeholder-slate-600 focus:ring-0 text-[16px] leading-none"
                    style={{ fontSize: '16px' }} // 16px prevents iOS zoom on focus
                  />
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRunTerminalCommand();
                    }}
                    disabled={!terminalInput.trim() || commandRunning}
                    className="px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded text-[10px] font-bold tracking-widest uppercase disabled:opacity-50 active:scale-95 transition-all shrink-0"
                  >
                    RUN
                  </button>
                </div>
              </div>
            ) : (
              /* Regular Chat body (Messages & inputs) */
              <>
                <div 
                  ref={chatContainerRef}
                  className={cn(
                    "flex-1 p-6 space-y-6 custom-scrollbar flex flex-col items-center",
                    project.messages.length === 0 ? "overflow-hidden" : "overflow-y-auto"
                  )} 
                  style={{ paddingBottom: isMobile && isMobileLogsOpen ? '280px' : isMobile ? '20px' : '0' }}
                >
                  <div className={cn("w-full max-w-4xl flex-1 flex flex-col justify-start space-y-6", project.messages.length === 0 && "h-full justify-center")}>
                    {project.messages.length === 0 ? (
                      /* Elegant empty screen with OmniWave logo and custom vanishing text greetings */
                      <div className="flex flex-col items-center justify-center text-center px-6 py-4 select-none space-y-8 flex-1 w-full max-w-md my-auto h-full justify-center">
                        <div className="relative shrink-0">
                          <OmniWave className="w-40 h-40" />
                          <motion.div 
                            animate={{ opacity: [0.1, 0.4, 0.1] }}
                            transition={{ duration: 3, repeat: Infinity }}
                            className="absolute inset-0 bg-gradient-to-tr from-blue-500 to-purple-500 blur-3xl rounded-full opacity-20 pointer-events-none"
                          />
                        </div>
                        
                        <div className="space-y-4 w-full">
                          <motion.h2 
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.8 }}
                            className="text-3xl font-bold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 dark:from-blue-400 dark:via-purple-400 dark:to-pink-400"
                          >
                            Hello, {user?.displayName || user?.email?.split('@')[0] || 'Developer'}
                          </motion.h2>

                          <div className="h-16 flex items-center justify-center w-full overflow-hidden">
                            <AnimatePresence mode="wait">
                              <motion.div
                                key={greetingIndex}
                                initial={{ opacity: 0, y: 4 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -4 }}
                                transition={{ duration: 0.35, ease: "easeInOut" }}
                                className="text-xs font-mono font-semibold text-slate-500 dark:text-slate-400 px-5 py-2.5 bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/5 rounded-2xl shadow-sm text-center w-full min-h-[44px] flex items-center justify-center"
                              >
                                "{greetings[greetingIndex]}"
                              </motion.div>
                            </AnimatePresence>
                          </div>
                        </div>
                      </div>
                    ) : (
                      project.messages.map((msg, mIdx) => {
                        const isLast = mIdx === project.messages.length - 1;
                        const isGenerating = isLast && project.status === 'generating';
                        const mode = msg.mode || selectedAgent;
                        
                        const showThoughts = ['thinking', 'agent', 'search', 'deep_research', 'plan', 'research'].includes(mode);
                        const showSteps = ['agent', 'research', 'plan'].includes(mode);
                        const isWebSearch = mode === 'search';
                        const isDeepResearch = mode === 'deep_research';

                        return (
                          <div key={msg.id} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                            {msg.role === 'assistant' && msg.thought && showThoughts && (
                              <MessageThoughts 
                                 thought={msg.thought} 
                                 isGenerating={isGenerating} 
                                 hasContent={msg.content !== undefined && msg.content.length > 0} 
                              />
                            )}
                          
                            {msg.role === 'assistant' && isWebSearch && isGenerating && !msg.content && (
                            <div className="w-[90%] mb-4 p-3 bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-500/20 rounded-xl">
                              <div className="flex items-center space-x-2 text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-widest animate-pulse">
                                <Globe className="w-3 h-3" />
                                <span>Scrapping & Refining Web Data...</span>
                              </div>
                              {msg.steps && msg.steps.length > 0 && (
                                <div className="mt-2 space-y-1">
                                  {msg.steps.map(s => (
                                    <div key={s.id} className="text-[9px] text-blue-500/70 flex items-center space-x-1.5">
                                      <div className="w-1 h-1 bg-blue-400 rounded-full" />
                                      <span>{s.label}</span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}

                            {msg.role === 'assistant' && isDeepResearch && isGenerating && !msg.content && (
                            <div className="w-[90%] mb-4 p-4 bg-indigo-50 dark:bg-indigo-900/10 border border-indigo-100 dark:border-indigo-500/20 rounded-xl">
                              <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center space-x-2 text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-widest">
                                  <Search className="w-3 h-3" />
                                  <span>Deep Research in Progress...</span>
                                </div>
                                <span className="text-[9px] text-indigo-400 font-mono">Est: 15-30s</span>
                              </div>
                              <div className="w-full h-1 bg-indigo-200 dark:bg-indigo-900/50 rounded-full overflow-hidden">
                                <motion.div 
                                  initial={{ width: "0%" }}
                                  animate={{ width: "95%" }}
                                  transition={{ duration: 25, ease: "linear" }}
                                  className="h-full bg-indigo-500"
                                />
                              </div>
                              {msg.steps && msg.steps.length > 0 && (
                                <div className="mt-3 space-y-1.5">
                                  {msg.steps.map(s => (
                                    <div key={s.id} className="text-[10px] text-indigo-500/70 flex items-center space-x-2">
                                      <div className={cn("w-1.5 h-1.5 rounded-full", s.status === 'running' ? "bg-indigo-500 animate-pulse" : "bg-indigo-300")} />
                                      <span>{s.label}</span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                          
                            {msg.role === 'assistant' && msg.steps && msg.steps.length > 0 && showSteps && (
                              <CollapsibleStepsContainer 
                                steps={msg.steps} 
                                isGeneratingOrExecuting={isGenerating || (isLast && project.status === 'executing')} 
                              />
                            )}

                            {msg.role === 'assistant' && msg.error && (
                              <div className="w-[95%] sm:w-[90%] border border-red-200/60 dark:border-red-950/40 rounded-2xl bg-red-50/50 dark:bg-red-950/10 p-4 mb-4 transition-all flex items-start space-x-3 text-xs text-red-600 dark:text-red-400">
                                <span className="text-sm shrink-0">⚠️</span>
                                <div className="space-y-1 flex-1">
                                  <div className="font-semibold text-red-700 dark:text-red-300">Execution Error Encountered</div>
                                  <div className="font-mono text-[11px] leading-relaxed break-all whitespace-pre-wrap">{msg.error}</div>
                                </div>
                              </div>
                            )}

                            <div className={cn(
                              "text-sm leading-relaxed text-left transition-all w-full max-w-full",
                              msg.role === 'user' 
                                ? "p-4 rounded-2xl bg-blue-600 text-white rounded-tr-none shadow-sm shadow-blue-600/10 font-medium max-w-[85%] ml-auto" 
                                : "bg-transparent text-slate-800 dark:text-slate-200 py-4"
                            )}>
                            <TextbookMessageContent 
                              content={msg.content} 
                              suggestions={msg.suggestions} 
                              onSelectSuggestion={(sug) => {
                                setChatInput(sug);
                                // Select model and send
                                setTimeout(() => {
                                  const btn = document.getElementById("send-chat-btn");
                                  if (btn) {
                                    btn.click();
                                  } else {
                                    // Fallback send trigger
                                    handleSendMessage();
                                  }
                                }, 150);
                              }}
                              role={msg.role}
                            />
                            {msg.role === 'assistant' && msg.content && (
                              <div className="flex items-center justify-between mt-4 text-slate-400 dark:text-slate-500 w-full pt-2 border-t border-transparent group-hover:border-slate-100 dark:group-hover:border-white/5 transition-colors">
                                {/* Model Identity Badge */}
                                <div className="flex items-center space-x-2">
                                  {msg.modelId ? (
                                    <div className="flex items-center space-x-1.5 flex-wrap gap-y-1">
                                      <div className="flex items-center space-x-1.5 px-2 py-0.5 rounded-full bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/5 font-mono text-[9px] font-bold text-slate-500 shadow-sm cursor-help transition-all hover:bg-slate-200 dark:hover:bg-white/10" title={`Model: ${msg.modelId}\nPlatform: ${msg.providerPlatform}`}>
                                        <Cpu className="w-3 h-3 text-blue-500" />
                                        <span className="uppercase tracking-wider">
                                          {msg.providerName || (msg.modelId.includes('gemini') ? 'GOOGLE' : 'AI MODEL')}
                                        </span>
                                      </div>
                                      {msg.latency && (
                                        <div className="text-[9px] font-mono font-bold text-blue-500 bg-blue-500/5 dark:bg-blue-500/10 px-2 py-0.5 rounded-full border border-blue-500/10">
                                          ⚡ {msg.latency}ms
                                        </div>
                                      )}
                                      <div className={`text-[9px] font-mono font-bold px-2 py-0.5 rounded-full border ${msg.byok ? 'text-green-500 bg-green-500/5 dark:bg-green-500/10 border-green-500/15' : 'text-purple-500 bg-purple-500/5 dark:bg-purple-500/10 border-purple-500/15'}`}>
                                        {msg.byok ? "BYOK key" : "Shared Mesh key"}
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="flex items-center space-x-1.5 px-2 py-0.5 rounded-full bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/5 font-mono text-[9px] font-bold text-slate-500 shadow-sm">
                                      <Zap className="w-3 h-3 text-purple-500" />
                                      <span className="uppercase tracking-wider">OMNI CORE</span>
                                    </div>
                                  )}
                                  {/* Read-Only Badge */}
                                  <div className="hidden group-hover:flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-widest text-slate-400 bg-slate-100 dark:bg-white/5 transition-all">
                                    READ-ONLY
                                  </div>
                                </div>

                                <div className="flex items-center space-x-2 opacity-50 group-hover:opacity-100 transition-opacity">
                                  <button 
                                    onClick={() => handleMessageFeedback(msg.id, 'up', msg.content)}
                                    className={cn(
                                      "p-1.5 rounded-md transition-all", 
                                      (msg.feedback === 'up' || messageFeedbacks[msg.id] === 'up') ? "bg-green-500/20 text-green-500 scale-110" : "hover:bg-slate-100 dark:hover:bg-white/10"
                                    )} 
                                    title="Good response"
                                  >
                                    <ThumbsUp className="w-4 h-4" />
                                  </button>
                                  <button 
                                    onClick={() => handleMessageFeedback(msg.id, 'down', msg.content)}
                                    className={cn(
                                      "p-1.5 rounded-md transition-all", 
                                      (msg.feedback === 'down' || messageFeedbacks[msg.id] === 'down') ? "bg-red-500/20 text-red-500 scale-110" : "hover:bg-slate-100 dark:hover:bg-white/10"
                                    )} 
                                    title="Bad response"
                                  >
                                    <ThumbsDown className="w-4 h-4" />
                                  </button>
                                  <button className="p-1.5 hover:bg-slate-100 dark:hover:bg-white/10 rounded-md transition-colors flex items-center space-x-1" title="Regenerate response" onClick={() => {
                                    // Simple retry logic: resend the last prompt if it's the last message
                                    const msgs = project.messages;
                                    const myIdx = msgs.findIndex(m => m.id === msg.id);
                                    if (myIdx > 0 && myIdx === msgs.length - 1) {
                                      const lastUserMsg = msgs[myIdx - 1];
                                      if (lastUserMsg && lastUserMsg.role === 'user') {
                                         // Remove both the user message and the assistant message to prevent duplication
                                         setProject(prev => ({...prev, messages: prev.messages.slice(0, prev.messages.length - 2)}));
                                         setTimeout(() => {
                                            setChatInput(lastUserMsg.content);
                                            setTimeout(() => {
                                              const btn = document.getElementById("send-chat-btn");
                                              if (btn) btn.click();
                                            }, 100);
                                         }, 100);
                                      }
                                    }
                                  }}>
                                    <RotateCcw className="w-4 h-4" />
                                  </button>
                                </div>
                              </div>
                            )}
                            </div>
                          </div>
                        )
                      })
                    )}
                    {project.status === 'generating' && project.messages[project.messages.length - 1]?.thought === '' && (
                      <div className="flex justify-start">
                        <div className="bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 p-4 rounded-2xl rounded-tl-none">
                          <div className="flex items-center space-x-3">
                            <div className="flex space-x-1">
                              <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce" />
                              <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce [animation-delay:0.2s]" />
                              <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce [animation-delay:0.4s]" />
                            </div>
                            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                              {selectedAgent === 'agent' ? "Building..." : 
                               activeTool === 'learn' ? "Teaching..." : 
                               activeTool === 'study' ? "Course Planning..." : 
                               activeTool === 'deep_research' ? "Deep Researching..." : 
                               activeTool === 'search' ? "Searching Web..." : 
                               activeTool === 'plan' ? "Planning Steps..." :
                               activeTool === 'research' ? "Technical Research..." :
                               "Thinking..."}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}
                    {project.status === 'executing' && (
                      <div className="flex justify-start">
                        <div className="bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-500/20 p-4 rounded-2xl rounded-tl-none">
                          <div className="flex items-center space-x-3">
                            <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />
                            <span className="text-xs font-semibold text-blue-600 dark:text-blue-400">
                              Autonomous Agent actively executing workspace updates...
                            </span>
                          </div>
                        </div>
                      </div>
                    )}
                    <div ref={chatEndRef} className="h-2" />
                  </div>
                </div>
                
                <div className={cn("px-6 pt-0 shrink-0 w-full flex flex-col items-center", isMobile && activeProject !== null && showMobileLogs ? "pb-[55px]" : "pb-2.5")}>
                  <div className="w-full max-w-4xl">
                    {/* Model mode toggle (Agent, Fast, Thinking) stays above the input box */}
                    <div className="flex items-center justify-between mb-2 px-1">
                      <div className="flex items-center bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-full p-0.5 shadow-sm max-w-full overflow-x-auto custom-scrollbar">
                        {activeProject !== null && (
                          <button
                            onClick={() => setSelectedAgent('agent')}
                            className={cn(
                              "flex items-center space-x-1.5 px-3 py-1 rounded-full text-[10px] font-mono font-bold transition-all shrink-0",
                              selectedAgent === 'agent' ? "bg-white dark:bg-[#1A1A1A] text-blue-600 dark:text-blue-400 shadow-sm" : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"
                            )}
                          >
                            <Bot className="w-3 h-3" />
                            <span>Agent</span>
                          </button>
                        )}
                        <button
                          onClick={() => setSelectedAgent('fast')}
                          className={cn(
                            "flex items-center space-x-1.5 px-3 py-1 rounded-full text-[10px] font-mono font-bold transition-all shrink-0",
                            selectedAgent === 'fast' ? "bg-white dark:bg-[#1A1A1A] text-emerald-600 dark:text-emerald-400 shadow-sm" : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"
                          )}
                        >
                          <Zap className="w-3 h-3" />
                          <span>Fast</span>
                        </button>
                        <button
                          onClick={() => setSelectedAgent('thinking')}
                          className={cn(
                            "flex items-center space-x-1.5 px-3 py-1 rounded-full text-[10px] font-mono font-bold transition-all shrink-0",
                            selectedAgent === 'thinking' ? "bg-white dark:bg-[#1A1A1A] text-amber-600 dark:text-amber-400 shadow-sm" : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"
                          )}
                        >
                          <Cpu className="w-3 h-3" />
                          <span>Thinking</span>
                        </button>
                      </div>
                    </div>

                    {/* Elegant input box with embedded toolbars */}
                    {/* Elegant input box with embedded toolbars */}
                    <div className="bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl p-2.5 focus-within:border-blue-500/50 transition-all flex flex-col relative group">
                      <textarea 
                        ref={inputRef}
                        rows={2}
                        value={chatInput}
                        onChange={(e) => setChatInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            if (project.status !== 'generating' && project.status !== 'executing') {
                              handleSendMessage();
                            }
                          }
                        }}
                        placeholder={project.status === 'generating' ? "Generating code..." : project.status === 'executing' ? "Executing tasks..." : "Ask Omni to build something..."}
                        disabled={project.status === 'generating' || project.status === 'executing'}
                        className="w-full bg-transparent border-none px-3.5 py-2 text-sm focus:outline-none resize-none custom-scrollbar text-slate-900 dark:text-white pb-12 disabled:opacity-60"
                      />


                      {/* Integrated footer inside input box */}
                      <div className="absolute bottom-2.5 inset-x-2.5 flex items-center justify-between">
                        {/* Left: Toggles & Selections */}
                        <div className="flex items-center space-x-1.5">
                          {/* Workspace Tools Menu */}
                          {activeProject !== null && selectedAgent === 'agent' && (
                            <button
                              onClick={() => setIsToolsMenuOpen(true)}
                              className="p-1.5 rounded-xl bg-white dark:bg-[#1E1E1F] hover:bg-slate-50 dark:hover:bg-[#2D2D2E] border border-slate-200 dark:border-white/5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-all shadow-sm flex items-center justify-center h-7"
                              title="Tools"
                            >
                              <SettingsIcon className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {/* Modes Button */}
                          <button
                            onClick={() => setIsToolSheetOpen(true)}
                            className={cn(
                              "flex items-center space-x-1.5 px-3 py-1.5 border rounded-xl text-[10.5px] font-mono font-bold transition-all shadow-sm h-7",
                              activeTool !== 'none' 
                                ? "bg-blue-600 text-white border-blue-500 shadow-blue-500/20" 
                                : "bg-white dark:bg-[#1E1E1F] text-slate-500 dark:text-slate-400 border-slate-200 dark:border-white/5 hover:bg-slate-50 dark:hover:bg-[#2D2D2E]"
                            )}
                            title="Select AI Mode"
                          >
                            <Search className={cn("w-3 h-3", activeTool !== 'none' ? "text-white" : "text-blue-500")} />
                            <span>{activeTool === 'none' ? 'Modes' : activeTool.replace('_', ' ').toUpperCase()}</span>
                            <ChevronDown className={cn("w-3 h-3", activeTool !== 'none' ? "text-white/70" : "text-slate-400")} />
                          </button>

                          {/* Model Selection Button */}
                          <button
                            onClick={() => setIsModelModalOpen(true)}
                            className="flex items-center space-x-1.5 px-2.5 py-1.5 bg-white dark:bg-[#1E1E1F] hover:bg-slate-50 dark:hover:bg-[#2D2D2E] border border-slate-200 dark:border-white/5 rounded-xl text-[10.5px] font-mono font-bold text-slate-500 dark:text-slate-400 transition-all shadow-sm"
                            title="Click to switch intelligence model"
                          >
                            <Cpu className="w-3 h-3 text-blue-500 shrink-0" />
                            <span className="text-blue-600 dark:text-blue-400 truncate max-w-[90px]">
                              {selectedModel.replace('omni-', '')}
                            </span>
                            <ChevronDown className="w-3 h-3 text-slate-400" />
                          </button>
                        </div>

                        {/* Right: Send / Stop button */}
                        <div>
                          {project.status === 'generating' ? (
                            <button 
                              onClick={handleStopGeneration}
                              className="p-1.5 bg-red-600 hover:bg-red-500 text-white rounded-xl transition-all shadow-md shrink-0"
                              title="Stop generating"
                            >
                              <Square className="w-3.5 h-3.5 fill-white text-white" />
                            </button>
                          ) : project.status === 'executing' ? (
                            <button 
                              disabled
                              className="p-1.5 bg-blue-600/50 text-white rounded-xl transition-all shrink-0 cursor-not-allowed"
                              title="Executing workspace updates..."
                            >
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            </button>
                          ) : (
                            <button 
                              id="send-chat-btn"
                              onClick={handleSendMessage}
                              disabled={!chatInput.trim()}
                              className="p-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-xl transition-all shadow-md shrink-0"
                              title="Send message"
                            >
                              <ChevronRight className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}
          </aside>
        )}
      </main>

      {/* Mobile Swipe-Up Logs Bottom Sheet */}
      {isMobile && activeProject !== null && showMobileLogs && (
        <motion.div
          animate={{ height: isMobileLogsOpen ? "280px" : "40px" }}
          transition={{ type: "spring", damping: 20, stiffness: 180 }}
          className="fixed bottom-0 inset-x-0 bg-[#0A0A0B] border-t border-white/10 z-40 flex flex-col overflow-hidden shadow-2xl rounded-t-2xl select-none"
        >
          {/* Header handle / drag bar to toggle */}
          <div 
            onClick={() => setIsMobileLogsOpen(!isMobileLogsOpen)}
            className="h-10 border-b border-white/5 px-4 flex items-center justify-between text-[10px] text-slate-400 tracking-widest uppercase cursor-pointer shrink-0"
          >
            <div className="flex items-center space-x-2">
              <TerminalIcon className="w-3.5 h-3.5 text-blue-500 animate-pulse" />
              <span className="font-bold">System Build Logs</span>
            </div>
            
            <div className="flex items-center space-x-2">
              <span className="text-[9px] px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 font-bold tracking-widest">LIVE</span>
              <motion.div
                animate={{ rotate: isMobileLogsOpen ? 180 : 0 }}
                transition={{ duration: 0.2 }}
              >
                <ChevronDown className="w-4 h-4 text-slate-400" />
              </motion.div>
              
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  setShowMobileLogs(false);
                }}
                className="p-1 rounded-md hover:bg-white/10 text-slate-400 hover:text-white transition-all ml-1.5"
                title="Hide logs panel"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Logs scroll area */}
          <div className="flex-1 p-4 font-mono text-xs space-y-2 overflow-y-auto custom-scrollbar text-left text-slate-300">
            <div className="flex space-x-2">
              <span className="text-green-500">✓</span>
              <span className="text-slate-400">Environment initialized on port 3000.</span>
            </div>
            {systemStatus && (
              <div className="flex space-x-2">
                <span className="text-blue-500">ℹ</span>
                <span className="text-slate-400">OmniBrain {systemStatus.brain.status}</span>
              </div>
            )}
            <div className="flex space-x-2">
              <span className="text-slate-600">[{new Date().toLocaleTimeString()}]</span>
              <span className="text-white">Mobile sandboxing active. Swiped up sheet enabled.</span>
            </div>
          </div>
        </motion.div>
      )}

      {/* Error Modals */}
      <ErrorModal 
        type={errorType} 
        onClose={() => setErrorType(null)} 
        onRetry={() => {
          setErrorType(null);
          handleSendMessage();
        }}
      />
    </div>
  );
}

function MessageThoughts({ thought, isGenerating, hasContent }: { thought: string, isGenerating?: boolean, hasContent?: boolean }) {
  const [isOpen, setIsOpen] = useState(false);
  
  // Auto-expand/collapse logic
  useEffect(() => {
    if (isGenerating && thought.length > 0 && !hasContent) {
      setIsOpen(true);
    } else if (hasContent) {
      setIsOpen(false);
    }
  }, [isGenerating, thought, hasContent]);

  return (
    <div className="w-[90%] mb-2">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-widest cursor-pointer hover:text-blue-500 dark:hover:text-blue-400 transition-colors flex items-center space-x-1 focus:outline-none"
      >
        <motion.div
          animate={{ rotate: isOpen ? 90 : 0 }}
          transition={{ duration: 0.2 }}
        >
          <ChevronRight className="w-3 h-3" />
        </motion.div>
        <span>
           {isGenerating && !hasContent && thought.length > 0 ? "Thinking..." : "View Thought Process"}
        </span>
      </button>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="mt-2 p-3 bg-slate-50 dark:bg-white/5 border border-slate-150 dark:border-white/5 rounded-xl text-[11px] text-slate-500 dark:text-slate-400 font-mono leading-relaxed italic text-left">
              {thought}
              {isGenerating && !hasContent && <span className="animate-pulse">_</span>}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function NavIcon({ icon: Icon, active, onClick, label }: any) {
  return (
    <button 
      onClick={onClick}
      title={label}
      className={cn(
        "p-3 rounded-xl transition-all duration-200 group relative",
        active 
          ? "bg-slate-100 dark:bg-white/5 text-blue-600 dark:text-white shadow-[0_0_20px_rgba(255,255,255,0.05)]" 
          : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/5"
      )}
    >
      <Icon className="w-5 h-5" />
      {active && (
        <motion.div 
          layoutId="nav-glow" 
          className="absolute -left-3 w-1 h-6 bg-blue-500 rounded-full shadow-[0_0_10px_#3b82f6]" 
        />
      )}
    </button>
  );
}

function FileItem({ node, level, onSelect }: { node: FileNode, level: number, onSelect: (path: string) => void }) {
  const [isOpen, setIsOpen] = useState(false);
  const Icon = node.type === 'directory' ? (isOpen ? ChevronDown : ChevronRight) : Code;

  const handleClick = () => {
    if (node.type === 'directory') {
      setIsOpen(!isOpen);
    } else {
      onSelect(node.path);
    }
  };

  return (
    <div className="select-none">
      <div 
        onClick={handleClick}
        className="flex items-center space-x-2 py-2 px-2 rounded-lg hover:bg-slate-100 dark:hover:bg-white/5 cursor-pointer transition-colors group"
        style={{ paddingLeft: `${level * 16 + 8}px` }}
      >
        <Icon className={cn(
          "w-4 h-4 transition-colors",
          node.type === 'directory' ? "text-slate-500 group-hover:text-slate-400" : "text-blue-500/60 group-hover:text-blue-500"
        )} />
        <span className="text-[13px] font-medium text-slate-600 dark:text-slate-400 group-hover:text-slate-900 dark:group-hover:text-slate-100 transition-colors truncate">{node.name}</span>
      </div>
      <AnimatePresence>
        {node.type === 'directory' && isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            {node.children?.map((child, i) => (
              <div key={`${node.path}-${child.name}-${i}`}>
                <FileItem node={child} level={level + 1} onSelect={onSelect} />
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
