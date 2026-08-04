import type {ChatActivity} from '../nlui/types.ts';

type ActivityStatus = ChatActivity['status'];
type ActivityTemplate = Pick<ChatActivity, 'kind' | 'title' | 'description' | 'receipt'>;

const TOOL_ACTIVITY_CATALOG = {
    get_dashboard: {
        kind: 'data',
        title: 'Reviewing business performance',
        description: 'Reading exact metrics from the demo dataset.',
        receipt: true
    },
    query_dataset: {
        kind: 'data',
        title: 'Checking the demo dataset',
        description: 'Running a bounded read-only data lookup.',
        receipt: true
    },
    semantic_query: {
        kind: 'data',
        title: 'Checking the demo dataset',
        description: 'Applying approved retail metrics and filters.',
        receipt: true
    },
    list_orders: {
        kind: 'data',
        title: 'Finding matching orders',
        description: 'Checking the order records that match your request.',
        receipt: true
    },
    search_products: {
        kind: 'data',
        title: 'Searching the product catalog',
        description: 'Comparing products with your requested criteria.',
        receipt: true
    },
    get_order: {
        kind: 'data',
        title: 'Checking the order',
        description: 'Reading the order and shipment details.',
        receipt: true
    },
    search_policies: {
        kind: 'data',
        title: 'Reviewing relevant policies',
        description: 'Searching the application-owned policy library.',
        receipt: true
    },
    request_details: {
        kind: 'action',
        title: 'Preparing a guided form',
        description: 'Selecting the required application-owned fields.',
        receipt: true
    },
    prepare_action: {
        kind: 'action',
        title: 'Validating the requested action',
        description: 'Preparing a safe confirmation without changing data.',
        receipt: true
    }
} as const satisfies Record<string, ActivityTemplate>;

const UNKNOWN_TOOL_ACTIVITY: ActivityTemplate = {
    kind: 'action',
    title: 'Using an application capability',
    description: 'Completing an approved application operation.',
    receipt: true
};

export const requestActivity = (messageId: string, status: ActivityStatus = 'loading'): ChatActivity => ({
    id: `${messageId}:request`,
    kind: 'request',
    title: 'Understanding your request',
    description: 'Identifying the information or action you need.',
    status,
    receipt: false
});

export const toolActivity = (
    toolName: string,
    messageId: string,
    sequence: number,
    status: ActivityStatus = 'loading'
): ChatActivity => ({
    id: `${messageId}:tool:${sequence}`,
    ...(TOOL_ACTIVITY_CATALOG[toolName as keyof typeof TOOL_ACTIVITY_CATALOG] ?? UNKNOWN_TOOL_ACTIVITY),
    status
});

export const composeActivity = (
    messageId: string,
    sequence: number,
    status: ActivityStatus = 'loading'
): ChatActivity => ({
    id: `${messageId}:compose:${sequence}`,
    kind: 'compose',
    title: 'Preparing the answer',
    description: 'Reviewing the trusted results and selecting the clearest response.',
    status,
    receipt: false
});

export const updateActivityStatus = (activity: ChatActivity, status: ActivityStatus): ChatActivity => ({
    ...activity,
    status
});
