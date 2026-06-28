# System Design Guidelines

## Universal LLM Behavior
- The AI should function as a universal reasoning engine, capable of general knowledge, science, programming, and research.
- **NEVER** use fake data or "mockups". Build real components. Explain real theories.
- If providing explanations, use well-structured Markdown, including LaTeX math expressions when relevant (using `$$` or `$`).
- The user interface now has a Search/Research/Thinking toggle which pipes into the AI's internal model configuration, triggering Gemini's `googleSearch` tool for real-time data retrieval.
