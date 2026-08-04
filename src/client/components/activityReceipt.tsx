import type {ThoughtChainItemType} from '@ant-design/x';
import {CheckCircle, CircleNotch, MinusCircle, XCircle} from '@phosphor-icons/react';
import type {ChatActivity} from '../../nlui/types.ts';

const ACTIVITY_STATUS_LABELS: Record<ChatActivity['status'], string> = {
    loading: 'In progress',
    success: 'Completed',
    error: 'Failed',
    abort: 'Cancelled'
};

export const activityStatusLabel = (status: ChatActivity['status']): string => ACTIVITY_STATUS_LABELS[status];

const ActivityStatusIcon = ({status}: {status: ChatActivity['status']}) =>
{
    const icon = status === 'success'
        ? <CheckCircle weight="fill"/>
        : status === 'error'
            ? <XCircle weight="fill"/>
            : status === 'abort'
                ? <MinusCircle weight="fill"/>
                : <CircleNotch weight="bold"/>;

    return <span
        className={`activity-chain-status-icon activity-chain-status-${status}`}
        aria-hidden="true"
    >
        {icon}
    </span>;
};

export const activityToThoughtChainItem = (activity: ChatActivity): ThoughtChainItemType => ({
    key: activity.id,
    icon: <ActivityStatusIcon status={activity.status}/>,
    title: <span>
        {activity.title}
        <span className="activity-visually-hidden">. Status: {activityStatusLabel(activity.status)}.</span>
    </span>,
    description: activity.description,
    collapsible: false
});
