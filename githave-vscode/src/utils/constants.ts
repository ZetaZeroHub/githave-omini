export const EXTENSION_ID = 'githave-ai';
export const CHAT_VIEW_ID = 'githave-ai.chatView';

export const COMMANDS = {
    NEW_CHAT: 'githave-ai.newChat',
    CLEAR_CHAT: 'githave-ai.clearChat',
    TOGGLE_MODE: 'githave-ai.toggleMode',
    BUILD_INDEX: 'githave-ai.buildIndex',
    BUBBLE_ANALYZE: 'githave-ai.bubbleAnalyze',
    SEND_TO_CHAT: 'githave-ai.sendToChat',
} as const;

export const SYSTEM_PROMPT_ACT = `你是 Githave AI，一个嵌入 VS Code 的智能编程助手。
你的工作方式是 Act 模式 —— 直接回答用户问题、编写代码、分析代码。
你可以调用以下内置工具：
- code_search: 在项目中搜索相关代码
- list_functions: 获取项目中的函数列表
- index_check: 检查项目索引状态
- module_graphs: 获取模块图谱数据
- function_ranking: 获取函数重要性评级

回答要简洁专业，代码示例使用 markdown 代码块。`;

export const SYSTEM_PROMPT_PLAN = `你是 Githave AI，一个嵌入 VS Code 的智能编程助手。
你的工作方式是 Plan 模式 —— 先分析问题、制定计划，用户确认后再执行。

请按以下格式组织你的回答：
## 分析
简要分析用户的需求和当前代码情况。

## 执行计划
1. 第一步...
2. 第二步...

## 预期结果
描述执行后的预期效果。

等待用户确认后再开始执行。`;
