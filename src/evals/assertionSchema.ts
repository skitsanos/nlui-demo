import {z} from 'zod';

export const EVALUATION_TOOL_NAMES = [
    'confirm_action',
    'get_dashboard',
    'get_order',
    'list_orders',
    'prepare_action',
    'query_dataset',
    'request_details',
    'search_policies',
    'search_products',
    'semantic_query'
] as const;

export const EVALUATION_BLOCK_NAMES = [
    'action_result',
    'chart',
    'choice',
    'citations',
    'confirmation',
    'error',
    'form',
    'markdown',
    'metrics',
    'table'
] as const;

const label = z.string().trim().min(1);
const path = z.string().regex(/^[A-Za-z0-9_-]+(?:\.[A-Za-z0-9_-]+)*$/);
const unqualifiedIdentifier = z.string().regex(/^[a-z][a-z0-9_]*$/);
const identifier = z.string().regex(/^(?:[a-z][a-z0-9_]*\.)?[a-z][a-z0-9_]*$/);
const scalar = z.union([z.string(), z.number().finite(), z.boolean(), z.null()]);
const denotation = z.union([
    scalar,
    z.array(scalar),
    z.array(z.array(scalar)),
    z.record(z.string(), scalar),
    z.array(z.record(z.string(), scalar))
]);

const toolAssertionSchema = z.object({
    source: z.literal('tool'),
    label,
    tool: z.enum(EVALUATION_TOOL_NAMES),
    path,
    operator: z.enum(['equals', 'contains', 'contains_value', 'length_equals']),
    expected: z.union([z.string(), z.number(), z.boolean()])
}).strict().superRefine((assertion, context) =>
{
    if (assertion.operator === 'length_equals'
        && (typeof assertion.expected !== 'number' || !Number.isFinite(assertion.expected)))
    {
        context.addIssue({code: 'custom', message: 'length_equals requires a numeric expectation'});
    }
});

const assistantTextAssertionSchema = z.object({
    source: z.literal('assistant_text'),
    label,
    operator: z.enum(['contains_ci', 'not_contains_ci', 'number_equals']),
    expected: z.union([z.string(), z.number()])
}).strict().superRefine((assertion, context) =>
{
    if (assertion.operator === 'number_equals'
        && (typeof assertion.expected !== 'number' || !Number.isFinite(assertion.expected)))
    {
        context.addIssue({code: 'custom', message: 'number_equals requires a numeric expectation'});
    }
    if (assertion.operator !== 'number_equals' && typeof assertion.expected !== 'string')
    {
        context.addIssue({code: 'custom', message: `${assertion.operator} requires a string expectation`});
    }
});

const whereAssertionSchema = z.object({
    source: z.literal('tool_arguments'),
    label,
    tool: z.literal('query_dataset'),
    operator: z.literal('sql_where_equals'),
    expected: z.object({column: unqualifiedIdentifier, value: z.string()}).strict()
}).strict();

const uiAssertionSchema = z.object({
    source: z.literal('ui'),
    label,
    operator: z.literal('block_types_equal'),
    expected: z.array(z.enum(EVALUATION_BLOCK_NAMES)).refine(
        (items) => new Set(items).size === items.length,
        'Values must be unique'
    )
}).strict();

const toleranceSchema = z.object({
    absolute: z.number().finite().nonnegative().optional(),
    relative: z.number().finite().nonnegative().optional()
}).strict().refine(
    ({absolute, relative}) => absolute !== undefined || relative !== undefined,
    'At least one tolerance must be configured'
);

const denotationAssertionSchema = z.object({
    source: z.literal('denotation'),
    label,
    tool: z.enum(EVALUATION_TOOL_NAMES),
    path,
    operator: z.enum(['exact', 'within_tolerance']),
    expected: denotation,
    arrayOrder: z.enum(['ordered', 'unordered']).optional(),
    tolerance: toleranceSchema.optional()
}).strict().superRefine((assertion, context) =>
{
    if (assertion.operator === 'within_tolerance' && !assertion.tolerance)
    {
        context.addIssue({code: 'custom', message: 'within_tolerance requires tolerance', path: ['tolerance']});
    }
    if (assertion.operator === 'exact' && assertion.tolerance)
    {
        context.addIssue({code: 'custom', message: 'exact does not accept tolerance', path: ['tolerance']});
    }
});

const sqlBase = {source: z.literal('sql_semantics'), label, tool: z.literal('query_dataset')};
const sqlSemanticAssertionSchema = z.discriminatedUnion('operator', [
    z.object({...sqlBase, operator: z.literal('has_join'), expected: z.object({
        left: identifier,
        right: identifier
    }).strict()}).strict(),
    z.object({...sqlBase, operator: z.literal('uses_time_field'), expected: z.object({
        column: identifier,
        clause: z.enum(['any', 'filter', 'group'])
    }).strict()}).strict(),
    z.object({...sqlBase, operator: z.literal('groups_by'), expected: z.array(identifier).min(1)}).strict(),
    z.object({...sqlBase, operator: z.literal('projects_unit'), expected: z.object({
        sourceColumn: identifier,
        outputAlias: unqualifiedIdentifier.optional(),
        divisor: z.number().finite().positive().optional()
    }).strict()}).strict(),
    z.object({...sqlBase, operator: z.literal('excludes_values'), expected: z.object({
        column: identifier,
        values: z.array(z.string()).min(1)
    }).strict()}).strict()
]);

const toolSequenceAssertionSchema = z.object({
    source: z.literal('tool_sequence'),
    label,
    tool: z.enum(EVALUATION_TOOL_NAMES),
    operator: z.literal('successful_attempt_equals'),
    expected: z.number().int().min(1).max(2)
}).strict();

export const deterministicAssertionSchema = z.union([
    toolAssertionSchema,
    assistantTextAssertionSchema,
    whereAssertionSchema,
    uiAssertionSchema,
    denotationAssertionSchema,
    sqlSemanticAssertionSchema,
    toolSequenceAssertionSchema
]);

export type DeterministicAssertion = z.infer<typeof deterministicAssertionSchema>;
export type EvaluationToolName = typeof EVALUATION_TOOL_NAMES[number];
export type EvaluationBlockName = typeof EVALUATION_BLOCK_NAMES[number];
