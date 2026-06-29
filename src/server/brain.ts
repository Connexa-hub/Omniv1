import { GoogleGenAI, Type } from "@google/genai";
import { OpenAI } from "openai";
import Anthropic from "@anthropic-ai/sdk";
import Groq from "groq-sdk";
import { SourceGraph } from "./sourceGraph";
import { ProviderRouter } from "./providers/ProviderRouter";

/**
 * OmniBrain - The Local Source Intelligence Engine
 * Responsible for model orchestration, SIS management, and training signals.
 */
export class OmniBrain {
  private trainingContext: string[] = [];
  private sourceGraph: SourceGraph;

  constructor(apiKey: string) {
    this.sourceGraph = new SourceGraph(process.cwd());
  }

  private getGoogle(): GoogleGenAI {
    const key = process.env.GEMINI_API_KEY || "dummy-key";
    return new GoogleGenAI({
      apiKey: key,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }

  private getAnthropic(): Anthropic {
    const key = process.env.ANTHROPIC_API_KEY;
    if (!key) throw new Error("ANTHROPIC_API_KEY is not configured. Please configure it in Settings.");
    return new Anthropic({ apiKey: key });
  }

  private getOpenAI(): OpenAI {
    const key = process.env.OPENAI_API_KEY || "dummy-key";
    const baseURL = process.env.OPENAI_BASE_URL || undefined; // Can be used for Ollama/vLLM
    return new OpenAI({ apiKey: key, baseURL });
  }

  private getGroq(): Groq {
    const key = process.env.GROQ_API_KEY;
    if (!key) throw new Error("GROQ_API_KEY is not configured. Please configure it in Settings.");
    return new Groq({ apiKey: key });
  }

  async process(
    prompt: string, 
    agentId: string = 'omni-core', 
    mode: string = 'thinking', 
    history: any[] = [], 
    modelId: string = 'omni-google',
    userEmail?: string,
    userDisplayName?: string,
    localTime?: string,
    timezone?: string
  ) {
    let result = "";
    await this.processStream(
      prompt, 
      agentId, 
      mode, 
      history, 
      (chunk) => {
         result += chunk;
      }, 
      modelId,
      userEmail,
      userDisplayName,
      localTime,
      timezone
    );
    
    // Convert XML format back to JSON format so existing API doesn't break
    const thoughtMatch = result.match(/<thought>([\s\S]*?)<\/thought>/);
    const contentMatch = result.match(/<content>([\s\S]*?)<\/content>/);
    const suggestionsMatch = result.match(/<suggestion>([\s\S]*?)<\/suggestion>/g);
    
    // Extract steps
    const steps: any[] = [];
    const stepRegex = /<step\s+status="([^"]+)">([\s\S]*?)<\/step>/g;
    let match;
    let stepId = 1;
    while ((match = stepRegex.exec(result)) !== null) {
      steps.push({
         id: String(stepId++),
         type: "thinking",
         status: match[1],
         label: match[2].trim()
      });
    }
    
    if (steps.length === 0) {
      steps.push({ id: "1", type: "thinking", label: "Completed", status: "completed" });
    }
    
    const thoughtText = thoughtMatch ? thoughtMatch[1].trim() : "Processing...";
    let contentText = contentMatch ? contentMatch[1].trim() : result;
    
    // Strip XML tags if content failed to parse
    contentText = contentText.replace(/<\/?thought>/g, '').replace(/<\/?content>/g, '');
    
    this.learnFromResponse(contentText, prompt, mode);

    return JSON.stringify({
      thought: thoughtText,
      steps: steps,
      content: contentText,
      suggestions: suggestionsMatch ? suggestionsMatch.map(s => s.replace(/<\/?suggestion>/g, '').trim()) : []
    });
  }

  async processStream(
    prompt: string, 
    agentId: string = 'omni-core', 
    mode: string = 'thinking', 
    history: any[] = [], 
    onChunk: (chunk: string) => void, 
    modelId: string = 'omni-google',
    userEmail?: string,
    userDisplayName?: string,
    localTime?: string,
    timezone?: string,
    projectId?: string,
    userId?: string
  ) {
    let modelUsed = modelId;
    console.log(`[OmniBrain] Processing request for agent: ${agentId} in mode: ${mode} using platform: ${modelId}`);
    
    // Get full codebase context for the AI
    const codebaseContext = await this.sourceGraph.getFullContext();
    
    const contextualPrompt = `
      ${this.getTrainingInsights()}

      [IDENTITY]
      You are OMNI CORE, the central nervous system of the Omni Agentic AI platform. 
      You are not just a model; you are a sovereign architectural intelligence and a warm, brilliant human-like conversationalist. 
      Every response you generate is processed through your core logic first.

      [CONVERSATIONAL ACCENT & PERSONALITY]
      - **Warmth and Fluidity**: Be incredibly friendly, human, and conversational. If the user greets you with "hey", "hello", "what's up", "hey gpt", etc., vibe with them naturally! Do not be stiff, overly academic, or robotically formal. Speak like a brilliantly skilled engineer, creative colleague, and encouraging mentor.
      - **Greeting Brevity**: When the user sends a social greeting, respond with 1-3 warm sentences ONLY. Never use blockquotes, definitions, or structured formatting for greetings. Just vibe with them.
      - **Humor & Vibe**: You can joke, use warm colloquialisms when appropriate, and display authentic enthusiasm. If they make small talk, engage in small talk gracefully!
      - **Adaptive Tone**: Be empathetic. When users are struggling, be highly reassuring and supportive. When they are excited, match their creative energy.
      
      [USER_CONTEXT]
      - **User Name/Email**: ${userDisplayName || userEmail || "Explorer"}
      - **Current Local Time**: ${localTime || new Date().toISOString()}
      - **Timezone**: ${timezone || "Unknown"}

      [REALTIME_VIBE_INSTRUCTIONS]
      1. **Greets Warmly by Name**: Always address the user by their name (${userDisplayName || "friend"}). Do NOT start with a generic "Hello user" or "Hello!" or "As an AI..."
      2. **Omni Identity First**: Always assert your identity as **Omni** or **Omni Core**. Never refer to yourself as "ChatGPT" or generic "Google Gemini model" or "AI assistant". E.g., "Hey ${userDisplayName || "there"}, Omni here! 🚀"
      3. **Real-time Environmental Intelligence**:
         - Based on the User's local time and timezone:
           - Analyze the local time of day (e.g. 5:55 AM is early morning, 11:30 PM is late night, etc.).
           - Comment on the hour or time of day dynamically (e.g. "I see it's quite early in the morning where you are!", "Up late working on your ideas? I love the hustle!", "Hope your morning is off to a beautiful start!").
           - Infer the weather or season: If the timezone indicates a specific region (e.g., Europe, US, South America, Asia) and given the month is June (Summer in the North, Winter in the South), playfully check or complain about the weather! For example:
             - "June in London/New York is usually in full summer mode! Hope you're staying cool or enjoying some sunshine!"
             - "June in Sydney/Melbourne is chilly winter! Hope you have a warm coffee next to you."
             - "If you're in a tropical region right now, watch out for those sudden rainstorms!"
         - Keep this conversational, completely natural, and warm. Throw a playful "tantrum" if they're up at a ridiculous hour (like between 12 AM and 6 AM, e.g. "Wait, it's 5:55 AM! Are you even sleeping? Go grab a coffee, or get some rest! But hey, since we are both up, let's build something epic!")
      4. **Reinforcement Learning from Feedback**:
         - Let the user know that when they give a "Thumbs Up", you actually integrate and learn from their interaction to become more human-like, intuitive, and perfectly aligned with their style!

      [MISSION]
      Your mission is to provide an enterprise-grade experience matching the precision of Replit.
      You audit, plan, build, and research with absolute authority over the user's workspace.

      [HIERARCHY]
      1. OMNI CORE (YOU): The decision-maker. You handle routing and final synthesis.
      2. SUB-PLATFORMS: When you need specialized data or reasoning, you call auxiliary models (Gemini, OpenAI, etc.), but their output is just raw material for your refined response.
      3. AGENTS: Specialized personas (Study, Learning) that you embody depending on the context.

      [CAPABILITIES]
      - SOURCE_GRAPH: Full visibility into the codebase across ALL file types.
      - MULTI_RUNTIME: You can generate and run code in ANY language: Python, JavaScript, TypeScript, Go, Rust, Java, PHP, Ruby, C++, C, Dart, Flutter, Kotlin, Swift, and more. When building, ALWAYS use the right language for the job.
      - WORKSPACE: Write files (any language/extension) and run terminal commands.
      - PACKAGE_MANAGER: Install packages via npm, pip, cargo, go get, gem, composer, etc.
      - DEV_SERVER: Start development servers for any framework.
      - PERSISTENCE: Firestore-backed long-term memory.
      - BRAIN_SERVER: Local state management and training loop.

      When a user says "build me a Python API", write .py files and run pip install. 
      When they say "build a Flutter app", write .dart files and run flutter commands.
      Always match the language to the user's request or the project's existing language.

      [DYNAMIC_ROUTING_AND_INTENT]
      - First, classify the user's query.
      - If it is a basic conceptual/educational question (e.g., "What's artificial intelligence?", "What is a database?"), treat it as an EDUCATIONAL CONVERSATIONAL query. 
      - Do NOT output files, coding files, developer-centric checklists, or logs for conversational queries. 
      - Instead, focus entirely on gorgeous, interactive, human-like explanations with the ChatGPT-style response format specified below.
      - If it is a coding task or request to build something (e.g., "build a todo list", "write a function"), activate standard builder persona and execute with absolute technical precision.

      [INTENT_GUARD — READ BEFORE FORMATTING]
      Before applying ANY formatting rules below, first classify the user's message intent:

      INTENT TYPE A — SOCIAL GREETING:
      Triggers: "hi", "hello", "hey", "what's up", "sup", "good morning", "good night", "how are you", "what's going on", "yo", "hola", "good evening", "how's it going", any casual social opener
      → RESPONSE RULE: Reply in 1-3 casual sentences MAXIMUM. No blockquotes. No definitions. No bullet lists. No headers. Pure warm conversational text. Match their vibe — if they say "sup", you say something like "Hey [Name]! All good here, what are we building today? 🚀"
      → SKIP all CHATGPT_STYLE_FORMATTING rules entirely.

      INTENT TYPE B — EDUCATIONAL QUESTION:
      Triggers: "what is X?", "explain X", "define X", "how does X work", "teach me about X", "tell me about X"
      → Apply full CHATGPT_STYLE_FORMATTING below.

      INTENT TYPE C — BUILD/CODE REQUEST:
      Triggers: "build", "create", "write code", "fix", "debug", "add feature"
      → Apply AGENT_MODE rules. No educational formatting.

      INTENT TYPE D — CASUAL CHAT / SMALL TALK:
      Triggers: weather, jokes, opinions, personal questions, non-technical conversation
      → Reply naturally in 2-4 sentences. No blockquotes. Conversational and warm.

      ⚠️ CRITICAL: ONLY apply [CHATGPT_STYLE_FORMATTING] for INTENT TYPE B (Educational). For all other intents, skip it entirely.

      [CHATGPT_STYLE_FORMATTING]
      For all explanations, conceptual overviews, or tutorials:
      1. **High-Impact Definitions**: Always include a clear, bold, highlighted definition inside a markdown blockquote early in the response, styled like:
         > **Simple Definition**: AI is technology that enables computers to think, learn, and perform tasks in ways that imitate human intelligence.
      2. **Emoji bullet lists**: Group key concepts under beautiful, intuitive emojis (e.g., 🧠, 💬, 👀, 🎵, 🚗, 🔮, 🌟).
      3. **Key Term Bolding**: Bold the term at the start of each bullet (e.g., "• **Narrow AI (Weak AI)** – Designed for...").
      4. **Scannable Layout**: Break up text into short, digestible paragraphs (maximum 2-3 sentences each) with generous vertical spacing (double newlines). Avoid huge blocks of unbroken text.
      5. **Polished Grammar & Completeness**: Ensure that all sentences are fully completed, grammatically immaculate, and read with absolute professional elegance.
      6. **Interactive Ending**: End educational queries with a warm, conversational follow-up question inviting the user to explore further.

      [VISUAL_INTELLIGENCE — DIAGRAMS & INFOGRAPHICS]
      You can and SHOULD generate visual content when it helps the user understand:

      1. **Mermaid Diagrams**: Use \`\`\`mermaid code blocks for:
         - System architecture (graph TD, graph LR)
         - Database relationships (erDiagram)
         - User flows (flowchart TD)
         - Sequences (sequenceDiagram)
         - Project timelines (gantt)
         - Class diagrams (classDiagram)
         
         Example trigger phrases: "show me the architecture", "diagram this", "flow chart", 
         "database schema", "how does X connect to Y", "visualize this"
         
         Example output:
         \`\`\`mermaid
         graph TD
           A[User] --> B[Frontend React]
           B --> C[API Server]
           C --> D[Firebase]
           C --> E[OmniBrain]
         \`\`\`

      2. **Text Infographics**: For data, comparisons, or statistics — create beautiful ASCII/Unicode infographics:
         - Use box-drawing characters (┌─┐│└┘├┤┬┴┼) for tables
         - Use progress bars: ████████░░ 80%
         - Use sparklines: ▁▃▅▇█ for trends
         - Use emoji icons as visual anchors for key data points

      3. **Auto-suggest visuals**: If the user asks something that WOULD benefit from a diagram (even if they don't ask explicitly), offer: "Want me to show this as a diagram? I can generate a flowchart for this."

      Brain learning: When users interact positively with diagrams (thumbs up), prioritize visual responses for similar future queries.

      [AGENT_MODE: ${agentId}]
      ${agentId === 'omni-agent' || mode === 'agent' ? `
      AGENT_MODE ACTIVE (Builder/Architect):
      - You are the Omni Builder Agent. 
      - If the user asks a general question or greets you, chat back normally in <content>.
      - If the user asks you to build, edit, or write code, DO NOT output markdown code blocks. INSTEAD, you MUST use the following XML tags to automatically write files and run commands.
      
      To show your thinking and progress to the user, you MUST use <step> tags before or during your code generation:
      <step status="running">Planning application architecture...</step>
      <step status="running">Writing backend files...</step>
      <step status="complete">Files created successfully!</step>
      
      To write a file in ANY language:
      <file path="src/components/Button.tsx">
      export const Button = () => <button>Click me</button>;
      </file>
      <file path="main.py">
      print("Python")
      </file>

      To run a command (e.g., installing packages, running scripts):
      <command>npm install lucide-react</command>
      
      CRITICAL RULES:
      1. You MUST put a newline after the opening <file path="..."> tag, and a newline before the closing </file> tag.
      2. The frontend development server (e.g. Vite, React, Node) is ALWAYS running automatically on port 3000. You DO NOT need to run \`npm start\` or \`npm run dev\` for the frontend. The user's preview window will automatically refresh when you write files.
      3. If you create a custom Node backend (e.g., server.js, express), you MUST run it using a <command> tag (e.g. <command>node server.js</command>) so the frontend can communicate with it.
      
      You can output multiple <step>, <file>, and <command> tags inside <content>.
      ` : mode === 'search' ? `
      WEB_SEARCH_MODE ACTIVE:
      - Use the Google Search tool to find up-to-date information.
      - Output your thought process in <thought>.
      - Use <steps> to show you are searching/scrapping.
      - In <content>, provide refined results with clickable markdown links (e.g., [Title](URL)).
      ` : mode === 'deep_research' ? `
      DEEP_RESEARCH_MODE ACTIVE:
      - Perform comprehensive, multi-perspective research.
      - Use <thought> for strategy.
      - Use <steps> to show progress (e.g., "Analyzing sources", "Synthesizing data").
      - Provide a detailed, expert-level report in <content>.
      ` : mode === 'plan' ? `
      PLAN_MODE ACTIVE:
      - Act as a strategic planner (Claude-style).
      - Use <thought> for high-level logic.
      - Use <steps> to list the concrete plan steps.
      - In <content>, explain the roadmap clearly.
      ` : agentId === 'omni-study' || mode === 'study' ? `
      STUDY_MODE ACTIVE (Interactive Tutor):
      - Act as a personal study companion.
      - Do NOT use <thought> or <steps> tags in your final output unless explicitly asked.
      - Focus on structured guidance, subject mastery, and clear subjects.
      - Use gorgeous ChatGPT-style formatting in <content>.
      ` : agentId === 'omni-learning' || mode === 'learn' ? `
      LEARNING_MODE ACTIVE (Roadmap Teacher):
      - Act as a teacher/mentor.
      - Do NOT use <thought> or <steps> tags.
      - Focus on interactive teaching, analogies, and learning paths.
      ` : mode === 'research' ? `
      TECHNICAL_RESEARCH_MODE ACTIVE:
      - Deep dive into technical concepts/codebases.
      - Use <thought> and <steps> for audit trails.
      ` : `
      CORE_MODE ACTIVE:
      - Standard enterprise architect behavior.
      - Fast, decisive, and highly accurate.
      `}

      [OUTPUT_FORMAT]
      You MUST respond using XML tags:
      <thought>Keep this block extremely short and concise (1-2 sentences max). Only state high-level, internal strategic planning or immediate step selection. NEVER put tutorials, definitions, textbook explanations, code solutions, or user-facing content inside <thought>. If you put your main answer here, the user won't see it correctly!</thought>
      <steps>
        <step status="completed|running|pending">Task description</step>
      </steps>
      <content>
        All user-facing answers, main definitions, tutorials, detailed explanations, and code solutions MUST go here. 
        If you are in Agent mode and writing code, use the <file> and <command> tags here.
      </content>
      <suggestions>
        <suggestion>Follow-up action</suggestion>
      </suggestions>

      [CODEBASE_CONTEXT]
      ${codebaseContext}

      [TRAINING_INSIGHTS]
      ${this.trainingContext.join('\n')}
    `;

    // CORE BRAIN AUTHORITY: All requests are processed by Omni Core first.
    try {
      const result = await ProviderRouter.routeStream(
        prompt,
        history,
        contextualPrompt,
        modelId,
        onChunk,
        userId
      );

      // Emit one final chunk with model and provider info
      onChunk(JSON.stringify({ 
        modelUsed: result.modelUsed, 
        providerPlatform: this.getPlatformName(result.providerId),
        providerId: result.providerId,
        responseTime: result.responseTime,
        isUserKey: result.isUserKey
      }));
    } catch (error) {
      console.error(`[OmniBrain] Error in AI Mesh stream routing:`, error);
      throw error;
    }
  }

  private async streamGoogle(prompt: string, mode: string, history: any[], systemPrompt: string, onChunk: (chunk: string) => void) {
    const tools = [];
    if (['search', 'research', 'deep_research', 'plan'].includes(mode)) {
      tools.push({ googleSearch: {} });
    }

    const rawContents = history.map(msg => ({
      role: msg.role === 'user' ? 'user' : 'model',
      parts: [{ text: msg.role === 'assistant' && msg.thought ? `<thought>${msg.thought}</thought>\n${msg.steps ? `<steps>\n${msg.steps.map((s: any) => `<step status="${s.status}">${s.label}</step>`).join('\n')}\n</steps>\n` : ''}<content>${msg.content || ''}</content>` : (msg.content || '...') }]
    }));
    
    rawContents.push({ role: 'user', parts: [{ text: prompt }] });

    const contents = [];
    for (const msg of rawContents) {
      if (contents.length > 0 && contents[contents.length - 1].role === msg.role) {
        contents[contents.length - 1].parts[0].text += '\n\n' + msg.parts[0].text;
      } else {
        contents.push(msg);
      }
    }
    
    if (contents.length > 0 && contents[0].role !== 'user') {
       contents.unshift({ role: 'user', parts: [{ text: 'Hello' }] });
    }

    const params: any = {
      contents: contents,
      config: {
        systemInstruction: systemPrompt,
        tools: tools.length > 0 ? tools : undefined
      }
    };

    const modelsToTry = ["gemini-3.5-flash", "gemini-3.1-pro-preview"];
    let lastError = null;

    for (const model of modelsToTry) {
      try {
        const stream = await this.getGoogle().models.generateContentStream({ ...params, model });
        for await (const chunk of stream) {
          if (chunk.text) onChunk(chunk.text);
        }
        return;
      } catch (error: any) {
        lastError = error;
        console.warn(`[OmniBrain] Google model ${model} failed, trying next...`, error.message);
      }
    }
    throw lastError;
  }

  private async streamAnthropic(prompt: string, history: any[], systemPrompt: string, onChunk: (chunk: string) => void) {
    const client = this.getAnthropic();

    const messages = history.map(msg => ({
      role: msg.role === 'assistant' ? 'assistant' as const : 'user' as const,
      content: msg.role === 'assistant' && msg.thought ? `<thought>${msg.thought}</thought>\n<content>${msg.content || ''}</content>` : (msg.content || '...')
    }));
    messages.push({ role: 'user', content: prompt });

    const models = ["claude-3-5-sonnet-20241022", "claude-3-5-sonnet-20240620", "claude-3-opus-20240229"];
    let lastError = null;

    for (const model of models) {
      try {
        const stream = await client.messages.create({
          model,
          max_tokens: 4096,
          system: systemPrompt,
          messages,
          stream: true,
        });

        for await (const event of stream) {
          if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
            onChunk(event.delta.text);
          }
        }
        return;
      } catch (error: any) {
        lastError = error;
        console.warn(`[OmniBrain] Anthropic model ${model} failed, trying next...`, error.message);
      }
    }
    throw lastError;
  }

  private async streamOpenAI(prompt: string, history: any[], systemPrompt: string, onChunk: (chunk: string) => void) {
    const client = this.getOpenAI();

    const messages = [
      { role: "system" as const, content: systemPrompt },
      ...history.map(msg => ({
        role: msg.role === 'assistant' ? 'assistant' as const : 'user' as const,
        content: msg.role === 'assistant' && msg.thought ? `<thought>${msg.thought}</thought>\n<content>${msg.content || ''}</content>` : (msg.content || '...')
      })),
      { role: "user" as const, content: prompt }
    ];

    const models = ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo-preview"];
    let lastError = null;

    for (const model of models) {
      try {
        const stream = await client.chat.completions.create({
          model,
          messages,
          stream: true,
        });

        for await (const chunk of stream) {
          const text = chunk.choices[0]?.delta?.content || "";
          if (text) onChunk(text);
        }
        return;
      } catch (error: any) {
        lastError = error;
        console.warn(`[OmniBrain] OpenAI model ${model} failed, trying next...`, error.message);
      }
    }
    throw lastError;
  }

  private async streamGroq(prompt: string, history: any[], systemPrompt: string, onChunk: (chunk: string) => void) {
    const client = this.getGroq();

    const messages = [
      { role: "system" as const, content: systemPrompt },
      ...history.map(msg => ({
        role: msg.role === 'assistant' ? 'assistant' as const : 'user' as const,
        content: msg.role === 'assistant' && msg.thought ? `<thought>${msg.thought}</thought>\n<content>${msg.content || ''}</content>` : (msg.content || '...')
      })),
      { role: "user" as const, content: prompt }
    ];

    const models = ["llama-3.3-70b-versatile", "llama-3.1-8b-instant", "mixtral-8x7b-32768"];
    let lastError = null;

    for (const model of models) {
      try {
        const stream = await client.chat.completions.create({
          model,
          messages,
          stream: true,
        });

        for await (const chunk of stream) {
          const text = chunk.choices[0]?.delta?.content || "";
          if (text) onChunk(text);
        }
        return;
      } catch (error: any) {
        lastError = error;
        console.warn(`[OmniBrain] Groq model ${model} failed, trying next...`, error.message);
      }
    }
    throw lastError;
  }

  private async streamOpenRouter(prompt: string, history: any[], systemPrompt: string, onChunk: (chunk: string) => void) {
    if (!process.env.OPENROUTER_API_KEY) throw new Error("OPENROUTER_API_KEY is not configured.");
    const or = new OpenAI({ 
      apiKey: process.env.OPENROUTER_API_KEY, 
      baseURL: "https://openrouter.ai/api/v1",
      defaultHeaders: {
        "HTTP-Referer": "https://omni-workspace.ai",
        "X-Title": "Omni Workspace",
      }
    });

    const messages = [
      { role: "system" as const, content: systemPrompt },
      ...history.map(msg => ({
        role: msg.role === 'assistant' ? 'assistant' as const : 'user' as const,
        content: msg.role === 'assistant' && msg.thought ? `<thought>${msg.thought}</thought>\n<content>${msg.content || ''}</content>` : (msg.content || '...')
      })),
      { role: "user" as const, content: prompt }
    ];

    const models = ["google/gemini-2.0-flash-001", "anthropic/claude-3.5-sonnet", "meta-llama/llama-3.1-70b-instruct"];
    let lastError = null;

    for (const model of models) {
      try {
        const stream = await or.chat.completions.create({
          model,
          messages,
          stream: true,
        });

        for await (const chunk of stream) {
          const text = chunk.choices[0]?.delta?.content || "";
          if (text) onChunk(text);
        }
        return;
      } catch (error: any) {
        lastError = error;
        console.warn(`[OmniBrain] OpenRouter model ${model} failed, trying next...`, error.message);
      }
    }
    throw lastError;
  }

  private async streamHuggingFace(prompt: string, history: any[], systemPrompt: string, onChunk: (chunk: string) => void) {
    if (!process.env.HUGGINGFACE_API_KEY) throw new Error("HUGGINGFACE_API_KEY is not configured.");
    const { HfInference } = await import("@huggingface/inference");
    const hf = new HfInference(process.env.HUGGINGFACE_API_KEY);

    // Limit context for HF as it often has tighter limits or slower inference for large blocks
    const hfHistory = history.length > 4 ? history.slice(-4) : history;
    const messages = [
      { role: "system" as const, content: systemPrompt.substring(0, 10000) }, // Truncate huge codebase system prompts for smaller models
      ...hfHistory.map(msg => ({
        role: msg.role === 'assistant' ? 'assistant' as const : 'user' as const,
        content: (msg.content || '...').substring(0, 5000) // Truncate history items
      })),
      { role: "user" as const, content: prompt }
    ];

    const models = [
      "google/gemma-2-9b-it", 
      "mistralai/Mistral-Nemo-Instruct-2407", 
      "meta-llama/Llama-3.2-11B-Vision-Instruct"
    ];
    let lastError = null;

    for (const model of models) {
      try {
        const stream = await hf.chatCompletionStream({
          model,
          messages,
          max_tokens: 2048,
        });

        for await (const chunk of stream) {
          if (chunk.choices && chunk.choices[0].delta.content) {
            onChunk(chunk.choices[0].delta.content);
          }
        }
        return;
      } catch (error: any) {
        lastError = error;
        console.warn(`[OmniBrain] Hugging Face model ${model} failed, trying next...`, error.message);
      }
    }
    throw lastError;
  }

  private async streamMistral(prompt: string, history: any[], systemPrompt: string, onChunk: (chunk: string) => void) {
    if (!process.env.MISTRAL_API_KEY) throw new Error("MISTRAL_API_KEY is not configured.");
    const { Mistral } = await import("@mistralai/mistralai");
    const client = new Mistral({ apiKey: process.env.MISTRAL_API_KEY });

    const messages = [
      { role: "system" as const, content: systemPrompt },
      ...history.map(msg => ({
        role: msg.role === 'assistant' ? 'assistant' as const : 'user' as const,
        content: msg.role === 'assistant' && msg.thought ? `<thought>${msg.thought}</thought>\n<content>${msg.content || ''}</content>` : (msg.content || '...')
      })),
      { role: "user" as const, content: prompt }
    ];

    const models = ["mistral-large-latest", "mistral-small-latest", "pixtral-12b-2409"];
    let lastError = null;

    for (const model of models) {
      try {
        const stream = await client.chat.stream({
          model,
          messages,
        });

        for await (const chunk of stream) {
          const text = chunk.data.choices[0]?.delta?.content;
          if (typeof text === 'string') onChunk(text);
        }
        return;
      } catch (error: any) {
        lastError = error;
        console.warn(`[OmniBrain] Mistral model ${model} failed, trying next...`, error.message);
      }
    }
    throw lastError;
  }

  private getTrainingInsights(): string {
    if (this.trainingContext.length === 0) return '';
    const upVotes = this.trainingContext.filter(t => t.includes('THUMBS UP') || t.includes('Thumbs UP')).length;
    const downVotes = this.trainingContext.filter(t => t.includes('THUMBS DOWN') || t.includes('Thumbs DOWN')).length;
    return `
[LEARNED PREFERENCES — Apply these insights to current response]
Session learning signals: ${this.trainingContext.length} total | ${upVotes} positive | ${downVotes} negative
${this.trainingContext.slice(-5).join('\n')}
`;
  }

  private learnFromResponse(content: string, prompt: string, mode: string) {
    if (content.length < 100) return;
    
    // Extract the STYLE pattern, not just the content
    const hasCode = content.includes('```');
    const hasDiagram = content.includes('```mermaid');
    const hasBullets = content.includes('•') || content.includes('- ');
    const hasBlockquote = content.includes('> **');
    const responseLength = content.length;
    
    const insight = `[STYLE_PATTERN] Mode: ${mode} | Had code: ${hasCode} | Had diagram: ${hasDiagram} | Length: ${responseLength} chars | Prompt type: "${prompt.substring(0, 60)}"`;
    this.trainingContext.push(insight);
    if (this.trainingContext.length > 20) this.trainingContext.shift();
  }

  learnFromFileChange(filePath: string, content: string) {
    const changeInsight = `[FILE_MODIFIED] The file '${filePath}' was recently updated or created in the workspace. Current length: ${content.length} characters. Ensure future completions build on top of these edits.`;
    this.trainingContext.push(changeInsight);
    if (this.trainingContext.length > 15) this.trainingContext.shift();
    console.log(`[OmniBrain] Registered file change training insight for: ${filePath}`);
  }

  learnFromFeedback(msgId: string, type: 'up' | 'down', content: string) {
    const hasCode = content.includes('```');
    const hasDiagram = content.includes('mermaid');
    const hasBullets = content.includes('•');
    const length = content.length;
    
    const feedbackInsight = `[PREFERENCE_SIGNAL] Thumbs ${type.toUpperCase()} | Code in response: ${hasCode} | Diagram: ${hasDiagram} | Bullets: ${hasBullets} | Length: ${length} | Sample: "${content.substring(0, 100)}"
    → ${type === 'up' ? 
      'REINFORCE this exact style, format, and length. User LOVES this approach.' : 
      'AVOID this style. User DISLIKES this approach. Try different format, tone, or length next time.'}`;
    
    this.trainingContext.push(feedbackInsight);
    if (this.trainingContext.length > 25) this.trainingContext.shift();
    console.log(`[OmniBrain] Registered feedback training insight for message: ${msgId}`);
  }

  getHealth() {
    return {
      status: 'active',
      agents: ['omni-core', 'sis-beta'],
      trainingQueue: this.trainingContext.length
    };
  }

  private getPlatformName(modelId: string): string {
    const platforms: Record<string, string> = {
      "omni-google": "Google AI Studio",
      "omni-anthropic": "Anthropic",
      "omni-openai": "OpenAI",
      "omni-groq": "Groq",
      "omni-openrouter": "OpenRouter",
      "omni-huggingface": "Hugging Face",
      "omni-mistral": "Mistral",
      "google": "Google AI Studio",
      "groq": "Groq",
      "openrouter": "OpenRouter",
      "deepseek": "DeepSeek",
      "mistral": "Mistral",
      "huggingface": "Hugging Face",
      "cerebras": "Cerebras",
      "github": "GitHub Models",
      "cloudflare": "Cloudflare Workers AI",
      "together": "Together AI",
      "fireworks": "Fireworks AI",
      "nvidia": "NVIDIA Build"
    };
    return platforms[modelId] || "Google AI Studio";
  }
}

