@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

rem MCP API文档服务器一键启动脚本 (Windows版)
rem 作者: GitHub Copilot
rem 日期: 2025-08-29

rem 颜色定义 (Windows CMD颜色代码)
set "RED=[91m"
set "GREEN=[92m"
set "YELLOW=[93m"
set "BLUE=[94m"
set "NC=[0m"

rem 日志函数使用goto实现
goto :main

:log_info
echo %BLUE%[INFO]%NC% %~1
goto :eof

:log_success
echo %GREEN%[SUCCESS]%NC% %~1
goto :eof

:log_warning
echo %YELLOW%[WARNING]%NC% %~1
goto :eof

:log_error
echo %RED%[ERROR]%NC% %~1
goto :eof

:check_node
call :log_info "检查Node.js环境..."

where node >nul 2>nul
if %errorlevel% neq 0 (
    call :log_error "Node.js未安装，请先安装Node.js (建议版本18+)"
    call :log_info "访问 https://nodejs.org 下载安装"
    exit /b 1
)

for /f "tokens=*" %%i in ('node --version') do set NODE_VERSION=%%i
call :log_success "Node.js已安装: !NODE_VERSION!"

where npm >nul 2>nul
if %errorlevel% neq 0 (
    call :log_error "npm未安装，请确保Node.js安装完整"
    exit /b 1
)

for /f "tokens=*" %%i in ('npm --version') do set NPM_VERSION=%%i
call :log_success "npm已安装: !NPM_VERSION!"
goto :eof

:check_dependencies
call :log_info "检查项目依赖..."

if not exist "node_modules" (
    call :log_warning "依赖未安装，开始安装..."
    call :install_dependencies
    goto :eof
)

call :log_success "依赖已存在"

rem 简单检查package.json更新 (Windows批处理限制)
call :log_info "如需更新依赖，请手动运行: npm install"
goto :eof

:install_dependencies
call :log_info "安装项目依赖..."

npm install
if %errorlevel% neq 0 (
    call :log_error "依赖安装失败"
    exit /b 1
)

call :log_success "依赖安装完成"
goto :eof

:check_server_file
call :log_info "检查服务器文件..."

if not exist "mcp-api-docs-server.js" (
    call :log_error "服务器文件 mcp-api-docs-server.js 不存在"
    exit /b 1
)

call :log_success "服务器文件检查通过"
goto :eof

:start_server
call :log_info "启动MCP API文档服务器..."
call :log_info "服务器将运行在stdio模式，用于MCP客户端连接"
call :log_warning "按 Ctrl+C 停止服务器"
echo.

rem 启动服务器
node mcp-api-docs-server.js
goto :eof

:show_help
echo MCP API文档服务器一键启动脚本 (Windows版)
echo.
echo 用法:
echo   start.bat          - 启动服务器
echo   start.bat --help   - 显示帮助信息
echo   start.bat --check  - 仅检查环境，不启动服务器
echo.
echo 功能:
echo   - 自动检查Node.js环境
echo   - 自动安装/更新项目依赖
echo   - 启动MCP API文档服务器
echo.
echo 注意:
echo   - 确保Node.js版本 ^>= 18
echo   - 服务器运行在stdio模式，用于MCP客户端连接
echo   - 按Ctrl+C停止服务器
goto :eof

:main
rem 检查参数
if "%~1"=="--help" goto :help
if "%~1"=="-h" goto :help
if "%~1"=="--check" goto :check_only
if "%~1"=="" goto :start_flow
call :log_error "未知参数: %~1"
call :show_help
exit /b 1

:help
call :show_help
exit /b 0

:check_only
call :log_info "执行环境检查..."
call :check_node
if %errorlevel% neq 0 exit /b 1
call :check_dependencies
if %errorlevel% neq 0 exit /b 1
call :check_server_file
if %errorlevel% neq 0 exit /b 1
call :log_success "所有检查通过！"
exit /b 0

:start_flow
rem 显示启动横幅
echo.
echo ================================================
echo         MCP API文档服务器一键启动脚本
echo ================================================
echo.

rem 执行启动流程
call :check_node
if %errorlevel% neq 0 exit /b 1

call :check_dependencies
if %errorlevel% neq 0 exit /b 1

call :check_server_file
if %errorlevel% neq 0 exit /b 1

echo.
call :log_success "环境检查完成，准备启动服务器..."
echo.

call :start_server
goto :eof
