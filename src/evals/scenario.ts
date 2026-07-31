import {join} from 'node:path';
import {z} from 'zod';
import {
    deterministicAssertionSchema,
    EVALUATION_BLOCK_NAMES,
    EVALUATION_TOOL_NAMES
} from './assertionSchema.ts';

export {
    type DeterministicAssertion,
    EVALUATION_BLOCK_NAMES,
    EVALUATION_TOOL_NAMES,
    type EvaluationBlockName,
    type EvaluationToolName
} from './assertionSchema.ts';

export const EVALUATION_CATEGORIES = [
    'analytics',
    'disambiguation',
    'orders',
    'products',
    'retrieval',
    'safe-action'
] as const;

const executionSchema = z.discriminatedUnion('mode', [
    z.object({mode: z.literal('single-turn')}).strict(),
    z.object({
        mode: z.literal('multi-turn'),
        priorScenarioIds: z.array(z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)).min(1)
    }).strict(),
    z.object({mode: z.literal('route'), route: z.literal('confirm_action')}).strict(),
    z.object({mode: z.literal('skip'), reason: z.string().trim().min(1)}).strict()
]);

const uniqueArray = <T extends z.ZodType>(schema: T) =>
    z.array(schema).refine((items) => new Set(items).size === items.length, 'Values must be unique');

const experimentIdSchema = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const experimentSchema = z.object({
    id: experimentIdSchema,
    caseId: experimentIdSchema,
    paraphraseId: experimentIdSchema
}).strict();

const orderNumberSchema = z.string().regex(/^ORD-\d+$/);
const reasonActionSchema = z.object({
    orderNumber: orderNumberSchema,
    reason: z.string().trim().min(3).max(300)
}).strict();

export const pendingActionSchema = z.discriminatedUnion('type', [
    reasonActionSchema.extend({type: z.literal('return_order')}),
    reasonActionSchema.extend({type: z.literal('cancel_order')}),
    z.object({
        type: z.literal('update_shipping_address'),
        orderNumber: orderNumberSchema,
        address: z.object({
            line1: z.string().trim().min(3).max(120),
            city: z.string().trim().min(2).max(80),
            postalCode: z.string().trim().min(3).max(24),
            country: z.string().trim().min(2).max(80)
        }).strict()
    }).strict()
]);

export const evaluationScenarioSchema = z.object({
    id: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    category: z.enum(EVALUATION_CATEGORIES),
    prompt: z.string().trim().min(1).max(500),
    experiment: experimentSchema.optional(),
    execution: executionSchema.optional(),
    setup: z.object({pendingAction: pendingActionSchema}).strict().optional(),
    expectedTools: uniqueArray(z.enum(EVALUATION_TOOL_NAMES)),
    expectedBlocks: uniqueArray(z.enum(EVALUATION_BLOCK_NAMES)).min(1),
    mustNotInvoke: uniqueArray(z.enum(EVALUATION_TOOL_NAMES)),
    dataAssertions: uniqueArray(z.string().trim().min(1)).min(1),
    deterministicAssertions: z.array(deterministicAssertionSchema).optional()
}).strict().superRefine((scenario, context) =>
{
    const forbidden = new Set(scenario.mustNotInvoke);
    const overlap = scenario.expectedTools.filter((tool) => forbidden.has(tool));
    if (overlap.length > 0)
    {
        context.addIssue({
            code: 'custom',
            message: `Expected tools cannot also be forbidden: ${overlap.join(', ')}`,
            path: ['mustNotInvoke']
        });
    }
    if (scenario.setup && scenario.execution?.mode !== 'route')
    {
        context.addIssue({
            code: 'custom',
            message: 'Scenario setup is only supported by route execution',
            path: ['setup']
        });
    }
    const labels = scenario.deterministicAssertions?.map(({label}) => label) ?? [];
    const unknownLabels = labels.filter((label) => !scenario.dataAssertions.includes(label));
    if (unknownLabels.length > 0)
    {
        context.addIssue({
            code: 'custom',
            message: 'Deterministic assertion labels must reference dataAssertions',
            path: ['deterministicAssertions']
        });
    }
    const expectedBlocks = [...scenario.expectedBlocks].sort();
    for (const [index, assertion] of (scenario.deterministicAssertions ?? []).entries())
    {
        if (assertion.source !== 'ui') continue;
        const assertedBlocks = [...assertion.expected].sort();
        if (assertedBlocks.length !== expectedBlocks.length
            || assertedBlocks.some((block, blockIndex) => block !== expectedBlocks[blockIndex]))
        {
            context.addIssue({
                code: 'custom',
                message: 'UI block-type assertions must match expectedBlocks',
                path: ['deterministicAssertions', index]
            });
        }
    }
});

export type EvaluationScenario = z.infer<typeof evaluationScenarioSchema>;
export type EvaluationCategory = typeof EVALUATION_CATEGORIES[number];
export type ScenarioExecution = z.infer<typeof executionSchema>;

export const executionFor = (scenario: EvaluationScenario): ScenarioExecution =>
    scenario.execution ?? {mode: 'single-turn'};

const validateScenarioReferences = (scenarios: EvaluationScenario[]): void =>
{
    const byId = new Map(scenarios.map((scenario) => [scenario.id, scenario]));
    for (const scenario of scenarios)
    {
        const execution = executionFor(scenario);
        if (execution.mode !== 'multi-turn') continue;
        for (const priorId of execution.priorScenarioIds)
        {
            if (!byId.has(priorId))
            {
                throw new Error(`Scenario ${scenario.id} references unknown prior scenario ${priorId}`);
            }
            if (priorId === scenario.id)
            {
                throw new Error(`Scenario ${scenario.id} cannot reference itself`);
            }
        }
    }

    const visited = new Set<string>();
    const visiting = new Set<string>();
    const visit = (scenarioId: string): void =>
    {
        if (visiting.has(scenarioId))
        {
            throw new Error(`Scenario dependencies contain a cycle at ${scenarioId}`);
        }
        if (visited.has(scenarioId)) return;
        visiting.add(scenarioId);
        const scenario = byId.get(scenarioId);
        const execution = scenario ? executionFor(scenario) : undefined;
        if (execution?.mode === 'multi-turn')
        {
            for (const priorId of execution.priorScenarioIds) visit(priorId);
        }
        visiting.delete(scenarioId);
        visited.add(scenarioId);
    };
    for (const scenario of scenarios) visit(scenario.id);
};

export const parseScenarioJsonl = (source: string): EvaluationScenario[] =>
{
    const lines = source.split(/\r?\n/);
    const scenarios: EvaluationScenario[] = [];

    for (const [index, line] of lines.entries())
    {
        if (line.trim().length === 0)
        {
            if (index === lines.length - 1)
            {
                continue;
            }
            throw new Error(`Invalid empty scenario on line ${index + 1}`);
        }

        try
        {
            scenarios.push(evaluationScenarioSchema.parse(JSON.parse(line) as unknown));
        }
        catch (error)
        {
            throw new Error(`Invalid scenario on line ${index + 1}`, {cause: error});
        }
    }

    if (scenarios.length === 0)
    {
        throw new Error('The scenario catalog is empty');
    }

    const ids = scenarios.map(({id}) => id);
    const duplicateIds = [...new Set(ids.filter((id, index) => ids.indexOf(id) !== index))];
    if (duplicateIds.length > 0)
    {
        throw new Error(`Scenario identifiers must be unique: ${duplicateIds.join(', ')}`);
    }

    validateScenarioReferences(scenarios);

    return scenarios;
};

export const loadEvaluationScenarios = async (
    path = join(process.cwd(), 'data', 'scenarios.jsonl')
): Promise<EvaluationScenario[]> =>
{
    const file = Bun.file(path);
    if (!await file.exists())
    {
        throw new Error(`Scenario catalog not found: ${path}`);
    }
    return parseScenarioJsonl(await file.text());
};
