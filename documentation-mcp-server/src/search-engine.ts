import * as fs from 'fs';
import * as path from 'path';
import { glob } from 'glob';
import * as lancedb from '@lancedb/lancedb';
import { pipeline, env } from '@xenova/transformers';

// Configure local cache directory to respect HF_HOME environment variable
env.cacheDir = process.env.HF_HOME || './.cache';

export interface DocSection {
  id: string;
  path: string;
  pageTitle: string;
  sectionTitle: string;
  content: string; // Original content with code blocks (for query_docs)
  contentForEmbedding: string; // Processed for embedding (includes code context)
  contentSummary: string; // Clean summary without code (for search results)
  vector: number[];
  
  // Metadata fields
  documentType: 'tutorial' | 'api' | 'guide' | 'reference' | 'overview';
  category: string; // Top-level folder: 'agents', 'tools', 'apis', etc.
  subcategory?: string; // Second-level folder if exists
  hasCodeExamples: boolean;
  sections: string[]; // List of all section titles in the page
  fileSize: number; // File size in bytes
}

interface DocumentMetadata {
  documentType: 'tutorial' | 'api' | 'guide' | 'reference' | 'overview';
  category: string;
  subcategory?: string;
  hasCodeExamples: boolean;
}

type QueryType = 'exact_match' | 'conceptual' | 'mixed';

export class SearchEngine {
  private db: lancedb.Connection | null = null;
  private table: lancedb.Table | null = null;
  private docsDir: string;
  private extractor: any = null;

  constructor(docsDir: string) {
    this.docsDir = path.resolve(docsDir);
  }

  public async initialize(): Promise<void> {
    console.log(`Initializing local embedding model pipeline using cache folder: ${env.cacheDir}...`);
    this.extractor = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');

    console.log("Connecting to LanceDB...");
    const dbPath = path.join(this.docsDir, '../.lancedb');
    // Ensure parent directory exists
    await fs.promises.mkdir(path.dirname(dbPath), { recursive: true });
    this.db = await lancedb.connect(dbPath);

    console.log(`Scanning directory for markdown files: ${this.docsDir}`);
    const mdFiles = await glob('**/*.md', { cwd: this.docsDir });
    console.log(`Found ${mdFiles.length} markdown files. Parsing & vectorizing with page-level chunking...`);

    const sections: DocSection[] = [];
    let pageCounter = 0;

    for (const relativeFilePath of mdFiles) {
      const fullPath = path.join(this.docsDir, relativeFilePath);
      try {
        const content = await fs.promises.readFile(fullPath, 'utf8');
        const stats = await fs.promises.stat(fullPath);
        const fileSize = stats.size;
        const cleanPath = '/' + relativeFilePath.replace(/\\/g, '/');
        
        // Use page-level chunking
        const pageChunk = this.parseMarkdownPageLevel(cleanPath, content, fileSize);
        
        if (pageChunk) {
          // Construct text block for embedding (includes code context)
          const embedText = `${pageChunk.pageTitle}\n${pageChunk.sections.join(' ')}\n${pageChunk.contentForEmbedding}`;
          const embedding = await this.getEmbedding(embedText);

          sections.push({
            ...pageChunk,
            id: `${cleanPath}#page-${pageCounter++}`,
            vector: embedding
          });
        }
      } catch (err) {
        console.error(`Error reading or parsing file ${fullPath}:`, err);
      }
    }

    if (sections.length === 0) {
      console.warn("No sections found to index.");
      return;
    }

    console.log(`Creating/Overwriting table 'sections' in LanceDB with ${sections.length} page-level records...`);
    // Cast sections to any[] to bypass index signature checks on Connection.createTable
    this.table = await this.db.createTable('sections', sections as any, { mode: 'overwrite' });

    console.log("Building FTS index on 'contentForEmbedding'...");
    await this.table.createIndex('contentForEmbedding', { config: lancedb.Index.fts() });
    console.log("LanceDB Search Engine initialized successfully.");
  }

  private async getEmbedding(text: string): Promise<number[]> {
    const output = await this.extractor(text, { pooling: 'mean', normalize: true });
    return Array.from(output.data);
  }

  public async search(query: string, limit: number = 10): Promise<any[]> {
    if (!this.table) {
      console.warn("Search table not initialized, attempting to reconnect/open...");
      if (this.db) {
        this.table = await this.db.openTable('sections');
      } else {
        throw new Error("Search engine not initialized.");
      }
    }

    // Analyze query to determine search strategy
    const queryType = this.analyzeQuery(query);
    
    const queryVector = await this.getEmbedding(query);
    
    // Get initial results (2x limit for reranking)
    const initialLimit = limit * 2;
    const results = await this.table
      .vectorSearch(queryVector)
      .fullTextSearch(query)
      .limit(initialLimit)
      .toArray();

    // Apply simple reranking
    const rerankedResults = this.rerankResults(query, results, queryType);
    
    // Return top results after reranking
    return rerankedResults.slice(0, limit);
  }

  private analyzeQuery(query: string): QueryType {
    const queryLower = query.toLowerCase();
    
    // Exact match indicators
    if (query.match(/^["'].*["']$/) || queryLower.includes('api') || queryLower.includes('endpoint')) {
      return 'exact_match';
    }
    
    // Conceptual indicators
    if (query.match(/^(how|what|why|when|where)/i) || queryLower.includes('guide') || queryLower.includes('tutorial')) {
      return 'conceptual';
    }
    
    return 'mixed';
  }

  private rerankResults(query: string, results: any[], queryType: QueryType): any[] {
    const queryLower = query.toLowerCase();
    const queryTerms = queryLower.split(/\s+/).filter(t => t.length > 2);
    
    return results.map(result => {
      let score = 1 - (result._distance || 0); // Convert distance to similarity (higher is better)
      
      // Boost for exact title match
      if (result.pageTitle.toLowerCase().includes(queryLower)) {
        score += 0.3;
      }
      
      // Boost for query terms in title
      const titleMatches = queryTerms.filter(term => 
        result.pageTitle.toLowerCase().includes(term)
      ).length;
      score += titleMatches * 0.1;
      
      // Boost for document type relevance
      if (queryLower.includes('tutorial') && result.documentType === 'tutorial') {
        score += 0.2;
      }
      if ((queryLower.includes('api') || queryLower.includes('endpoint')) && result.documentType === 'api') {
        score += 0.2;
      }
      if ((queryLower.includes('guide') || queryLower.includes('how')) && result.documentType === 'guide') {
        score += 0.15;
      }
      
      // Boost for overview pages on broad queries (1-2 word queries)
      if (queryTerms.length <= 2 && result.documentType === 'overview') {
        score += 0.15;
      }
      
      // Boost for category match
      if (queryTerms.some(term => result.category.toLowerCase().includes(term))) {
        score += 0.1;
      }
      
      return { ...result, _relevance_score: score };
    }).sort((a, b) => b._relevance_score - a._relevance_score);
  }

  private parseMarkdownPageLevel(filePath: string, rawContent: string, fileSize: number): Omit<DocSection, 'id' | 'vector'> | null {
    const lines = rawContent.split(/\r?\n/);
    
    // Find main page title first
    let pageTitle = '';
    for (const line of lines) {
      if (line.startsWith('# ')) {
        pageTitle = line.substring(2).trim();
        break;
      }
    }

    if (!pageTitle) {
      // Fallback to filename
      const base = path.basename(filePath, '.md');
      pageTitle = base
        .replace(/[-_]/g, ' ')
        .replace(/\b\w/g, (char) => char.toUpperCase());
    }

    // Extract all section titles (H2-H6)
    const sections: string[] = [];
    for (const line of lines) {
      const headingMatch = line.match(/^(#{2,6})\s+(.*)$/);
      if (headingMatch) {
        sections.push(headingMatch[2].trim());
      }
    }

    // Get full content
    const content = rawContent;
    
    // Classify document
    const metadata = this.classifyDocument(filePath, content);
    
    // Prepare content for embedding (keep code context)
    const contentForEmbedding = this.prepareContentForEmbedding(content);
    
    // Create summary for search results (no code)
    const contentSummary = this.createSearchResultSummary(content, 300);

    return {
      path: filePath,
      pageTitle,
      sectionTitle: 'Overview', // Page-level chunk represents the whole page
      content,
      contentForEmbedding,
      contentSummary,
      sections,
      fileSize,
      ...metadata
    };
  }

  private classifyDocument(filePath: string, content: string): DocumentMetadata {
    const pathLower = filePath.toLowerCase();
    const pathParts = filePath.split('/').filter(p => p);
    
    // Extract category and subcategory from path
    const category = pathParts.length > 1 ? pathParts[1] : 'general';
    const subcategory = pathParts.length > 2 ? pathParts[2] : undefined;
    
    // Determine document type from path patterns
    let documentType: DocumentMetadata['documentType'] = 'guide';
    
    if (pathLower.includes('/apis/')) {
      documentType = 'api';
    } else if (pathLower.includes('/tutorials/')) {
      documentType = 'tutorial';
    } else if (pathLower.match(/overview|what_is|getting_started/)) {
      documentType = 'overview';
    } else if (pathLower.includes('/sdk/') || pathLower.includes('/reference/')) {
      documentType = 'reference';
    }
    
    // Check for code examples
    const hasCodeExamples = /```/.test(content);
    
    return {
      documentType,
      category,
      subcategory,
      hasCodeExamples
    };
  }

  private prepareContentForEmbedding(content: string): string {
    let cleaned = content;
    
    // KEEP code blocks - they provide important semantic context
    // Just replace code block markers with descriptive text
    cleaned = cleaned.replace(/```(\w+)?\n([\s\S]*?)```/g, (match, lang, code) => {
      const language = lang || 'code';
      // Keep a brief description instead of removing entirely
      return `[${language} code example] `;
    });
    
    // Remove HTML/XML tags but keep their title attributes
    cleaned = cleaned.replace(/<[A-Za-z0-9]+[^>]*title="([^"]+)"[^>]*>/g, ' $1 ');
    cleaned = cleaned.replace(/<[^>]+>/g, ' ');
    
    // Remove URLs (not useful for semantic search)
    cleaned = cleaned.replace(/https?:\/\/[^\s]+/g, '');
    
    // Clean markdown formatting
    cleaned = cleaned.replace(/\*\*([^*]+)\*\*/g, '$1');
    cleaned = cleaned.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
    
    // Normalize whitespace
    cleaned = cleaned.replace(/\s+/g, ' ').trim();
    
    // Limit length (embedding models have token limits)
    const maxChars = 2000;
    if (cleaned.length > maxChars) {
      cleaned = cleaned.substring(0, maxChars);
    }
    
    return cleaned;
  }

  private createSearchResultSummary(content: string, maxLength: number = 300): string {
    let summary = content;
    
    // Remove code blocks from results
    summary = summary.replace(/```[\s\S]*?```/g, '[code example] ');
    
    // Remove HTML/XML tags
    summary = summary.replace(/<[^>]+>/g, ' ');
    
    // Clean markdown formatting
    summary = summary.replace(/\*\*([^*]+)\*\*/g, '$1');
    summary = summary.replace(/\*([^*]+)\*/g, '$1');
    summary = summary.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
    summary = summary.replace(/^#+\s+/gm, ''); // Remove heading markers
    
    // Normalize whitespace
    summary = summary.replace(/\s+/g, ' ').trim();
    
    // Truncate to max length
    if (summary.length > maxLength) {
      summary = summary.substring(0, maxLength) + '...';
    }
    
    return summary;
  }
}

// Made with Bob
