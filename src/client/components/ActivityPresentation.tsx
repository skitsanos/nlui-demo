import {Think, ThoughtChain} from '@ant-design/x';
import {Collapse} from 'antd';
import type {ChatActivity} from '../../nlui/types.ts';
import type {ChatMessage} from '../chat.ts';
import {selectActivityReceipt, selectCurrentActivity} from '../chatActivity.ts';
import {activityToThoughtChainItem} from './activityReceipt.tsx';

const ActivityStatus = ({activity}: {activity: ChatActivity}) =>
{
    const label = activity.description
        ? `${activity.title}. ${activity.description}`
        : activity.title;

    return <Think
        className="activity-think"
        classNames={{status: 'activity-think-status'}}
        title={<span className="activity-think-copy">
            <span>{activity.title}</span>
            {activity.description && <span className="activity-think-description">{activity.description}</span>}
        </span>}
        loading
        expanded={false}
        onExpand={() => undefined}
        destroyOnHidden
        role="status"
        aria-label={label}
        aria-live="polite"
        aria-atomic="true"
    />;
};

const ActivityReceipt = ({activities}: {activities: ChatActivity[]}) => <Collapse
    className="activity-receipt"
    size="small"
    ghost
    defaultActiveKey={[]}
    items={[{
        key: 'activity-receipt',
        label: 'How this answer was produced',
        children: <ThoughtChain
            className="activity-chain"
            items={activities.map(activityToThoughtChainItem)}
            line="solid"
            role="group"
            aria-label="Answer activity"
        />
    }]}
/>;

export const ActivityPresentation = ({message}: {message: ChatMessage}) =>
{
    const current = selectCurrentActivity(message);
    const receipt = selectActivityReceipt(message);

    return <>
        {current && <ActivityStatus activity={current}/>}
        {receipt.length > 0 && <ActivityReceipt activities={receipt}/>}
    </>;
};
