import Prompts from '@ant-design/x/es/prompts';
import {ChartLine, ChatsCircle, Package, ShoppingCart} from '@phosphor-icons/react';

export const CONVERSATION_STARTERS = [
    {key: 'sales', label: 'Show the sales trend for the last six months', description: 'A live chart with headline metrics', icon: <ChartLine/>},
    {key: 'orders', label: 'Show delayed orders over €500', description: 'An operational data table', icon: <Package/>},
    {key: 'products', label: 'Help me choose a laptop for design work', description: 'Interactive product choices', icon: <ShoppingCart/>},
    {key: 'return', label: 'I need to return an order', description: 'A guided form and safe confirmation', icon: <ChatsCircle/>}
];

// Prompts 2.9 renders clickable divs. A native button keeps its existing design
// while adding keyboard activation, disabled semantics and an accessible description.
export const ConversationStarters = ({disabled, onChoose}: {disabled?: boolean; onChoose: (text: string) => void}) =>
    <Prompts title="Try an NLUI response" wrap items={CONVERSATION_STARTERS.map((starter) => ({
        key: starter.key, icon: starter.icon, disabled,
        label: <button type="button" className="starter-button" disabled={disabled} aria-describedby={`starter-${starter.key}-description`}
            onClick={() => {if (!disabled) onChoose(starter.label);}}>{starter.label}</button>,
        description: <span id={`starter-${starter.key}-description`}>{starter.description}</span>
    }))}/>;
