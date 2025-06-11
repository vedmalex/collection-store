// MarkdownParser - Metadata-rich hybrid model with lazy loading
// Based on Creative Phase Decision: Balanced approach с rich metadata + efficient content storage

import { marked } from 'marked';
import matter from 'gray-matter';
import fs from 'fs-extra';
import path from 'path';
import crypto from 'crypto';

export interface MarkdownDocument {
  id: string;
  path: string;
  metadata: MarkdownMetadata;
  content: MarkdownContent;
  index: MarkdownIndex;
  timestamps: {
    created: Date;
    modified: Date;
    accessed: Date;
    gitCommit?: Date;
  };
}

export interface MarkdownMetadata {
  frontmatter: Record<string, any>;
  git: {
    branch: string;
    commit: string;
    author: string;
    status: 'clean' | 'modified' | 'staged' | 'conflict';
  };
  system: {
    size: number;
    encoding: string;
    checksum: string;
  };
  computed: {
    wordCount: number;
    readingTime: number;
    headingCount: number;
    linkCount: number;
  };
}

export interface MarkdownContent {
  raw: string;
  parsed?: {
    headers: HeaderNode[];
    sections: ContentSection[];
    links: LinkReference[];
  };
  html?: string;
}

export interface MarkdownIndex {
  text: Map<string, number[]>; // word -> positions
  headers: HeaderIndex[];
  links: LinkIndex[];
  tags: string[];
}

export interface HeaderNode {
  level: number;
  text: string;
  id: string;
  position: {
    start: number;
    end: number;
  };
  children: HeaderNode[];
}

export interface ContentSection {
  id: string;
  type: 'paragraph' | 'code' | 'list' | 'quote' | 'table';
  content: string;
  position: {
    start: number;
    end: number;
  };
  metadata?: Record<string, any>;
}

export interface LinkReference {
  text: string;
  url: string;
  title?: string;
  type: 'internal' | 'external' | 'anchor';
  position: {
    start: number;
    end: number;
  };
}

export interface HeaderIndex {
  level: number;
  text: string;
  id: string;
  position: number;
}

export interface LinkIndex {
  text: string;
  url: string;
  type: 'internal' | 'external' | 'anchor';
  position: number;
}

export interface ParsingConfig {
  lazy: {
    enabled: boolean;
    parseHtmlOnDemand: boolean;
    indexOnDemand: boolean;
  };
  indexing: {
    enabled: boolean;
    minWordLength: number;
    stopWords: string[];
    caseSensitive: boolean;
  };
  processing: {
    extractLinks: boolean;
    generateIds: boolean;
    calculateReadingTime: boolean;
    wordsPerMinute: number;
  };
  caching: {
    enabled: boolean;
    ttl: number; // Time to live in milliseconds
  };
}

export class MarkdownParser {
  private config: ParsingConfig;
  private cache: Map<string, { document: MarkdownDocument; timestamp: number }> = new Map();

  constructor(config: Partial<ParsingConfig> = {}) {
    this.config = this.mergeConfig(config);
    this.setupMarkedOptions();
  }

  private mergeConfig(userConfig: Partial<ParsingConfig>): ParsingConfig {
    return {
      lazy: {
        enabled: userConfig.lazy?.enabled ?? true,
        parseHtmlOnDemand: userConfig.lazy?.parseHtmlOnDemand ?? true,
        indexOnDemand: userConfig.lazy?.indexOnDemand ?? true,
      },
      indexing: {
        enabled: userConfig.indexing?.enabled ?? true,
        minWordLength: userConfig.indexing?.minWordLength ?? 3,
        stopWords: userConfig.indexing?.stopWords ?? ['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by'],
        caseSensitive: userConfig.indexing?.caseSensitive ?? false,
      },
      processing: {
        extractLinks: userConfig.processing?.extractLinks ?? true,
        generateIds: userConfig.processing?.generateIds ?? true,
        calculateReadingTime: userConfig.processing?.calculateReadingTime ?? true,
        wordsPerMinute: userConfig.processing?.wordsPerMinute ?? 200,
      },
      caching: {
        enabled: userConfig.caching?.enabled ?? true,
        ttl: userConfig.caching?.ttl ?? 5 * 60 * 1000, // 5 minutes
      },
    };
  }

  private setupMarkedOptions(): void {
    marked.setOptions({
      gfm: true,
      breaks: false,
      pedantic: false,
    });
  }

  async parseFile(filePath: string, gitMetadata?: Partial<MarkdownMetadata['git']>): Promise<MarkdownDocument> {
    const absolutePath = path.resolve(filePath);
    const cacheKey = this.getCacheKey(absolutePath);

    // Get file stats first to check modification time
    const stats = await fs.stat(absolutePath);

    // Check cache first
    if (this.config.caching.enabled) {
      const cached = this.cache.get(cacheKey);
      if (cached && this.isCacheValid(cached.timestamp)) {
        // Also check if file was modified since cache entry
        const cachedModTime = cached.document.timestamps.modified.getTime();
        const fileModTime = stats.mtime.getTime();

        if (fileModTime <= cachedModTime) {
        cached.document.timestamps.accessed = new Date();
        return cached.document;
        }
        // File was modified, invalidate cache
        this.cache.delete(cacheKey);
      }
    }

    // Read and parse file
    const rawContent = await fs.readFile(absolutePath, 'utf-8');

    const document = await this.parseContent(rawContent, {
      path: absolutePath,
      stats,
      gitMetadata,
    });

    // Cache the result
    if (this.config.caching.enabled) {
      this.cache.set(cacheKey, {
        document,
        timestamp: Date.now(),
      });
    }

    return document;
  }

  async parseContent(rawContent: string, options: {
    path: string;
    stats?: fs.Stats;
    gitMetadata?: Partial<MarkdownMetadata['git']>;
  }): Promise<MarkdownDocument> {
    const { path: filePath, stats, gitMetadata } = options;

    // Parse frontmatter
    const { data: frontmatter, content } = matter(rawContent);

    // Generate document ID
    const id = this.generateDocumentId(filePath, rawContent);

    // Create base document structure
    const document: MarkdownDocument = {
      id,
      path: filePath,
      metadata: await this.extractMetadata(rawContent, frontmatter, stats, gitMetadata),
      content: {
        raw: rawContent,
      },
      index: {
        text: new Map(),
        headers: [],
        links: [],
        tags: [],
      },
      timestamps: {
        created: stats?.birthtime || new Date(),
        modified: stats?.mtime || new Date(),
        accessed: new Date(),
        gitCommit: gitMetadata?.commit ? new Date() : undefined,
      },
    };

    // Parse content based on lazy loading configuration
    if (!this.config.lazy.enabled) {
      // Parse everything immediately
      document.content.parsed = await this.parseStructuredContent(content);
      document.content.html = await this.parseToHtml(content);
      document.index = await this.buildIndex(content, document.content.parsed);
    } else {
      // Parse only essential parts immediately
      document.content.parsed = await this.parseStructuredContent(content);

      if (!this.config.lazy.indexOnDemand) {
        document.index = await this.buildIndex(content, document.content.parsed);
      }
    }

    return document;
  }

  private async extractMetadata(
    rawContent: string,
    frontmatter: Record<string, any>,
    stats?: fs.Stats,
    gitMetadata?: Partial<MarkdownMetadata['git']>
  ): Promise<MarkdownMetadata> {
    const checksum = crypto.createHash('md5').update(rawContent).digest('hex');
    const wordCount = this.countWords(rawContent);
    const readingTime = this.config.processing.calculateReadingTime
      ? Math.ceil(wordCount / this.config.processing.wordsPerMinute)
      : 0;

    return {
      frontmatter,
      git: {
        branch: gitMetadata?.branch || '',
        commit: gitMetadata?.commit || '',
        author: gitMetadata?.author || '',
        status: gitMetadata?.status || 'clean',
      },
      system: {
        size: stats?.size || rawContent.length,
        encoding: 'utf-8',
        checksum,
      },
      computed: {
        wordCount,
        readingTime,
        headingCount: 0, // Will be updated after parsing
        linkCount: 0,    // Will be updated after parsing
      },
    };
  }

  private async parseStructuredContent(content: string): Promise<{
    headers: HeaderNode[];
    sections: ContentSection[];
    links: LinkReference[];
  }> {
    const headers = this.extractHeaders(content);
    const sections = this.extractSections(content);
    const links = this.config.processing.extractLinks ? this.extractLinks(content) : [];

    return {
      headers,
      sections,
      links,
    };
  }

  private extractHeaders(content: string): HeaderNode[] {
    const headers: HeaderNode[] = [];
    const lines = content.split('\n');
    let position = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const match = line.match(/^(#{1,6})\s+(.+)$/);

      if (match) {
        const level = match[1].length;
        const text = match[2].trim();
        const id = this.config.processing.generateIds ? this.generateHeaderId(text) : '';

        headers.push({
          level,
          text,
          id,
          position: {
            start: position,
            end: position + line.length,
          },
          children: [],
        });
      }

      position += line.length + 1; // +1 for newline
    }

    // Build header hierarchy
    return this.buildHeaderHierarchy(headers);
  }

  private buildHeaderHierarchy(flatHeaders: HeaderNode[]): HeaderNode[] {
    const result: HeaderNode[] = [];
    const stack: HeaderNode[] = [];

    for (const header of flatHeaders) {
      // Find the correct parent level
      while (stack.length > 0 && stack[stack.length - 1].level >= header.level) {
        stack.pop();
      }

      if (stack.length === 0) {
        result.push(header);
      } else {
        stack[stack.length - 1].children.push(header);
      }

      stack.push(header);
    }

    return result;
  }

  private extractSections(content: string): ContentSection[] {
    const sections: ContentSection[] = [];
    const lines = content.split('\n');
    let currentSection: ContentSection | null = null;
    let position = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const sectionType = this.detectSectionType(line);

      if (sectionType !== 'paragraph' || !currentSection || currentSection.type !== 'paragraph') {
        // Start new section
        if (currentSection) {
          currentSection.position.end = position - 1;
          sections.push(currentSection);
        }

        currentSection = {
          id: crypto.randomUUID(),
          type: sectionType,
          content: line,
          position: {
            start: position,
            end: position + line.length,
          },
        };
      } else {
        // Continue current paragraph section
        currentSection.content += '\n' + line;
        currentSection.position.end = position + line.length;
      }

      position += line.length + 1;
    }

    if (currentSection) {
      sections.push(currentSection);
    }

    return sections;
  }

  private detectSectionType(line: string): ContentSection['type'] {
    if (line.startsWith('```')) return 'code';
    if (line.startsWith('> ')) return 'quote';
    if (line.startsWith('- ') || line.startsWith('* ') || line.match(/^\d+\. /)) return 'list';
    if (line.includes('|') && line.includes('|')) return 'table';
    return 'paragraph';
  }

  private extractLinks(content: string): LinkReference[] {
    const links: LinkReference[] = [];
    const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
    let match;

    while ((match = linkRegex.exec(content)) !== null) {
      const text = match[1];
      const url = match[2];
      const type = this.classifyLinkType(url);

      links.push({
        text,
        url,
        type,
        position: {
          start: match.index,
          end: match.index + match[0].length,
        },
      });
    }

    return links;
  }

  private classifyLinkType(url: string): LinkReference['type'] {
    if (url.startsWith('#')) return 'anchor';
    if (url.startsWith('http://') || url.startsWith('https://')) return 'external';
    return 'internal';
  }

  private async buildIndex(content: string, parsed: MarkdownContent['parsed']): Promise<MarkdownIndex> {
    const textIndex = new Map<string, number[]>();
    const headerIndex: HeaderIndex[] = [];
    const linkIndex: LinkIndex[] = [];
    const tags: string[] = [];

    if (this.config.indexing.enabled) {
      // Build text index
      const words = this.extractWords(content);
      words.forEach(({ word, position }) => {
        if (word.length >= this.config.indexing.minWordLength &&
            !this.config.indexing.stopWords.includes(word.toLowerCase())) {

          const normalizedWord = this.config.indexing.caseSensitive ? word : word.toLowerCase();

          if (!textIndex.has(normalizedWord)) {
            textIndex.set(normalizedWord, []);
          }
          textIndex.get(normalizedWord)!.push(position);
        }
      });
    }

    // Build header index
    if (parsed?.headers) {
      parsed.headers.forEach(header => {
        this.flattenHeaders(header, headerIndex);
      });
    }

    // Build link index
    if (parsed?.links) {
      parsed.links.forEach(link => {
        linkIndex.push({
          text: link.text,
          url: link.url,
          type: link.type,
          position: link.position.start,
        });
      });
    }

    return {
      text: textIndex,
      headers: headerIndex,
      links: linkIndex,
      tags,
    };
  }

  private flattenHeaders(header: HeaderNode, result: HeaderIndex[]): void {
    result.push({
      level: header.level,
      text: header.text,
      id: header.id,
      position: header.position.start,
    });

    header.children.forEach(child => {
      this.flattenHeaders(child, result);
    });
  }

  private extractWords(content: string): Array<{ word: string; position: number }> {
    const words: Array<{ word: string; position: number }> = [];
    const wordRegex = /\b\w+\b/g;
    let match;

    while ((match = wordRegex.exec(content)) !== null) {
      words.push({
        word: match[0],
        position: match.index,
      });
    }

    return words;
  }

  async getHtml(document: MarkdownDocument): Promise<string> {
    if (document.content.html) {
      return document.content.html;
    }

    if (this.config.lazy.parseHtmlOnDemand) {
      const { content } = matter(document.content.raw);
      document.content.html = await this.parseToHtml(content);
      return document.content.html;
    }

    throw new Error('HTML not available and lazy parsing disabled');
  }

  private async parseToHtml(content: string): Promise<string> {
    return marked(content);
  }

  private generateDocumentId(filePath: string, content: string): string {
    const pathHash = crypto.createHash('md5').update(filePath).digest('hex').substring(0, 8);
    const contentHash = crypto.createHash('md5').update(content).digest('hex').substring(0, 8);
    return `md_${pathHash}_${contentHash}`;
  }

  private generateHeaderId(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-')
      .trim();
  }

  private countWords(content: string): number {
    // Remove frontmatter and markdown syntax for accurate word count
    const { content: cleanContent } = matter(content);
    return cleanContent
      .replace(/[#*`_~\[\]()]/g, '')
      .split(/\s+/)
      .filter(word => word.length > 0).length;
  }

  private getCacheKey(filePath: string): string {
    return crypto.createHash('md5').update(filePath).digest('hex');
  }

  private isCacheValid(timestamp: number): boolean {
    return Date.now() - timestamp < this.config.caching.ttl;
  }

  clearCache(): void {
    this.cache.clear();
  }

  // Search functionality
  async search(documents: MarkdownDocument[], query: string): Promise<Array<{
    document: MarkdownDocument;
    matches: Array<{
      type: 'text' | 'header' | 'link';
      text: string;
      position: number;
      score: number;
    }>;
    totalScore: number;
  }>> {
    const results: Array<{
      document: MarkdownDocument;
      matches: Array<{
        type: 'text' | 'header' | 'link';
        text: string;
        position: number;
        score: number;
      }>;
      totalScore: number;
    }> = [];

    const queryWords = query.toLowerCase().split(/\s+/);

    for (const document of documents) {
      const matches: Array<{
        type: 'text' | 'header' | 'link';
        text: string;
        position: number;
        score: number;
      }> = [];

      // Search in text index
      queryWords.forEach(word => {
        const positions = document.index.text.get(word);
        if (positions) {
          positions.forEach(position => {
            matches.push({
              type: 'text',
              text: word,
              position,
              score: 1,
            });
          });
        }
      });

      // Search in headers
      document.index.headers.forEach(header => {
        if (header.text.toLowerCase().includes(query.toLowerCase())) {
          matches.push({
            type: 'header',
            text: header.text,
            position: header.position,
            score: 3, // Headers have higher score
          });
        }
      });

      // Search in links
      document.index.links.forEach(link => {
        if (link.text.toLowerCase().includes(query.toLowerCase()) ||
            link.url.toLowerCase().includes(query.toLowerCase())) {
          matches.push({
            type: 'link',
            text: link.text,
            position: link.position,
            score: 2,
          });
        }
      });

      if (matches.length > 0) {
        const totalScore = matches.reduce((sum, match) => sum + match.score, 0);
        results.push({
          document,
          matches,
          totalScore,
        });
      }
    }

    // Sort by total score descending
    return results.sort((a, b) => b.totalScore - a.totalScore);
  }

  getCacheStats(): {
    size: number;
    entries: number;
  } {
    return {
      size: this.cache.size,
      entries: this.cache.size,
    };
  }

  getCacheSize(): number {
    return this.cache.size;
  }
}