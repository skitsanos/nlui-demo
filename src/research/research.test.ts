import {describe, expect, test} from 'bun:test';
import {ownedSurfaceCommands} from '../nlui/a2ui/adapter.ts';
import {ProviderRequestBudget} from './budget.ts';
import {type RESEARCH_QUERY_ARMS, RESEARCH_QUERY_CASES} from './queryCases.ts';
import {researchTools} from './queryRun.ts';
import {surfaceEnvelopeSchema, surfaceResponseSchema} from './surfaceRun.ts';

describe('bounded opt-in research', () =>
{
    test('reserves every request before execution and cannot reset or exceed the approved maximum', () =>
    {
        const budget = new ProviderRequestBudget(':memory:', 2);
        try
        {
            const first = budget.reserve('case:control'); budget.reserve('case:semantic');
            expect(() => budget.reserve('repair')).toThrow('exhausted');
            budget.account(first, {round: 1, responseId: '', model: '', durationMs: 1, usageKnown: true,
                usage: {inputTokens: 20, cachedInputTokens: 5, outputTokens: 10, cacheWriteTokens: 0, reasoningTokens: 2, totalTokens: 30}});
            expect(budget.summary()).toMatchObject({requests: 2, maximum: 2, accounted: 1, inputTokens: 20, totalTokens: 30});
        }
        finally {budget.close();}
        expect(() => new ProviderRequestBudget(':memory:', 41)).toThrow('40');
    });

    test('arms preserve fixed controls and paired intent coverage without broadening action execution', () =>
    {
        const names = (arm: typeof RESEARCH_QUERY_ARMS[number]) => researchTools(arm).map(({name}) => name);
        expect(names('fixed')).not.toContain('query_dataset');
        expect(names('fixed')).not.toContain('semantic_query');
        expect(names('control')).toContain('query_dataset');
        expect(names('control')).not.toContain('semantic_query');
        expect(names('semantic')).toContain('semantic_query');
        expect(names('semantic')).not.toContain('query_dataset');
        expect(names('hybrid')).toContain('query_dataset'); expect(names('hybrid')).toContain('semantic_query');
        expect(RESEARCH_QUERY_CASES).toHaveLength(4);
        expect(new Set(RESEARCH_QUERY_CASES.map(({caseId}) => caseId)).size).toBe(2);
    });

    test('model-facing surface envelope is strict and contains only negotiated commands', () =>
    {
        const commands = ownedSurfaceCommands([{id: 'metric', type: 'stats', items: [{label: 'Count', value: 2}]}]);
        expect(surfaceEnvelopeSchema.parse({commands}).commands).toHaveLength(3);
        expect(surfaceEnvelopeSchema.safeParse({commands, code: 'fetch(secret)'}).success).toBeFalse();
        const schema = JSON.stringify(surfaceResponseSchema([{id: 'metric', type: 'stats', items: [{label: 'Count', value: 2}]}]));
        expect(schema).not.toContain('oneOf'); expect(schema).not.toContain('propertyNames');
        expect(schema).toContain('"enum":["metric"]');
    });
});
