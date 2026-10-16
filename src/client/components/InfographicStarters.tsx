import {Button, Space, Typography} from 'antd';

export const InfographicStarters = ({onChoose, disabled}: {onChoose: (text: string) => void; disabled?: boolean}) =>
    <section aria-label="Experimental visual explanations" style={{marginTop: 20}}>
        <Typography.Paragraph type="secondary">Try a visual explanation · Experimental</Typography.Paragraph>
        <Space wrap>
            <Button disabled={disabled} onClick={() => onChoose('Show a visual comparison of West and East eligible revenue from 2026-01-01 to 2026-06-30.')}>Compare two regions</Button>
            <Button disabled={disabled} onClick={() => onChoose('Show the recorded event timeline for order ORD-1042.')}>Order timeline</Button>
            <Button disabled={disabled} onClick={() => onChoose('Visually explain the general return-policy process, not eligibility for an order.')}>How returns work</Button>
        </Space>
    </section>;
