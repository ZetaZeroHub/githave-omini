import { getLLMConfig } from '../utils/config';
import { log, logError } from '../utils/logger';

export interface ChatMessage {
    role: 'system' | 'user' | 'assistant' | 'tool';
    content: string;
    tool_calls?: ToolCall[];
    tool_call_id?: string;
    name?: string;
}

export interface ToolCall {
    id: string;
    type: 'function';
    function: {
        name: string;
        arguments: string;
    };
}

export interface ToolDefinition {
    type: 'function';
    function: {
        name: string;
        description: string;
        parameters: Record<string, unknown>;
    };
}

export interface StreamChunk {
    choices: {
        delta: {
            content?: string;
            tool_calls?: ToolCall[];
        };
        finish_reason: string | null;
    }[];
}

/**
 * LLM Adapter — 支持多模型后端（OpenAI 兼容协议）
 */
export class LLMAdapter {

    /**
     * 流式发送消息，返回 AsyncGenerator
     */
    async *streamChat(
        messages: ChatMessage[],
        tools?: ToolDefinition[],
        abortSignal?: AbortSignal
    ): AsyncGenerator<string | ToolCall[], void, unknown> {
        const config = getLLMConfig();
        const url = `${config.apiEndpoint}/chat/completions`;

        const body: Record<string, unknown> = {
            model: config.model,
            messages,
            stream: true,
            max_tokens: config.maxTokens,
        };
        if (tools && tools.length > 0) {
            body.tools = tools;
            body.tool_choice = 'auto';
        }

        const maskedKey = config.apiKey ? `${config.apiKey.substring(0, 5)}...${config.apiKey.substring(config.apiKey.length - 4)}` : 'empty';
        log(`LLM Stream Request: ${config.provider}/${config.model}`);
        log(`URL: ${url}`);
        log(`API Key (Masked): ${maskedKey}`);
        log(`Body: ${JSON.stringify(body, null, 2)}`);

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${config.apiKey}`,
            },
            body: JSON.stringify(body),
            signal: abortSignal,
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`LLM API Error ${response.status}: ${errorText}`);
        }

        const reader = response.body?.getReader();
        if (!reader) {
            throw new Error('Response body is empty');
        }

        const decoder = new TextDecoder();
        let buffer = '';
        const pendingToolCalls: ToolCall[] = [];

        try {
            while (true) {
                const { done, value } = await reader.read();
                if (done) { break; }

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';

                for (const line of lines) {
                    const trimmed = line.trim();
                    if (!trimmed || trimmed === 'data: [DONE]') { continue; }
                    if (!trimmed.startsWith('data: ')) { continue; }

                    try {
                        const chunk: StreamChunk = JSON.parse(trimmed.slice(6));
                        const choice = chunk.choices?.[0];
                        if (!choice) { continue; }

                        if (choice.delta?.content) {
                            yield choice.delta.content;
                        }

                        if (choice.delta?.tool_calls) {
                            for (const tc of choice.delta.tool_calls) {
                                // Accumulate tool call fragments
                                const existing = pendingToolCalls.find(p => p.id === tc.id);
                                if (existing) {
                                    existing.function.arguments += tc.function.arguments;
                                } else {
                                    pendingToolCalls.push({
                                        id: tc.id,
                                        type: 'function',
                                        function: {
                                            name: tc.function.name,
                                            arguments: tc.function.arguments || '',
                                        }
                                    });
                                }
                            }
                        }

                        if (choice.finish_reason === 'tool_calls' && pendingToolCalls.length > 0) {
                            yield [...pendingToolCalls];
                            pendingToolCalls.length = 0;
                        }
                    } catch {
                        // skip malformed JSON chunks
                    }
                }
            }
        } finally {
            reader.releaseLock();
        }

        // If there are remaining tool calls that didn't finish cleanly
        if (pendingToolCalls.length > 0) {
            yield [...pendingToolCalls];
        }
    }

    /**
     * 非流式调用（用于简短查询）
     */
    async chat(messages: ChatMessage[], tools?: ToolDefinition[]): Promise<ChatMessage> {
        const config = getLLMConfig();
        const url = `${config.apiEndpoint}/chat/completions`;

        const body: Record<string, unknown> = {
            model: config.model,
            messages,
            max_tokens: config.maxTokens,
        };
        if (tools && tools.length > 0) {
            body.tools = tools;
            body.tool_choice = 'auto';
        }

        const maskedKey = config.apiKey ? `${config.apiKey.substring(0, 5)}...${config.apiKey.substring(config.apiKey.length - 4)}` : 'empty';
        log(`LLM Chat Request: ${config.provider}/${config.model}`);
        log(`URL: ${url}`);
        log(`API Key (Masked): ${maskedKey}`);
        log(`Body: ${JSON.stringify(body, null, 2)}`);

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${config.apiKey}`,
            },
            body: JSON.stringify(body),
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`LLM API Error ${response.status}: ${errorText}`);
        }

        const result = await response.json() as {
            choices: { message: ChatMessage }[];
        };
        return result.choices[0].message;
    }
}
