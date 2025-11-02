#!/usr/bin/env node

/**
 * 萌娘百科 MCP 服务器主入口
 */

import { MoegirlMCPServer } from './mcp/server.js';

async function main() {
  console.log('🚀 启动萌娘百科 MCP 服务器...');

  const server = new MoegirlMCPServer();

  try {
    await server.start();
  } catch (error) {
    console.error('❌ MCP 服务器启动失败:', error);
    process.exit(1);
  }
}

// 运行主函数
main().catch(error => {
  console.error('❌ MCP 启动失败:', error);
  process.exit(1);
});