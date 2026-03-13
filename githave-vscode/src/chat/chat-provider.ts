import * as vscode from 'vscode';
import { ChatController, ChatMode } from './chat-controller';
import { log } from '../utils/logger';

/**
 * ChatViewProvider — 管理 Chat Webview
 */
export class ChatViewProvider implements vscode.WebviewViewProvider {

    public static readonly viewType = 'githave-ai.chatView';
    private webviewView?: vscode.WebviewView;
    private chatController: ChatController;

    constructor(
        private readonly extensionUri: vscode.Uri,
        chatController: ChatController,
    ) {
        this.chatController = chatController;
    }

    resolveWebviewView(
        webviewView: vscode.WebviewView,
        _context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken,
    ) {
        this.webviewView = webviewView;

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this.extensionUri],
        };

        webviewView.webview.html = this.getHtmlContent(webviewView.webview);

        // 监听 Webview 消息
        webviewView.webview.onDidReceiveMessage(async (message) => {
            switch (message.type) {
                case 'sendMessage':
                    await this.handleSendMessage(message.text);
                    break;
                case 'toggleMode':
                    this.handleToggleMode();
                    break;
                case 'clearChat':
                    this.handleClearChat();
                    break;
                case 'cancelStream':
                    this.chatController.cancelStream();
                    break;
                case 'ready':
                    // Webview 加载完成，发送初始状态
                    this.postMessage({ type: 'setMode', mode: this.chatController.getMode() });
                    break;
            }
        });
    }

    private async handleSendMessage(text: string) {
        // 通知 UI 开始思考
        this.postMessage({ type: 'startThinking' });

        await this.chatController.sendMessage(
            text,
            (chunk) => {
                this.postMessage({ type: 'streamChunk', text: chunk });
            },
            (toolName, status) => {
                this.postMessage({ type: 'toolCall', name: toolName, status });
            },
            (_fullText) => {
                this.postMessage({ type: 'streamEnd' });
            },
            (error) => {
                this.postMessage({ type: 'error', message: error });
            },
        );
    }

    private handleToggleMode() {
        const newMode = this.chatController.toggleMode();
        this.postMessage({ type: 'setMode', mode: newMode });
    }

    private handleClearChat() {
        this.chatController.clearHistory();
        this.postMessage({ type: 'chatCleared' });
    }

    public newChat() {
        this.chatController.clearHistory();
        this.postMessage({ type: 'chatCleared' });
    }

    public clearChat() {
        this.handleClearChat();
    }

    public toggleMode() {
        this.handleToggleMode();
    }

    /** 向聊天注入文本（从气泡浮窗或右键菜单） */
    public injectContext(text: string) {
        this.postMessage({ type: 'injectContext', text });
    }

    private postMessage(message: unknown) {
        this.webviewView?.webview.postMessage(message);
    }

    private getHtmlContent(webview: vscode.Webview): string {
        const nonce = getNonce();

        return /*html*/`<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';">
    <title>Githave AI Chat</title>
    <style>
        :root {
            --bg: var(--vscode-editor-background);
            --fg: var(--vscode-editor-foreground);
            --input-bg: var(--vscode-input-background);
            --input-fg: var(--vscode-input-foreground);
            --input-border: var(--vscode-input-border);
            --btn-bg: var(--vscode-button-background);
            --btn-fg: var(--vscode-button-foreground);
            --btn-hover: var(--vscode-button-hoverBackground);
            --badge-bg: var(--vscode-badge-background);
            --badge-fg: var(--vscode-badge-foreground);
            --border: var(--vscode-panel-border, rgba(128,128,128,0.3));
            --user-bubble: var(--vscode-textBlockQuote-background, rgba(100,100,255,0.1));
            --ai-bubble: var(--vscode-editor-background);
            --tool-bg: var(--vscode-textCodeBlock-background, rgba(128,128,128,0.1));
        }

        * { margin: 0; padding: 0; box-sizing: border-box; }

        body {
            font-family: var(--vscode-font-family);
            font-size: var(--vscode-font-size, 13px);
            color: var(--fg);
            background: var(--bg);
            display: flex;
            flex-direction: column;
            height: 100vh;
            overflow: hidden;
        }

        /* ─── Header ─── */
        .header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 8px 12px;
            border-bottom: 1px solid var(--border);
            flex-shrink: 0;
        }
        .header-title {
            font-weight: 600;
            font-size: 13px;
            display: flex;
            align-items: center;
            gap: 6px;
        }
        .mode-badge {
            font-size: 11px;
            padding: 2px 8px;
            border-radius: 10px;
            background: var(--badge-bg);
            color: var(--badge-fg);
            cursor: pointer;
            user-select: none;
            transition: opacity 0.2s;
        }
        .mode-badge:hover { opacity: 0.8; }

        /* ─── Messages Area ─── */
        .messages {
            flex: 1;
            overflow-y: auto;
            padding: 12px;
            display: flex;
            flex-direction: column;
            gap: 12px;
        }
        .messages::-webkit-scrollbar { width: 6px; }
        .messages::-webkit-scrollbar-thumb { background: rgba(128,128,128,0.3); border-radius: 3px; }

        .message {
            max-width: 95%;
            padding: 10px 14px;
            border-radius: 12px;
            line-height: 1.6;
            word-break: break-word;
            animation: fadeIn 0.2s ease;
        }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }

        .message.user {
            align-self: flex-end;
            background: var(--user-bubble);
            border-bottom-right-radius: 4px;
        }
        .message.assistant {
            align-self: flex-start;
            background: var(--ai-bubble);
            border: 1px solid var(--border);
            border-bottom-left-radius: 4px;
        }

        .message pre {
            background: var(--tool-bg);
            padding: 8px 12px;
            border-radius: 6px;
            overflow-x: auto;
            margin: 6px 0;
            font-family: var(--vscode-editor-font-family, monospace);
            font-size: 12px;
        }
        .message code {
            font-family: var(--vscode-editor-font-family, monospace);
            font-size: 12px;
            background: var(--tool-bg);
            padding: 1px 4px;
            border-radius: 3px;
        }
        .message pre code { background: none; padding: 0; }

        /* ─── Tool Call Indicator ─── */
        .tool-call {
            display: flex;
            align-items: center;
            gap: 6px;
            padding: 6px 12px;
            background: var(--tool-bg);
            border-radius: 8px;
            font-size: 12px;
            color: var(--fg);
            opacity: 0.8;
        }
        .tool-call .spinner {
            width: 12px; height: 12px;
            border: 2px solid rgba(128,128,128,0.3);
            border-top-color: var(--btn-bg);
            border-radius: 50%;
            animation: spin 0.6s linear infinite;
        }
        @keyframes spin { to { transform: rotate(360deg); } }
        .tool-call .done-icon { color: #4caf50; }

        /* ─── Thinking Indicator ─── */
        .thinking {
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 10px 14px;
            opacity: 0.6;
            font-style: italic;
        }
        .thinking .dots span {
            display: inline-block;
            width: 6px; height: 6px;
            background: var(--fg);
            border-radius: 50%;
            margin: 0 2px;
            animation: bounce 1.4s infinite ease-in-out both;
        }
        .thinking .dots span:nth-child(1) { animation-delay: -0.32s; }
        .thinking .dots span:nth-child(2) { animation-delay: -0.16s; }
        @keyframes bounce { 0%, 80%, 100% { transform: scale(0); } 40% { transform: scale(1); } }

        /* ─── Welcome Screen ─── */
        .welcome {
            flex: 1;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            text-align: center;
            padding: 20px;
            opacity: 0.6;
        }
        .welcome h2 { margin-bottom: 8px; font-size: 16px; }
        .welcome p { font-size: 12px; max-width: 280px; }

        /* ─── Input Area ─── */
        .input-area {
            border-top: 1px solid var(--border);
            padding: 10px 12px;
            flex-shrink: 0;
        }
        .input-wrapper {
            display: flex;
            gap: 6px;
            align-items: flex-end;
        }
        .input-wrapper textarea {
            flex: 1;
            resize: none;
            background: var(--input-bg);
            color: var(--input-fg);
            border: 1px solid var(--input-border);
            border-radius: 8px;
            padding: 8px 12px;
            font-family: var(--vscode-font-family);
            font-size: 13px;
            outline: none;
            min-height: 36px;
            max-height: 120px;
            line-height: 1.4;
            transition: border-color 0.2s;
        }
        .input-wrapper textarea:focus { border-color: var(--btn-bg); }
        .input-wrapper textarea::placeholder { opacity: 0.5; }

        .send-btn {
            width: 36px; height: 36px;
            border: none;
            background: var(--btn-bg);
            color: var(--btn-fg);
            border-radius: 8px;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            flex-shrink: 0;
            transition: background 0.2s;
        }
        .send-btn:hover { background: var(--btn-hover); }
        .send-btn:disabled { opacity: 0.4; cursor: not-allowed; }
        .send-btn svg { width: 18px; height: 18px; fill: currentColor; }

        .input-footer {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-top: 4px;
            font-size: 11px;
            opacity: 0.5;
        }
    </style>
</head>
<body>
    <div class="header">
        <div class="header-title">
            🤖 Githave AI
        </div>
        <span class="mode-badge" id="modeBadge" onclick="toggleMode()">Act</span>
    </div>

    <div class="messages" id="messages">
        <div class="welcome" id="welcome">
            <h2>👋 你好，有什么需要帮助？</h2>
            <p>我可以帮你搜索代码、分析架构、编写代码、解答技术问题。</p>
        </div>
    </div>

    <div class="input-area">
        <div class="input-wrapper">
            <textarea
                id="input"
                placeholder="输入你的问题... (Shift+Enter 换行)"
                rows="1"
            ></textarea>
            <button class="send-btn" id="sendBtn" onclick="sendMessage()">
                <svg viewBox="0 0 24 24"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
            </button>
        </div>
        <div class="input-footer">
            <span id="statusText">就绪</span>
            <span>Shift+Enter 换行 · Enter 发送</span>
        </div>
    </div>

    <script nonce="${nonce}">
        const vscode = acquireVsCodeApi();
        const messagesEl = document.getElementById('messages');
        const inputEl = document.getElementById('input');
        const sendBtn = document.getElementById('sendBtn');
        const modeBadge = document.getElementById('modeBadge');
        const welcomeEl = document.getElementById('welcome');
        const statusText = document.getElementById('statusText');

        let isStreaming = false;
        let currentAssistantEl = null;
        let currentAssistantText = '';

        // ─── 输入处理 ───
        inputEl.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
            }
        });
        inputEl.addEventListener('input', () => {
            inputEl.style.height = 'auto';
            inputEl.style.height = Math.min(inputEl.scrollHeight, 120) + 'px';
        });

        function sendMessage() {
            const text = inputEl.value.trim();
            if (!text || isStreaming) return;

            hideWelcome();
            addMessage('user', text);
            inputEl.value = '';
            inputEl.style.height = 'auto';

            vscode.postMessage({ type: 'sendMessage', text });
        }

        function toggleMode() {
            vscode.postMessage({ type: 'toggleMode' });
        }

        // ─── 消息渲染 ───
        function addMessage(role, text) {
            const el = document.createElement('div');
            el.className = 'message ' + role;
            el.innerHTML = renderMarkdown(text);
            messagesEl.appendChild(el);
            scrollToBottom();
            return el;
        }

        function hideWelcome() {
            if (welcomeEl) welcomeEl.style.display = 'none';
        }

        function scrollToBottom() {
            messagesEl.scrollTop = messagesEl.scrollHeight;
        }

        function showThinking() {
            const el = document.createElement('div');
            el.className = 'thinking';
            el.id = 'thinkingIndicator';
            el.innerHTML = '思考中 <div class="dots"><span></span><span></span><span></span></div>';
            messagesEl.appendChild(el);
            scrollToBottom();
        }

        function hideThinking() {
            const el = document.getElementById('thinkingIndicator');
            if (el) el.remove();
        }

        function addToolCallIndicator(name, status) {
            hideThinking();
            const id = 'tool-' + name.replace(/\\W/g, '');
            let el = document.getElementById(id);
            if (!el) {
                el = document.createElement('div');
                el.className = 'tool-call';
                el.id = id;
                messagesEl.appendChild(el);
            }
            if (status === 'calling') {
                el.innerHTML = '<div class="spinner"></div> 调用工具: ' + name + '...';
            } else {
                el.innerHTML = '<span class="done-icon">✓</span> ' + name + ' 完成';
            }
            scrollToBottom();
        }

        // ─── 简易 Markdown 渲染器 ───
        function renderMarkdown(text) {
            let html = escapeHtml(text);
            // Code blocks
            html = html.replace(/\`\`\`(\\w*)\\n([\\s\\S]*?)\`\`\`/g, '<pre><code class="lang-$1">$2</code></pre>');
            // Inline code
            html = html.replace(/\`([^\`]+)\`/g, '<code>$1</code>');
            // Bold
            html = html.replace(/\\*\\*(.+?)\\*\\*/g, '<strong>$1</strong>');
            // Italic
            html = html.replace(/\\*(.+?)\\*/g, '<em>$1</em>');
            // Headers
            html = html.replace(/^### (.+)$/gm, '<h4>$1</h4>');
            html = html.replace(/^## (.+)$/gm, '<h3>$1</h3>');
            html = html.replace(/^# (.+)$/gm, '<h2>$1</h2>');
            // Lists
            html = html.replace(/^- (.+)$/gm, '• $1<br>');
            html = html.replace(/^\\d+\\. (.+)$/gm, '$&<br>');
            // Line breaks
            html = html.replace(/\\n/g, '<br>');
            return html;
        }

        function escapeHtml(text) {
            const el = document.createElement('div');
            el.textContent = text;
            return el.innerHTML;
        }

        // ─── 接收来自 Extension 的消息 ───
        window.addEventListener('message', (event) => {
            const msg = event.data;
            switch (msg.type) {
                case 'startThinking':
                    isStreaming = true;
                    sendBtn.disabled = true;
                    statusText.textContent = '思考中...';
                    showThinking();
                    break;

                case 'streamChunk':
                    hideThinking();
                    if (!currentAssistantEl) {
                        currentAssistantEl = document.createElement('div');
                        currentAssistantEl.className = 'message assistant';
                        messagesEl.appendChild(currentAssistantEl);
                        currentAssistantText = '';
                    }
                    currentAssistantText += msg.text;
                    currentAssistantEl.innerHTML = renderMarkdown(currentAssistantText);
                    scrollToBottom();
                    break;

                case 'toolCall':
                    addToolCallIndicator(msg.name, msg.status);
                    statusText.textContent = '调用工具: ' + msg.name;
                    break;

                case 'streamEnd':
                    isStreaming = false;
                    sendBtn.disabled = false;
                    currentAssistantEl = null;
                    currentAssistantText = '';
                    statusText.textContent = '就绪';
                    hideThinking();
                    break;

                case 'error':
                    hideThinking();
                    isStreaming = false;
                    sendBtn.disabled = false;
                    currentAssistantEl = null;
                    currentAssistantText = '';
                    statusText.textContent = '就绪';
                    addMessage('assistant', '❌ 错误: ' + msg.message);
                    break;

                case 'setMode':
                    modeBadge.textContent = msg.mode === 'act' ? 'Act' : 'Plan';
                    break;

                case 'chatCleared':
                    messagesEl.innerHTML = '';
                    if (welcomeEl) {
                        messagesEl.appendChild(welcomeEl);
                        welcomeEl.style.display = '';
                    }
                    currentAssistantEl = null;
                    currentAssistantText = '';
                    break;

                case 'injectContext':
                    inputEl.value += msg.text;
                    inputEl.style.height = 'auto';
                    inputEl.style.height = Math.min(inputEl.scrollHeight, 120) + 'px';
                    inputEl.focus();
                    break;
            }
        });

        // 通知 Extension Webview 已就绪
        vscode.postMessage({ type: 'ready' });
    </script>
</body>
</html>`;
    }
}

function getNonce(): string {
    let text = '';
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
        text += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return text;
}
