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
}

interface RegistryOptions
{
    ttlMs?: number;
    now?: () => number;
}

const DEFAULT_TTL_MS = 15 * 60 * 1_000;
const MAX_ACTIVE_CAPABILITIES = 10_000;

export class InteractionCapabilityRegistry
{
    private readonly entries = new Map<string, CapabilityEntry>();
    private readonly ttlMs: number;
    private readonly now: () => number;

    constructor({ttlMs = DEFAULT_TTL_MS, now = Date.now}: RegistryOptions = {})
    {
        this.ttlMs = ttlMs;
        this.now = now;
    }

    issue(conversationId: string, block: NluiBlock): void
    {
        this.issueMany(conversationId, [block]);
    }

    issueMany(conversationId: string, blocks: NluiBlock[]): void
    {
        const now = this.now();
        for (const [interactionId, entry] of this.entries)
        {
            if (entry.expiresAt <= now) this.entries.delete(interactionId);
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
        for (const entry of issued)
        {
            this.entries.set(entry.interactionId, {
                conversationId,
                capability: entry.capability,
                expiresAt: now + this.ttlMs
            });
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
        if (entry.consumedAt !== undefined || capability.state !== 'issued')
        {
            throw new InteractionCapabilityError('consumed');
        }
        capability.state = 'executing';
        return {status: 'execute'};
    }

    completeConfirmation(
        conversationId: string,
        interactionId: string,
        actionId: string,
        result: ResultBlock
    ): void
    {
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
    }

    releaseConfirmation(interactionId: string): void
    {
        const entry = this.entries.get(interactionId);
        if (entry?.capability.kind === 'confirmation' && entry.capability.state === 'executing')
        {
            entry.capability.state = 'issued';
        }
    }

    consume(conversationId: string, interactionId: string, values: InteractionValues): InteractionValues
    {
        const entry = this.usableEntry(conversationId, interactionId);
        validateCapability(entry.capability, values);
        entry.consumedAt = this.now();
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
        return {...values};
    }

    releaseSubmission(conversationId: string, interactionId: string): void
    {
        const entry = this.entries.get(interactionId);
        if (entry?.conversationId === conversationId) delete entry.consumedAt;
    }

    private usableEntry(conversationId: string, interactionId: string): CapabilityEntry
    {
        const entry = this.scopedEntry(conversationId, interactionId);
        if (entry.consumedAt !== undefined) throw new InteractionCapabilityError('consumed');
        return entry;
    }

    private scopedEntry(conversationId: string, interactionId: string): CapabilityEntry
    {
        const entry = this.entries.get(interactionId);
        if (!entry) throw new InteractionCapabilityError('unknown');
        if (entry.expiresAt <= this.now())
        {
            this.entries.delete(interactionId);
            throw new InteractionCapabilityError('expired');
        }
        if (entry.conversationId !== conversationId)
        {
            throw new InteractionCapabilityError('conversation_mismatch');
        }
        return entry;
    }
}

export const interactionCapabilities = new InteractionCapabilityRegistry();
