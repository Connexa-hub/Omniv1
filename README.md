# Project Omni: Autonomous Multi-Agent Workspace & OmniBrain Core

Project Omni is a state-of-the-art, high-fidelity full-stack AI coding platform designed to mimic real enterprise environments like Claude, ChatGPT, and Gemini. Powered by `OmniBrain`—a high-capacity, server-side orchestrated multi-agent network—Omni coordinates 16 distinct specialization agents to autonomously plan, generate, test, and deploy production-grade software.

---

## 🌌 Visual Identity: The "Omni-Glass" Canvas

Omni features an immersive, slate-dark **Glassmorphic Canvas** built with React, Vite, and Tailwind CSS. The interface is split into cohesive functional zones:
- **Left Control Pane (Omni Core)**: Interactive chat interface driven by the primary brain, supporting textbook-grade Markdown formatting, LaTeX equations, structured responsive tables, blockquotes, and automatic syntax-colored code blocks with copy buttons.
- **Center Stage (Live Sandbox Preview)**: Dynamic iframe displaying running client-side states, interactive educational physics simulators, or full application portals.
- **Bottom Terminal Console (Sandbox Shell Executor)**: A reactive Unix terminal that allows users to run actual workspace terminal commands (e.g. `npm run build`, `ls`, file alterations) directly from either desktop or mobile layouts.

---

## 🧠 System Architecture: How Omni Works

Omni operates on a split full-stack architecture, combining high-speed Node.js Express servers with a powerful Python-based cognitive orchestration layer.

```
                    ┌──────────────────────────┐
                    │  Omni-Glass Client (UI)  │
                    └────────────┬─────────────┘
                                 │ HTTP / WebSockets
                    ┌────────────▼─────────────┐
                    │ Express.js Gateway (3000)│
                    └────────────┬─────────────┘
                                 │ IPC / REST Ingestion
  ┌──────────────────────────────┴──────────────────────────────┐
  │                   Python Cognitive Layer                    │
  │                                                             │
  │  ┌───────────────────┐  ┌───────────────────┐  ┌─────────┐  │
  │  │   Orchestrator    │  │  16-Agent Registry│  │Artifact │  │
  │  │  (Decision Engine)│  │ (Specialists/VMs) │  │ Manager │  │
  │  └─────────┬─────────┘  └───────────────────┘  └────┬────┘  │
  │            │                                        │       │
  │  ┌─────────▼─────────┐                          ┌───▼─────┐ │
  │  │  CompanyMemory    │◄─────────────────────────┤Workspace│ │
  │  │ (Knowledge Graph) │                          │  Files  │ │
  │  └───────────────────┘                          └─────────┘ │
  └─────────────────────────────────────────────────────────────┘
```

### 1. The Gateway (`server.ts`)
The Node.js server routes client messages, manages static Vite compilation, proxies database writes, and streams output logs from background shell tasks.

### 2. Python Cognitive Layer (`core/`)
The cognitive processor contains the intelligence engine:
* **`Orchestrator`**: The main planner. It parses human prompts, breaks down tasks into multi-file blueprints, and selects the ideal agent specialists.
* **`CompanyMemory`**: A localized semantic index (knowledge graph) containing training data, code context, custom rulesets, and design guides. It recursively serializes sets and complex memory chains to prevent latency bottlenecks.
* **`16-Agent Specialization Registry`**: Includes UI Designers, Database Architects, DevOps Engineers, Security Officers, and Testers. Each agent has custom system prompts tailored to their role.
* **`ArtifactManager`**: Manages the generation lifecycle. It ensures that files written to disk match pristine formatting guidelines without truncating output blocks.

---

## 🛠️ Features Implemented

1. **Textbook Markdown Engine**: Fully custom reactive parser rendering beautiful text formats, blockquotes with thick blue indicators, tabular layouts, mathematical equations, task checkboxes, and side-by-side execution triggers.
2. **Enterprise Code Block Highlighting**: Fully visual, 1-indexed line-numbered code terminals with custom syntax keywords coloring, automatic line breaks, and single-click copy buttons.
3. **Responsive Mobile Shell**: Seamless interactive terminal workspace on mobile devices. Supports quick command helper chips to minimize touch keyboard fatigue.
4. **Persistent Firebase Connection**: Syncs and saves project workspaces, chats, and files securely into Firestore.

---

## 🚀 Directory Structure

* `/src` - The high-fidelity React workspace, UI components, and state layers.
* `/core` - The Python-based `OmniBrain` and Agent Orchestration framework.
* `/tests` - Exhaustive validation suites verifying company memory serialization, agent routing, and file extraction.
* `server.ts` - Express proxy serving Vite static folders and managing backend container actions.
* `DEPLOYMENT.md` - Complete instructions on deploying, training, and building custom offline models from your local brain.
