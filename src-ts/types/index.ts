/**
 * 类型定义
 */

export interface MoegirlSearchResult {
  title: string;
  pageid: number;
  url: string;
  snippet: string;
}

export interface MoegirlPageContent {
  title: string;
  pageid: number;
  content: string;
  cleaned_content?: string;
}

export interface SearchParams {
  keyword: string;
  limit?: number;
  search_mode?: 'original' | 'fuzzy';
}

export interface PageParams {
  pageid?: number;
  title?: string;
}

export interface CacheStats {
  total_entries: number;
  cache_hits: number;
  cache_misses: number;
  hit_rate: number;
}

export interface ServerStats {
  isInitialized: boolean;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  cacheStats: CacheStats;
  lastRequestTime?: Date;
}

export interface MCPToolResponse {
  content: Array<{
    type: 'text';
    text: string;
  }>;
}

// 页面结构相关类型
export interface PageSection {
  type: 'heading' | 'template' | 'content';
  title?: string;
  level?: number; // 标题级别 (1-6)
  templateName?: string; // 模板名称
  content: string;
  startLine: number;
  endLine: number;
}

export interface PageTemplate {
  name: string;
  fullText: string;
  parameters: Map<string, string>;
  startLine: number;
  endLine: number;
}

export interface PageStructure {
  title: string;
  sections: PageSection[];
  templates: PageTemplate[];
  headings: Array<{
    title: string;
    level: number;
    line: number;
  }>;
  toc: string; // 目录字符串
}

// 新增参数类型
export interface PageStructureParams {
  pageid?: number;
  title?: string;
}

export interface PageSectionsParams {
  pageid?: number;
  title?: string;
  section_titles?: string[]; // 要获取的标题列表
  template_names?: string[]; // 要获取的模板名称列表
  max_length?: number; // 最大返回字符数
}