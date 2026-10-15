import 'antd/dist/reset.css';
import '../../src/client/styles.css';
import XMarkdown from '@ant-design/x-markdown';
import Latex from '@ant-design/x-markdown/plugins/Latex';
import {Card, Space, Typography} from 'antd';
import {createRoot} from 'react-dom/client';
import {AssistantMarkdown} from '../../src/client/components/AssistantMarkdown.tsx';

const source = '**A clear answer**\n\n- First insight\n- Next step\n\n'
    + '[Unsafe link](javascript:alert(1))\n\n![External image](https://fixture.invalid/canary.png)\n\n'
    + '<img src=x onerror=alert(1)><script>alert(1)</script>';
createRoot(document.getElementById('root')!).render(<main style={{maxWidth: 1000, margin: '24px auto', padding: 20}}>
    <Typography.Title level={1} style={{fontSize: 24}}>Markdown compatibility qualification</Typography.Title>
    <Typography.Paragraph>Production prose renderer and upstream math adapter. No provider or database.</Typography.Paragraph>
    <Space orientation="vertical" size={16} style={{width: '100%'}}>
        <Card title="Production assistant Markdown"><section aria-label="Production assistant Markdown"><AssistantMarkdown content={source}/></section></Card>
        <Card title="Patched KaTeX and upstream LaTeX adapter"><section aria-label="Patched math">
            <XMarkdown content={'Inline $x^2$ and tagged $x\\tag{1}$.\n\n$$\n\\frac{1}{2} + \\sqrt{a^2+b^2}\n$$'}
                config={{extensions: Latex({katexOptions: {trust: false, throwOnError: false}})}} escapeRawHtml/>
        </section></Card>
    </Space>
</main>);
