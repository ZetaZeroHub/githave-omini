import * as vscode from 'vscode';

/**
 * ContextBuilder — 构建用于 LLM 的上下文信息
 * 自动提取当前打开文件、选中代码、光标位置等
 */
export class ContextBuilder {

    /**
     * 获取当前编辑器上下文
     */
    static getCurrentContext(): EditorContext | null {
        const editor = vscode.window.activeTextEditor;
        if (!editor) { return null; }

        const document = editor.document;
        const selection = editor.selection;

        const ctx: EditorContext = {
            filePath: document.uri.fsPath,
            fileName: document.fileName.split('/').pop() || '',
            languageId: document.languageId,
            lineCount: document.lineCount,
            cursorLine: selection.active.line + 1,
            cursorColumn: selection.active.character + 1,
        };

        // 如果有选中文本
        if (!selection.isEmpty) {
            ctx.selectedText = document.getText(selection);
            ctx.selectionRange = {
                startLine: selection.start.line + 1,
                endLine: selection.end.line + 1,
            };
        }

        // 获取光标附近的代码（前后各 10 行）
        const startLine = Math.max(0, selection.active.line - 10);
        const endLine = Math.min(document.lineCount - 1, selection.active.line + 10);
        const range = new vscode.Range(startLine, 0, endLine, document.lineAt(endLine).text.length);
        ctx.surroundingCode = document.getText(range);

        return ctx;
    }

    /**
     * 获取工作区根路径
     */
    static getWorkspaceRoot(): string | undefined {
        return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    }

    /**
     * 将上下文格式化为系统消息
     */
    static formatContextMessage(ctx: EditorContext | null): string {
        if (!ctx) {
            return '当前没有打开的文件。';
        }

        let msg = `当前文件: ${ctx.filePath} (${ctx.languageId})\n`;
        msg += `光标位置: 第 ${ctx.cursorLine} 行\n`;

        if (ctx.selectedText) {
            msg += `\n选中的代码 (第 ${ctx.selectionRange?.startLine}-${ctx.selectionRange?.endLine} 行):\n\`\`\`${ctx.languageId}\n${ctx.selectedText}\n\`\`\`\n`;
        }

        if (ctx.surroundingCode && !ctx.selectedText) {
            msg += `\n光标附近的代码:\n\`\`\`${ctx.languageId}\n${ctx.surroundingCode}\n\`\`\`\n`;
        }

        return msg;
    }
}

export interface EditorContext {
    filePath: string;
    fileName: string;
    languageId: string;
    lineCount: number;
    cursorLine: number;
    cursorColumn: number;
    selectedText?: string;
    selectionRange?: {
        startLine: number;
        endLine: number;
    };
    surroundingCode?: string;
}
