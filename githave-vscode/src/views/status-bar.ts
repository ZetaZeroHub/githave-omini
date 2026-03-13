import * as vscode from 'vscode';
import { getFMBaseUrl } from '../utils/config';
import { FMClient } from '../core/fm-client';
import { log } from '../utils/logger';

/**
 * StatusBar — 底部状态栏组件
 * 展示 FM 连接状态和索引状态
 */
export class StatusBar {
    private statusBarItem: vscode.StatusBarItem;
    private fmClient: FMClient;
    private checkTimer: NodeJS.Timeout | undefined;

    constructor(fmClient: FMClient) {
        this.fmClient = fmClient;
        this.statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
        this.statusBarItem.command = 'githave-ai.buildIndex';
        this.statusBarItem.show();
        this.setStatus('checking');
    }

    /**
     * 开始定期检查 FM 连接状态
     */
    startHealthCheck(intervalMs: number = 30000) {
        this.checkHealth();
        this.checkTimer = setInterval(() => this.checkHealth(), intervalMs);
    }

    private async checkHealth() {
        try {
            const result = await this.fmClient.health();
            if (result.code === 0) {
                this.setStatus('connected');
            } else {
                this.setStatus('error');
            }
        } catch {
            this.setStatus('disconnected');
        }
    }

    private setStatus(status: 'checking' | 'connected' | 'disconnected' | 'error') {
        switch (status) {
            case 'checking':
                this.statusBarItem.text = '$(sync~spin) Githave AI';
                this.statusBarItem.tooltip = '正在连接 FlashMemory...';
                break;
            case 'connected':
                this.statusBarItem.text = '$(check) Githave AI';
                this.statusBarItem.tooltip = `已连接 FlashMemory (${getFMBaseUrl()})`;
                break;
            case 'disconnected':
                this.statusBarItem.text = '$(warning) Githave AI';
                this.statusBarItem.tooltip = `无法连接 FlashMemory (${getFMBaseUrl()})。点击构建索引。`;
                break;
            case 'error':
                this.statusBarItem.text = '$(error) Githave AI';
                this.statusBarItem.tooltip = 'FlashMemory 服务异常';
                break;
        }
    }

    dispose() {
        this.statusBarItem.dispose();
        if (this.checkTimer) { clearInterval(this.checkTimer); }
    }
}
