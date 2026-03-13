import * as vscode from 'vscode';

export interface LLMConfig {
    provider: 'dashscope' | 'openai' | 'ollama' | 'custom';
    apiEndpoint: string;
    apiKey: string;
    model: string;
    maxTokens: number;
}

export interface FMConfig {
    host: string;
    port: number;
    username: string;
    password: string;
}

export function getLLMConfig(): LLMConfig {
    const config = vscode.workspace.getConfiguration('githave-ai.llm');
    return {
        provider: config.get<'dashscope' | 'openai' | 'ollama' | 'custom'>('provider', 'dashscope'),
        apiEndpoint: config.get<string>('apiEndpoint', 'https://dashscope.aliyuncs.com/compatible-mode/v1'),
        apiKey: config.get<string>('apiKey', 'githave-omini'),
        model: config.get<string>('model', 'qwen-plus'),
        maxTokens: config.get<number>('maxTokens', 4096),
    };
}

export function getFMConfig(): FMConfig {
    const config = vscode.workspace.getConfiguration('githave-ai.fm');
    return {
        host: config.get<string>('host', 'localhost'),
        port: config.get<number>('port', 5532),
        username: config.get<string>('username', ''),
        password: config.get<string>('password', ''),
    };
}

export function getFMBaseUrl(): string {
    const fm = getFMConfig();
    return `http://${fm.host}:${fm.port}`;
}

export function getDefaultChatMode(): 'act' | 'plan' {
    const config = vscode.workspace.getConfiguration('githave-ai.chat');
    return config.get<'act' | 'plan'>('defaultMode', 'act');
}
