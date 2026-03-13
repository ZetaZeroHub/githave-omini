import { FMClient } from './fm-client';
import { ContextBuilder } from './context-builder';
import { log, logError } from '../utils/logger';
import type { ToolDefinition, ToolCall } from './llm-adapter';

/**
 * ToolRegistry — 注册和执行原生工具
 * 作为 LLM function-calling 的工具执行层
 */
export class ToolRegistry {
    private fmClient: FMClient;

    constructor(fmClient: FMClient) {
        this.fmClient = fmClient;
    }

    /**
     * 获取所有可用工具定义（注入给 LLM）
     */
    getToolDefinitions(): ToolDefinition[] {
        return [
            {
                type: 'function',
                function: {
                    name: 'code_search',
                    description: '在项目代码库中搜索函数、模块、代码片段。支持语义搜索、关键词搜索和混合搜索。',
                    parameters: {
                        type: 'object',
                        properties: {
                            query: { type: 'string', description: '搜索查询关键词' },
                            search_mode: { type: 'string', enum: ['semantic', 'keyword', 'hybrid'], description: '搜索模式，默认 hybrid' },
                            limit: { type: 'number', description: '返回结果数量，默认 5' },
                        },
                        required: ['query'],
                    },
                },
            },
            {
                type: 'function',
                function: {
                    name: 'list_functions',
                    description: '获取项目中的函数列表概览。',
                    parameters: {
                        type: 'object',
                        properties: {
                            scan: { type: 'boolean', description: '是否只返回统计信息' },
                        },
                    },
                },
            },
            {
                type: 'function',
                function: {
                    name: 'index_check',
                    description: '检查项目指定子路径的索引状态，返回函数数量、文件数量及模块信息。',
                    parameters: {
                        type: 'object',
                        properties: {
                            relative_dir: { type: 'string', description: '要检查的子路径，留空检查整个项目' },
                        },
                    },
                },
            },
            {
                type: 'function',
                function: {
                    name: 'module_graphs',
                    description: '获取项目的模块图谱数据，包含层级结构、网络关系、旭日图等可视化数据。',
                    parameters: {
                        type: 'object',
                        properties: {
                            graph_type: { type: 'string', enum: ['flat', 'hierarchical', 'network', 'sunburst'], description: '图谱类型' },
                        },
                    },
                },
            },
            {
                type: 'function',
                function: {
                    name: 'function_ranking',
                    description: '计算项目中函数的重要性评分，基于扇入、扇出、深度和复杂度。',
                    parameters: {
                        type: 'object',
                        properties: {},
                    },
                },
            },
        ];
    }

    /**
     * 执行工具调用
     */
    async executeTool(toolCall: ToolCall): Promise<string> {
        const name = toolCall.function.name;
        let args: Record<string, unknown> = {};
        try {
            args = JSON.parse(toolCall.function.arguments || '{}');
        } catch {
            return JSON.stringify({ error: '工具参数解析失败' });
        }

        const projectDir = ContextBuilder.getWorkspaceRoot();
        if (!projectDir) {
            return JSON.stringify({ error: '未打开工作区，无法执行工具' });
        }

        log(`Tool Execute: ${name} args=${JSON.stringify(args)}`);

        try {
            switch (name) {
                case 'code_search': {
                    const result = await this.fmClient.search({
                        project_dir: projectDir,
                        query: args.query as string,
                        search_mode: (args.search_mode as 'semantic' | 'keyword' | 'hybrid') || 'hybrid',
                        limit: (args.limit as number) || 5,
                    });
                    return JSON.stringify(result.data, null, 2);
                }
                case 'list_functions': {
                    const result = await this.fmClient.functions({
                        project_dir: projectDir,
                        scan: args.scan as boolean,
                    });
                    return JSON.stringify(result.data, null, 2);
                }
                case 'index_check': {
                    const result = await this.fmClient.checkIndex({
                        project_dir: projectDir,
                        relative_dir: args.relative_dir as string,
                    });
                    return JSON.stringify(result.data, null, 2);
                }
                case 'module_graphs': {
                    const result = await this.fmClient.moduleGraphs({
                        project_dir: projectDir,
                        graph_type: args.graph_type as string,
                    });
                    return JSON.stringify(result.data, null, 2);
                }
                case 'function_ranking': {
                    const result = await this.fmClient.ranking({
                        project_dir: projectDir,
                    });
                    return JSON.stringify(result.data, null, 2);
                }
                default:
                    return JSON.stringify({ error: `未知工具: ${name}` });
            }
        } catch (err) {
            logError(`Tool execution failed: ${name}`, err);
            return JSON.stringify({ error: `工具执行失败: ${err instanceof Error ? err.message : String(err)}` });
        }
    }
}
