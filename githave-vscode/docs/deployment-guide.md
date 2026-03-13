# Githave AI VSCode 插件 — 联调与部署指南

## 目录

1. [开发环境搭建](#1-开发环境搭建)
2. [本地联调](#2-本地联调)
3. [配置详解](#3-配置详解)
4. [生产打包](#4-生产打包)
5. [企业内部分发](#5-企业内部分发)
6. [常见问题排查](#6-常见问题排查)

---

## 1. 开发环境搭建

### 前置依赖

| 工具 | 最低版本 | 说明 |
|------|----------|------|
| Node.js | 18+ | 推荐 LTS 版本 |
| VS Code | 1.110+ | 插件引擎要求 |
| FlashMemory (fm) | - | 后端代码索引服务 |

### 安装步骤

```bash
# 进入插件目录
cd githave-vscode

# 安装依赖
npm install

# 编译 TypeScript
npm run compile

# 启动监听模式（开发时推荐）
npm run watch
```

---

## 2. 本地联调

### 2.1 启动 FlashMemory 后端

确保 `fm` 二进制程序正在运行：

```bash
# 默认端口 5532
./fm serve

# 或指定端口
FM_PORT=5532 ./fm serve

# 带认证启动
API_USER=admin API_PASS=your_password ./fm serve
```

验证服务是否正常：
```bash
curl http://localhost:5532/api/health
# 预期返回: {"code":0,"message":"OK"}
```

### 2.2 启动插件调试

1. 在 VS Code 中打开 `githave-vscode` 目录
2. 按 `F5` 启动调试（会打开一个新的 Extension Development Host 窗口）
3. 在新窗口的左侧活动栏中，你会看到一个 🤖 **Githave AI** 图标
4. 点击图标打开 AI Chat 面板

### 2.3 联调检查清单

| 检查项 | 操作 | 预期结果 |
|--------|------|----------|
| FM 连接 | 查看底部状态栏 | 显示 `✓ Githave AI` |
| 聊天功能 | 在聊天面板输入 "你好" | 收到 AI 回复 |
| 模式切换 | 点击聊天面板右上角 `Act`/`Plan` 徽章 | 模式切换 |
| 工具调用 | 输入 "搜索代码中的 main 函数" | 显示工具调用指示器后返回结果 |
| 构建索引 | 命令面板 → `Githave AI: Build Code Index` | 弹出成功通知 |
| 气泡浮窗 | 将鼠标悬停在任意函数名上 | 弹出函数分析浮窗 |
| 右键分析 | 选中代码 → 右键 → `Githave AI: Analyze with Bubble` | 打开侧边分析面板 |
| 发送到聊天 | 选中代码 → 右键 → `Githave AI: Send Selection to Chat` | 代码注入聊天输入框 |

### 2.4 调试技巧

- **查看日志**: 在 VS Code 的 Output 面板选择 `Githave AI` 查看插件日志
- **断点调试**: 在 `src/` 下的 TypeScript 文件中设置断点，F5 启动后会自动命中
- **Webview 调试**: 在 Extension Development Host 窗口中，按 `Ctrl+Shift+I` (Cmd+Opt+I) 打开 DevTools，查看 Webview 的控制台和网络请求
- **重载**: 修改代码后，在 Extension Development Host 窗口中按 `Ctrl+Shift+P` → `Developer: Reload Window`

---

## 3. 配置详解

所有配置项都可以在 VS Code Settings 中搜索 `githave-ai` 找到：

### LLM 配置

| 配置项 | 默认值 | 说明 |
|--------|--------|------|
| `githave-ai.llm.provider` | `dashscope` | 模型服务商：`dashscope` / `openai` / `ollama` / `custom` |
| `githave-ai.llm.apiEndpoint` | `https://coding.dashscope.aliyuncs.com/v1` | API 地址（OpenAI 兼容） |
| `githave-ai.llm.apiKey` | `githave-omini` | API 密钥 |
| `githave-ai.llm.model` | `qwen-plus` | 模型名称 |
| `githave-ai.llm.maxTokens` | `4096` | 最大输出 token 数 |

### FM 配置

| 配置项 | 默认值 | 说明 |
|--------|--------|------|
| `githave-ai.fm.host` | `localhost` | FlashMemory 服务地址 |
| `githave-ai.fm.port` | `5532` | FlashMemory 服务端口 |
| `githave-ai.fm.username` | (空) | Basic Auth 用户名（可选） |
| `githave-ai.fm.password` | (空) | Basic Auth 密码（可选） |

### 聊天配置

| 配置项 | 默认值 | 说明 |
|--------|--------|------|
| `githave-ai.chat.defaultMode` | `act` | 默认聊天模式：`act`(直接执行) / `plan`(先规划) |

**切换到其他模型示例**（settings.json）：

```jsonc
// 使用 OpenAI
{
    "githave-ai.llm.provider": "openai",
    "githave-ai.llm.apiEndpoint": "https://api.openai.com/v1",
    "githave-ai.llm.apiKey": "sk-xxx",
    "githave-ai.llm.model": "gpt-4o"
}

// 使用本地 Ollama
{
    "githave-ai.llm.provider": "ollama",
    "githave-ai.llm.apiEndpoint": "http://localhost:11434/v1",
    "githave-ai.llm.apiKey": "ollama",
    "githave-ai.llm.model": "qwen2.5:14b"
}
```

---

## 4. 生产打包

### 4.1 安装打包工具

```bash
npm install -g @vscode/vsce
```

### 4.2 打包为 .vsix

```bash
cd githave-vscode

# 编译
npm run compile

# 打包
vsce package
```

成功后会生成 `githave-ai-0.1.0.vsix` 文件。

### 4.3 测试安装

```bash
# 通过命令行安装
code --install-extension githave-ai-0.1.0.vsix

# 或在 VS Code 中：
# Extensions 面板 → ⋯ → Install from VSIX...
```

---

## 5. 企业内部分发

### 方式一：手动分发 .vsix 文件

最简单的方式，将 `.vsix` 文件通过内部文件共享或 Git 仓库分发给团队成员。

### 方式二：搭建私有 Extension Registry

使用 [Open VSX Registry](https://github.com/eclipse/openvsx) 或类似方案搭建企业内部的扩展市场。

### 方式三：发布到 VS Code Marketplace（公开）

```bash
# 首次需要创建发布者并登录
vsce login zetazerohub

# 发布
vsce publish
```

---

## 6. 常见问题排查

### Q: 状态栏显示 ⚠ 无法连接 FlashMemory

- 确认 `fm` 服务是否在运行：`curl http://localhost:5532/api/health`
- 检查 `githave-ai.fm.port` 配置是否与 fm 服务端口一致
- 如果 fm 在远程服务器上，确保端口可达

### Q: 聊天无响应 / 报错

- 检查 LLM API Key 是否正确
- 查看 Output 面板的 `Githave AI` 日志获取详细错误信息
- 尝试在浏览器中直接调用 LLM API 确认服务可用性

### Q: 气泡浮窗不显示

- 确保已建立项目索引（执行 `Githave AI: Build Code Index`）
- Hover 需要光标在函数名上停留 1-2 秒
- 确认 fm 服务可用

### Q: 工具调用始终失败

- 确认工作区已打开一个项目文件夹（不是单个文件）
- 先构建索引再使用搜索功能
- 查看 Output 面板日志确认具体错误

---

*最后更新: 2026-03-12*
