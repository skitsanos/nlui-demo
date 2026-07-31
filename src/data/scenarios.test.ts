import {describe, expect, test} from 'bun:test';
import {
    EVALUATION_BLOCK_NAMES,
    EVALUATION_TOOL_NAMES,
    executionFor,
    loadEvaluationScenarios
} from '../evals/scenario.ts';

describe('golden NLUI scenarios', () =>
{
    test('every JSONL record satisfies the reusable strict fixture contract', async () =>
    {
        const scenarios = await loadEvaluationScenarios();
        expect(scenarios).toHaveLength(35);
        expect(new Set(scenarios.map(({id}) => id)).size).toBe(scenarios.length);

        const usedTools = scenarios.flatMap(({expectedTools, mustNotInvoke}) => [...expectedTools, ...mustNotInvoke]);
        const usedBlocks = scenarios.flatMap(({expectedBlocks}) => expectedBlocks);
        expect(usedTools.every((tool) => EVALUATION_TOOL_NAMES.includes(tool))).toBeTrue();
        expect(usedBlocks.every((block) => EVALUATION_BLOCK_NAMES.includes(block))).toBeTrue();
    });

    test('separates model turns, multi-turn context, and application routes', async () =>
    {
        const scenarios = await loadEvaluationScenarios();
        expect(scenarios.some((scenario) => executionFor(scenario).mode === 'multi-turn')).toBeTrue();
        expect(scenarios.some((scenario) => executionFor(scenario).mode === 'route')).toBeTrue();

        const formScenarios = scenarios.filter(({expectedBlocks}) => expectedBlocks.includes('form'));
        expect(formScenarios.every(({expectedTools}) => expectedTools.includes('request_details'))).toBeTrue();

        const confirmations = scenarios.filter(({expectedTools}) => expectedTools.includes('confirm_action'));
        expect(confirmations.every((scenario) => executionFor(scenario).mode === 'route')).toBeTrue();
    });

    test('covers controlled renderers, retrieval, actions, and deterministic grading', async () =>
    {
        const scenarios = await loadEvaluationScenarios();
        const expectedBlocks = new Set(scenarios.flatMap(({expectedBlocks}) => expectedBlocks));
        for (const required of ['chart', 'table', 'choice', 'form', 'confirmation', 'action_result'] as const)
        {
            expect(expectedBlocks.has(required)).toBeTrue();
        }
        expect(scenarios.some(({expectedTools}) => expectedTools.includes('search_policies'))).toBeTrue();
        expect(scenarios.some(({deterministicAssertions}) => deterministicAssertions?.length)).toBeTrue();
    });
});
