# VSCode 插件开发手把手指南

欢迎来到 VSCode 插件开发指南！本指南将带你从零开始在这个目录下编写你的第一个 VSCode 扩展。

## 目录
1. [环境准备](#1-环境准备)
2. [项目结构解析](#2-项目结构解析)
3. [开发你的第一个命令](#3-开发你的第一个命令)
4. [调试与运行](#4-调试与运行)
5. [打包与发布](#5-打包与发布)

---

## 1. 环境准备

要开发 VSCode 插件，你需要确保本地安装了以下工具：
- **Node.js**: 官方推荐使用最新的 LTS 版本。
- **Git**: 版本控制系统。
- **Yeoman 和 VS Code Extension Generator**: 用于快速生成项目脚手架。

如果你还没有搭建脚手架，在当前目录下（或上级目录）可以通过以下命令生成标准项目：
```bash
npx --package yo --package generator-code -- yo code
```

## 2. 项目结构解析

一个典型的 VSCode 插件项目具有以下关键文件：
- `package.json`: 插件的清单文件（Manifest）。这里配置了插件的名称、版本、激活事件（Activation Events）以及贡献点（Contributions，例如注册的命令）。
- `src/extension.ts` (或 .js): 插件的主要入口文件，包含 `activate` 和 `deactivate` 方法。
- `tsconfig.json`: TypeScript 的配置文件（如果是 TS 项目）。

## 3. 开发你的第一个命令

打开 `src/extension.ts` 文件，你会看到类似下面的代码：

```typescript
import * as vscode from 'vscode';

// 当插件被激活时，这个方法会被调用
export function activate(context: vscode.ExtensionContext) {
    console.log('你的插件已被激活！');

    // 注册一个命令，命令的 ID 必须与 package.json 中配置的一致
    let disposable = vscode.commands.registerCommand('githave-vscode.helloWorld', () => {
        // 命令执行时弹出一个信息框
        vscode.window.showInformationMessage('你好，世界！来自 githave-vscode');
    });

    context.subscriptions.push(disposable);
}

// 插件停用时调用
export function deactivate() {}
```

**别忘了在 `package.json` 中配置它：**
```json
"activationEvents": [
    "onCommand:githave-vscode.helloWorld"
],
"contributes": {
    "commands": [
        {
            "command": "githave-vscode.helloWorld",
            "title": "Hello World"
        }
    ]
}
```

## 4. 调试与运行

VSCode 为插件开发提供了极佳的调试体验。

1. 在 VSCode 中打开当前 `githave-vscode` 文件夹。
2. 按下 `F5` 键。这会启动一个处于“扩展开发宿主” (Extension Development Host) 模式的新 VSCode 窗口。
3. 在新窗口中，按下 `Ctrl+Shift+P` (或 Cmd+Shift+P) 打开命令面板。
4. 输入 `Hello World` 并执行，你会看到右下角弹出的提示框。
5. 你可以在 `src/extension.ts` 中设置断点，体验完整的断点调试功能。

## 5. 打包与发布

当插件开发完成后，你可以将其打包为 `.vsix` 文件进行分享或发布到应用市场。

1. 全局安装 `vsce`（Visual Studio Code Extensions CLI）：
   ```bash
   npm install -g @vscode/vsce
   ```
2. 在项目根目录下运行打包命令：
   ```bash
   vsce package
   ```
   这会生成一个 `.vsix` 文件，你可以直接在 VSCode 面板中通过 "Install from VSIX..." 进行安装。

---
*你可以利用新安装的 `vscode-extension-guide` agent skill 来获取更多深度指南。*
