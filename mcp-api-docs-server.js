#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema, McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';

class ApiDocsServer {
  constructor() {
    this.server = new Server(
      {
        name: 'api-docs-reader',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    // 加载配置
    this.loadConfig();
    this.setupToolHandlers();
  }

  loadConfig() {
    try {
      const configPath = path.join(process.cwd(), 'config.json');
      const configFile = fs.readFileSync(configPath, 'utf8');
      const config = JSON.parse(configFile);
      
      this.config = {
        maxContentLength: config.tokenLimits?.maxContentLength || 15000,
        maxResponseSize: config.tokenLimits?.maxResponseSize || 5242880,
        summaryLength: config.tokenLimits?.summaryLength || 3000,
        batchMaxLength: config.tokenLimits?.batchMaxLength || 8000,
        autoSummaryForLargeContent: config.optimization?.autoSummaryForLargeContent || true,
        smartTruncation: config.optimization?.smartTruncation || true,
        enableJavaScriptDetection: config.optimization?.enableJavaScriptDetection || true,
        retryWithDifferentHeaders: config.optimization?.retryWithDifferentHeaders || true,
        extractFromPartialContent: config.optimization?.extractFromPartialContent || true,
        timeout: config.apiSettings?.timeout || 60000,
        userAgent: config.apiSettings?.userAgent || 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        maxRetries: config.apiSettings?.maxRetries || 3,
        retryDelay: config.apiSettings?.retryDelay || 2000
      };
    } catch (error) {
      // 使用默认配置
      this.config = {
        maxContentLength: 15000,
        maxResponseSize: 5242880,
        summaryLength: 3000,
        batchMaxLength: 8000,
        autoSummaryForLargeContent: true,
        smartTruncation: true,
        enableJavaScriptDetection: true,
        retryWithDifferentHeaders: true,
        extractFromPartialContent: true,
        timeout: 60000,
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        maxRetries: 3,
        retryDelay: 2000
      };
    }
  }

  setupToolHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: 'read_api_docs',
            description: '根据提供的URL读取接口文档内容',
            inputSchema: {
              type: 'object',
              properties: {
                url: {
                  type: 'string',
                  description: '接口文档的URL地址',
                },
                headers: {
                  type: 'object',
                  description: '可选的HTTP请求头',
                  additionalProperties: {
                    type: 'string'
                  }
                },
                maxLength: {
                  type: 'number',
                  description: '最大内容长度，默认8000字符',
                  default: 8000
                },
                extractSummary: {
                  type: 'boolean',
                  description: '是否提取摘要而不是完整内容',
                  default: false
                }
              },
              required: ['url'],
            },
          },
          {
            name: 'read_multiple_api_docs',
            description: '批量读取多个接口文档URL的内容',
            inputSchema: {
              type: 'object',
              properties: {
                urls: {
                  type: 'array',
                  items: {
                    type: 'string'
                  },
                  description: '接口文档URL数组',
                },
                headers: {
                  type: 'object',
                  description: '可选的HTTP请求头',
                  additionalProperties: {
                    type: 'string'
                  }
                },
                maxLength: {
                  type: 'number',
                  description: '每个文档的最大内容长度',
                  default: 4000
                }
              },
              required: ['urls'],
            },
          },
          {
            name: 'read_api_docs_summary',
            description: '读取API文档并提取关键信息摘要',
            inputSchema: {
              type: 'object',
              properties: {
                url: {
                  type: 'string',
                  description: '接口文档的URL地址',
                },
                headers: {
                  type: 'object',
                  description: '可选的HTTP请求头',
                  additionalProperties: {
                    type: 'string'
                  }
                }
              },
              required: ['url'],
            },
          },
          {
            name: 'extract_api_structure',
            description: '专门为API开发提取结构化信息，包括端点、参数、示例代码等',
            inputSchema: {
              type: 'object',
              properties: {
                url: {
                  type: 'string',
                  description: '接口文档的URL地址',
                },
                headers: {
                  type: 'object',
                  description: '可选的HTTP请求头',
                  additionalProperties: {
                    type: 'string'
                  }
                },
                focusAreas: {
                  type: 'array',
                  items: {
                    type: 'string',
                    enum: ['endpoints', 'authentication', 'parameters', 'examples', 'errors', 'ratelimits']
                  },
                  description: '重点提取的信息类型',
                  default: ['endpoints', 'authentication', 'parameters', 'examples']
                }
              },
              required: ['url'],
            },
          }
        ],
      };
    });

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        if (name === 'read_api_docs') {
          return await this.readApiDocs(args.url, args.headers, args.maxLength, args.extractSummary);
        } else if (name === 'read_multiple_api_docs') {
          return await this.readMultipleApiDocs(args.urls, args.headers, args.maxLength);
        } else if (name === 'read_api_docs_summary') {
          return await this.readApiDocsSummary(args.url, args.headers);
        } else if (name === 'extract_api_structure') {
          return await this.extractApiStructure(args.url, args.headers, args.focusAreas);
        } else {
          throw new McpError(
            ErrorCode.MethodNotFound,
            `Unknown tool: ${name}`
          );
        }
      } catch (error) {
        throw new McpError(
          ErrorCode.InternalError,
          `Error executing tool: ${error.message}`
        );
      }
    });
  }

  // 检查响应大小
  async checkResponseSize(response) {
    const contentLength = response.headers.get('content-length');
    if (contentLength && parseInt(contentLength) > this.config.maxResponseSize) {
      throw new Error(`Response too large: ${contentLength} bytes (max: ${this.config.maxResponseSize})`);
    }
  }

  // 截断内容
  truncateContent(content, maxLength = this.config.maxContentLength) {
    if (content.length <= maxLength) {
      return content;
    }
    
    const truncated = content.substring(0, maxLength);
    const lastNewline = truncated.lastIndexOf('\n');
    const result = lastNewline > maxLength * 0.8 ? truncated.substring(0, lastNewline) : truncated;
    
    return result + '\n\n[内容已截断，原文档更长...]';
  }

  // 提取API文档摘要
  extractApiSummary(content, contentType) {
    let summary = '';
    
    try {
      if (contentType.includes('application/json')) {
        const data = JSON.parse(content);
        summary = this.extractJsonApiSummary(data);
      } else if (contentType.includes('text/html')) {
        summary = this.extractHtmlApiSummary(content);
      } else {
        summary = this.extractTextApiSummary(content);
      }
    } catch (error) {
      summary = this.extractTextApiSummary(content);
    }
    
    return this.truncateContent(summary, this.config.summaryLength);
  }

  // 提取JSON API文档摘要
  extractJsonApiSummary(data) {
    let summary = '';
    
    // OpenAPI/Swagger格式
    if (data.openapi || data.swagger) {
      summary += `API文档类型: ${data.openapi ? 'OpenAPI ' + data.openapi : 'Swagger ' + data.swagger}\n`;
      if (data.info) {
        summary += `标题: ${data.info.title || '未知'}\n`;
        summary += `版本: ${data.info.version || '未知'}\n`;
        if (data.info.description) {
          summary += `描述: ${data.info.description.substring(0, 200)}...\n`;
        }
      }
      
      if (data.servers && data.servers.length > 0) {
        summary += `服务器: ${data.servers[0].url}\n`;
      }
      
      if (data.paths) {
        const pathCount = Object.keys(data.paths).length;
        summary += `接口数量: ${pathCount}\n`;
        summary += `主要接口:\n`;
        
        Object.keys(data.paths).slice(0, 10).forEach(path => {
          const methods = Object.keys(data.paths[path]).filter(m => 
            ['get', 'post', 'put', 'delete', 'patch'].includes(m)
          );
          summary += `  ${methods.join(', ').toUpperCase()} ${path}\n`;
        });
      }
    } else {
      // 通用JSON结构摘要
      summary += `JSON文档结构:\n`;
      summary += this.summarizeJsonStructure(data, 0, 3);
    }
    
    return summary;
  }

  // 递归总结JSON结构
  summarizeJsonStructure(obj, depth, maxDepth) {
    if (depth >= maxDepth) return '';
    
    let summary = '';
    const indent = '  '.repeat(depth);
    
    if (Array.isArray(obj)) {
      summary += `${indent}数组 (${obj.length} 项)\n`;
      if (obj.length > 0) {
        summary += this.summarizeJsonStructure(obj[0], depth + 1, maxDepth);
      }
    } else if (typeof obj === 'object' && obj !== null) {
      const keys = Object.keys(obj);
      summary += `${indent}对象 (${keys.length} 个字段)\n`;
      keys.slice(0, 5).forEach(key => {
        const value = obj[key];
        const type = Array.isArray(value) ? 'array' : typeof value;
        summary += `${indent}  ${key}: ${type}\n`;
        
        if (typeof value === 'object' && value !== null && depth < maxDepth - 1) {
          summary += this.summarizeJsonStructure(value, depth + 2, maxDepth);
        }
      });
      if (keys.length > 5) {
        summary += `${indent}  ... 还有 ${keys.length - 5} 个字段\n`;
      }
    }
    
    return summary;
  }

  // 提取HTML API文档摘要
  extractHtmlApiSummary(content) {
    let summary = '';
    
    // 提取标题
    const titleMatch = content.match(/<title[^>]*>([^<]+)</i);
    if (titleMatch) {
      summary += `文档标题: ${titleMatch[1].trim()}\n`;
    }
    
    // 提取主要标题和结构
    const headings = content.match(/<h[1-6][^>]*>([^<]+)</gi);
    if (headings && headings.length > 0) {
      summary += `\n文档结构:\n`;
      headings.slice(0, 15).forEach(heading => {
        const level = heading.match(/<h([1-6])/i)?.[1] || '1';
        const text = heading.replace(/<[^>]+>/g, '').trim();
        const indent = '  '.repeat(parseInt(level) - 1);
        if (text) summary += `${indent}- ${text}\n`;
      });
    }

    // 提取API端点信息
    const apiEndpoints = this.extractApiEndpointsFromHtml(content);
    if (apiEndpoints.length > 0) {
      summary += `\nAPI端点 (${apiEndpoints.length}个):\n`;
      apiEndpoints.slice(0, 20).forEach(endpoint => {
        summary += `  ${endpoint}\n`;
      });
      if (apiEndpoints.length > 20) {
        summary += `  ... 还有 ${apiEndpoints.length - 20} 个端点\n`;
      }
    }
    
    // 提取参数表格
    const paramTables = this.extractParameterTables(content);
    if (paramTables.length > 0) {
      summary += `\n参数表格:\n`;
      paramTables.forEach((table, index) => {
        summary += `  表格${index + 1}: ${table.headers.join(' | ')}\n`;
        table.rows.slice(0, 3).forEach(row => {
          summary += `    ${row.join(' | ')}\n`;
        });
        if (table.rows.length > 3) {
          summary += `    ... 还有 ${table.rows.length - 3} 行\n`;
        }
      });
    }

    // 提取代码示例
    const codeExamples = this.extractCodeExamples(content);
    if (codeExamples.length > 0) {
      summary += `\n代码示例 (${codeExamples.length}个):\n`;
      codeExamples.slice(0, 5).forEach((example, index) => {
        summary += `  示例${index + 1} (${example.language}): ${example.preview}...\n`;
      });
    }

    // 提取认证信息
    const authInfo = this.extractAuthenticationInfo(content);
    if (authInfo) {
      summary += `\n认证方式: ${authInfo}\n`;
    }

    // 提取基础URL
    const baseUrls = this.extractBaseUrls(content);
    if (baseUrls.length > 0) {
      summary += `\n基础URL:\n`;
      baseUrls.forEach(url => {
        summary += `  ${url}\n`;
      });
    }
    
    return summary;
  }

  // 从HTML中提取API端点
  extractApiEndpointsFromHtml(content) {
    const endpoints = new Set();

    // 常见的API端点模式
    const patterns = [
      // HTTP方法 + 路径
      /<(?:code|pre|span)[^>]*>(GET|POST|PUT|DELETE|PATCH)\s+([\/\w\-\{\}:]+)<\/(?:code|pre|span)>/gi,
      // 路径模式
      /<(?:code|pre|span)[^>]*>([\/][\w\-\{\}\/:\?&=]+)<\/(?:code|pre|span)>/gi,
      // 完整URL
      /https?:\/\/[^\s<>"']+\/api[^\s<>"']*/gi,
      // 表格中的端点
      /<td[^>]*>(?:<[^>]*>)*\s*((?:GET|POST|PUT|DELETE|PATCH)\s+[\/\w\-\{\}:]+)(?:<[^>]*>)*\s*<\/td>/gi
    ];

    patterns.forEach(pattern => {
      const matches = content.match(pattern);
      if (matches) {
        matches.forEach(match => {
          // 清理HTML标签
          const clean = match.replace(/<[^>]+>/g, '').trim();
          if (clean && (clean.includes('/') || /^(GET|POST|PUT|DELETE|PATCH)\s/.test(clean))) {
            endpoints.add(clean);
          }
        });
      }
    });

    return Array.from(endpoints);
  }

  // 提取参数表格
  extractParameterTables(content) {
    const tables = [];
    const tableMatches = content.match(/<table[^>]*>[\s\S]*?<\/table>/gi);

    if (tableMatches) {
      tableMatches.forEach(tableHtml => {
        // 检查是否是参数表格
        if (/参数|parameter|param|field|属性/i.test(tableHtml)) {
          const headers = [];
          const rows = [];

          // 提取表头
          const headerMatch = tableHtml.match(/<thead[^>]*>[\s\S]*?<\/thead>|<tr[^>]*>[\s\S]*?<\/tr>/i);
          if (headerMatch) {
            const headerCells = headerMatch[0].match(/<th[^>]*>([^<]*)<\/th>|<td[^>]*>([^<]*)<\/td>/gi);
            if (headerCells) {
              headerCells.forEach(cell => {
                const text = cell.replace(/<[^>]+>/g, '').trim();
                if (text) headers.push(text);
              });
            }
          }

          // 提取数据行
          const rowMatches = tableHtml.match(/<tr[^>]*>[\s\S]*?<\/tr>/gi);
          if (rowMatches) {
            rowMatches.slice(1, 11).forEach(rowHtml => { // 最多10行
              const cells = rowHtml.match(/<td[^>]*>([^<]*)<\/td>/gi);
              if (cells) {
                const rowData = cells.map(cell =>
                  cell.replace(/<[^>]+>/g, '').trim()
                ).filter(text => text);
                if (rowData.length > 0) rows.push(rowData);
              }
            });
          }

          if (headers.length > 0 || rows.length > 0) {
            tables.push({ headers, rows });
          }
        }
      });
    }

    return tables;
  }

  // 提取代码示例
  extractCodeExamples(content) {
    const examples = [];

    // 提取代码块
    const codeBlocks = content.match(/<(?:pre|code)[^>]*>[\s\S]*?<\/(?:pre|code)>/gi);
    if (codeBlocks) {
      codeBlocks.forEach(block => {
        const code = block.replace(/<[^>]+>/g, '').trim();
        if (code.length > 10) {
          let language = 'unknown';

          // 检测语言类型
          if (/curl\s+|wget\s+/.test(code)) language = 'curl';
          else if (/^[\s]*\{[\s\S]*\}[\s]*$/.test(code)) language = 'json';
          else if (/import\s+|from\s+.*import|def\s+|print\s*\(/.test(code)) language = 'python';
          else if (/const\s+|let\s+|var\s+|function\s+|=>/.test(code)) language = 'javascript';
          else if (/public\s+class|System\.out\.print|import\s+java/.test(code)) language = 'java';

          examples.push({
            language,
            preview: code.substring(0, 50),
            fullCode: code
          });
        }
      });
    }

    return examples;
  }

  // 提取认证信息
  extractAuthenticationInfo(content) {
    const authPatterns = [
      /API\s*Key|api[-_]key/i,
      /Bearer\s+Token|bearer[-_]token/i,
      /Basic\s+Auth|basic[-_]auth/i,
      /OAuth|oauth/i,
      /JWT|json\s*web\s*token/i
    ];

    for (const pattern of authPatterns) {
      if (pattern.test(content)) {
        return pattern.toString().replace(/[\/ig]/g, '');
      }
    }

    return null;
  }

  // 提取基础URL
  extractBaseUrls(content) {
    const urls = new Set();

    // 查找基础URL模式
    const patterns = [
      /base\s*url[:\s]*([^\s<>"']+)/gi,
      /api\s*endpoint[:\s]*([^\s<>"']+)/gi,
      /https?:\/\/[^\s<>"']+\.(?:com|org|net|io)(?:\/api)?/gi
    ];

    patterns.forEach(pattern => {
      const matches = content.match(pattern);
      if (matches) {
        matches.forEach(match => {
          const url = match.replace(/base\s*url[:\s]*/gi, '')
                          .replace(/api\s*endpoint[:\s]*/gi, '')
                          .trim();
          if (url.startsWith('http')) {
            urls.add(url);
          }
        });
      }
    });

    return Array.from(urls);
  }

  // 提取纯文本API文档摘要
  extractTextApiSummary(content) {
    const lines = content.split('\n').filter(line => line.trim());
    let summary = '';

    // 提取前几行作为概述
    summary += `文档概述:\n${lines.slice(0, 5).join('\n')}\n\n`;

    // 查找API endpoint模式
    const apiPatterns = [
      /^(GET|POST|PUT|DELETE|PATCH)\s+\/\S+/gmi,
      /\/api\/\S+/gi,
      /https?:\/\/\S+\/api\S*/gi
    ];
    
    const foundApis = new Set();
    apiPatterns.forEach(pattern => {
      const matches = content.match(pattern);
      if (matches) {
        matches.slice(0, 10).forEach(match => foundApis.add(match.trim()));
      }
    });

    if (foundApis.size > 0) {
      summary += `发现的API接口:\n`;
      Array.from(foundApis).forEach(api => {
        summary += `  ${api}\n`;
      });
    }

    // 查找认证相关信息
    const authKeywords = ['authentication', 'authorization', 'token', 'api key', 'oauth'];
    const authLines = lines.filter(line =>
      authKeywords.some(keyword => line.toLowerCase().includes(keyword))
    );

    if (authLines.length > 0) {
      summary += `\n认证相关信息:\n`;
      authLines.slice(0, 3).forEach(line => {
        summary += `  ${line.trim()}\n`;
      });
    }

    // 查找参数相关信息
    const paramKeywords = ['parameter', 'param', 'field', 'request', 'body'];
    const paramLines = lines.filter(line =>
      paramKeywords.some(keyword => line.toLowerCase().includes(keyword))
    );

    if (paramLines.length > 0) {
      summary += `\n参数相关信息:\n`;
      paramLines.slice(0, 5).forEach(line => {
        summary += `  ${line.trim()}\n`;
      });
    }

    return summary;
  }

  async readApiDocs(url, headers = {}, maxLength = this.config.maxContentLength, extractSummary = false) {
    try {
      const fetchResult = await this.fetchContentWithRetry(url, headers);
      
      if (!fetchResult.success) {
        return {
          content: [
            {
              type: 'text',
              text: `读取接口文档失败:\nURL: ${url}\n错误: ${fetchResult.error}\n\n这可能是一个需要JavaScript渲染的动态页面。建议:\n1. 查找该API的OpenAPI规范文件\n2. 联系API提供商获取静态文档\n3. 使用浏览器开发者工具查看实际的API调用`
            }
          ]
        };
      }

      let { content, contentType, isSPA, extractedInfo, status } = fetchResult;

      // 如果是SPA页面，返回提取的信息
      if (isSPA) {
        return {
          content: [
            {
              type: 'text',
              text: `接口文档URL: ${url}\n内容类型: ${contentType}\n状态码: ${status}\n页面类型: JavaScript SPA页面\n\n检测到这是一个单页应用，无法直接提取完整内容。\n以下是提取到的信息:\n\n${extractedInfo}`
            }
          ]
        };
      }

      // 尝试解析JSON格式的API文档
      if (contentType.includes('application/json')) {
        try {
          const jsonContent = JSON.parse(content);
          content = JSON.stringify(jsonContent, null, 2);
        } catch (e) {
          // 如果不是有效的JSON，保持原始文本
        }
      }

      if (extractSummary || this.config.autoSummaryForLargeContent && content.length > maxLength * 2) {
        const summary = this.extractApiSummary(content, contentType);
        return {
          content: [
            {
              type: 'text',
              text: `接口文档URL: ${url}\n内容类型: ${contentType}\n状态码: ${status}\n\n摘要:\n${summary}`
            }
          ]
        };
      } else {
        const truncatedContent = this.truncateContent(content, maxLength);
        return {
          content: [
            {
              type: 'text',
              text: `接口文档URL: ${url}\n内容类型: ${contentType}\n状态码: ${status}\n\n内容:\n${truncatedContent}`
            }
          ]
        };
      }
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `读取接口文档失败:\nURL: ${url}\n错误: ${error.message}`
          }
        ]
      };
    }
  }

  async readApiDocsSummary(url, headers = {}) {
    try {
      const fetchResult = await this.fetchContentWithRetry(url, headers);
      
      if (!fetchResult.success) {
        return {
          content: [
            {
              type: 'text',
              text: `读取接口文档摘要失败:\nURL: ${url}\n错误: ${fetchResult.error}\n\n${this.inferAPIStructureFromURL(url)}`
            }
          ]
        };
      }

      let { content, contentType, isSPA, extractedInfo, status } = fetchResult;

      // 如果是SPA页面，返回推断信息
      if (isSPA) {
        return {
          content: [
            {
              type: 'text',
              text: `接口文档摘要 (SPA页面)\nURL: ${url}\n内容类型: ${contentType}\n状态码: ${status}\n\n${extractedInfo}`
            }
          ]
        };
      }

      // 对于JSON内容，解析后再提取摘要
      if (contentType.includes('application/json')) {
        try {
          const jsonContent = JSON.parse(content);
          content = JSON.stringify(jsonContent, null, 2);
        } catch (e) {
          // 保持原始文本
        }
      }

      const summary = this.extractApiSummary(content, contentType);

      return {
        content: [
          {
            type: 'text',
            text: `接口文档摘要\nURL: ${url}\n内容类型: ${contentType}\n状态码: ${status}\n\n${summary}`
          }
        ]
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `读取接口文档摘要失败:\nURL: ${url}\n错误: ${error.message}`
          }
        ]
      };
    }
  }

  async readMultipleApiDocs(urls, headers = {}, maxLength) {
    // 使用配置中的批量读取长度限制
    const effectiveMaxLength = maxLength || this.config.batchMaxLength;

    const results = await Promise.allSettled(
      urls.map(url => this.readApiDocs(url, headers, effectiveMaxLength, true)) // 自动使用摘要模式
    );

    let combinedContent = '批量读取接口文档结果:\n\n';

    results.forEach((result, index) => {
      combinedContent += `=== 文档 ${index + 1} ===\n`;
      if (result.status === 'fulfilled') {
        combinedContent += result.value.content[0].text + '\n\n';
      } else {
        combinedContent += `读取失败: ${result.reason}\n\n`;
      }
    });

    // 确保总内容不超过限制
    const finalContent = this.truncateContent(combinedContent, this.config.maxContentLength * 2);

    return {
      content: [
        {
          type: 'text',
          text: finalContent
        }
      ]
    };
  }

  async extractApiStructure(url, headers = {}, focusAreas = ['endpoints', 'authentication', 'parameters', 'examples']) {
    try {
      const fetchResult = await this.fetchContentWithRetry(url, headers);
      
      if (!fetchResult.success) {
        return {
          content: [
            {
              type: 'text',
              text: `提取API结构失败:\nURL: ${url}\n错误: ${fetchResult.error}\n\n${this.inferAPIStructureFromURL(url)}`
            }
          ]
        };
      }

      let { content, contentType, isSPA, extractedInfo, status } = fetchResult;

      // 如果是SPA页面，返回推断的结构信息
      if (isSPA) {
        const result = {
          url: url,
          contentType: contentType,
          pageType: 'SPA',
          extractedInfo: extractedInfo,
          inferredStructure: this.inferAPIStructureFromURL(url)
        };

        return {
          content: [
            {
              type: 'text',
              text: `API结构化信息提取结果 (SPA页面):\n\n${JSON.stringify(result, null, 2)}`
            }
          ]
        };
      }

      // 处理JSON内容
      if (contentType.includes('application/json')) {
        try {
          const jsonData = JSON.parse(content);
          content = JSON.stringify(jsonData, null, 2);
        } catch (e) {
          // 保持原始文本
        }
      }

      const result = {
        url: url,
        contentType: contentType,
        pageType: 'static'
      };

      // 提取端点
      if (focusAreas.includes('endpoints')) {
        result.endpoints = this.extractApiEndpointsFromHtml(content);
      }

      // 提取认证信息
      if (focusAreas.includes('authentication')) {
        result.authentication = this.extractAuthenticationInfo(content);
      }

      // 提取参数
      if (focusAreas.includes('parameters')) {
        result.parameters = this.extractParameterTables(content);
      }

      // 提取示例代码
      if (focusAreas.includes('examples')) {
        result.examples = this.extractCodeExamples(content);
      }

      // 提取错误处理
      if (focusAreas.includes('errors')) {
        result.errors = this.extractErrorHandling(content);
      }

      // 提取速率限制
      if (focusAreas.includes('ratelimits')) {
        result.rateLimit = this.extractRateLimit(content);
      }

      return {
        content: [
          {
            type: 'text',
            text: `API结构化信息提取结果:\n\n${JSON.stringify(result, null, 2)}`
          }
        ]
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `提取API结构失败:\nURL: ${url}\n错误: ${error.message}`
          }
        ]
      };
    }
  }

  // 提取错误处理信息
  extractErrorHandling(content) {
    const errorInfo = [];
    
    // 查找错误代码和描述
    const errorPatterns = [
      /error\s*code[:\s]*(\d+)/gi,
      /status\s*code[:\s]*(\d+)/gi,
      /http\s*(\d{3})/gi,
      /400|401|403|404|429|500|502|503/g
    ];

    errorPatterns.forEach(pattern => {
      const matches = content.match(pattern);
      if (matches) {
        matches.slice(0, 10).forEach(match => {
          errorInfo.push(match.trim());
        });
      }
    });

    return errorInfo.length > 0 ? [...new Set(errorInfo)] : null;
  }

  // 提取速率限制信息
  extractRateLimit(content) {
    const rateLimitInfo = [];
    
    // 查找速率限制相关信息
    const rateLimitPatterns = [
      /rate\s*limit[:\s]*([^\n<]+)/gi,
      /requests?\s*per\s*(second|minute|hour|day)[:\s]*([^\n<]+)/gi,
      /throttl[^\n<]{0,50}/gi,
      /quota[:\s]*([^\n<]+)/gi
    ];

    rateLimitPatterns.forEach(pattern => {
      const matches = content.match(pattern);
      if (matches) {
        matches.slice(0, 5).forEach(match => {
          const clean = match.replace(/<[^>]+>/g, '').trim();
          if (clean.length > 5) {
            rateLimitInfo.push(clean);
          }
        });
      }
    });

    return rateLimitInfo.length > 0 ? [...new Set(rateLimitInfo)] : null;
  }

  // 检测是否为JavaScript SPA页面
  detectSPAPage(content) {
    const spaIndicators = [
      /<div[^>]*id=["']root["'][^>]*><\/div>/i,
      /<div[^>]*id=["']app["'][^>]*><\/div>/i,
      /This HTML file is a template/i,
      /If you open it directly in the browser, you will see an empty page/i,
      /react|vue|angular/i,
      /<script[^>]*src[^>]*\.js[^>]*><\/script>/i
    ];

    return spaIndicators.some(pattern => pattern.test(content));
  }

  // 尝试从SPA页面提取有用信息
  extractFromSPAPage(content, url) {
    let extractedInfo = '';

    // 提取页面标题
    const titleMatch = content.match(/<title[^>]*>([^<]+)</i);
    if (titleMatch) {
      extractedInfo += `页面标题: ${titleMatch[1].trim()}\n`;
    }

    // 提取meta描述
    const descMatch = content.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i);
    if (descMatch) {
      extractedInfo += `页面描述: ${descMatch[1].trim()}\n`;
    }

    // 提取JavaScript文件路径，可能包含API信息
    const scriptMatches = content.match(/<script[^>]*src=["']([^"']+)["'][^>]*>/gi);
    if (scriptMatches) {
      extractedInfo += `\n检测到的JavaScript文件:\n`;
      scriptMatches.forEach(script => {
        const srcMatch = script.match(/src=["']([^"']+)["']/);
        if (srcMatch) {
          extractedInfo += `  ${srcMatch[1]}\n`;
        }
      });
    }

    // 尝试从URL推断API文档结构
    extractedInfo += this.inferAPIStructureFromURL(url);

    return extractedInfo;
  }

  // 从URL推断API文档结构
  inferAPIStructureFromURL(url) {
    let inference = '\n基于URL的API文档结构推断:\n';
    
    if (url.includes('/docs/api')) {
      inference += '- 这是一个API文档页面\n';
    }
    
    if (url.includes('Authentication') || url.includes('auth')) {
      inference += '- 包含认证相关信息\n';
      inference += '- 建议查看以下可能的认证方式:\n';
      inference += '  * API Key认证\n';
      inference += '  * OAuth 2.0认证\n';
      inference += '  * Bearer Token认证\n';
    }

    if (url.includes('OAuth') || url.includes('oauth')) {
      inference += '- 包含OAuth认证流程\n';
      inference += '- OAuth标准流程通常包括:\n';
      inference += '  1. 获取授权码 (Authorization Code)\n';
      inference += '  2. 交换访问令牌 (Access Token)\n';
      inference += '  3. 使用令牌访问API\n';
    }

    // 尝试提供通用的解决方案
    inference += '\n建议的解决方案:\n';
    inference += '1. 尝试查找该网站的静态API文档或OpenAPI规范\n';
    inference += '2. 查看开发者工具中的网络请求，寻找API端点\n';
    inference += '3. 联系API提供商获取详细的集成文档\n';

    return inference;
  }

  // 获取多种请求头组合
  getAlternativeHeaders(baseHeaders = {}) {
    const headerSets = [
      {
        ...baseHeaders,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate, br',
        'DNT': '1',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1'
      },
      {
        ...baseHeaders,
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.1 Safari/605.1.15',
        'Accept': '*/*',
        'Accept-Language': 'en-us',
        'Accept-Encoding': 'gzip, deflate, br'
      },
      {
        ...baseHeaders,
        'User-Agent': 'PostmanRuntime/7.28.0',
        'Accept': '*/*',
        'Cache-Control': 'no-cache'
      }
    ];

    return headerSets;
  }

  // 改进的内容获取方法，支持重试和多种策略
  async fetchContentWithRetry(url, headers = {}) {
    let lastError;
    const headerSets = this.config.retryWithDifferentHeaders ? 
      this.getAlternativeHeaders(headers) : [{ ...this.config.userAgent ? { 'User-Agent': this.config.userAgent } : {}, ...headers }];

    for (let attempt = 0; attempt < this.config.maxRetries; attempt++) {
      for (const headerSet of headerSets) {
        try {
          console.error(`尝试获取内容 (尝试 ${attempt + 1}/${this.config.maxRetries}): ${url}`);
          
          const response = await fetch(url, {
            method: 'GET',
            headers: headerSet,
            timeout: this.config.timeout,
            follow: 10 // 允许重定���
          });

          await this.checkResponseSize(response);

          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }

          const contentType = response.headers.get('content-type') || '';
          let content = await response.text();

          // 检测是否为SPA页面
          if (this.config.enableJavaScriptDetection && this.detectSPAPage(content)) {
            console.error(`检测到SPA页面，尝试提取可用信息: ${url}`);
            
            // 尝试提取SPA页面的有用信息
            const extractedInfo = this.extractFromSPAPage(content, url);
            
            return {
              success: true,
              content: content,
              contentType: contentType,
              isSPA: true,
              extractedInfo: extractedInfo,
              status: response.status
            };
          }

          // 检查内容是否有意义
          if (content.trim().length < 100) {
            throw new Error('返回的内容过短，可能是空页面');
          }

          return {
            success: true,
            content: content,
            contentType: contentType,
            isSPA: false,
            status: response.status
          };

        } catch (error) {
          lastError = error;
          console.error(`获取失败: ${error.message}`);
          
          // 等待后重试
          if (attempt < this.config.maxRetries - 1) {
            await new Promise(resolve => setTimeout(resolve, this.config.retryDelay));
          }
        }
      }
    }

    return {
      success: false,
      error: lastError?.message || '未知错误'
    };
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('API Docs MCP server running on stdio');
  }
}

const server = new ApiDocsServer();
server.run().catch(console.error);
