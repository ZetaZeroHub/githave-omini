import * as vscode from 'vscode';
import { LLMAdapter, ChatMessage, ToolCall } from '../core/llm-adapter';
import { ToolRegistry } from '../core/tool-registry';
import { ContextBuilder } from '../core/context-builder';
import { SYSTEM_PROMPT_ACT, SYSTEM_PROMPT_PLAN } from '../utils/constants';
import { getDefaultChatMode } from '../utils/config';
import { log, logError } from '../utils/logger';

export type ChatMode = 'act' | 'plan';

/**
 * ChatController — 聊天逻辑核心
 * 管理消息历史、模式切换、工具调用循环
 */
export class ChatController {
    private llm: LLMAdapter;
    private toolRegistry: ToolRegistry;
    private messages: ChatMessage[] = [];
    private mode: ChatMode;
    private abortController: AbortController | null = null;

    constructor(llm: LLMAdapter, toolRegistry: ToolRegistry) {
        this.llm = llm;
        this.toolRegistry = toolRegistry;
        this.mode = getDefaultChatMode();
    }

    getMode(): ChatMode {
        return this.mode;
    }

    toggleMode(): ChatMode {
        this.mode = this.mode === 'act' ? 'plan' : 'act';
        return this.mode;
    }

    setMode(mode: ChatMode) {
        this.mode = mode;
    }

    clearHistory() {
        this.messages = [];
    }

    getHistory(): ChatMessage[] {
        return [...this.messages];
    }

    cancelStream() {
        if (this.abortController) {
            this.abortController.abort();
            this.abortController = null;
        }
    }

    /**
     * 发送消息并流式返回
     * @param userMessage 用户消息
     * @param onChunk 每接收到一个文本 chunk 时回调
     * @param onToolCall 工具调用时回调（可选，用于 UI 展示）
     * @param onDone 完成时回调
     * @param onError 错误时回调
     */
    async sendMessage(
        userMessage: string,
        onChunk: (text: string) => void,
        onToolCall?: (name: string, status: 'calling' | 'done') => void,
        onDone?: (fullText: string) => void,
        onError?: (error: string) => void,
    ) {
        this.abortController = new AbortController();

        // 构建上下文
        const editorCtx = ContextBuilder.getCurrentContext();
        const contextMsg = ContextBuilder.formatContextMessage(editorCtx);

        // 构建系统消息
        const systemPrompt = this.mode === 'act' ? SYSTEM_PROMPT_ACT : SYSTEM_PROMPT_PLAN;

        // 准备消息
        if (this.messages.length === 0) {
            this.messages.push({ role: 'system', content: systemPrompt });
        }

        // 添加用户消息（含上下文）
        const fullUserMsg = `${userMessage}\n\n---\n[编辑器上下文]\n${contextMsg}`;
        this.messages.push({ role: 'user', content: fullUserMsg });

        const tools = this.toolRegistry.getToolDefinitions();
        let fullText = '';

        try {
            // 工具调用循环（最多 5 轮）
            for (let round = 0; round < 5; round++) {
                let hasToolCalls = false;

                for await (const chunk of this.llm.streamChat(
                    this.messages,
                    tools,
                    this.abortController.signal
                )) {
                    if (typeof chunk === 'string') {
                        fullText += chunk;
                        onChunk(chunk);
                    } else {
                        // chunk 是 ToolCall[]
                        hasToolCalls = true;

                        // 先添加 assistant 消息 (含 tool_calls)
                        this.messages.push({
                            role: 'assistant',
                            content: fullText || '',
                            tool_calls: chunk,
                        });

                        // 执行每个工具调用
                        for (const tc of chunk) {
                            onToolCall?.(tc.function.name, 'calling');
                            const result = await this.toolRegistry.executeTool(tc);
                            this.messages.push({
                                role: 'tool',
                                content: result,
                                tool_call_id: tc.id,
                                name: tc.function.name,
                            });
                            onToolCall?.(tc.function.name, 'done');
                        }

                        fullText = ''; // 工具调用后重新开始收集文本
                    }
                }

                if (!hasToolCalls) {
                    break; // 没有工具调用，对话结束
                }
            }

            // 添加最终的 assistant 消息
            if (fullText) {
                this.messages.push({ role: 'assistant', content: fullText });
            }
            onDone?.(fullText);

        } catch (err) {
            if ((err as Error).name === 'AbortError') {
                log('Stream aborted by user');
                onDone?.(fullText);
            } else {
                logError('Chat stream error', err);
                onError?.(err instanceof Error ? err.message : String(err));
            }
        } finally {
            this.abortController = null;
        }
    }
}
