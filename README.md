# 萌娘百科 MCP 服务器

萌娘百科专用 MCP 服务器，提供搜索、页面获取和内容解析功能。

## 安装使用

```bash
# 直接使用 npx（推荐）
npx moegirl-wiki-mcp

# 或全局安装
npm install -g moegirl-wiki-mcp
moegirl-wiki-mcp
```

## Claude Desktop 配置

在 Claude Desktop 的 `claude_desktop_config.json` 文件中添加：

```json
{
  "mcpServers": {
    "moegirl_wiki_mcp": {
      "command": "npx",
      "args": ["-y", "moegirl-wiki-mcp"],
      "alwaysAllow": ["search_moegirl", "get_page", "get_page_sections"]
    }
  }
}
```

## 可用工具

本MCP工具专门用于搜索ACG、二次元、动漫、游戏相关内容：

- `search_moegirl` - 搜索萌娘百科条目
  - 适用于查找动漫角色、游戏、声优、ACG文化等词条
  
- `get_page` - 获取页面内容（含目录）
  - 自动生成页面目录，便于长页面导航
  
- `get_page_sections` - 获取指定标题或模板内容
  - 精准获取页面的特定部分，避免返回过长内容

## 重要声明

**⚠️ 严禁滥用**
- 本项目仅限非商业用途使用
- 禁止高频请求，避免给萌娘百科服务器造成压力
- 请遵守萌娘百科服务条款
- 不得用于任何商业目的

**使用须知**
- 需要访问 `zh.moegirl.org.cn`
- 内容缓存30分钟以减少服务器负载

## 许可证

GPL-3.0 License