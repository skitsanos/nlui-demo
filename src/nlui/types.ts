export type CellValue = string | number | boolean | null;
export type ValueFormat = 'text' | 'number' | 'currency' | 'date' | 'status';
export type StringValueFormat = Extract<ValueFormat, 'text' | 'date' | 'status'>;

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
        format?: ValueFormat;
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
    categoryFormat?: 'date';
    data: Array<Record<string, string | number>>;
}

export interface TableBlock extends BlockBase
{
    type: 'table';
    columns: Array<{
        key: string;
        label: string;
        format?: ValueFormat;
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
    details: Array<{label: string; value: string; format?: StringValueFormat}>;
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
    conversationId: string;
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
    conversationId: string;
    interactionId: string;
    actionId: string;
}

export interface ActionResponse
{
    block: ResultBlock;
}
