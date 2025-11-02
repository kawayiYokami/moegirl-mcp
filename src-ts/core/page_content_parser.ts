/**
 * 页面内容解析器
 * 用于解析萌娘百科页面内容，提取标题、模板和结构化信息
 */

import { PageSection, PageTemplate, PageStructure } from '../types/index.js';

export class PageContentParser {
  /**
   * 解析页面内容，提取结构化信息
   * @param title 页面标题
   * @param content 页面内容
   * @returns 页面结构对象
   */
  static parsePage(title: string, content: string): PageStructure {
    const lines = content.split('\n');
    const sections: PageSection[] = [];
    const templates: PageTemplate[] = [];
    const headings: Array<{ title: string; level: number; line: number }> = [];

    let currentSection: PageSection | null = null;
    let templateStack: Array<{ name: string; startLine: number; content: string[] }> = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmedLine = line.trim();

      // 处理标题
      const headingMatch = trimmedLine.match(/^(#{1,6})\s+(.+)$/);
      if (headingMatch) {
        // 保存当前section
        if (currentSection) {
          currentSection.endLine = i - 1;
          sections.push(currentSection);
        }

        const level = headingMatch[1].length;
        const title = headingMatch[2];
        
        headings.push({ title, level, line: i });
        
        currentSection = {
          type: 'heading',
          title,
          level,
          content: line,
          startLine: i,
          endLine: i
        };
        continue;
      }

      // 处理模板开始
      if (this.isValidTemplateStart(trimmedLine)) {
        // 保存当前section
        if (currentSection && currentSection.type !== 'template') {
          currentSection.endLine = i - 1;
          sections.push(currentSection);
        }

        const templateName = this.extractTemplateName(trimmedLine);
        templateStack.push({
          name: templateName,
          startLine: i,
          content: [line]
        });
        continue;
      }

      // 处理模板内容或结束
      if (templateStack.length > 0) {
        templateStack[templateStack.length - 1].content.push(line);
        
        // 检查模板是否结束：寻找最后一个未配对的 }}
        const currentTemplate = templateStack[templateStack.length - 1];
        const fullContent = currentTemplate.content.join('\n');
        
        if (this.isTemplateComplete(fullContent)) {
          // 模板结束
          const templateData = templateStack.pop()!;
          const fullText = templateData.content.join('\n');
          const parameters = this.extractTemplateParameters(fullText);
          
          const template: PageTemplate = {
            name: templateData.name,
            fullText,
            parameters,
            startLine: templateData.startLine,
            endLine: i
          };
          
          templates.push(template);
          
          // 创建模板section，但不立即添加到sections中
          // 这样可以保持标题和内容的正确关系
          const templateSection = {
            type: 'template' as const,
            templateName: templateData.name,
            content: fullText,
            startLine: templateData.startLine,
            endLine: i
          };
          
          // 如果当前没有活跃的section，或者当前section是标题，则添加模板section
          if (!currentSection || currentSection.type === 'heading') {
            if (currentSection) {
              currentSection.endLine = i - 1;
              sections.push(currentSection);
            }
            currentSection = templateSection;
          } else {
            // 否则将模板内容添加到当前section
            currentSection.content += '\n' + fullText;
            currentSection.endLine = i;
          }
        }
        continue;
      }

      // 处理普通内容
      if (currentSection && currentSection.type === 'content') {
        currentSection.content += '\n' + line;
        currentSection.endLine = i;
      } else if (currentSection && currentSection.type === 'heading') {
        // 标题后的第一行内容，创建内容section
        currentSection.endLine = i - 1;
        sections.push(currentSection);
        
        currentSection = {
          type: 'content',
          content: line,
          startLine: i,
          endLine: i
        };
      } else if (!currentSection) {
        // 页面开始的内容
        currentSection = {
          type: 'content',
          content: line,
          startLine: i,
          endLine: i
        };
      }
    }

    // 保存最后的section
    if (currentSection) {
      currentSection.endLine = lines.length - 1;
      sections.push(currentSection);
    }

    // 生成目录
    const toc = this.generateTOC(headings);

    return {
      title,
      sections,
      templates,
      headings,
      toc
    };
  }

  /**
   * 提取模板名称
   * @param line 模板开始行
   * @returns 模板名称
   */
  private static extractTemplateName(line: string): string {
    // 匹配 {{开头，后面跟着任意字符，直到遇到 | 或 }} 为止
    // 使用更精确的正则表达式，确保不会包含后面的文本
    const match = line.match(/^\{\{([^|\}]+)(?:\||\}\})/);
    if (!match) {
      return '';
    }
    
    const templateName = match[1].trim();
    
    // 如果模板名称很短（如"原神"），但后面有参数，检查是否应该包含参数
    if (templateName.length <= 3 && line.includes('|')) {
      // 对于短名称，尝试包含第一个参数
      const fullMatch = line.match(/^\{\{([^|}]+(?:\|[^|}]+)?)(?:\||\}\})/);
      if (fullMatch && fullMatch[1].includes('|')) {
        return fullMatch[1].trim();
      }
    }
    
    return templateName;
  }

  /**
   * 判断模板是否完整（是否已经正确结束）
   * @param content 模板内容
   * @returns 是否完整
   */
  private static isTemplateComplete(content: string): boolean {
    let braceCount = 0;
    let i = 0;
    
    while (i < content.length) {
      if (content[i] === '{' && i + 1 < content.length && content[i + 1] === '{') {
        braceCount += 2;
        i += 2;
      } else if (content[i] === '}' && i + 1 < content.length && content[i + 1] === '}') {
        braceCount -= 2;
        i += 2;
        
        // 如果braceCount为0，表示所有{{都正确配对了}}
        if (braceCount === 0) {
          // 检查是否到达内容末尾或者后面没有其他{{了
          const remainingContent = content.substring(i);
          return !remainingContent.includes('{{');
        }
      } else {
        i++;
      }
    }
    
    return false;
  }

  /**
   * 判断是否是有效的模板开始
   * @param line 行内容
   * @returns 是否是有效模板开始
   */
  private static isValidTemplateStart(line: string): boolean {
    // 必须以 {{ 开始，但不能以 {{{ 开始（避免Wiki链接）
    if (!line.startsWith('{{') || line.startsWith('{{{')) {
      return false;
    }
    
    // 必须包含有效的模板名称
    const templateName = this.extractTemplateName(line);
    if (!templateName) {
      return false;
    }
    
    // 检查是否在同一行内结束（单行模板）
    if (line.includes('}}')) {
      // 验证 {{ 和 }} 是否正确配对
      let braceCount = 0;
      for (let i = 0; i < line.length; i++) {
        if (line[i] === '{' && i + 1 < line.length && line[i + 1] === '{') {
          braceCount += 2;
          i++;
        } else if (line[i] === '}' && i + 1 < line.length && line[i + 1] === '}') {
          braceCount -= 2;
          i++;
        }
      }
      return braceCount === 0;
    }
    
    return true;
  }

  /**
   * 提取模板参数
   * @param templateText 模板完整文本
   * @returns 参数映射
   */
  private static extractTemplateParameters(templateText: string): Map<string, string> {
    const parameters = new Map<string, string>();
    
    // 移除外层的 {{ 和 }}
    const content = templateText.replace(/^\{\{|\}\}$/g, '');
    
    // 简单的参数解析（支持 key=value 格式和位置参数）
    const parts = this.splitTemplateParams(content);
    
    parts.forEach((part, index) => {
      const keyValueMatch = part.match(/^([^=]+)=(.+)$/);
      if (keyValueMatch) {
        parameters.set(keyValueMatch[1].trim(), keyValueMatch[2].trim());
      } else if (part.trim()) {
        parameters.set(`${index + 1}`, part.trim());
      }
    });
    
    return parameters;
  }

  /**
   * 分割模板参数（处理嵌套的模板和链接）
   * @param content 模板内容
   * @returns 参数数组
   */
  private static splitTemplateParams(content: string): string[] {
    const parts: string[] = [];
    let current = '';
    let braceLevel = 0;
    let bracketLevel = 0;
    
    for (let i = 0; i < content.length; i++) {
      const char = content[i];
      
      if (char === '{' && i + 1 < content.length && content[i + 1] === '{') {
        braceLevel += 2;
        current += char;
        i++; // 跳过下一个 {
      } else if (char === '}' && i + 1 < content.length && content[i + 1] === '}') {
        braceLevel -= 2;
        current += char;
        i++; // 跳过下一个 }
      } else if (char === '[') {
        bracketLevel++;
        current += char;
      } else if (char === ']') {
        bracketLevel--;
        current += char;
      } else if (char === '|' && braceLevel === 0 && bracketLevel === 0) {
        parts.push(current);
        current = '';
      } else {
        current += char;
      }
    }
    
    if (current) {
      parts.push(current);
    }
    
    return parts;
  }

  /**
   * 生成目录
   * @param headings 标题列表
   * @returns 目录字符串
   */
  private static generateTOC(headings: Array<{ title: string; level: number; line: number }>): string {
    if (headings.length === 0) {
      return '无目录';
    }
    
    let toc = '📋 页面目录\n';
    toc += '=' .repeat(20) + '\n\n';
    
    headings.forEach(heading => {
      const indent = '  '.repeat(heading.level - 1);
      toc += `${indent}• ${heading.title}\n`;
    });
    
    return toc;
  }

  /**
   * 根据标题查找section
   * @param structure 页面结构
   * @param title 标题名称（支持部分匹配）
   * @returns 匹配的sections
   */
  static findSectionsByTitle(structure: PageStructure, title: string): PageSection[] {
    return structure.sections.filter(section => 
      section.type === 'heading' && 
      section.title && 
      section.title.toLowerCase().includes(title.toLowerCase())
    );
  }

  /**
   * 根据模板名称查找template
   * @param structure 页面结构
   * @param templateName 模板名称（支持部分匹配）
   * @returns 匹配的templates
   */
  static findTemplatesByName(structure: PageStructure, templateName: string): PageTemplate[] {
    return structure.templates.filter(template => 
      template.name.toLowerCase().includes(templateName.toLowerCase())
    );
  }

  /**
   * 获取指定标题下的内容
   * @param structure 页面结构
   * @param title 标题名称
   * @returns 标题下的内容
   */
  static getContentByTitle(structure: PageStructure, title: string): string {
    const headingSection = structure.sections.find(section => 
      section.type === 'heading' && 
      section.title && 
      section.title.toLowerCase().includes(title.toLowerCase())
    );
    
    if (!headingSection) {
      return '';
    }
    
    // 找到该标题后的所有内容，直到下一个同级或更高级标题
    const headingIndex = structure.sections.indexOf(headingSection);
    const content: string[] = [];
    
    // 从标题section的下一个开始收集内容
    for (let i = headingIndex + 1; i < structure.sections.length; i++) {
      const section = structure.sections[i];
      
      // 如果遇到同级或更高级的标题，停止收集
      if (section.type === 'heading' && 
          section.level && 
          headingSection.level && 
          section.level <= headingSection.level) {
        break;
      }
      
      // 收集内容（包括标题下的模板和内容）
      content.push(section.content);
    }
    
    return content.join('\n\n');
  }
}