import * as vscode from 'vscode';
import { FMClient } from '../core/fm-client';
import { ContextBuilder } from '../core/context-builder';
import { log, logError } from '../utils/logger';

/**
 * IndexManager — 管理代码索引的生命周期
 * 包括首次构建、增量更新、文件监听
 */
export class IndexManager {
    private fmClient: FMClient;
    private fileWatcher: vscode.FileSystemWatcher | undefined;
    private debounceTimer: NodeJS.Timeout | undefined;

    constructor(fmClient: FMClient) {
        this.fmClient = fmClient;
    }

    /**
     * 启动文件监听，检测到变更后触发增量索引
     */
    startWatching() {
        const workspaceRoot = ContextBuilder.getWorkspaceRoot();
        if (!workspaceRoot) { return; }

        this.fileWatcher = vscode.workspace.createFileSystemWatcher(
            new vscode.RelativePattern(workspaceRoot, '**/*.{ts,js,go,py,java,rs,c,cpp,h,vue,jsx,tsx}')
        );

        const triggerUpdate = () => {
            if (this.debounceTimer) { clearTimeout(this.debounceTimer); }
            this.debounceTimer = setTimeout(() => this.incrementalUpdate(), 5000);
        };

        this.fileWatcher.onDidChange(triggerUpdate);
        this.fileWatcher.onDidCreate(triggerUpdate);
        this.fileWatcher.onDidDelete(triggerUpdate);

        log('IndexManager: File watcher started');
    }

    /**
     * 手动构建索引
     */
    async buildIndex(progress?: vscode.Progress<{ message: string }>) {
        const projectDir = ContextBuilder.getWorkspaceRoot();
        if (!projectDir) {
            vscode.window.showErrorMessage('请先打开一个工作区');
            return;
        }

        try {
            progress?.report({ message: '正在构建索引...' });
            const result = await this.fmClient.buildIndex({ project_dir: projectDir });
            if (result.code === 0) {
                vscode.window.showInformationMessage(`✅ 索引构建成功: ${result.message}`);
            } else {
                vscode.window.showWarningMessage(`索引构建: ${result.message}`);
            }
        } catch (err) {
            logError('Index build failed', err);
            vscode.window.showErrorMessage(`索引构建失败: ${err instanceof Error ? err.message : String(err)}`);
        }
    }

    /**
     * 增量更新索引
     */
    private async incrementalUpdate() {
        const projectDir = ContextBuilder.getWorkspaceRoot();
        if (!projectDir) { return; }

        try {
            await this.fmClient.incrementalIndex({ project_dir: projectDir });
            log('IndexManager: Incremental update completed');
        } catch (err) {
            logError('Incremental index update failed', err);
        }
    }

    /**
     * 检查索引状态
     */
    async checkIndex(): Promise<boolean> {
        const projectDir = ContextBuilder.getWorkspaceRoot();
        if (!projectDir) { return false; }

        try {
            const result = await this.fmClient.checkIndex({ project_dir: projectDir });
            return result.code === 0 && (result.data?.total_function_count ?? 0) > 0;
        } catch {
            return false;
        }
    }

    dispose() {
        this.fileWatcher?.dispose();
        if (this.debounceTimer) { clearTimeout(this.debounceTimer); }
    }
}
