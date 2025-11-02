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
import { PageContentParser } from '../core/page_content_parser.js';
import { SearchParams, PageParams, PageStructureParams, PageSectionsParams, ServerStats, MCPToolResponse } from '../types/index.js';

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
        description: '搜索ACG、二次元、动漫、游戏相关内容 - 专门用于萌娘百科条目搜索',
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
        description: '获取ACG、二次元相关页面内容 - 专门用于萌娘百科页面获取，含自动目录',
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
      {
        name: 'get_page_sections',
        description: '获取ACG、二次元页面的指定内容 - 专门用于萌娘百科页面段落提取',
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
            section_titles: {
              type: 'array',
              items: { type: 'string' },
              description: '要获取的标题列表，支持部分匹配'
            },
            template_names: {
              type: 'array',
              items: { type: 'string' },
              description: '要获取的模板名称列表，支持部分匹配'
            },
            max_length: {
              type: 'number',
              description: '最大返回字符数，默认5000',
              default: 5000,
              minimum: 100,
              maximum: 20000
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
      
      case 'get_page_sections':
        return await this.handleGetPageSections(args);
      
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
          text: this.formatPageContentWithTOC(cachedPage, max_length)
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
        text: this.formatPageContentWithTOC(pageContent, max_length)
      }]
    };
  }

  

  /**
   * 处理获取页面段落
   */
  private async handleGetPageSections(args: any): Promise<MCPToolResponse> {
    const { pageid, title, section_titles = [], template_names = [], max_length = 5000 } = args;

    if (section_titles.length === 0 && template_names.length === 0) {
      throw new Error('必须提供 section_titles 或 template_names 参数');
    }

    // 检查缓存
    const cacheKey = CacheManager.buildDocKey(pageid || title);
    const cachedPage = this.cache.get(cacheKey);
    
    let pageContent: any;
    
    if (cachedPage) {
      console.log(`📋 使用缓存页面: ${pageid || title}`);
      pageContent = cachedPage;
    } else {
      // 获取页面内容
      const pageParams: PageParams = { pageid, title };
      pageContent = await this.client.getPageContent(pageParams);

      if (!pageContent) {
        throw new Error(`页面获取失败: ${pageid || title}`);
      }

      // 缓存结果
      this.cache.set(cacheKey, pageContent);
    }

    // 解析页面结构
    const structure = PageContentParser.parsePage(pageContent.title, pageContent.content);

    // 收集请求的内容
    const results: string[] = [];

    // 获取指定标题的内容
    for (const titleQuery of section_titles) {
      const content = PageContentParser.getContentByTitle(structure, titleQuery);
      if (content) {
        results.push(`📖 ${titleQuery}\n${'='.repeat(titleQuery.length + 3)}\n\n${content}`);
      }
    }

    // 获取指定模板的内容
    for (const templateQuery of template_names) {
      const templates = PageContentParser.findTemplatesByName(structure, templateQuery);
      for (const template of templates) {
        results.push(`🔧 模板: ${template.name}\n${'='.repeat(template.name.length + 5)}\n\n${template.fullText}`);
      }
    }

    if (results.length === 0) {
      return {
        content: [{
          type: 'text',
          text: `❌ 未找到匹配的标题或模板\n\n搜索的标题: ${section_titles.join(', ')}\n搜索的模板: ${template_names.join(', ')}`
        }]
      };
    }

    const combinedContent = results.join('\n\n' + '-'.repeat(50) + '\n\n');
    
    // 限制内容长度
    let finalContent = combinedContent;
    if (combinedContent.length > max_length) {
      finalContent = combinedContent.substring(0, max_length);
      const remaining = combinedContent.length - max_length;
      finalContent += `\n\n... (剩余 ${remaining} 字符未显示，可增加 max_length 参数查看完整内容)`;
    }

    return {
      content: [{
        type: 'text',
        text: finalContent
      }]
    };
  }

  /**
   * 格式化页面结构
   */
  private formatPageStructure(structure: any): string {
    let text = `📋 ${structure.title} 页面结构\n`;
    text += '=' .repeat(structure.title.length + 7) + '\n\n';
    
    // 添加目录
    text += structure.toc + '\n';
    
    // 添加模板统计
    if (structure.templates.length > 0) {
      text += '\n🔧 模板列表\n';
      text += '-'.repeat(10) + '\n';
      
      const templateCount = new Map<string, number>();
      structure.templates.forEach(template => {
        templateCount.set(template.name, (templateCount.get(template.name) || 0) + 1);
      });
      
      Array.from(templateCount.entries()).forEach(([name, count]) => {
        text += `• ${name} (${count}个)\n`;
      });
    }
    
    // 添加段落统计
    text += '\n📊 内容统计\n';
    text += '-'.repeat(10) + '\n';
    text += `• 总段落数: ${structure.sections.length}\n`;
    text += `• 标题数量: ${structure.headings.length}\n`;
    text += `• 模板数量: ${structure.templates.length}\n`;
    text += `• 内容长度: ${structure.sections.reduce((sum, section) => sum + section.content.length, 0)} 字符\n`;
    
    return text;
  }

  /**
   * 格式化页面内容（包含目录）
   */
  private formatPageContentWithTOC(page: any, maxLength: number = 2000): string {
    // 解析页面结构
    const structure = PageContentParser.parsePage(page.title, page.content);
    
    let text = '';
    
    // 添加目录
    if (structure.toc && structure.headings.length > 0) {
      text += structure.toc + '\n\n';
    }
    
    // 添加页面内容
    const content = page.cleaned_content || page.content;
    
    text += `📖 ${page.title}
`;
    text += '=' .repeat(page.title.length + 3) + '\n\n';
    
    if (content.length > maxLength) {
      text += content.substring(0, maxLength);
      const remaining = content.length - maxLength;
      text += `\n\n... (剩余 ${remaining} 字符未显示，可使用 get_page_sections 获取特定部分内容)`;
    } else {
      text += content;
      text += `\n\n(完整内容，共 ${content.length} 字符)`;
    }

    return text;
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
      },
      
      {
        uri: 'help://sections',
        name: '段落帮助',
        description: '页面段落获取功能使用说明',
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

      case 'help://sections':
        return {
          contents: [{
            uri,
            mimeType: 'text/plain',
            text: this.getSectionsHelpText()
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

返回内容:
- 页面目录（自动生成）
- 页面开头内容
- 内容长度和状态信息

注意事项:
- 页面内容会自动缓存30分钟
- 自动在内容开头包含页面目录，便于导航
- clean_content=true 时会移除MediaWiki标记
- max_length 控制返回内容的字符数量
- 内容被截断时会提示使用 get_page_sections 获取特定部分
- 支持中文和英文页面标题
- 适用于长页面的快速概览和导航
`;
  }

  

  /**
   * 获取页面段落帮助文本
   */
  private getSectionsHelpText(): string {
    return `萌娘百科页面段落获取功能使用说明

工具: get_page_sections

参数:
- pageid (可选): 页面ID，数字类型
- title (可选): 页面标题，字符串类型
- section_titles (可选): 要获取的标题列表，支持部分匹配
- template_names (可选): 要获取的模板名称列表，支持部分匹配
- max_length (可选): 最大返回字符数，默认5000，范围100-20000

使用规则:
- pageid 和 title 必须提供其中一个
- section_titles 和 template_names 必须至少提供一个
- 支持同时获取多个标题和模板内容

使用示例:
get_page_sections(title="芙宁娜", section_titles=["命之座", "天赋"])
get_page_sections(title="原神", template_names=["原神角色"])
get_page_sections(pageid=12345, section_titles=["简介"], template_names=["Cquote"])

返回内容:
- 指定标题下的完整内容
- 指定模板的完整定义
- 内容按请求顺序排列，用分隔线分开

注意事项:
- 页面内容会自动缓存30分钟
- 标题匹配支持部分匹配（包含关系）
- 模板名称匹配支持部分匹配
- 适用于获取页面的特定部分内容
- 避免返回整个长页面，提高效率
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
        console.error('\n💡 启动提示:');
        console.error('   MCP服务器将尝试启动，但API功能可能不可用');
        console.error('   这通常是由于萌娘百科服务器暂时不可用导致的');
        console.error('   您可以稍后重启服务器，或等待萌娘百科服务恢复\n');
        
        // 不抛出错误，允许服务器启动但标记API不可用
        this.isInitialized = false;
      } else {
        console.log('✅ 萌娘百科API连接正常');
        this.isInitialized = true;
      }

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