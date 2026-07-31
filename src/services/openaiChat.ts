import OpenAI from 'openai';
import {interactionCapabilities} from '../nlui/interactionCapabilities.ts';
import {executeNluiTool} from '../nlui/tools.ts';
import {CHAT_PROMPT_VERSION} from './chatPrompt.ts';
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

const configuredRunner = () =>
{
    const apiKey = process.env.OPENAI_API_KEY?.trim();
    const model = process.env.CHAT_MODEL?.trim();
    if (!apiKey) throw new ChatConfigurationError('OPENAI_API_KEY is not configured');
    if (!model) throw new ChatConfigurationError('CHAT_MODEL is not configured');

    client ??= new OpenAI({apiKey});
    const openai = client;
    return createOpenAIChatRunner({
        model,
        createResponse: async (params, signal) => await openai.responses.create(params, {signal}),
        executeTool: executeNluiTool,
        issueCapabilities: (conversationId, blocks) => interactionCapabilities.issueMany(conversationId, blocks)
    });
};

export const runOpenAIChat: ReturnType<typeof createOpenAIChatRunner> =
    (request, emit, signal, observe) => configuredRunner()(request, emit, signal, observe);
