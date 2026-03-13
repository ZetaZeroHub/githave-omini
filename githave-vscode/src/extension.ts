import * as vscode from 'vscode';
import { FMClient } from './core/fm-client';
import { LLMAdapter } from './core/llm-adapter';
import { ToolRegistry } from './core/tool-registry';
import { ChatController } from './chat/chat-controller';
import { ChatViewProvider } from './chat/chat-provider';
import { BubbleProvider, registerBubbleCommands } from './bubble/bubble-provider';
import { IndexManager } from './index/index-manager';
import { StatusBar } from './views/status-bar';
import { initLogger, log } from './utils/logger';
import { COMMANDS } from './utils/constants';

export function activate(context: vscode.ExtensionContext) {
    // 初始化日志
    initLogger();
    log('Githave AI 插件正在启动...');

    // ─── 核心服务实例化 ───
    const fmClient = new FMClient();
    const llmAdapter = new LLMAdapter();
    const toolRegistry = new ToolRegistry(fmClient);
    const chatController = new ChatController(llmAdapter, toolRegistry);
    const indexManager = new IndexManager(fmClient);
    const statusBar = new StatusBar(fmClient);

    // ─── Chat Webview ───
    const chatProvider = new ChatViewProvider(context.extensionUri, chatController);
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(ChatViewProvider.viewType, chatProvider)
    );

    // ─── 气泡浮窗 (Hover Provider) ───
    const bubbleProvider = new BubbleProvider(fmClient, llmAdapter);
    context.subscriptions.push(
        vscode.languages.registerHoverProvider({ scheme: 'file' }, bubbleProvider)
    );

    // ─── 注册命令 ───
    context.subscriptions.push(
        vscode.commands.registerCommand(COMMANDS.NEW_CHAT, () => {
            chatProvider.newChat();
        }),
        vscode.commands.registerCommand(COMMANDS.CLEAR_CHAT, () => {
            chatProvider.clearChat();
        }),
        vscode.commands.registerCommand(COMMANDS.TOGGLE_MODE, () => {
            chatProvider.toggleMode();
        }),
        vscode.commands.registerCommand(COMMANDS.BUILD_INDEX, () => {
            vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: 'Githave AI',
                cancellable: false,
            }, async (progress) => {
                await indexManager.buildIndex(progress);
            });
        }),
    );

    // ─── 注册气泡浮窗相关命令 ───
    registerBubbleCommands(context, fmClient, llmAdapter, (text) => {
        chatProvider.injectContext(text);
    });

    // ─── 启动后台服务 ───
    statusBar.startHealthCheck();
    indexManager.startWatching();

    // ─── 清理 ───
    context.subscriptions.push({
        dispose: () => {
            statusBar.dispose();
            indexManager.dispose();
        },
    });

    log('Githave AI 插件已激活! ✅');
}

export function deactivate() {
    log('Githave AI 插件已停用');
}
