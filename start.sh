#!/bin/bash

# MCP API文档服务器一键启动脚本
# 作者: GitHub Copilot
# 日期: 2025-08-29

set -e  # 遇到错误时退出

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 日志函数
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 检查Node.js是否安装
check_node() {
    log_info "检查Node.js环境..."

    if ! command -v node &> /dev/null; then
        log_error "Node.js未安装，请先安装Node.js (建议版本18+)"
        log_info "访问 https://nodejs.org 下载安装"
        exit 1
    fi

    NODE_VERSION=$(node --version)
    log_success "Node.js已安装: $NODE_VERSION"

    if ! command -v npm &> /dev/null; then
        log_error "npm未安装，请确保Node.js安装完整"
        exit 1
    fi

    NPM_VERSION=$(npm --version)
    log_success "npm已安装: $NPM_VERSION"
}

# 检查依赖是否安装
check_dependencies() {
    log_info "检查项目依赖..."

    if [ ! -d "node_modules" ]; then
        log_warning "依赖未安装，开始安装..."
        install_dependencies
    else
        log_success "依赖已存在"

        # 检查package.json是否有更新
        if [ "package.json" -nt "node_modules" ]; then
            log_warning "检测到package.json更新，重新安装依赖..."
            install_dependencies
        fi
    fi
}

# 安装依赖
install_dependencies() {
    log_info "安装项目依赖..."

    if npm install; then
        log_success "依赖安装完成"
    else
        log_error "依赖安装失败"
        exit 1
    fi
}

# 检查服务器文件
check_server_file() {
    log_info "检查服务器文件..."

    if [ ! -f "mcp-api-docs-server.js" ]; then
        log_error "服务器文件 mcp-api-docs-server.js 不存在"
        exit 1
    fi

    log_success "服务器文件检查通过"
}

# 启动服务器
start_server() {
    log_info "启动MCP API文档服务器..."
    log_info "服务器将运行在stdio模式，用于MCP客户端连接"
    log_warning "按 Ctrl+C 停止服务器"
    echo ""

    # 启动服务器
    node mcp-api-docs-server.js
}

# 显示帮助信息
show_help() {
    echo "MCP API文档服务器一键启动脚本"
    echo ""
    echo "用法:"
    echo "  ./start.sh          - 启动服务器"
    echo "  ./start.sh --help   - 显示帮助信息"
    echo "  ./start.sh --check  - 仅检查环境，不启动服务器"
    echo ""
    echo "功能:"
    echo "  - 自动检查Node.js环境"
    echo "  - 自动安装/更新项目依赖"
    echo "  - 启动MCP API文档服务器"
    echo ""
    echo "注意:"
    echo "  - 确保Node.js版本 >= 18"
    echo "  - 服务器运行在stdio模式，用于MCP客户端连接"
    echo "  - 按Ctrl+C停止服务器"
}

# 主函数
main() {
    # 检查参数
    case "${1:-}" in
        --help|-h)
            show_help
            exit 0
            ;;
        --check)
            log_info "执行环境检查..."
            check_node
            check_dependencies
            check_server_file
            log_success "所有检查通过！"
            exit 0
            ;;
        "")
            # 默认启动流程
            ;;
        *)
            log_error "未知参数: $1"
            show_help
            exit 1
            ;;
    esac

    # 显示启动横幅
    echo ""
    echo "================================================"
    echo "        MCP API文档服务器一键启动脚本"
    echo "================================================"
    echo ""

    # 执行启动流程
    check_node
    check_dependencies
    check_server_file

    echo ""
    log_success "环境检查完成，准备启动服务器..."
    echo ""

    start_server
}

# 信号处理
trap 'log_info "正在停止服务器..."; exit 0' INT TERM

# 执行主函数
main "$@"
