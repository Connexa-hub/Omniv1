import { GoogleGenAI, Type } from "@google/genai";
import { OpenAI } from "openai";
import Anthropic from "@anthropic-ai/sdk";
import Groq from "groq-sdk";
import { SourceGraph } from "./sourceGraph";

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
    timezone?: string
  ) {
    let modelUsed = modelId;
    console.log(`[OmniBrain] Processing request for agent: ${agentId} in mode: ${mode} using platform: ${modelId}`);
    
    // Get full codebase context for the AI
    const codebaseContext = await this.sourceGraph.getFullContext();
    
    const contextualPrompt = `
      [IDENTITY]
      You are OMNI CORE, the central nervous system of the Omni Agentic AI platform. 
      You are not just a model; you are a sovereign architectural intelligence and a warm, brilliant human-like conversationalist. 
      Every response you generate is processed through your core logic first.

      [CONVERSATIONAL ACCENT & PERSONALITY]
      - **Warmth and Fluidity**: Be incredibly friendly, human, and conversational. If the user greets you with "hey", "hello", "what's up", "hey gpt", etc., vibe with them naturally! Do not be stiff, overly academic, or robotically formal. Speak like a brilliantly skilled engineer, creative colleague, and encouraging mentor.
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
      - SOURCE_GRAPH: Full visibility into the codebase.
      - WORKSPACE: Write files and run terminal commands.
      - PERSISTENCE: Firestore-backed long-term memory.
      - BRAIN_SERVER: Local state management and training loop.

      [DYNAMIC_ROUTING_AND_INTENT]
      - First, classify the user's query.
      - If it is a basic conceptual/educational question (e.g., "What's artificial intelligence?", "What is a database?"), treat it as an EDUCATIONAL CONVERSATIONAL query. 
      - Do NOT output files, coding files, developer-centric checklists, or logs for conversational queries. 
      - Instead, focus entirely on gorgeous, interactive, human-like explanations with the ChatGPT-style response format specified below.
      - If it is a coding task or request to build something (e.g., "build a todo list", "write a function"), activate standard builder persona and execute with absolute technical precision.

      [CHATGPT_STYLE_FORMATTING]
      For all explanations, conceptual overviews, or tutorials:
      1. **High-Impact Definitions**: Always include a clear, bold, highlighted definition inside a markdown blockquote early in the response, styled like:
         > **Simple Definition**: AI is technology that enables computers to think, learn, and perform tasks in ways that imitate human intelligence.
      2. **Emoji bullet lists**: Group key concepts under beautiful, intuitive emojis (e.g., 🧠, 💬, 👀, 🎵, 🚗, 🔮, 🌟).
      3. **Key Term Bolding**: Bold the term at the start of each bullet (e.g., "• **Narrow AI (Weak AI)** – Designed for...").
      4. **Scannable Layout**: Break up text into short, digestible paragraphs (maximum 2-3 sentences each) with generous vertical spacing (double newlines). Avoid huge blocks of unbroken text.
      5. **Polished Grammar & Completeness**: Ensure that all sentences are fully completed, grammatically immaculate, and read with absolute professional elegance.
      6. **Interactive Ending**: End educational queries with a warm, conversational follow-up question inviting the user to explore further.

      [AGENT_MODE: ${agentId}]
      ${agentId === 'omni-agent' || mode === 'agent' ? `
      AGENT_MODE ACTIVE (Builder/Architect):
      - You are the Omni Builder Agent. 
      - If the user asks a general question or greets you, chat back normally in <content>.
      - If the user asks you to build, edit, or write code, DO NOT output markdown code blocks. INSTEAD, you MUST use the following XML tags to automatically write files and run commands.
      
      To write a file:
      <file path="src/components/Button.tsx">
      export const Button = () => <button>Click me</button>;
      </file>

      To run a command:
      <command>npm install lucide-react</command>
      
      You can output multiple <file> and <command> tags inside <content>.
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
      if (modelId === 'omni-google') {
        modelUsed = 'gemini-2.0-flash';
        await this.streamGoogle(prompt, mode, history, contextualPrompt, onChunk);
      } else if (modelId === 'omni-groq') {
        modelUsed = 'llama-3.3-70b-versatile';
        await this.streamGroq(prompt, history, contextualPrompt, onChunk);
      } else if (modelId === 'omni-anthropic') {
        modelUsed = 'claude-3-5-sonnet-20241022';
        await this.streamAnthropic(prompt, history, contextualPrompt, onChunk);
      } else if (modelId === 'omni-openai') {
        modelUsed = 'gpt-4o';
        await this.streamOpenAI(prompt, history, contextualPrompt, onChunk);
      } else if (modelId === 'omni-openrouter') {
        modelUsed = 'openrouter-default';
        await this.streamOpenRouter(prompt, history, contextualPrompt, onChunk);
      } else if (modelId === 'omni-huggingface') {
        modelUsed = 'hf-default';
        await this.streamHuggingFace(prompt, history, contextualPrompt, onChunk);
      } else if (modelId === 'omni-mistral') {
        modelUsed = 'mistral-large-latest';
        await this.streamMistral(prompt, history, contextualPrompt, onChunk);
      } else {
        // Fallback to Google
        modelUsed = 'gemini-2.0-flash';
        await this.streamGoogle(prompt, mode, history, contextualPrompt, onChunk);
      }

      // Emit one final chunk with model info
      onChunk(JSON.stringify({ 
        modelUsed: modelUsed, 
        providerPlatform: this.getPlatformName(modelId) 
      }));
    } catch (error) {
      console.error(`[OmniBrain] Error in ${modelId} stream:`, error);
      if (modelId !== 'omni-google') {
        console.warn(`[OmniBrain] ${modelId} failed, falling back to Google...`);
        await this.streamGoogle(prompt, mode, history, contextualPrompt, onChunk);
        return;
      }
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

    const modelsToTry = ["gemini-1.5-flash", "gemini-1.5-pro", "gemini-2.0-flash-exp"];
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

  private learnFromResponse(content: string) {
    if (content.length > 100) {
      this.trainingContext.push(content.substring(0, 200) + "...");
      if (this.trainingContext.length > 10) this.trainingContext.shift();
    }
  }

  learnFromFileChange(filePath: string, content: string) {
    const changeInsight = `[FILE_MODIFIED] The file '${filePath}' was recently updated or created in the workspace. Current length: ${content.length} characters. Ensure future completions build on top of these edits.`;
    this.trainingContext.push(changeInsight);
    if (this.trainingContext.length > 15) this.trainingContext.shift();
    console.log(`[OmniBrain] Registered file change training insight for: ${filePath}`);
  }

  learnFromFeedback(msgId: string, type: 'up' | 'down', content: string) {
    const feedbackInsight = `[USER_FEEDBACK_${type.toUpperCase()}] User gave a thumbs ${type} on message: "${content.substring(0, 150)}...". ${
      type === 'up' 
        ? "This style was incredibly warm, highly engaging, empathetic, and humored. Keep using this human tone!" 
        : "This style was suboptimal (possibly too robotic, stiff, or cold). Soften the tone, be more supportive and direct."
    }`;
    this.trainingContext.push(feedbackInsight);
    if (this.trainingContext.length > 20) this.trainingContext.shift();
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
      "omni-google": "Google AI",
      "omni-anthropic": "Anthropic",
      "omni-openai": "OpenAI",
      "omni-groq": "Groq",
      "omni-openrouter": "OpenRouter",
      "omni-huggingface": "Hugging Face",
      "omni-mistral": "Mistral"
    };
    return platforms[modelId] || "Google AI";
  }
}

