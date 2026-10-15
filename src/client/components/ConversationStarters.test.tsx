import {expect, test} from 'bun:test';
import {renderToStaticMarkup} from 'react-dom/server';
import {CONVERSATION_STARTERS, ConversationStarters} from './ConversationStarters.tsx';

test('Ant Design X starters expose native keyboard buttons, descriptions and disabled semantics', () =>
{
    const html = renderToStaticMarkup(<ConversationStarters onChoose={() => undefined}/>);
    expect(html.match(/<button /g)).toHaveLength(4);
    for (const starter of CONVERSATION_STARTERS)
    {
        expect(html).toContain(`aria-describedby="starter-${starter.key}-description"`);
        expect(html).toContain(starter.label); expect(html).toContain(starter.description);
    }
    const disabled = renderToStaticMarkup(<ConversationStarters disabled onChoose={() => undefined}/>);
    expect(disabled.match(/disabled=""/g)).toHaveLength(4);
});
