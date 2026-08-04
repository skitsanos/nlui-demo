import type {ChatActivity, ChatStreamEvent} from '../nlui/types.ts';
import type {ChatMessage} from './chat.ts';

type ActivityTerminalStatus = Extract<ChatActivity['status'], 'success' | 'error' | 'abort'>;

export const upsertActivity = (activities: ChatActivity[], next: ChatActivity): ChatActivity[] =>
{
    const index = activities.findIndex(({id}) => id === next.id);
    if (index < 0)
    {
        return [...activities, next];
    }

    return activities.map((activity, activityIndex) => activityIndex === index ? next : activity);
};

export const settleLoadingActivities = (
    activities: ChatActivity[],
    status: ActivityTerminalStatus
): ChatActivity[] => activities.map((activity) => activity.status === 'loading'
    ? {...activity, status}
    : activity);

export const reduceAssistantEvent = (message: ChatMessage, event: ChatStreamEvent): ChatMessage =>
{
    switch (event.type)
    {
        case 'activity.updated':
            return {...message, activities: upsertActivity(message.activities, event.activity)};
        case 'text.delta':
            return {...message, content: message.content + event.delta, state: 'streaming'};
        case 'ui.block':
            return {...message, blocks: [...message.blocks, event.block]};
        case 'message.completed':
            return {...message, state: 'complete', activities: settleLoadingActivities(message.activities, 'success')};
        case 'error':
            return {
                ...message,
                content: event.message,
                state: 'error',
                activities: settleLoadingActivities(message.activities, 'error')
            };
        case 'tool.started':
        case 'tool.completed':
        case 'message.started':
            return message;
    }
};

export const abortAssistantMessage = (message: ChatMessage): ChatMessage =>
{
    if (message.state !== 'loading' && message.state !== 'streaming')
    {
        return message;
    }

    return {
        ...message,
        content: message.content || 'Response cancelled.',
        state: 'abort',
        activities: settleLoadingActivities(message.activities, 'abort')
    };
};

export const selectCurrentActivity = (message: ChatMessage): ChatActivity | undefined =>
{
    if (message.state !== 'loading' && message.state !== 'streaming')
    {
        return undefined;
    }

    for (let index = message.activities.length - 1; index >= 0; index -= 1)
    {
        const activity = message.activities[index];
        if (activity.status === 'loading')
        {
            return activity;
        }
    }
    return undefined;
};

const isUnsuccessful = ({status}: ChatActivity): boolean => status === 'error' || status === 'abort';

export const selectActivityReceipt = (message: ChatMessage): ChatActivity[] =>
{
    if (message.state === 'loading' || message.state === 'streaming')
    {
        return [];
    }

    const receiptActivities = message.activities.filter((activity) =>
        activity.receipt || activity.kind === 'action' || isUnsuccessful(activity));
    if (receiptActivities.length === 0)
    {
        return [];
    }

    const hasDataArtifact = message.blocks.some(({type}) => type === 'table' || type === 'chart');
    const hasAction = receiptActivities.some(({kind}) => kind === 'action');
    const hasFailure = receiptActivities.some(isUnsuccessful);
    const shouldShow = hasDataArtifact || receiptActivities.length >= 2 || hasAction || hasFailure;

    return shouldShow ? receiptActivities : [];
};
