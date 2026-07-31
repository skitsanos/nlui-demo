import {z} from 'zod';

const cellValueSchema = z.union([z.string(), z.number(), z.boolean(), z.null()]);
const valueFormatSchema = z.enum(['text', 'number', 'currency', 'date', 'status']);
const stringValueFormatSchema = z.enum(['text', 'date', 'status']);

export const chatInputSchema = z.discriminatedUnion('type', [
    z.object({
        type: z.literal('user_text'),
        text: z.string().trim().min(1).max(4_000)
    }),
    z.object({
        type: z.literal('ui_result'),
        interactionId: z.string().min(1).max(120),
        values: z.record(z.string(), z.union([cellValueSchema, z.array(cellValueSchema).max(50)]))
    })
]);

export const chatRequestSchema = z.object({
    conversationId: z.string().min(12).max(120),
    input: chatInputSchema,
    previousResponseId: z.string().min(1).max(200).optional()
});

export const actionRequestSchema = z.object({
    conversationId: z.string().min(12).max(120),
    interactionId: z.string().min(1).max(120),
    actionId: z.string().min(1).max(200)
});

const blockBaseSchema = z.object({
    id: z.string().min(1),
    title: z.string().optional(),
    description: z.string().optional()
});

const statsBlockSchema = blockBaseSchema.extend({
    type: z.literal('stats'),
    items: z.array(z.object({
        label: z.string(),
        value: z.union([z.string(), z.number()]),
        format: valueFormatSchema.optional(),
        suffix: z.string().optional(),
        trend: z.enum(['up', 'down', 'flat']).optional()
    })).min(1).max(8)
});

const chartBlockSchema = blockBaseSchema.extend({
    type: z.literal('chart'),
    variant: z.enum(['bar', 'line']),
    categoryKey: z.string(),
    valueKey: z.string(),
    valueLabel: z.string().optional(),
    categoryFormat: z.literal('date').optional(),
    data: z.array(z.record(z.string(), z.union([z.string(), z.number()]))).max(24)
});

const tableBlockSchema = blockBaseSchema.extend({
    type: z.literal('table'),
    columns: z.array(z.object({
        key: z.string(),
        label: z.string(),
        format: valueFormatSchema.optional()
    })).min(1).max(20),
    rows: z.array(z.record(z.string(), cellValueSchema)).max(100),
    rowKey: z.string()
}).superRefine((block, context) =>
{
    if (new Set(block.columns.map(({key}) => key)).size !== block.columns.length)
    {
        context.addIssue({code: 'custom', message: 'Table column keys must be unique', path: ['columns']});
    }
    const rowKeys = block.rows.map((row) => row[block.rowKey]);
    if (rowKeys.some((value) => value === undefined) || new Set(rowKeys).size !== rowKeys.length)
    {
        context.addIssue({code: 'custom', message: 'Table row keys must be present and unique', path: ['rows']});
    }
});

const choicesBlockSchema = blockBaseSchema.extend({
    type: z.literal('choices'),
    interactionId: z.string(),
    multiple: z.boolean().optional(),
    options: z.array(z.object({
        value: z.string(),
        label: z.string(),
        description: z.string().optional(),
        meta: z.string().optional()
    })).min(1).max(20)
}).superRefine((block, context) =>
{
    if (new Set(block.options.map(({value}) => value)).size !== block.options.length)
    {
        context.addIssue({code: 'custom', message: 'Choice values must be unique', path: ['options']});
    }
});

const formFieldBase = z.object({
    name: z.string(),
    label: z.string(),
    required: z.boolean().optional(),
    help: z.string().optional()
});

const formFieldSchema = z.discriminatedUnion('input', [
    formFieldBase.extend({
        input: z.enum(['text', 'textarea']),
        placeholder: z.string().optional(),
        maxLength: z.number().int().positive().optional()
    }),
    formFieldBase.extend({
        input: z.literal('number'),
        min: z.number().optional(),
        max: z.number().optional()
    }),
    formFieldBase.extend({
        input: z.literal('select'),
        options: z.array(z.object({label: z.string(), value: z.string()})).min(1)
    }),
    formFieldBase.extend({input: z.literal('date')})
]);

const formBlockSchema = blockBaseSchema.extend({
    type: z.literal('form'),
    interactionId: z.string(),
    submitLabel: z.string(),
    fields: z.array(formFieldSchema).min(1).max(20),
    initialValues: z.record(z.string(), cellValueSchema).optional()
}).superRefine((block, context) =>
{
    if (new Set(block.fields.map(({name}) => name)).size !== block.fields.length)
    {
        context.addIssue({code: 'custom', message: 'Form field names must be unique', path: ['fields']});
    }
});

const confirmationBlockSchema = blockBaseSchema.extend({
    type: z.literal('confirmation'),
    actionId: z.string(),
    confirmLabel: z.string(),
    cancelLabel: z.string().optional(),
    severity: z.enum(['default', 'warning', 'danger']).optional(),
    details: z.array(z.object({
        label: z.string(),
        value: z.string(),
        format: stringValueFormatSchema.optional()
    })).max(20)
});

const sourcesBlockSchema = blockBaseSchema.extend({
    type: z.literal('sources'),
    items: z.array(z.object({
        title: z.string(),
        excerpt: z.string(),
        source: z.string()
    })).min(1).max(10)
});

const resultBlockSchema = blockBaseSchema.extend({
    type: z.literal('result'),
    status: z.enum(['success', 'info', 'warning', 'error']),
    message: z.string()
});

export const nluiBlockSchema = z.discriminatedUnion('type', [
    statsBlockSchema,
    chartBlockSchema,
    tableBlockSchema,
    choicesBlockSchema,
    formBlockSchema,
    confirmationBlockSchema,
    sourcesBlockSchema,
    resultBlockSchema
]);

export const nluiBlocksSchema = z.array(nluiBlockSchema).max(12).superRefine((blocks, context) =>
{
    if (new Set(blocks.map(({id}) => id)).size !== blocks.length)
    {
        context.addIssue({code: 'custom', message: 'Block identifiers must be unique'});
    }
});
