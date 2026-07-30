import {Bubble, Conversations, Prompts, Sender, Welcome, XProvider} from '@ant-design/x';
import XMarkdown, {type ComponentProps} from '@ant-design/x-markdown';
import {
    ChartLine,
    ChatsCircle,
    Database,
    Package,
    Robot,
    ShoppingCart,
    Sparkle,
    User
} from '@phosphor-icons/react';
import {Button, Flex, Tag, Typography} from 'antd';
import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import type {ChatInput} from '../nlui/types.ts';
import {NluiRenderer} from './components/NluiRenderer.tsx';
import {useChat} from './useChat.ts';

const STARTERS = [
    {
        key: 'sales',
        label: 'Show the sales trend for the last six months',
        description: 'A live chart with headline metrics',
        icon: <ChartLine/>
    },
    {
        key: 'orders',
        label: 'Show delayed orders over €500',
        description: 'An operational data table',
        icon: <Package/>
    },
    {
        key: 'products',
        label: 'Help me choose a laptop for design work',
        description: 'Interactive product choices',
        icon: <ShoppingCart/>
    },
    {
        key: 'return',
        label: 'I need to return an order',
        description: 'A guided form and safe confirmation',
        icon: <ChatsCircle/>
    }
];

const TextOnlyLink = ({children}: ComponentProps) => <span>{children}</span>;
const OmittedImage = ({alt}: ComponentProps<{alt?: string}>) => <span>{alt ? `[Image: ${alt}]` : '[Image omitted]'}</span>;

const App = () =>
{
    const [draft, setDraft] = useState('');
    const [chatConfigured, setChatConfigured] = useState<boolean>();
    const {messages, loading, submit, cancel, reset} = useChat();
    const consumedInteractions = useRef(new Set<string>());

    useEffect(() =>
    {
        const controller = new AbortController();
        void fetch('/api/config', {signal: controller.signal})
            .then(async (response) => response.ok
                ? response.json() as Promise<{chat?: {configured?: boolean}}>
                : Promise.reject(new Error('Configuration request failed')))
            .then(({chat}) => setChatConfigured(Boolean(chat?.configured)))
            .catch(() =>
            {
                if (!controller.signal.aborted)
                {
                    setChatConfigured(false);
                }
            });
        return () => controller.abort();
    }, []);

    const send = useCallback((input: ChatInput, displayText: string): void =>
    {
        if (input.type === 'ui_result')
        {
            if (consumedInteractions.current.has(input.interactionId))
            {
                return;
            }
            consumedInteractions.current.add(input.interactionId);
        }
        void submit(input, displayText);
    }, [submit]);

    const sendText = (text: string): void =>
    {
        const trimmed = text.trim();
        if (!trimmed)
        {
            return;
        }
        setDraft('');
        send({type: 'user_text', text: trimmed}, trimmed);
    };

    const resetChat = (): void =>
    {
        consumedInteractions.current.clear();
        reset();
    };

    const latestAssistantId = messages.findLast(({role}) => role === 'assistant')?.id;
    const bubbleItems = useMemo(() => messages.map((message) => ({
        key: message.id,
        role: message.role,
        loading: message.state === 'loading' && !message.content && message.blocks.length === 0,
        streaming: message.state === 'streaming',
        content: message.role === 'user' ? message.content : (
            <div className="assistant-message">
                {message.content && <XMarkdown
                    content={message.content}
                    className="x-markdown-light"
                    components={{a: TextOnlyLink, img: OmittedImage}}
                    escapeRawHtml
                    streaming={{hasNextChunk: message.state === 'streaming', tail: message.state === 'streaming'}}
                />}
                {message.activity && <Typography.Text type="secondary" className="tool-activity" role="status" aria-live="polite">
                    <Sparkle weight="fill"/> {message.activity}
                </Typography.Text>}
                <NluiRenderer
                    blocks={message.blocks}
                    disabled={loading || message.state !== 'complete' || message.id !== latestAssistantId}
                    onInteraction={send}
                />
            </div>
        )
    })), [latestAssistantId, loading, messages, send]);

    return (
        <XProvider theme={{
            token: {
                colorPrimary: '#5b5bd6',
                borderRadius: 12,
                colorBgLayout: '#f4f6fa',
                fontFamily: 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
            }
        }}>
            <div className="app-shell">
                <aside className="sidebar">
                    <div className="brand">
                        <div className="brand-mark"><Sparkle weight="fill"/></div>
                        <div>
                            <strong>NLUI</strong>
                            <span>Runtime lab</span>
                        </div>
                    </div>

                    <Conversations
                        activeKey="demo"
                        creation={{label: 'New conversation', icon: <ChatsCircle/>, onClick: resetChat}}
                        items={[{key: 'demo', label: 'Commerce operations', icon: <ChatsCircle/>}]}
                    />

                    <div className="dataset-card">
                        <Flex align="center" gap={10}>
                            <Database size={22}/>
                            <div>
                                <strong>Demo dataset</strong>
                                <span>Synthetic retail operations</span>
                            </div>
                        </Flex>
                        <Tag color="success">Deterministic</Tag>
                    </div>

                    <div className="trust-note">
                        <strong>Controlled UI</strong>
                        <span>The model selects capabilities. The application owns rendering and actions.</span>
                    </div>
                </aside>

                <main className="workspace">
                    <header className="workspace-header">
                        <div>
                            <Typography.Title level={4}>Commerce operations</Typography.Title>
                            <Typography.Text type="secondary">Ask for analysis, drill into records, or complete a guided task.</Typography.Text>
                        </div>
                        <Flex gap={8} align="center">
                            <Tag variant="filled" color={chatConfigured ? 'success' : chatConfigured === false ? 'error' : 'default'}>
                                <span className={`status-dot status-dot-${chatConfigured ? 'ready' : chatConfigured === false ? 'missing' : 'checking'}`}/>
                                {chatConfigured ? 'OpenAI configured' : chatConfigured === false ? 'OpenAI not configured' : 'Checking configuration'}
                            </Tag>
                            <Button className="mobile-reset" onClick={resetChat}>New chat</Button>
                        </Flex>
                    </header>

                    <section className={`conversation ${messages.length === 0 ? 'conversation-empty' : ''}`}>
                        {messages.length === 0 ? <div className="welcome-wrap">
                            <Welcome
                                variant="borderless"
                                icon={<div className="welcome-icon"><Robot weight="duotone"/></div>}
                                title="What would you like to understand or do?"
                                description="This assistant can answer with prose, live data, and safe interactive controls."
                            />
                            <Prompts
                                title="Try an NLUI response"
                                items={STARTERS}
                                wrap
                                onItemClick={({data}) => sendText(String(data.label))}
                            />
                        </div> : <Bubble.List
                            autoScroll
                            className="message-list"
                            items={bubbleItems}
                            role={{
                                user: {
                                    placement: 'end',
                                    variant: 'filled',
                                    avatar: <div className="avatar avatar-user"><User weight="bold"/></div>
                                },
                                assistant: {
                                    placement: 'start',
                                    variant: 'borderless',
                                    avatar: <div className="avatar avatar-assistant"><Sparkle weight="fill"/></div>
                                }
                            }}
                        />}
                    </section>

                    <footer className="composer-wrap">
                        <Sender
                            value={draft}
                            onChange={setDraft}
                            onSubmit={sendText}
                            onCancel={cancel}
                            loading={loading}
                            placeholder="Ask about customers, products, orders, returns, or sales…"
                            autoSize={{minRows: 1, maxRows: 5}}
                        />
                        <Typography.Text type="secondary" className="composer-hint">
                            AI may make mistakes. Data operations are constrained by server-owned tools.
                        </Typography.Text>
                    </footer>
                </main>
            </div>
        </XProvider>
    );
};

export default App;
