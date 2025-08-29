#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema, McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import fetch from 'node-fetch';

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

    this.setupToolHandlers();
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
                }
              },
              required: ['urls'],
            },
          }
        ],
      };
    });

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        if (name === 'read_api_docs') {
          return await this.readApiDocs(args.url, args.headers);
        } else if (name === 'read_multiple_api_docs') {
          return await this.readMultipleApiDocs(args.urls, args.headers);
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

  async readApiDocs(url, headers = {}) {
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'User-Agent': 'MCP-API-Docs-Reader/1.0.0',
          'Accept': 'text/html,application/xhtml+xml,application/xml,application/json,text/plain,*/*',
          ...headers
        },
        timeout: 30000
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const contentType = response.headers.get('content-type') || '';
      let content = await response.text();

      // 尝试解析JSON格式的API文档
      if (contentType.includes('application/json')) {
        try {
          const jsonContent = JSON.parse(content);
          content = JSON.stringify(jsonContent, null, 2);
        } catch (e) {
          // 如果不是有效的JSON，保持原始文本
        }
      }

      return {
        content: [
          {
            type: 'text',
            text: `接口文档URL: ${url}\n内容类型: ${contentType}\n状态码: ${response.status}\n\n内容:\n${content}`
          }
        ]
      };
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

  async readMultipleApiDocs(urls, headers = {}) {
    const results = await Promise.allSettled(
      urls.map(url => this.readApiDocs(url, headers))
    );

    let combinedContent = '批量读取接口文档结果:\n\n';

    results.forEach((result, index) => {
      combinedContent += `=== 文档 ${index + 1} ===\n`;
      if (result.status === 'fulfilled') {
        combinedContent += result.value.content[0].text + '\n\n';
      } else {
        combinedContent += `读取失败: ${result.reason.message}\n\n`;
      }
    });

    return {
      content: [
        {
          type: 'text',
          text: combinedContent
        }
      ]
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
