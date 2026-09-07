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
  sectionSlug: string;
  sectionOrder: number;
  headingLevel: number;
  lineStart: number;
  lineEnd: number;
  lineRange: string;
  content: string;
  contentForEmbedding: string;
  contentSummary: string;
  vector: number[];
  documentType: 'tutorial' | 'api' | 'guide' | 'reference' | 'overview';
  category: string;
  subcategory?: string;
  hasCodeExamples: boolean;
  sections: string[];
  fileSize: number;
}

interface DocumentMetadata {
  documentType: 'tutorial' | 'api' | 'guide' | 'reference' | 'overview';
  category: string;
  subcategory?: string;
  hasCodeExamples: boolean;
}

interface ParsedHeading {
  title: string;
  level: number;
  line: number;
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
    console.log(`Found ${mdFiles.length} markdown files. Parsing & vectorizing with section-level chunking...`);

    const sections: DocSection[] = [];

    for (const relativeFilePath of mdFiles) {
      const fullPath = path.join(this.docsDir, relativeFilePath);
      try {
        const content = await fs.promises.readFile(fullPath, 'utf8');
        const stats = await fs.promises.stat(fullPath);
        const fileSize = stats.size;
        const cleanPath = '/' + relativeFilePath.replace(/\\/g, '/');

        const parsedSections = this.parseMarkdownSections(cleanPath, content, fileSize);

        for (const section of parsedSections) {
          const embedText = [
            section.pageTitle,
            section.sectionTitle,
            section.sections.join(' '),
            section.contentForEmbedding
          ].join('\n');
          const embedding = await this.getEmbedding(embedText);

          sections.push({
            ...section,
            id: `${cleanPath}#${section.sectionSlug}-${section.sectionOrder}`,
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

    console.log(`Creating/Overwriting table 'sections' in LanceDB with ${sections.length} section-level records...`);
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

    const queryType = this.analyzeQuery(query);
    const queryVector = await this.getEmbedding(query);
    const initialLimit = Math.max(limit * 4, 20);

    const results = await this.table
      .vectorSearch(queryVector)
      .fullTextSearch(query)
      .limit(initialLimit)
      .toArray();

    const rerankedResults = this.rerankResults(query, results, queryType);
    return this.deduplicateResults(rerankedResults, limit);
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
      let score = 1 - (result._distance || 0);

      const pageTitle = String(result.pageTitle || '').toLowerCase();
      const sectionTitle = String(result.sectionTitle || '').toLowerCase();
      const pathValue = String(result.path || '').toLowerCase();
      const summary = String(result.contentSummary || '').toLowerCase();

      if (sectionTitle.includes(queryLower)) {
        score += 0.45;
      }
      if (pageTitle.includes(queryLower)) {
        score += 0.25;
      }

      const sectionMatches = queryTerms.filter(term => sectionTitle.includes(term)).length;
      const titleMatches = queryTerms.filter(term => pageTitle.includes(term)).length;
      const pathMatches = queryTerms.filter(term => pathValue.includes(term)).length;
      const summaryMatches = queryTerms.filter(term => summary.includes(term)).length;

      score += sectionMatches * 0.18;
      score += titleMatches * 0.08;
      score += pathMatches * 0.06;
      score += Math.min(summaryMatches * 0.03, 0.12);

      if (queryLower.includes('tutorial') && result.documentType === 'tutorial') {
        score += 0.2;
      }
      if ((queryLower.includes('api') || queryLower.includes('endpoint')) && result.documentType === 'api') {
        score += 0.2;
      }
      if ((queryLower.includes('guide') || queryLower.includes('how')) && result.documentType === 'guide') {
        score += 0.15;
      }

      const sectionLength = Math.max((result.lineEnd || 0) - (result.lineStart || 0) + 1, 1);
      if (queryType === 'exact_match') {
        score += Math.max(0, 0.18 - Math.min(sectionLength, 120) / 1000);
      } else if (queryType === 'conceptual') {
        score += Math.min(sectionLength, 180) / 1500;
      }

      if (queryTerms.some(term => String(result.category || '').toLowerCase().includes(term))) {
        score += 0.1;
      }

      if (result.hasCodeExamples && queryTerms.some(term => ['code', 'example', 'python', 'javascript', 'typescript'].includes(term))) {
        score += 0.08;
      }

      return { ...result, _relevance_score: score };
    }).sort((a, b) => b._relevance_score - a._relevance_score);
  }

  private deduplicateResults(results: any[], limit: number): any[] {
    const deduped: any[] = [];
    const perPathCount = new Map<string, number>();
    const seenKeys = new Set<string>();

    for (const result of results) {
      const pathKey = String(result.path || '');
      const sectionKey = `${pathKey}:${result.lineRange || ''}:${String(result.sectionTitle || '')}`;
      if (seenKeys.has(sectionKey)) {
        continue;
      }

      const currentCount = perPathCount.get(pathKey) || 0;
      if (currentCount >= 2) {
        continue;
      }

      seenKeys.add(sectionKey);
      perPathCount.set(pathKey, currentCount + 1);
      deduped.push(result);

      if (deduped.length >= limit) {
        break;
      }
    }

    return deduped;
  }

  private parseMarkdownSections(filePath: string, rawContent: string, fileSize: number): Omit<DocSection, 'id' | 'vector'>[] {
    const lines = rawContent.split(/\r?\n/);
    const pageTitle = this.extractPageTitle(filePath, lines);
    const headings = this.extractHeadings(lines);
    const metadata = this.classifyDocument(filePath, rawContent);
    const sectionTitles = headings
      .filter(heading => heading.level >= 2)
      .map(heading => heading.title);

    const sections: Omit<DocSection, 'id' | 'vector'>[] = [];

    if (headings.length === 0) {
      const content = rawContent;
      sections.push({
        path: filePath,
        pageTitle,
        sectionTitle: 'Overview',
        sectionSlug: 'overview',
        sectionOrder: 0,
        headingLevel: 1,
        lineStart: 1,
        lineEnd: lines.length,
        lineRange: `1-${lines.length}`,
        content,
        contentForEmbedding: this.prepareContentForEmbedding(content),
        contentSummary: this.createSearchResultSummary(content, 300),
        sections: sectionTitles,
        fileSize,
        ...metadata
      });
      return sections;
    }

    const sectionHeadings = headings.filter(heading => heading.level >= 2);

    if (sectionHeadings.length === 0) {
      const content = rawContent;
      sections.push({
        path: filePath,
        pageTitle,
        sectionTitle: 'Overview',
        sectionSlug: 'overview',
        sectionOrder: 0,
        headingLevel: 1,
        lineStart: 1,
        lineEnd: lines.length,
        lineRange: `1-${lines.length}`,
        content,
        contentForEmbedding: this.prepareContentForEmbedding(content),
        contentSummary: this.createSearchResultSummary(content, 300),
        sections: sectionTitles,
        fileSize,
        ...metadata
      });
      return sections;
    }

    const firstSectionStart = sectionHeadings[0].line;
    if (firstSectionStart > 1) {
      const overviewContent = lines.slice(0, firstSectionStart - 1).join('\n').trim();
      if (overviewContent) {
        sections.push({
          path: filePath,
          pageTitle,
          sectionTitle: 'Overview',
          sectionSlug: 'overview',
          sectionOrder: 0,
          headingLevel: 1,
          lineStart: 1,
          lineEnd: firstSectionStart - 1,
          lineRange: `1-${firstSectionStart - 1}`,
          content: overviewContent,
          contentForEmbedding: this.prepareContentForEmbedding(overviewContent),
          contentSummary: this.createSearchResultSummary(overviewContent, 300),
          sections: sectionTitles,
          fileSize,
          ...metadata
        });
      }
    }

    sectionHeadings.forEach((heading, index) => {
      const nextHeading = sectionHeadings[index + 1];
      const lineStart = heading.line;
      const lineEnd = nextHeading ? nextHeading.line - 1 : lines.length;
      const content = lines.slice(lineStart - 1, lineEnd).join('\n').trim();

      if (!content) {
        return;
      }

      sections.push({
        path: filePath,
        pageTitle,
        sectionTitle: heading.title,
        sectionSlug: this.slugify(heading.title),
        sectionOrder: index + 1,
        headingLevel: heading.level,
        lineStart,
        lineEnd,
        lineRange: `${lineStart}-${lineEnd}`,
        content,
        contentForEmbedding: this.prepareContentForEmbedding(content),
        contentSummary: this.createSearchResultSummary(content, 300),
        sections: sectionTitles,
        fileSize,
        ...metadata
      });
    });

    return sections;
  }

  private extractPageTitle(filePath: string, lines: string[]): string {
    for (const line of lines) {
      if (line.startsWith('# ')) {
        return line.substring(2).trim();
      }
    }

    const base = path.basename(filePath, '.md');
    return base
      .replace(/[-_]/g, ' ')
      .replace(/\b\w/g, (char) => char.toUpperCase());
  }

  private extractHeadings(lines: string[]): ParsedHeading[] {
    const headings: ParsedHeading[] = [];

    lines.forEach((line, index) => {
      const headingMatch = line.match(/^(#{1,6})\s+(.*)$/);
      if (!headingMatch) {
        return;
      }

      headings.push({
        title: headingMatch[2].trim(),
        level: headingMatch[1].length,
        line: index + 1
      });
    });

    return headings;
  }

  private slugify(value: string): string {
    const slug = value
      .toLowerCase()
      .replace(/[`"'.,:;!?()[\]{}]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

    return slug || 'section';
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
