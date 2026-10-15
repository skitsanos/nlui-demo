import OpenAI from 'openai';
import type {InteractionCapabilityRegistry} from '../nlui/interactionCapabilities.ts';
import {interactionCapabilities} from '../nlui/interactionCapabilities.ts';
import {type QueryArm, toolsForQueryArm} from '../nlui/toolDefinitions.ts';
import {executeNluiTool} from '../nlui/tools.ts';
import type {ToolDataSource} from '../nlui/toolTypes.ts';
import {CHAT_PROMPT_VERSION, chatInstructionsFor, promptVersionFor} from './chatPrompt.ts';
import {createOpenAIChatRunner} from './openaiChatRunner.ts';

export type {OpenAIChatDependencies, OpenAIChatRunner} from './openaiChatRunner.ts';
export {CHAT_PROMPT_VERSION, createOpenAIChatRunner};

export class ChatConfigurationError extends Error
{
    constructor(message: string)
    {
        super(message);
        this.name = 'ChatConfigurationError';
    }
}

let client: OpenAI | undefined;

export const createConfiguredOpenAIChatRunner = (
    arm: QueryArm, data?: ToolDataSource, registry: InteractionCapabilityRegistry = interactionCapabilities
) =>
{
    const apiKey = process.env.OPENAI_API_KEY?.trim();
    const model = process.env.CHAT_MODEL?.trim();
    if (!apiKey) throw new ChatConfigurationError('OPENAI_API_KEY is not configured');
    if (!model) throw new ChatConfigurationError('CHAT_MODEL is not configured');

    client ??= new OpenAI({apiKey});
    const openai = client;
    return createOpenAIChatRunner({
        model,
        tools: toolsForQueryArm(arm),
        instructions: chatInstructionsFor(arm),
        promptVersion: promptVersionFor(arm),
        createResponse: async (params, signal) => await openai.responses.create(params, {signal}),
        executeTool: (name, args, signal) => executeNluiTool(name, args, signal, data),
        issueCapabilities: (conversationId, blocks) => registry.issueMany(conversationId, blocks)
    });
};

export const runOpenAIChat: ReturnType<typeof createOpenAIChatRunner> =
    (request, emit, signal, observe) => createConfiguredOpenAIChatRunner('control')(request, emit, signal, observe);
