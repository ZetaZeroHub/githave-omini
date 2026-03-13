import * as vscode from 'vscode';

let outputChannel: vscode.OutputChannel;

export function initLogger() {
    outputChannel = vscode.window.createOutputChannel('Githave AI');
}

export function log(message: string) {
    const timestamp = new Date().toISOString();
    const formatted = `[${timestamp}] ${message}`;
    outputChannel?.appendLine(formatted);
    console.log(`(Githave AI) ${formatted}`);
}

export function logError(message: string, error?: unknown) {
    const timestamp = new Date().toISOString();
    const errMsg = error instanceof Error ? error.message : String(error ?? '');
    const formatted = `[${timestamp}] ERROR: ${message} ${errMsg}`;
    outputChannel?.appendLine(formatted);
    console.error(`(Githave AI) ${formatted}`);
}

export function showOutput() {
    outputChannel?.show();
}
