import {describe, expect, test} from 'bun:test';
import {ConversationStateError, ConversationStateRegistry} from './conversationState.ts';

describe('conversation response-chain state', () =>
{
    test('binds each continuation to the last response in its conversation', () =>
    {
        const registry = new ConversationStateRegistry();
        registry.begin('conversation-one');
        registry.complete('conversation-one', 'response-one');

        expect(() => registry.begin('conversation-one', 'response-other')).toThrow(ConversationStateError);
        expect(() => registry.begin('conversation-two', 'response-one')).toThrow(ConversationStateError);
        registry.begin('conversation-one', 'response-one');
        registry.complete('conversation-one', 'response-two');
    });

    test('rejects concurrent turns and releases a failed turn for retry', () =>
    {
        const registry = new ConversationStateRegistry();
        registry.begin('conversation-one');
        expect(() => registry.begin('conversation-one')).toThrow(ConversationStateError);
        registry.release('conversation-one');
        registry.begin('conversation-one');
    });

    test('expires idle conversations and enforces a cardinality bound', () =>
    {
        let now = 1_000;
        const registry = new ConversationStateRegistry({ttlMs: 10, maximumConversations: 1, now: () => now});
        registry.begin('conversation-one');
        registry.complete('conversation-one', 'response-one');
        expect(() => registry.begin('conversation-two')).toThrow('limit');
        now += 10;
        registry.begin('conversation-two');
    });
});
