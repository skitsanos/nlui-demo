import {DATASET_ID, DATASET_VERSION} from '../data/constants.ts';
import {NLUI_TOOL_BLOCK_TYPES} from '../nlui/tools.ts';
import type {NluiBlock} from '../nlui/types.ts';
import {
    type EvaluationBlockName,
    type EvaluationScenario,
    type EvaluationToolName, 
    executionFor
} from './scenario.ts';

const MODEL_TOOLS = new Set<EvaluationToolName>(Object.keys(NLUI_TOOL_BLOCK_TYPES) as EvaluationToolName[]);

const evaluationBlocksFor = (block: NluiBlock['type']): EvaluationBlockName[] =>
{
    if (block === 'stats') return ['metrics'];
    if (block === 'choices') return ['choice'];
    if (block === 'sources') return ['citations'];
    if (block === 'result') return ['action_result', 'error'];
    return [block];
};

const TOOL_BLOCKS = Object.fromEntries([
    ['confirm_action', ['action_result']],
    ...Object.entries(NLUI_TOOL_BLOCK_TYPES).map(([tool, blocks]) => [
        tool,
        [...new Set(blocks.flatMap(evaluationBlocksFor))]
    ])
]) as Record<EvaluationToolName, EvaluationBlockName[]>;

export interface CatalogIssue
{
    scenarioId: string;
    message: string;
}

export interface CatalogValidationReport
{
    dataset: {id: string; version: number};
    scenarios: number;
    executionModes: Record<'single-turn' | 'multi-turn' | 'route' | 'skip', number>;
    deterministicAssertions: number;
    deterministicRules: number;
    ungradedAssertions: number;
    issues: CatalogIssue[];
}

const expectedBlockIssues = (scenario: EvaluationScenario): CatalogIssue[] =>
{
    const execution = executionFor(scenario);
    const producible = new Set<EvaluationBlockName>(execution.mode === 'route' ? [] : ['markdown']);
    for (const tool of scenario.expectedTools)
    {
        for (const block of TOOL_BLOCKS[tool]) producible.add(block);
    }
    return scenario.expectedBlocks
        .filter((block) => !producible.has(block))
        .map((block) => ({
            scenarioId: scenario.id,
            message: `Expected block ${block} cannot be produced by ${execution.mode} execution and its expected tools`
        }));
};

const executionIssues = (scenario: EvaluationScenario): CatalogIssue[] =>
{
    const execution = executionFor(scenario);
    if (execution.mode === 'route')
    {
        const invalid = scenario.expectedTools.filter((tool) => tool !== 'confirm_action');
        return invalid.length === 0 ? [] : [{
            scenarioId: scenario.id,
            message: `Route scenarios cannot expect model tools: ${invalid.join(', ')}`
        }];
    }
    const invalid = scenario.expectedTools.filter((tool) => !MODEL_TOOLS.has(tool));
    return invalid.length === 0 ? [] : [{
        scenarioId: scenario.id,
        message: `Model scenarios cannot expect application routes: ${invalid.join(', ')}`
    }];
};

const annotationIssues = (scenario: EvaluationScenario): CatalogIssue[] =>
{
    const execution = executionFor(scenario);
    if (execution.mode === 'route' || execution.mode === 'skip') return [];
    const hasStructuredBlock = scenario.expectedBlocks.some((block) => block !== 'markdown');
    return hasStructuredBlock && !scenario.expectedBlocks.includes('markdown') ? [{
        scenarioId: scenario.id,
        message: 'Model-driven UI block scenarios must expect a conversational markdown annotation'
    }] : [];
};

export const validateScenarioCatalog = (scenarios: EvaluationScenario[]): CatalogValidationReport =>
{
    const executionModes = {'single-turn': 0, 'multi-turn': 0, route: 0, skip: 0};
    let deterministicAssertions = 0;
    let deterministicRules = 0;
    let ungradedAssertions = 0;
    const issues: CatalogIssue[] = [];

    for (const scenario of scenarios)
    {
        executionModes[executionFor(scenario).mode] += 1;
        const graded = new Set(scenario.deterministicAssertions?.map(({label}) => label) ?? []);
        deterministicAssertions += graded.size;
        deterministicRules += scenario.deterministicAssertions?.length ?? 0;
        ungradedAssertions += scenario.dataAssertions.length - graded.size;
        issues.push(...executionIssues(scenario), ...expectedBlockIssues(scenario), ...annotationIssues(scenario));
    }

    return {
        dataset: {id: DATASET_ID, version: DATASET_VERSION},
        scenarios: scenarios.length,
        executionModes,
        deterministicAssertions,
        deterministicRules,
        ungradedAssertions,
        issues
    };
};
