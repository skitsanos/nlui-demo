export class ConversationStateError extends Error
{
    constructor(message = 'The conversation state is invalid or already in use.')
    {
        super(message);
        this.name = 'ConversationStateError';
    }
}

interface ConversationEntry
{
    responseId?: string;
    inFlight: boolean;
    expiresAt: number;
}

interface ConversationStateOptions
{
    ttlMs?: number;
    maximumConversations?: number;
    now?: () => number;
}

const DEFAULT_TTL_MS = 24 * 60 * 60 * 1_000;
const DEFAULT_MAXIMUM_CONVERSATIONS = 1_000;

export class ConversationStateRegistry
{
    private readonly entries = new Map<string, ConversationEntry>();
    private readonly ttlMs: number;
    private readonly maximumConversations: number;
    private readonly now: () => number;

    constructor({
        ttlMs = DEFAULT_TTL_MS,
        maximumConversations = DEFAULT_MAXIMUM_CONVERSATIONS,
        now = Date.now
    }: ConversationStateOptions = {})
    {
        this.ttlMs = ttlMs;
        this.maximumConversations = maximumConversations;
        this.now = now;
    }

    begin(conversationId: string, previousResponseId?: string): void
    {
        this.prune();
        const entry = this.entries.get(conversationId);
        if (!entry)
        {
            if (previousResponseId)
            {
                throw new ConversationStateError('The previous response does not belong to this conversation.');
            }
            if (this.entries.size >= this.maximumConversations)
            {
                throw new ConversationStateError('The active conversation limit was reached.');
            }
            this.entries.set(conversationId, {inFlight: true, expiresAt: this.now() + this.ttlMs});
            return;
        }
        if (entry.inFlight)
        {
            throw new ConversationStateError();
        }
        if (!previousResponseId || previousResponseId !== entry.responseId)
        {
            throw new ConversationStateError('The previous response does not belong to this conversation.');
        }
        entry.inFlight = true;
    }

    complete(conversationId: string, responseId: string): void
    {
        const entry = this.entries.get(conversationId);
        if (!entry?.inFlight)
        {
            throw new ConversationStateError();
        }
        entry.responseId = responseId;
        entry.inFlight = false;
        entry.expiresAt = this.now() + this.ttlMs;
    }

    release(conversationId: string): void
    {
        const entry = this.entries.get(conversationId);
        if (!entry) return;
        if (entry.responseId)
        {
            entry.inFlight = false;
        }
        else
        {
            this.entries.delete(conversationId);
        }
    }

    private prune(): void
    {
        const now = this.now();
        for (const [conversationId, entry] of this.entries)
        {
            if (!entry.inFlight && entry.expiresAt <= now)
            {
                this.entries.delete(conversationId);
            }
        }
    }
}

export const conversationStates = new ConversationStateRegistry();
