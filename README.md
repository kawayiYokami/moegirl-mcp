# 萌娘百科 MCP 服务器

基于 Node.js 和 TypeScript 的萌娘百科专用 MCP 服务器，提供搜索、页面获取等功能，包含完整的 CLI 调试工具。

## 功能特性

- 🔍 **搜索萌娘百科条目** - 支持关键词搜索
- 📖 **获取页面内容** - 支持页面ID和标题获取
- 🧹 **Wiki文本清理** - 移除MediaWiki标记，保留核心内容
- 💾 **智能缓存** - 30分钟缓存，提升响应速度
- 🛠️ **CLI调试工具** - 完整的命令行调试界面
- 🚀 **MCP服务器** - 标准MCP协议支持

## 安装使用

### 方式一：直接使用 npx（推荐）

```bash
# 搜索萌娘百科
npx moegirlwiki-mcp moegirl-cli search "原神"

# 获取页面内容
npx moegirlwiki-mcp moegirl-cli page "原神"

# 启动MCP服务器
npx moegirlwiki-mcp moegirl-mcp
```

### 方式二：全局安装

```bash
# 全局安装
npm install -g moegirlwiki-mcp

# 使用命令
moegirl-cli search "原神"
moegirl-cli page "原神"
moegirl-mcp  # 启动MCP服务器
```

### 方式三：本地安装构建

```bash
# 克隆仓库
git clone https://github.com/yokami618/wiki_mcp.git
cd wiki_mcp

# 安装依赖
npm install

# 编译TypeScript
npm run build

# 运行CLI工具
node dist/cli.js search "原神"

# 启动MCP服务器
node dist/mcp.js
```

## CLI 工具使用

### 基本命令

```bash
# 使用 npx
npx moegirlwiki-mcp moegirl-cli search "原神"
npx moegirlwiki-mcp moegirl-cli page "原神"
npx moegirlwiki-mcp moegirl-cli cache-stats
npx moegirlwiki-mcp moegirl-cli test

# 全局安装后
moegirl-cli search "原神"
moegirl-cli page "原神"
moegirl-cli cache-stats
moegirl-cli test

# 本地构建后
node dist/cli.js search "原神"
node dist/cli.js page "原神"
node dist/cli.js cache-stats
node dist/cli.js test
```

### 高级选项

```bash
# 搜索选项
moegirl-cli search "原神" --limit 10 --json
moegirl-cli search "关键词" --no-cache  # 不使用缓存

# 页面选项
moegirl-cli page "标题" --no-clean  # 不清理Wiki标记
moegirl-cli page "标题" --json --no-cache
moegirl-cli page "12345" --id  # 按ID获取

# 缓存管理
moegirl-cli cache-clear  # 清理过期缓存
moegirl-cli cache-clear --all  # 清空所有缓存
```

## MCP 服务器

### 启动服务器

```bash
# 使用 npx 启动
npx moegirlwiki-mcp moegirl-mcp

# 全局安装后启动
moegirl-mcp

# 本地构建后启动
node dist/mcp.js
```

### 可用工具

- `search_moegirl` - 搜索萌娘百科条目
  - `keyword` (必填): 搜索关键词
  - `limit` (可选): 返回结果数量限制，默认5，范围1-20

- `get_page` - 获取页面内容
  - `pageid` (可选): 页面ID，数字类型
  - `title` (可选): 页面标题，字符串类型
  - `clean_content` (可选): 是否清理Wiki标记，默认true
  - `max_length` (可选): 最大返回字符数，默认2000，范围100-10000

### 使用示例

```javascript
// 搜索萌娘百科
{
  "tool": "search_moegirl",
  "arguments": {
    "keyword": "原神",
    "limit": 5
  }
}

// 获取页面内容
{
  "tool": "get_page",
  "arguments": {
    "title": "原神",
    "max_length": 1000
  }
}
```

## 项目结构

```
src-ts/
├── cli/                    # CLI工具
│   ├── commands.ts        # 命令处理器
│   └── index.ts           # 模块导出
├── core/                   # 核心功能
│   ├── moegirl_client.ts  # 萌娘百科客户端
│   ├── wikitext_cleaner.ts # Wiki文本清理
│   └── cache_manager.ts   # 缓存管理
├── mcp/                    # MCP服务器
│   └── server.ts          # 服务器实现
├── types/                  # 类型定义
│   └── index.ts
├── cli.ts                  # CLI主入口
├── mcp.ts                  # MCP主入口
└── index.ts                # 模块导出
```

## 技术栈

- **Node.js** 18+
- **TypeScript** 5.9+
- **MCP SDK** - Model Context Protocol
- **Axios** - HTTP客户端
- **Commander.js** - CLI框架

## 开发

```bash
# 克隆仓库
git clone https://github.com/yokami618/wiki_mcp.git
cd wiki_mcp

# 安装依赖
npm install

# 开发模式（监听文件变化）
npm run dev

# 运行测试
npm test

# 手动编译
npx tsc

# 清理编译文件
npm run clean
```

## 发布说明

**重要提示**：个人 npm 账号无法发布 scoped 包（@username/package-name），请使用组织账号或非 scoped 包名。

本项目发布为：`moegirlwiki-mcp`

## 注意事项

1. **网络连接** - 需要能够访问 `zh.moegirl.org.cn`
2. **缓存策略** - 搜索和页面内容默认缓存30分钟
3. **Wiki清理** - 基于Angel Eye插件的清理逻辑，保留核心内容结构
4. **错误处理** - 网络错误会返回详细错误信息

## 故障排除

### 网络连接问题

如果遇到连接错误，可以尝试：

1. 检查网络连接
2. 确认能够访问萌娘百科
3. 检查防火墙设置
4. 尝试使用代理

### 编译问题

确保使用Node.js 18+和正确的包管理器：

```bash
# 清理并重新安装
rm -rf node_modules dist
npm install
npm run build
```

## 许可证

MIT License