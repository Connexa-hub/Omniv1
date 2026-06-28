import fs from "fs/promises";
import path from "path";

/**
 * SourceGraph - Scans the codebase to provide context to OmniBrain.
 */
export class SourceGraph {
  private rootDir: string;

  constructor(rootDir: string) {
    this.rootDir = rootDir;
  }

  async getFullContext(): Promise<string> {
    const context: string[] = [];
    
    const scan = async (dir: string) => {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === 'dist') continue;

        if (entry.isDirectory()) {
          await scan(fullPath);
        } else if (entry.name.match(/\.(ts|tsx|json|css|html)$/)) {
          const content = await fs.readFile(fullPath, 'utf-8');
          context.push(`--- FILE: ${path.relative(this.rootDir, fullPath)} ---\n${content}`);
        }
      }
    };

    await scan(this.rootDir);
    return context.join('\n\n');
  }
}
