import { getFMBaseUrl, getFMConfig } from '../utils/config';
import { log, logError } from '../utils/logger';

/**
 * FlashMemory HTTP API Client
 * 封装所有与 FM 后端的交互
 */
export class FMClient {

    private getHeaders(): Record<string, string> {
        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
        };
        const fm = getFMConfig();
        if (fm.username && fm.password) {
            const credentials = Buffer.from(`${fm.username}:${fm.password}`).toString('base64');
            headers['Authorization'] = `Basic ${credentials}`;
        }
        return headers;
    }

    private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
        const url = `${getFMBaseUrl()}${path}`;
        log(`FM Request: ${method} ${url}`);

        const options: RequestInit = {
            method,
            headers: this.getHeaders(),
        };
        if (body) {
            options.body = JSON.stringify(body);
        }

        const response = await fetch(url, options);
        const data = await response.json() as T;
        return data;
    }

    /** 健康检查 */
    async health(): Promise<FMResponse> {
        return this.request<FMResponse>('GET', '/api/health');
    }

    /** 代码搜索 */
    async search(params: SearchParams): Promise<FMResponse<SearchResult>> {
        return this.request<FMResponse<SearchResult>>('POST', '/api/search', params);
    }

    /** 获取函数列表 */
    async functions(params: FunctionsParams): Promise<FMResponse<FunctionItem[]>> {
        return this.request<FMResponse<FunctionItem[]>>('POST', '/api/functions', params);
    }

    /** 构建索引 */
    async buildIndex(params: IndexParams): Promise<FMResponse> {
        return this.request<FMResponse>('POST', '/api/index', params);
    }

    /** 增量索引更新 */
    async incrementalIndex(params: IncrementalIndexParams): Promise<FMResponse> {
        return this.request<FMResponse>('POST', '/api/index/incremental', params);
    }

    /** 检查索引 */
    async checkIndex(params: CheckIndexParams): Promise<FMResponse<IndexCheckResult>> {
        return this.request<FMResponse<IndexCheckResult>>('POST', '/api/index/check', params);
    }

    /** 删除索引 */
    async deleteIndex(params: { project_dir: string; relative_dir?: string }): Promise<FMResponse> {
        return this.request<FMResponse>('DELETE', '/api/index', params);
    }

    /** 获取模块图谱 */
    async moduleGraphs(params: { project_dir: string; graph_type?: string }): Promise<FMResponse> {
        return this.request<FMResponse>('POST', '/api/module-graphs', params);
    }

    /** 异步更新模块图谱 */
    async updateModuleGraphs(params: { project_dir: string; skip_llm?: boolean }): Promise<FMResponse<{ task_id: string; status: string }>> {
        return this.request<FMResponse<{ task_id: string; status: string }>>('POST', '/api/module-graphs/update', params);
    }

    /** 查询模块分析任务状态 */
    async moduleGraphsStatus(params: { task_id?: string; project_dir?: string }): Promise<FMResponse> {
        return this.request<FMResponse>('POST', '/api/module-graphs/status', params);
    }

    /** 函数重要性评级 */
    async ranking(params: RankingParams): Promise<FMResponse<RankingResult>> {
        return this.request<FMResponse<RankingResult>>('POST', '/api/ranking', params);
    }

    /** LLM 分析器 */
    async llmAnalyzer(params: { project_dir: string; relative_dir?: string }): Promise<FMResponse> {
        return this.request<FMResponse>('POST', '/api/llm/analyzer', params);
    }

    /** 列出图谱 */
    async listGraph(params: { project_dir: string; sub_path?: string }): Promise<FMResponse> {
        return this.request<FMResponse>('POST', '/api/listGraph', params);
    }

    /** 设置排除项 */
    async setExclude(params: { project_dir: string; exclude: string[] }): Promise<FMResponse> {
        return this.request<FMResponse>('POST', '/api/exclude', params);
    }

    /** 读取排除项 */
    async readExclude(params: { project_dir: string }): Promise<FMResponse<string[]>> {
        return this.request<FMResponse<string[]>>('POST', '/api/exclude/read', params);
    }
}

// ──── Types ────

export interface FMResponse<T = null> {
    code: number;
    message: string;
    data: T;
}

export interface SearchParams {
    project_dir: string;
    query: string;
    search_mode?: 'semantic' | 'keyword' | 'hybrid';
    limit?: number;
    faiss?: boolean;
}

export interface SearchResult {
    func_res: FunctionMatch[];
    tags: string[];
    funcs: FunctionMatch[];
    modules: ModuleMatch[];
}

export interface FunctionMatch {
    name: string;
    package: string;
    file: string;
    score: number;
    description: string;
    code_snippet: string;
}

export interface ModuleMatch {
    name: string;
    package: string;
    file: string;
    score: number;
    description: string;
    code_snippet: string;
}

export interface FunctionsParams {
    project_dir: string;
    scan?: boolean;
}

export interface FunctionItem {
    name: string;
    package: string;
    file: string;
    scan?: boolean;
}

export interface IndexParams {
    project_dir: string;
    relative_dir?: string;
    Faiss?: boolean;
    exclude?: string[];
}

export interface IncrementalIndexParams {
    project_dir: string;
    branch?: string;
    commit?: string;
    faiss?: boolean;
}

export interface CheckIndexParams {
    project_dir: string;
    relative_dir?: string;
}

export interface IndexCheckResult {
    total_function_count: number;
    total_file_count: number;
    real_file_count: number;
    functions: Record<string, { name: string; package: string; file: string; start_line: number; end_line: number; description: string }[]>;
    modules: Record<string, { name: string; type: string; path: string; parent_path: string; function_count: number; file_count: number; description: string }[]>;
}

export interface RankingParams {
    project_dir: string;
    config?: {
        Alpha?: number;
        Beta?: number;
        Gamma?: number;
        Delta?: number;
    };
}

export interface RankingResult {
    total_functions: number;
    config: { Alpha: number; Beta: number; Gamma: number; Delta: number };
    scores: Record<string, number>;
}
