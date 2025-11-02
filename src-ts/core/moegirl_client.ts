/**
 * 萌娘百科API客户端
 * 基于Angel Eye插件的Python实现移植到TypeScript
 */

import axios, { AxiosInstance, AxiosResponse } from 'axios';
import { MoegirlSearchResult, MoegirlPageContent, SearchParams, PageParams } from '../types/index.js';

export class MoegirlClient {
  private api: AxiosInstance;
  private readonly apiEndpoint = 'https://zh.moegirl.org.cn/api.php';
  private readonly siteName = 'MoegirlClient';

  constructor() {
    this.api = axios.create({
      baseURL: this.apiEndpoint,
      timeout: 15000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
        'Accept-Encoding': 'gzip, deflate'
      }
    });
  }

  /**
   * 根据关键词搜索萌娘百科
   * @param params 搜索参数
   * @returns 搜索结果列表
   */
  async search(params: SearchParams): Promise<MoegirlSearchResult[]> {
    const { keyword, limit = 5 } = params;

    try {
      console.log(`🔍 [${this.siteName}] 搜索关键词: ${keyword}`);

      const response: AxiosResponse<any> = await this.api.get('', {
        params: {
          action: 'query',
          format: 'json',
          list: 'search',
          srsearch: keyword,
          srlimit: limit,
          srprop: 'snippet'
        }
      });

      const data = response.data;

      if (!data || !data.query || !data.query.search) {
        console.warn(`⚠️ [${this.siteName}] 搜索结果为空或格式异常`);
        return [];
      }

      const results: MoegirlSearchResult[] = data.query.search.map((item: any) => ({
        title: item.title,
        pageid: item.pageid,
        url: `https://zh.moegirl.org.cn/index.php?curid=${item.pageid}`,
        snippet: item.snippet || ''
      }));

      console.log(`✅ [${this.siteName}] 搜索完成，找到 ${results.length} 个结果`);
      return results;

    } catch (error) {
      console.error(`❌ [${this.siteName}] 搜索失败:`, error);
      if (axios.isAxiosError(error)) {
        console.error(`🔍 [${this.siteName}] 请求详情:`, {
          status: error.response?.status,
          statusText: error.response?.statusText,
          url: error.config?.url
        });
      }
      return [];
    }
  }

  /**
   * 根据页面ID获取页面内容
   * @param params 页面参数
   * @returns 页面内容
   */
  async getPageContent(params: PageParams): Promise<MoegirlPageContent | null> {
    const { pageid, title } = params;

    if (!pageid && !title) {
      console.warn(`⚠️ [${this.siteName}] 调用 getPageContent 时未提供 pageid 或 title`);
      return null;
    }

    try {
      console.log(`📄 [${this.siteName}] 获取页面内容: pageid=${pageid}, title=${title}`);

      const requestParams: any = {
        action: 'parse',
        format: 'json',
        prop: 'wikitext'
      };

      if (pageid) {
        requestParams.pageid = pageid;
      } else if (title) {
        requestParams.page = title;
      }

      const response: AxiosResponse<any> = await this.api.get('', {
        params: requestParams
      });

      const data = response.data;

      if (!data || !data.parse || !data.parse.wikitext) {
        console.warn(`⚠️ [${this.siteName}] 页面内容获取失败或格式异常`);
        return null;
      }

      const result: MoegirlPageContent = {
        title: data.parse.title,
        pageid: data.parse.pageid,
        content: data.parse.wikitext['*']
      };

      console.log(`✅ [${this.siteName}] 页面内容获取成功，内容长度: ${result.content.length}`);
      return result;

    } catch (error) {
      console.error(`❌ [${this.siteName}] 获取页面内容失败:`, error);
      if (axios.isAxiosError(error)) {
        console.error(`🔍 [${this.siteName}] 请求详情:`, {
          status: error.response?.status,
          statusText: error.response?.statusText,
          url: error.config?.url
        });
      }
      return null;
    }
  }

  /**
   * 根据页面ID获取完整页面信息（包含搜索结果信息）
   * @param pageid 页面ID
   * @returns 完整页面信息
   */
  async getFullPageInfo(pageid: number): Promise<(MoegirlSearchResult & MoegirlPageContent) | null> {
    try {
      // 先获取页面内容
      const pageContent = await this.getPageContent({ pageid });
      if (!pageContent) {
        return null;
      }

      // 构建完整信息
      const fullInfo: MoegirlSearchResult & MoegirlPageContent = {
        title: pageContent.title,
        pageid: pageContent.pageid,
        url: `https://zh.moegirl.org.cn/index.php?curid=${pageid}`,
        snippet: '', // 搜索时才有snippet
        content: pageContent.content
      };

      return fullInfo;

    } catch (error) {
      console.error(`❌ [${this.siteName}] 获取完整页面信息失败:`, error);
      return null;
    }
  }

  /**
   * 检查API连接状态
   * @returns 连接状态
   */
  async checkConnection(): Promise<boolean> {
    try {
      const response = await this.api.get('', {
        params: {
          action: 'query',
          format: 'json',
          meta: 'siteinfo'
        }
      });

      return response.status === 200 && !!response.data.query;
    } catch (error) {
      console.error(`❌ [${this.siteName}] API连接检查失败:`, error);
      return false;
    }
  }
}