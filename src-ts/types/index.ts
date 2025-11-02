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