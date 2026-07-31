import {describe, expect, test} from 'bun:test';
import {type EvaluationScenario, loadEvaluationScenarios } from './scenario.ts';
import {validateScenarioCatalog} from './validate.ts';

describe('evaluation catalog validation', () =>
{
    test('the checked-in catalog has executable tool and block expectations', async () =>
    {
        const report = validateScenarioCatalog(await loadEvaluationScenarios());
        expect(report.scenarios).toBe(35);
        expect(report.executionModes.route).toBe(2);
        expect(report.executionModes['multi-turn']).toBe(1);
        expect(report.deterministicAssertions).toBe(9);
        expect(report.deterministicRules).toBe(14);
        expect(report.issues).toEqual([]);
    });

    test('detects a block no expected tool can produce', () =>
    {
        const scenario: EvaluationScenario = {
            id: 'impossible-chart',
            category: 'orders',
            prompt: 'List orders',
            expectedTools: ['list_orders'],
            expectedBlocks: ['chart'],
            mustNotInvoke: [],
            dataAssertions: ['rows are valid']
        };
        expect(validateScenarioCatalog([scenario]).issues[0]?.message).toContain('cannot be produced');
    });
});
