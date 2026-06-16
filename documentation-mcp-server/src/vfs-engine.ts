import * as fs from 'fs';
import * as path from 'path';
import { glob } from 'glob';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export class VFSEngine {
  private docsDir: string;
  private vfsDir: string;
  private topLevelNames: string[] = [];

  constructor(docsDir: string, vfsDir: string) {
    this.docsDir = path.resolve(docsDir);
    this.vfsDir = path.resolve(vfsDir);
  }

  public getVfsDir(): string {
    return this.vfsDir;
  }

  /**
   * Initializes the .vfs folder by mirroring the documentation directory,
   * replacing all directory name underscores with hyphens.
   */
  public async initialize(): Promise<void> {
    console.log(`Initializing VFS. docsDir: ${this.docsDir}, vfsDir: ${this.vfsDir}`);
    
    // Clear the existing VFS directory if it exists
    if (fs.existsSync(this.vfsDir)) {
      await fs.promises.rm(this.vfsDir, { recursive: true, force: true });
    }
    await fs.promises.mkdir(this.vfsDir, { recursive: true });

    // Scan for all files in documentation folder
    const files = await glob('**/*', { cwd: this.docsDir, nodir: true });
    
    for (const relativeFile of files) {
      const srcPath = path.join(this.docsDir, relativeFile);
      
      // Compute mapped path: replace underscores with hyphens in directory names
      const parts = relativeFile.replace(/\\/g, '/').split('/');
      const mappedParts = parts.map((part, index) => {
        if (index < parts.length - 1) {
          return part.replace(/_/g, '-');
        }
        return part;
      });
      
      const mappedRelativePath = mappedParts.join('/');
      const destPath = path.join(this.vfsDir, mappedRelativePath);
      
      // Ensure destination directory exists
      await fs.promises.mkdir(path.dirname(destPath), { recursive: true });
      
      // Copy file
      await fs.promises.copyFile(srcPath, destPath);
    }

    // Load top-level names in VFS
    if (fs.existsSync(this.vfsDir)) {
      this.topLevelNames = await fs.promises.readdir(this.vfsDir);
    }
    console.log(`VFS initialized with ${files.length} files. Top level names:`, this.topLevelNames);
  }

  /**
   * Validates if the shell command is safe and read-only.
   * Returns an error message if invalid, or null if valid.
   */
  public validateCommand(command: string): string | null {
    const forbiddenCommands = [
      'rm', 'mv', 'cp', 'touch', 'mkdir', 'rmdir', 'chmod', 'chown', 'ln',
      'wget', 'curl', 'apt', 'apt-get', 'yum', 'npm', 'yarn', 'pnpm', 'pip',
      'python', 'node', 'sh', 'bash', 'zsh', 'ash', 'dash', 'eval', 'exec',
      'kill', 'pkill', 'killall', 'top', 'ps', 'systemctl', 'service'
    ];

    const words = command.split(/[\s|&;<>()`]+/);
    for (const word of words) {
      const cleanWord = word.trim();
      if (forbiddenCommands.includes(cleanWord)) {
        return `Command "${cleanWord}" is not allowed. Supported commands are: rg, grep, find, tree, ls, cat, head, tail, stat, wc, sort, uniq, cut, sed, awk, jq, plus basic text utilities.`;
      }
    }

    // Check for write redirection '>' outside quotes, avoiding '->' and '>='
    let inSingleQuote = false;
    let inDoubleQuote = false;
    let inBacktick = false;
    for (let i = 0; i < command.length; i++) {
      const char = command[i];
      if (char === "'" && !inDoubleQuote && !inBacktick) {
        inSingleQuote = !inSingleQuote;
      } else if (char === '"' && !inSingleQuote && !inBacktick) {
        inDoubleQuote = !inDoubleQuote;
      } else if (char === '`' && !inSingleQuote && !inDoubleQuote) {
        inBacktick = !inBacktick;
      } else if (char === '>' && !inSingleQuote && !inDoubleQuote && !inBacktick) {
        const prev = command[i - 1];
        const next = command[i + 1];
        if (prev !== '-' && next !== '=') {
          return 'Write redirection is not allowed.';
        }
      }
    }

    return null;
  }

  /**
   * Rewrites absolute VFS paths (like /openapi, /getting-started, or /) to point to the actual disk directory.
   */
  public rewriteCommand(command: string): string {
    let rewritten = command;

    // 1. Rewrite standalone "/" to the vfsDir path
    const standaloneRegex = /(^|[\s"'`|&;()<>])(\/)(?=$|[\s"'`|&;()<>])/g;
    rewritten = rewritten.replace(standaloneRegex, `$1${this.vfsDir}`);

    // 2. Rewrite paths starting with "/" followed by a top-level VFS name
    const sortedNames = [...this.topLevelNames].sort((a, b) => b.length - a.length);
    
    for (const name of sortedNames) {
      const escapedName = this.escapeRegExp(name);
      const pathRegex = new RegExp('(^|[\\s"\'`|&;()<>])\\/(' + escapedName + ')(?=$|[\\s"\'`|&;()<>/])', 'g');
      rewritten = rewritten.replace(pathRegex, `$1${this.thisVfsPath(name)}`);
    }

    return rewritten;
  }

  private thisVfsPath(name: string): string {
    return path.join(this.vfsDir, name).replace(/\\/g, '/');
  }

  /**
   * Cleans references to the VFS directory path back to / in command outputs.
   */
  public cleanOutput(output: string): string {
    const normalizedVfs = this.vfsDir.replace(/\\/g, '/');
    const escapedVfs = this.escapeRegExp(normalizedVfs);
    
    // Replace the VFS absolute directory path with /
    let cleaned = output.replace(new RegExp(escapedVfs + '/?', 'g'), '/');
    
    // Support cleaning windows-style backslash paths if they exist
    const winVfs = this.vfsDir.replace(/\//g, '\\\\');
    const escapedWinVfs = this.escapeRegExp(winVfs);
    cleaned = cleaned.replace(new RegExp(escapedWinVfs + '\\\\?', 'g'), '/');
    
    return cleaned;
  }

  private escapeRegExp(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * Runs the query in the VFS context and returns stdout+stderr, or throws an error.
   */
  public async runQuery(query: string): Promise<string> {
    const validationError = this.validateCommand(query);
    if (validationError) {
      throw new Error(validationError);
    }

    const rewrittenCmd = this.rewriteCommand(query);
    
    try {
      const { stdout, stderr } = await execAsync(rewrittenCmd, {
        cwd: this.vfsDir,
        timeout: 10000,
        maxBuffer: 10 * 1024 * 1024
      });

      const combinedOutput = stdout + stderr;
      return this.cleanOutput(combinedOutput);
    } catch (error: any) {
      if (error.stdout !== undefined || error.stderr !== undefined) {
        const combinedOutput = (error.stdout || '') + (error.stderr || '');
        return this.cleanOutput(combinedOutput);
      }
      throw error;
    }
  }
}
