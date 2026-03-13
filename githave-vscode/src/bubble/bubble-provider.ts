import * as vscode from 'vscode';
import { FMClient } from '../core/fm-client';
import { LLMAdapter } from '../core/llm-adapter';
import { ContextBuilder } from '../core/context-builder';
import { log, logError } from '../utils/logger';

/**
 * BubbleProvider — 气泡浮窗交互
 * 提供函数/文件/目录级别的即时 AI 脉络分析
 */
export class BubbleProvider implements vscode.HoverProvider {
    private fmClient: FMClient;
    private llmAdapter: LLMAdapter;

    constructor(fmClient: FMClient, llmAdapter: LLMAdapter) {
        this.fmClient = fmClient;
        this.llmAdapter = llmAdapter;
    }

    async provideHover(
        document: vscode.TextDocument,
        position: vscode.Position,
        _token: vscode.CancellationToken,
    ): Promise<vscode.Hover | undefined> {
        // 获取光标所在的单词（可能是函数名）
        const wordRange = document.getWordRangeAtPosition(position);
        if (!wordRange) { return undefined; }

        const word = document.getText(wordRange);
        if (!word || word.length < 2) { return undefined; }

        // 获取所在行的代码
        const line = document.lineAt(position.line).text;

        // 简单判断是否为函数调用或定义
        const isFunctionLike = /\b(function|func|def|fn|const|let|var|export)\b/.test(line)
            || line.includes(`${word}(`)
            || line.includes(`${word} (`)
            || /^\s*(async\s+)?[a-zA-Z_]/.test(line);

        if (!isFunctionLike) { return undefined; }

        const projectDir = ContextBuilder.getWorkspaceRoot();
        if (!projectDir) { return undefined; }

        try {
            // 通过 FM 搜索该函数
            const searchResult = await this.fmClient.search({
                project_dir: projectDir,
                query: word,
                search_mode: 'hybrid',
                limit: 3,
            });

            if (searchResult.code !== 0 || !searchResult.data) { return undefined; }

            const funcs = searchResult.data.func_res || searchResult.data.funcs || [];
            if (funcs.length === 0) { return undefined; }

            const topFunc = funcs[0];

            // 构建 Hover 内容
            const md = new vscode.MarkdownString();
            md.isTrusted = true;
            md.supportHtml = true;

            md.appendMarkdown(`### 🫧 Githave AI · 函数分析\n\n`);
            md.appendMarkdown(`**${topFunc.name}** \`${topFunc.package}\`\n\n`);

            if (topFunc.description) {
                md.appendMarkdown(`> ${topFunc.description}\n\n`);
            }

            md.appendMarkdown(`📄 \`${topFunc.file}\` · 匹配度 ${(topFunc.score * 100).toFixed(0)}%\n\n`);

            if (topFunc.code_snippet) {
                md.appendCodeblock(topFunc.code_snippet, document.languageId);
            }

            // 如果有多个匹配
            if (funcs.length > 1) {
                md.appendMarkdown(`\n---\n`);
                md.appendMarkdown(`*还有 ${funcs.length - 1} 个相关函数*\n\n`);
            }

            // 添加操作链接
            const sendToChatUri = vscode.Uri.parse(
                `command:githave-ai.sendToChat?${encodeURIComponent(JSON.stringify({ text: `分析函数 ${topFunc.name} 的调用链和作用` }))}`
            );
            md.appendMarkdown(`[💬 发送到聊天](${sendToChatUri}) · `);

            const analyzeUri = vscode.Uri.parse(
                `command:githave-ai.bubbleAnalyze?${encodeURIComponent(JSON.stringify({ function: topFunc.name }))}`
            );
            md.appendMarkdown(`[🔍 深入分析](${analyzeUri})`);

            return new vscode.Hover(md, wordRange);

        } catch (err) {
            logError('Bubble hover error', err);
            return undefined;
        }
    }
}

/**
 * 注册右键菜单的气泡分析命令
 */
export function registerBubbleCommands(
    context: vscode.ExtensionContext,
    fmClient: FMClient,
    llmAdapter: LLMAdapter,
    injectToChat: (text: string) => void,
) {
    // 注册气泡分析命令
    context.subscriptions.push(
        vscode.commands.registerCommand('githave-ai.bubbleAnalyze', async (args?: { function?: string }) => {
            const editor = vscode.window.activeTextEditor;
            if (!editor) { return; }

            let targetText: string;
            if (args?.function) {
                targetText = args.function;
            } else if (!editor.selection.isEmpty) {
                targetText = editor.document.getText(editor.selection);
            } else {
                // 获取光标所在的单词
                const wordRange = editor.document.getWordRangeAtPosition(editor.selection.active);
                targetText = wordRange ? editor.document.getText(wordRange) : '';
            }

            if (!targetText) {
                vscode.window.showWarningMessage('请选择代码或将光标放在函数名上');
                return;
            }

            const projectDir = ContextBuilder.getWorkspaceRoot();
            if (!projectDir) { return; }

            // 创建临时进度弹窗
            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: `🫧 正在分析: ${targetText}`,
                cancellable: true,
            }, async (progress, token) => {
                try {
                    // 搜索函数信息
                    const searchResult = await fmClient.search({
                        project_dir: projectDir,
                        query: targetText,
                        search_mode: 'hybrid',
                        limit: 5,
                    });

                    if (token.isCancellationRequested) { return; }

                    // 使用 LLM 进行深度分析
                    const context = JSON.stringify(searchResult.data, null, 2);
                    const response = await llmAdapter.chat([
                        {
                            role: 'system',
                            content: '你是代码分析助手。请简洁地分析给出的代码函数，包括：1) 功能概述 2) 关键逻辑 3) 潜在问题。用中文回答。',
                        },
                        {
                            role: 'user',
                            content: `请分析以下函数 "${targetText}":\n\n${context}`,
                        },
                    ]);

                    // 显示分析结果
                    const panel = vscode.window.createWebviewPanel(
                        'githaveBubble',
                        `🫧 ${targetText}`,
                        vscode.ViewColumn.Beside,
                        { enableScripts: false },
                    );

                    panel.webview.html = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
body { font-family: var(--vscode-font-family, sans-serif); padding: 16px; color: var(--vscode-editor-foreground); background: var(--vscode-editor-background); line-height: 1.6; }
h1 { font-size: 18px; margin-bottom: 12px; }
pre { background: rgba(128,128,128,0.1); padding: 12px; border-radius: 6px; overflow-x: auto; }
code { font-family: var(--vscode-editor-font-family, monospace); font-size: 13px; }
</style>
</head>
<body>
<h1>🫧 ${targetText}</h1>
<div>${(response.content || '').replace(/\n/g, '<br>')}</div>
</body>
</html>`;

                } catch (err) {
                    logError('Bubble analyze error', err);
                    vscode.window.showErrorMessage(`分析失败: ${err instanceof Error ? err.message : String(err)}`);
                }
            });
        })
    );

    // 注册发送到聊天命令
    context.subscriptions.push(
        vscode.commands.registerCommand('githave-ai.sendToChat', (args?: { text?: string }) => {
            const editor = vscode.window.activeTextEditor;
            let text: string;

            if (args?.text) {
                text = args.text;
            } else if (editor && !editor.selection.isEmpty) {
                text = editor.document.getText(editor.selection);
            } else {
                vscode.window.showWarningMessage('请先选择代码');
                return;
            }

            injectToChat(text);
            vscode.commands.executeCommand('githave-ai.chatView.focus');
        })
    );
}
