/**
 * CLI 命令处理器
 * 实现命令行模式的各种功能
 */

import { Command } from 'commander';
import { MoegirlClient } from '../core/moegirl_client.js';
import { WikiTextCleaner } from '../core/wikitext_cleaner.js';
import { CacheManager } from '../core/cache_manager.js';
import { SearchParams, PageParams } from '../types/index.js';

export class CLICommands {
  private client: MoegirlClient;
  private cache: CacheManager;

  constructor() {
    this.client = new MoegirlClient();
    this.cache = new CacheManager();
    this.setupGracefulShutdown();
  }

  /**
   * 设置优雅关闭
   */
  private setupGracefulShutdown(): void {
    const shutdown = async () => {
      console.log('\n🔄 正在关闭萌娘百科 CLI...');
      process.exit(0);
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
  }

  /**
   * 注册所有命令
   */
  registerCommands(program: Command): void {
    // 搜索命令
    program
      .command('search')
      .description('搜索萌娘百科条目')
      .argument('<keyword>', '搜索关键词')
      .option('-l, --limit <number>', '返回结果数量限制', '5')
      .option('-m, --mode <mode>', '搜索模式 (original|fuzzy)', 'original')
      .option('--json', '输出 JSON 格式')
      .option('--no-cache', '不使用缓存')
      .action(async (keyword, options) => {
        await this.handleSearchCommand(keyword, options);
      });

    // 页面获取命令
    program
      .command('page')
      .description('获取萌娘百科页面内容')
      .argument('<identifier>', '页面ID或标题')
      .option('--id', '将参数作为页面ID处理')
      .option('--no-clean', '不清理Wiki标记')
      .option('--json', '输出 JSON 格式')
      .option('--no-cache', '不使用缓存')
      .option('-l, --limit <number>', '最大返回字符数', '2000')
      .action(async (identifier, options) => {
        await this.handlePageCommand(identifier, options);
      });

    // 缓存统计命令
    program
      .command('cache-stats')
      .description('查看缓存统计信息')
      .option('--json', '输出 JSON 格式')
      .action(async (options) => {
        await this.handleCacheStatsCommand(options);
      });

    // 缓存清理命令
    program
      .command('cache-clear')
      .description('清理缓存')
      .option('--all', '清空所有缓存')
      .action(async (options) => {
        await this.handleCacheClearCommand(options);
      });

    // 连接测试命令
    program
      .command('test')
      .description('测试萌娘百科API连接')
      .action(async () => {
        await this.handleTestCommand();
      });

    // MCP 服务器模式
    program
      .command('mcp')
      .description('启动 MCP 服务器模式')
      .action(async () => {
        await this.handleMCPCommand();
      });
  }

  /**
   * 处理搜索命令
   */
  private async handleSearchCommand(keyword: string, options: any): Promise<void> {
    try {
      console.log(`🔍 正在搜索萌娘百科: ${keyword}`);
      console.log('=' .repeat(40));

      const limit = parseInt(options.limit) || 5;
      const useCache = options.cache !== false;

      // 检查缓存
      if (useCache) {
        const cacheKey = CacheManager.buildSearchKey(keyword, limit);
        const cachedResult = this.cache.get(cacheKey);
        
        if (cachedResult && Array.isArray(cachedResult)) {
          console.log('📋 使用缓存结果');
          this.displaySearchResults(cachedResult, options.json);
          return;
        }
      }

      // 执行搜索
      const searchParams: SearchParams = { keyword, limit };
      const results = await this.client.search(searchParams);

      if (options.json) {
        console.log(JSON.stringify(results, null, 2));
      } else {
        this.displaySearchResults(results, options.json);
      }

      // 缓存结果
      if (useCache && results.length > 0) {
        const cacheKey = CacheManager.buildSearchKey(keyword, limit);
        this.cache.set(cacheKey, results);
        console.log(`💾 结果已缓存`);
      }

    } catch (error) {
      console.error(`❌ 搜索失败: ${error}`);
      process.exit(1);
    }
  }

  /**
   * 处理页面获取命令
   */
  private async handlePageCommand(identifier: string, options: any): Promise<void> {
    try {
      const useId = options.id || /^\d+$/.test(identifier);
      const useCache = options.cache !== false;
      const cleanContent = options.clean !== false;
      const maxLength = parseInt(options.limit) || 2000;

      console.log(`📖 正在获取页面: ${identifier} (${useId ? 'ID' : '标题'})`);
      console.log('=' .repeat(40));

      // 检查缓存
      if (useCache) {
        const cacheKey = CacheManager.buildDocKey(identifier);
        const cachedPage = this.cache.get(cacheKey);
        
        if (cachedPage) {
          console.log('📋 使用缓存页面');
          this.displayPageContent(cachedPage, options.json, cleanContent, maxLength);
          return;
        }
      }

      // 获取页面内容
      const pageParams: PageParams = useId ? 
        { pageid: parseInt(identifier) } : 
        { title: identifier };

      const pageContent = await this.client.getPageContent(pageParams);

      if (!pageContent) {
        console.error(`❌ 页面获取失败: ${identifier}`);
        process.exit(1);
      }

      // 清理内容
      if (cleanContent) {
        pageContent.cleaned_content = WikiTextCleaner.clean(pageContent.content);
      }

      this.displayPageContent(pageContent, options.json, cleanContent, maxLength);

      // 缓存结果
      if (useCache) {
        const cacheKey = CacheManager.buildDocKey(identifier);
        this.cache.set(cacheKey, pageContent);
        console.log(`💾 页面已缓存`);
      }

    } catch (error) {
      console.error(`❌ 页面获取失败: ${error}`);
      process.exit(1);
    }
  }

  /**
   * 处理缓存统计命令
   */
  private async handleCacheStatsCommand(options: any): Promise<void> {
    const stats = this.cache.getStats();

    if (options.json) {
      console.log(JSON.stringify(stats, null, 2));
    } else {
      console.log('📊 缓存统计信息');
      console.log('=' .repeat(20));
      console.log(`总条目数: ${stats.total_entries}`);
      console.log(`缓存命中: ${stats.cache_hits}`);
      console.log(`缓存未命中: ${stats.cache_misses}`);
      console.log(`命中率: ${(stats.hit_rate * 100).toFixed(2)}%`);
    }
  }

  /**
   * 处理缓存清理命令
   */
  private async handleCacheClearCommand(options: any): Promise<void> {
    let cleanedCount = 0;
    
    if (options.all) {
      const size = this.cache.size();
      this.cache.clear();
      cleanedCount = size;
      console.log(`🧹 已清空所有缓存 (${cleanedCount} 项)`);
    } else {
      cleanedCount = this.cache.cleanup();
      console.log(`🧹 已清理过期缓存 (${cleanedCount} 项)`);
    }
  }

  /**
   * 处理连接测试命令
   */
  private async handleTestCommand(): Promise<void> {
    console.log('🔗 测试萌娘百科API连接...');
    console.log('=' .repeat(30));

    try {
      const isConnected = await this.client.checkConnection();
      
      if (isConnected) {
        console.log('✅ API连接正常');
        
        // 执行一个简单搜索测试
        console.log('\n🔍 执行搜索测试...');
        const testResults = await this.client.search({ keyword: '测试', limit: 1 });
        
        if (testResults.length > 0) {
          console.log('✅ 搜索功能正常');
          console.log(`   找到 ${testResults.length} 个结果`);
        } else {
          console.log('⚠️ 搜索功能异常（无结果）');
        }
        
      } else {
        console.log('❌ API连接失败');
        process.exit(1);
      }
      
    } catch (error) {
      console.error(`❌ 连接测试失败: ${error}`);
      process.exit(1);
    }
  }

  /**
   * 处理 MCP 服务器命令
   */
  private async handleMCPCommand(): Promise<void> {
    try {
      console.log('🚀 启动萌娘百科 MCP 服务器模式...\n');

      // 动态导入 MCP 服务器
      const { MoegirlMCPServer } = await import('../mcp/server.js');
      const mcpServer = new MoegirlMCPServer();

      await mcpServer.start();

    } catch (error) {
      console.error(`❌ MCP 服务器启动失败: ${error}`);
      process.exit(1);
    }
  }

  /**
   * 显示搜索结果
   */
  private displaySearchResults(results: any[] | undefined, jsonFormat: boolean): void {
    if (jsonFormat) {
      console.log(JSON.stringify(results, null, 2));
      return;
    }

    if (!results || results.length === 0) {
      console.log('❌ 未找到相关条目');
      return;
    }

    console.log(`🔍 搜索结果 (${results.length} 个):\n`);

    results.forEach((result, index) => {
      console.log(`${index + 1}. ${result.title}`);
      console.log(`   页面ID: ${result.pageid}`);
      console.log(`   链接: ${result.url}`);
      if (result.snippet) {
        // 移除HTML标签
        const cleanSnippet = result.snippet.replace(/<[^>]*>/g, '');
        console.log(`   摘要: ${cleanSnippet}`);
      }
      console.log('');
    });
  }

  /**
   * 显示页面内容
   */
  private displayPageContent(page: any, jsonFormat: boolean, cleanContent: boolean, maxLength: number = 2000): void {
    if (jsonFormat) {
      console.log(JSON.stringify(page, null, 2));
      return;
    }

    const content = cleanContent ? page.cleaned_content || page.content : page.content;
    
    console.log(`📖 ${page.title}`);
    console.log('='.repeat(page.title.length + 3));
    console.log(`页面ID: ${page.pageid}`);
    console.log(`内容长度: ${content.length} 字符`);
    console.log(`清理状态: ${cleanContent ? '已清理' : '原始'}\n`);

    // 限制显示长度
    if (content.length > maxLength) {
      console.log(content.substring(0, maxLength));
      const remaining = content.length - maxLength;
      console.log(`\n... (剩余 ${remaining} 字符未显示)`);
    } else {
      console.log(content);
      console.log(`\n(完整内容，共 ${content.length} 字符)`);
    }
  }
}