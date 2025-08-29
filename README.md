# MCP API文档服务器 - 一键启动指南

这是一个用于读取API文档的MCP（Model Context Protocol）服务器，提供了便捷的一键启动脚本。

## 🚀 快速启动

### Linux/macOS 用户

```bash
# 直接启动（推荐）
./start.sh

# 或者先检查环境
./start.sh --check
```

### Windows 用户

```cmd
# 直接启动（推荐）
start.bat

# 或者先检查环境
start.bat --check
```

## 📋 系统要求

- **Node.js**: 版本 18 或更高
- **npm**: 随Node.js一起安装
- **操作系统**: Linux, macOS, 或 Windows

## 🔧 功能特性

### 自动化检查
- ✅ Node.js 环境检测
- ✅ npm 可用性验证
- ✅ 项目依赖检查
- ✅ 服务器文件完整性验证

### 智能依赖管理
- 🔍 自动检测是否需要安装依赖
- 📦 自动安装缺失的npm包
- 🔄 检测package.json更新并重新安装

### 用户友好
- 🎨 彩色日志输出
- 📝 详细的状态信息
- ❌ 清晰的错误提示
- 📖 内置帮助文档

## 📖 使用说明

### 基本用法

```bash
# Linux/macOS
./start.sh

# Windows
start.bat
```

### 高级选项

```bash
# 显示帮助信息
./start.sh --help     # Linux/macOS
start.bat --help      # Windows

# 仅检查环境，不启动服务器
./start.sh --check    # Linux/macOS
start.bat --check     # Windows
```

### 停止服务器

在服务器运行时，按 `Ctrl+C` 即可安全停止服务器。

## 🛠️ 手动安装（可选）

如果您更喜欢手动操作：

```bash
# 1. 安装依赖
npm install

# 2. 启动服务器
npm start
# 或
node mcp-api-docs-server.js
```

## 🔌 MCP工具说明

本服务器提供以下MCP工具：

### 1. read_api_docs
读取单个API文档URL的内容

**参数：**
- `url` (必需): 接口文档的URL地址
- `headers` (可选): HTTP请求头对象

### 2. read_multiple_api_docs
批量读取多个API文档URL的内容

**参数：**
- `urls` (必需): 接口文档URL数组
- `headers` (可选): HTTP请求头对象

## 🎯 使用场景

- 📚 快速获取API文档内容
- 🔄 批量处理多个API文档
- 🤖 与AI助手集成，提供文档上下文
- 📊 API文档内容分析

## ⚠️ 注意事项

1. **网络连接**: 确保能够访问目标API文档URL
2. **超时设置**: 请求超时时间为30秒
3. **内容类型**: 支持JSON、HTML、XML等多种格式
4. **安全性**: 请谨慎处理包含敏感信息的API文档

## 🐛 故障排除

### 常见问题

**Q: Node.js版本过低**
```bash
# 升级Node.js到18+版本
# 访问 https://nodejs.org 下载最新版本
```

**Q: 依赖安装失败**
```bash
# 清理缓存后重试
npm cache clean --force
npm install
```

**Q: 权限错误（Linux/macOS）**
```bash
# 确保脚本有执行权限
chmod +x start.sh
```

**Q: 服务器无法启动**
```bash
# 检查端口占用或查看错误日志
# 确保当前目录包含正确的项目文件
```

## 📝 日志说明

启动脚本会显示以下类型的日志：

- 🔵 **[INFO]**: 普通信息
- 🟢 **[SUCCESS]**: 成功操作
- 🟡 **[WARNING]**: 警告信息
- 🔴 **[ERROR]**: 错误信息

## 🤝 技术支持

如遇到问题，请检查：

1. Node.js版本是否符合要求
2. 网络连接是否正常
3. 项目文件是否完整
4. 依赖是否正确安装

---

**提示**: 首次运行建议使用 `--check` 参数验证环境配置！
