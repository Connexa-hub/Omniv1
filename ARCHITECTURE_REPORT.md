# Architecture Report: Project Omni

## 1. System Overview
Omni uses a unified full-stack architecture where the Express backend serves as a secure proxy for high-privilege operations (AI, FS) while the React frontend provides a responsive, IDE-like experience.

## 2. Component Hierarchy
- **Omni-Shell**: The top-level layout controller.
  - **Omni-Nav**: Primary navigation (context switching).
  - **Omni-Workspace**: The main tri-pane layout.
    - **Control-Pane**: Secondary navigation (Chat, Explorer).
    - **Canvas-Pane**: The main stage (Editor, Preview).
    - **Status-Pane**: Terminal and build indicators.

## 3. Data Flow
1. **User Intent**: Captured via `Omni-Chat` (React State).
2. **AI Processing**: Sent to `/api/chat` (Express) -> Gemini SDK.
3. **Action Execution**: Backend parses instructions and executes file operations (in progress).
4. **Visual Feedback**: Frontend updates state and re-renders the `Live-Mirror` preview.

## 4. Key Technologies
- **Vite/React 19**: Modern rendering and fast refresh.
- **Express + tsx**: High-performance TypeScript backend.
- **Tailwind v4**: Next-gen utility-first styling.
- **Motion**: Fluid animations for UI state transitions.
