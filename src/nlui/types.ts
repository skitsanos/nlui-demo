export type CellValue = string | number | boolean | null;

export type NluiBlock =
    | StatsBlock
    | ChartBlock
    | TableBlock
    | ChoicesBlock
    | FormBlock
    | ConfirmationBlock
    | SourcesBlock
    | ResultBlock;

export interface BlockBase
{
    id: string;
    title?: string;
    description?: string;
}

export interface StatsBlock extends BlockBase
{
    type: 'stats';
    items: Array<{
        label: string;
        value: string | number;
        suffix?: string;
        trend?: 'up' | 'down' | 'flat';
    }>;
}

export interface ChartBlock extends BlockBase
{
    type: 'chart';
    variant: 'bar' | 'line';
    categoryKey: string;
    valueKey: string;
    valueLabel?: string;
    data: Array<Record<string, string | number>>;
}

export interface TableBlock extends BlockBase
{
    type: 'table';
    columns: Array<{
        key: string;
        label: string;
        format?: 'text' | 'number' | 'currency' | 'date' | 'status';
    }>;
    rows: Array<Record<string, CellValue>>;
    rowKey: string;
}

export interface ChoicesBlock extends BlockBase
{
    type: 'choices';
    interactionId: string;
    multiple?: boolean;
    options: Array<{
        value: string;
        label: string;
        description?: string;
        meta?: string;
    }>;
}

export type FormField =
    | TextFormField
    | NumberFormField
    | SelectFormField
    | DateFormField;

interface FormFieldBase
{
    name: string;
    label: string;
    required?: boolean;
    help?: string;
}

export interface TextFormField extends FormFieldBase
{
    input: 'text' | 'textarea';
    placeholder?: string;
    maxLength?: number;
}

export interface NumberFormField extends FormFieldBase
{
    input: 'number';
    min?: number;
    max?: number;
}

export interface SelectFormField extends FormFieldBase
{
    input: 'select';
    options: Array<{label: string; value: string}>;
}

export interface DateFormField extends FormFieldBase
{
    input: 'date';
}

export interface FormBlock extends BlockBase
{
    type: 'form';
    interactionId: string;
    submitLabel: string;
    fields: FormField[];
    initialValues?: Record<string, CellValue>;
}

export interface ConfirmationBlock extends BlockBase
{
    type: 'confirmation';
    actionId: string;
    confirmLabel: string;
    cancelLabel?: string;
    severity?: 'default' | 'warning' | 'danger';
    details: Array<{label: string; value: string}>;
}

export interface SourcesBlock extends BlockBase
{
    type: 'sources';
    items: Array<{title: string; excerpt: string; source: string}>;
}

export interface ResultBlock extends BlockBase
{
    type: 'result';
    status: 'success' | 'info' | 'warning' | 'error';
    message: string;
}

export type ChatInput =
    | {type: 'user_text'; text: string}
    | {type: 'ui_result'; interactionId: string; values: Record<string, CellValue | CellValue[]>};

export interface ChatRequest
{
    input: ChatInput;
    previousResponseId?: string;
}

export type ChatStreamEvent =
    | {type: 'message.started'; messageId: string}
    | {type: 'tool.started'; name: string}
    | {type: 'tool.completed'; name: string}
    | {type: 'text.delta'; delta: string}
    | {type: 'ui.block'; block: NluiBlock}
    | {type: 'message.completed'; messageId: string; responseId: string}
    | {type: 'error'; message: string};

export interface ActionRequest
{
    actionId: string;
}

export interface ActionResponse
{
    block: ResultBlock;
}
