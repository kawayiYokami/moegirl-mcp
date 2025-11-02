/**
 * 萌娘百科 MCP 服务器
 * 使用官方 MCP SDK 实现
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
  ListResourcesRequestSchema,
  TextContent,
  Tool,
  Resource
} from '@modelcontextprotocol/sdk/types.js';

import { MoegirlClient } from '../core/moegirl_client.js';
import { WikiTextCleaner } from '../core/wikitext_cleaner.js';
import { CacheManager } from '../core/cache_manager.js';
import { SearchParams, PageParams, ServerStats, MCPToolResponse } from '../types/index.js';

export class MoegirlMCPServer {
  private server: Server;
  private client: MoegirlClient;
  private cache: CacheManager;
  private isInitialized: boolean = false;
  private stats: ServerStats;

  constructor() {
    this.server = new Server(
      {
        name: 'moegirl-mcp',
        version: '0.1.0',
        description: '萌娘百科 MCP 服务器 - 提供萌娘百科搜索、页面获取等功能'
      },
      {
        capabilities: {
          tools: {},
          resources: {}
        }
      }
    );

    this.client = new MoegirlClient();
    this.cache = new CacheManager();
    this.stats = {
      isInitialized: false,
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      cacheStats: this.cache.getStats()
    };

    this.setupHandlers();
    this.setupErrorHandling();
  }

  /**
   * 设置错误处理
   */
  private setupErrorHandling(): void {
    process.on('uncaughtException', (error) => {
      console.error('❌ 未捕获的异常:', error);
      this.stats.failedRequests++;
    });

    process.on('unhandledRejection', (reason, promise) => {
      console.error('❌ 未处理的Promise拒绝:', reason);
      this.stats.failedRequests++;
    });
  }

  /**
   * 设置请求处理器
   */
  private setupHandlers(): void {
    // 工具列表处理器
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return { tools: this.getToolList() };
    });

    // 工具调用处理器
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      try {
        this.stats.totalRequests++;
        const result = await this.handleToolCall(request);
        this.stats.successfulRequests++;
        this.stats.lastRequestTime = new Date();
        return result;
      } catch (error) {
        this.stats.failedRequests++;
        console.error(`❌ 工具调用失败:`, error);
        return this.createErrorResponse(error);
      }
    });

    // 资源列表处理器
    this.server.setRequestHandler(ListResourcesRequestSchema, async () => {
      return { resources: this.getResourceList() };
    });

    // 资源读取处理器
    this.server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
      try {
        return this.handleResourceRead(request);
      } catch (error) {
        console.error(`❌ 资源读取失败:`, error);
        throw error;
      }
    });
  }

  /**
   * 获取工具列表
   */
  private getToolList(): Tool[] {
    return [
      {
        name: 'search_moegirl',
        description: '搜索萌娘百科条目',
        inputSchema: {
          type: 'object',
          properties: {
            keyword: {
              type: 'string',
              description: '搜索关键词'
            },
            limit: {
              type: 'number',
              description: '返回结果数量限制',
              default: 5,
              minimum: 1,
              maximum: 20
            }
          },
          required: ['keyword']
        }
      },
      {
        name: 'get_page',
        description: '获取萌娘百科页面内容',
        inputSchema: {
          type: 'object',
          properties: {
            pageid: {
              type: 'number',
              description: '页面ID（与title二选一）'
            },
            title: {
              type: 'string',
              description: '页面标题（与pageid二选一）'
            },
            clean_content: {
              type: 'boolean',
              description: '是否清理Wiki标记',
              default: true
            },
            max_length: {
              type: 'number',
              description: '最大返回字符数，默认2000',
              default: 2000,
              minimum: 100,
              maximum: 10000
            }
          },
          oneOf: [
            { required: ['pageid'] },
            { required: ['title'] }
          ]
        }
      },
    ];
  }

  /**
   * 处理工具调用
   */
  private async handleToolCall(request: any): Promise<any> {
    const { name, arguments: args } = request.params;

    console.log(`🔧 工具调用: ${name}`, args);

    switch (name) {
      case 'search_moegirl':
        return await this.handleSearchMoegirl(args);
      
      case 'get_page':
        return await this.handleGetPage(args);
      
      default:
        throw new Error(`未知工具: ${name}`);
    }
  }

  /**
   * 处理搜索萌娘百科
   */
  private async handleSearchMoegirl(args: any): Promise<MCPToolResponse> {
    const { keyword, limit = 5 } = args;

    // 检查缓存
    const cacheKey = CacheManager.buildSearchKey(keyword, limit);
    const cachedResult = this.cache.get(cacheKey);
    
    if (cachedResult && Array.isArray(cachedResult)) {
      console.log(`📋 使用缓存搜索结果: ${keyword}`);
      return {
        content: [{
          type: 'text',
          text: this.formatSearchResults(cachedResult)
        }]
      };
    }

    // 执行搜索
    const searchParams: SearchParams = { keyword, limit };
    const results = await this.client.search(searchParams);

    // 缓存结果
    this.cache.set(cacheKey, results);

    return {
      content: [{
        type: 'text',
        text: this.formatSearchResults(results)
      }]
    };
  }

  /**
   * 处理获取页面
   */
  private async handleGetPage(args: any): Promise<any> {
    const { pageid, title, clean_content = true, max_length = 2000 } = args;

    // 检查缓存
    const cacheKey = CacheManager.buildDocKey(pageid || title);
    const cachedPage = this.cache.get(cacheKey);
    
    if (cachedPage) {
      console.log(`📋 使用缓存页面: ${pageid || title}`);
      return {
        content: [{
          type: 'text',
          text: this.formatPageContent(cachedPage, max_length)
        }]
      };
    }

    // 获取页面内容
    const pageParams: PageParams = { pageid, title };
    const pageContent = await this.client.getPageContent(pageParams);

    if (!pageContent) {
      throw new Error(`页面获取失败: ${pageid || title}`);
    }

    // 清理内容
    if (clean_content) {
      pageContent.cleaned_content = WikiTextCleaner.clean(pageContent.content);
    }

    // 缓存结果
    this.cache.set(cacheKey, pageContent);

    return {
      content: [{
        type: 'text',
        text: this.formatPageContent(pageContent, max_length)
      }]
    };
  }

  

  /**
   * 格式化搜索结果
   */
  private formatSearchResults(results: any[] | undefined): string {
    if (!results || results.length === 0) {
      return '❌ 未找到相关条目';
    }

    let text = `🔍 萌娘百科搜索结果\n`;
    text += '=' .repeat(20) + '\n\n';

    results.forEach((result, index) => {
      text += `${index + 1}. ${result.title}\n`;
      text += `   页面ID: ${result.pageid}\n`;
      text += `   链接: ${result.url}\n`;
      if (result.snippet) {
        text += `   摘要: ${result.snippet.replace(/<[^>]*>/g, '')}\n`;
      }
      text += '\n';
    });

    return text;
  }

  /**
   * 格式化页面内容
   */
  private formatPageContent(page: any, maxLength: number = 2000): string {
    const content = page.cleaned_content || page.content;
    
    let text = `📖 ${page.title}
`;
    text += '=' .repeat(page.title.length + 3) + '\n\n';
    
    if (content.length > maxLength) {
      text += content.substring(0, maxLength);
      const remaining = content.length - maxLength;
      text += `

... (剩余 ${remaining} 字符未显示，可增加 max_length 参数查看完整内容)`;
    } else {
      text += content;
      text += `

(完整内容，共 ${content.length} 字符)`;
    }

    return text;
  }

  /**
   * 创建错误响应
   */
  private createErrorResponse(error: any): any {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorType = error instanceof Error ? error.name : typeof error;

    return {
      content: [{
        type: 'text',
        text: `❌ 操作失败\n\n错误类型: ${errorType}\n错误信息: ${errorMessage}\n\n建议操作:\n1. 检查网络连接\n2. 验证参数格式\n3. 重试操作\n4. 查看服务器状态`
      }]
    };
  }

  /**
   * 获取资源列表
   */
  private getResourceList(): Resource[] {
    return [
      {
        uri: 'help://search',
        name: '搜索帮助',
        description: '萌娘百科搜索功能使用说明',
        mimeType: 'text/plain'
      },
      {
        uri: 'help://page',
        name: '页面帮助',
        description: '页面获取功能使用说明',
        mimeType: 'text/plain'
      }
    ];
  }

  /**
   * 处理资源读取
   */
  private async handleResourceRead(request: any): Promise<any> {
    const { uri } = request.params;

    switch (uri) {
      case 'help://search':
        return {
          contents: [{
            uri,
            mimeType: 'text/plain',
            text: this.getSearchHelpText()
          }]
        };

      case 'help://page':
        return {
          contents: [{
            uri,
            mimeType: 'text/plain',
            text: this.getPageHelpText()
          }]
        };

      default:
        throw new Error(`未知资源: ${uri}`);
    }
  }

  /**
   * 获取搜索帮助文本
   */
  private getSearchHelpText(): string {
    return `萌娘百科搜索功能使用说明

工具: search_moegirl

参数:
- keyword (必填): 搜索关键词
- limit (可选): 返回结果数量限制，默认5，范围1-20

使用示例:
search_moegirl(keyword="芙宁娜")
search_moegirl(keyword="原神", limit=10)

注意事项:
- 搜索结果会自动缓存30分钟
- 支持中文和英文搜索
- 返回结果包含页面ID、标题、链接和摘要
`;
  }

  /**
   * 获取页面帮助文本
   */
  private getPageHelpText(): string {
    return `萌娘百科页面获取功能使用说明

工具: get_page

参数:
- pageid (可选): 页面ID，数字类型
- title (可选): 页面标题，字符串类型
- clean_content (可选): 是否清理Wiki标记，默认true
- max_length (可选): 最大返回字符数，默认2000，范围100-10000

使用规则:
- pageid 和 title 必须提供其中一个
- pageid 优先级高于 title

使用示例:
get_page(pageid=12345)
get_page(title="芙宁娜")
get_page(title="原神", clean_content=false)
get_page(title="原神", max_length=5000)

注意事项:
- 页面内容会自动缓存30分钟
- clean_content=true 时会移除MediaWiki标记
- max_length 控制返回内容的字符数量
- 内容被截断时会显示剩余字符数
- 支持中文和英文页面标题
`;
  }

  /**
   * 启动MCP服务器
   */
  async start(): Promise<void> {
    try {
      console.log('🚀 启动萌娘百科 MCP 服务器...');

      // 检查API连接
      const isConnected = await this.client.checkConnection();
      if (!isConnected) {
        throw new Error('萌娘百科API连接失败');
      }

      console.log('✅ 萌娘百科API连接正常');

      this.isInitialized = true;
      console.log('✅ MCP 服务器初始化完成');

      // 连接传输层
      const transport = new StdioServerTransport();
      await this.server.connect(transport);
      console.log('🚀 萌娘百科 MCP 服务器已启动');

    } catch (error) {
      console.error('❌ MCP 服务器启动失败:', error);
      throw error;
    }
  }

  /**
   * 关闭MCP服务器
   */
  async close(): Promise<void> {
    console.log('🔄 正在关闭 MCP 服务器...');
    this.cache.clear();
    this.isInitialized = false;
    console.log('✅ MCP 服务器已关闭');
  }
}