import {type ConversationStore, getConversationStore } from '../conversations/store.ts';
import {normalizeFormValues} from './formValues.ts';
import {
    type Capability,
    type ConfirmationReservation,
    InteractionCapabilityError,
    type InteractionValues
} from './interactionCapabilityTypes.ts';
import {capabilityFor, validateCapability} from './interactionCapabilityValidation.ts';
import type {NluiBlock, ResultBlock} from './types.ts';

export {
    type ConfirmationReservation,
    InteractionCapabilityError,
    type InteractionCapabilityErrorCode,
    type InteractionValues
} from './interactionCapabilityTypes.ts';

interface CapabilityEntry
{
    conversationId: string;
    capability: Capability;
    expiresAt: number;
    consumedAt?: number;
    supersededAt?: number;
    supersessionKey?: string;
}

interface RegistryOptions
{
    ttlMs?: number;
    now?: () => number;
    storage?: () => ConversationStore;
}

const DEFAULT_TTL_MS = 15 * 60 * 1_000;
const MAX_ACTIVE_CAPABILITIES = 10_000;

export class InteractionCapabilityRegistry
{
    private readonly entries = new Map<string, CapabilityEntry>();
    private readonly ttlMs: number;
    private readonly now: () => number;
    private readonly storage?: () => ConversationStore;
    private loaded = false;

    constructor({ttlMs = DEFAULT_TTL_MS, now = Date.now, storage}: RegistryOptions = {})
    {
        this.ttlMs = ttlMs;
        this.now = now;
        this.storage = storage;
    }

    issue(conversationId: string, block: NluiBlock): void
    {
        this.issueMany(conversationId, [block]);
    }

    issueMany(conversationId: string, blocks: NluiBlock[]): void
    {
        this.load();
        const now = this.now();
        for (const [interactionId, entry] of this.entries)
        {
            if (entry.expiresAt <= now) {this.entries.delete(interactionId); this.storage?.().remove('capability', interactionId);}
        }
        const issued = blocks.map(capabilityFor).filter((entry) => entry !== undefined);
        const interactionIds = issued.map(({interactionId}) => interactionId);
        if (new Set(interactionIds).size !== interactionIds.length
            || interactionIds.some((interactionId) => this.entries.has(interactionId)))
        {
            throw new Error('An interaction identifier was issued more than once.');
        }
        if (this.entries.size + issued.length > MAX_ACTIVE_CAPABILITIES)
        {
            throw new Error('The interaction capability limit was reached.');
        }
        const keyFor = (block: NluiBlock): string | undefined =>
        {
            if (block.type === 'form') return block.interactionId.includes(':') ? `form:${block.interactionId.split(':')[0]}` : undefined;
            if (block.type === 'choices') return 'choices';
            if (block.type !== 'confirmation') return undefined;
            const order = block.details.find(({label}) => label === 'Order')?.value;
            const action = block.details.find(({label}) => label === 'Action')?.value;
            return order && action ? `confirmation:${order}:${action}` : undefined;
        };
        const keys = new Set(blocks.map(keyFor).filter(Boolean));
        for (const [id, previous] of this.entries)
        {
            if (previous.conversationId === conversationId && previous.supersessionKey && keys.has(previous.supersessionKey)
                && previous.consumedAt === undefined && previous.capability.kind !== 'confirmation')
            {previous.supersededAt = now; this.persist(id);}
            else if (previous.conversationId === conversationId && previous.supersessionKey && keys.has(previous.supersessionKey)
                && previous.consumedAt === undefined && previous.capability.kind === 'confirmation' && previous.capability.state === 'issued')
            {previous.supersededAt = now; this.persist(id);}
        }
        for (const entry of issued)
        {
            const block = blocks.find((block) => ('interactionId' in block ? block.interactionId : block.id) === entry.interactionId)!;
            block.controlExpiresAt = new Date(now + this.ttlMs).toISOString();
            this.entries.set(entry.interactionId, {
                conversationId,
                capability: entry.capability,
                expiresAt: now + this.ttlMs, supersessionKey: keyFor(block)
            });
            this.persist(entry.interactionId);
        }
    }

    beginConfirmation(conversationId: string, interactionId: string, actionId: string): ConfirmationReservation
    {
        const entry = this.scopedEntry(conversationId, interactionId);
        const capability = entry.capability;
        if (capability.kind !== 'confirmation' || capability.actionId !== actionId)
        {
            throw new InteractionCapabilityError('invalid_payload');
        }
        if (capability.state === 'completed' && capability.result)
        {
            return {status: 'completed', block: capability.result};
        }
        if (capability.state === 'executing') throw new InteractionCapabilityError('in_progress');
        if (entry.consumedAt !== undefined || capability.state !== 'issued')
        {
            throw new InteractionCapabilityError('consumed');
        }
        capability.state = 'executing';
        this.persist(interactionId);
        return {status: 'execute'};
    }

    completeConfirmation(
        conversationId: string,
        interactionId: string,
        actionId: string,
        result: ResultBlock
    ): void
    {
        this.load();
        const entry = this.entries.get(interactionId);
        if (!entry) throw new InteractionCapabilityError('unknown');
        if (entry.conversationId !== conversationId)
        {
            throw new InteractionCapabilityError('conversation_mismatch');
        }
        const capability = entry.capability;
        if (capability.kind !== 'confirmation' || capability.actionId !== actionId
            || capability.state !== 'executing')
        {
            throw new InteractionCapabilityError('invalid_payload');
        }
        capability.state = 'completed';
        capability.result = result;
        this.persist(interactionId);
    }

    releaseConfirmation(interactionId: string): void
    {
        this.load();
        const entry = this.entries.get(interactionId);
        if (entry?.capability.kind === 'confirmation' && entry.capability.state === 'executing')
        {
            entry.capability.state = 'issued';
            this.persist(interactionId);
        }
    }

    consume(conversationId: string, interactionId: string, values: InteractionValues): InteractionValues
    {
        const entry = this.usableEntry(conversationId, interactionId);
        const normalized = entry.capability.kind === 'form' ? normalizeFormValues(entry.capability.fields, values) : {...values};
        validateCapability(entry.capability, normalized);
        entry.consumedAt = this.now();
        this.persist(interactionId);
        if (entry.capability.kind === 'confirmation' && values.outcome === 'confirmed')
        {
            const result = entry.capability.result;
            if (!result) throw new InteractionCapabilityError('action_not_completed');
            return {
                outcome: 'confirmed',
                action_id: entry.capability.actionId,
                action_status: result.status,
                message: result.message
            };
        }
        return normalized;
    }

    releaseSubmission(conversationId: string, interactionId: string): void
    {
        this.load();
        const entry = this.entries.get(interactionId);
        if (entry?.conversationId === conversationId) {delete entry.consumedAt; this.persist(interactionId);}
    }

    states(conversationId: string): Record<string, 'available' | 'submitted' | 'expired' | 'completed' | 'executing' | 'superseded'>
    {
        this.load();
        return Object.fromEntries([...this.entries].filter(([, entry]) => entry.conversationId === conversationId).map(([id, entry]) => [id,
            entry.supersededAt !== undefined ? 'superseded' : entry.capability.kind === 'confirmation' && entry.capability.state === 'completed' ? 'completed'
                : entry.expiresAt <= this.now() ? 'expired' : entry.consumedAt !== undefined ? 'submitted'
                    : entry.capability.kind === 'confirmation' && entry.capability.state === 'executing' ? 'executing' : 'available']));
    }

    private load(): void
    {
        if (this.loaded || !this.storage) return;
        for (const {id, body} of this.storage().records<string>('capability'))
        {
            const entry = JSON.parse(body, (_key, value) => value?.$map ? new Map(value.$map) : value?.$set ? new Set(value.$set) : value) as CapabilityEntry;
            if (entry.capability.kind === 'confirmation' && entry.capability.state === 'executing') entry.capability.state = 'issued';
            this.entries.set(id, entry);
        }
        this.loaded = true;
    }

    private persist(id: string): void
    {
        const entry = this.entries.get(id);
        if (!entry || !this.storage) return;
        this.storage().put('capability', id, entry.conversationId, JSON.stringify(entry, (_key, value) =>
            value instanceof Map ? {$map: [...value]} : value instanceof Set ? {$set: [...value]} : value));
    }

    private usableEntry(conversationId: string, interactionId: string): CapabilityEntry
    {
        const entry = this.scopedEntry(conversationId, interactionId);
        if (entry.consumedAt !== undefined) throw new InteractionCapabilityError('consumed');
        return entry;
    }

    private scopedEntry(conversationId: string, interactionId: string): CapabilityEntry
    {
        this.load();
        const entry = this.entries.get(interactionId);
        if (!entry) throw new InteractionCapabilityError('unknown');
        if (entry.expiresAt <= this.now())
        {
            throw new InteractionCapabilityError('expired');
        }
        if (entry.conversationId !== conversationId)
        {
            throw new InteractionCapabilityError('conversation_mismatch');
        }
        if (entry.supersededAt !== undefined) throw new InteractionCapabilityError('consumed');
        return entry;
    }
}

export const interactionCapabilities = new InteractionCapabilityRegistry({storage: getConversationStore});
