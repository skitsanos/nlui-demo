import XMarkdown, {type ComponentProps} from '@ant-design/x-markdown';

const TextOnlyLink = ({children}: ComponentProps) => <span>{children}</span>;
const OmittedImage = ({alt}: ComponentProps<{alt?: string}>) => <span>{alt ? `[Image: ${alt}]` : '[Image omitted]'}</span>;

// Keep untrusted assistant content separate from application-owned UI capabilities.
export const AssistantMarkdown = ({content, streaming = false, annotation = false}: {
    content: string; streaming?: boolean; annotation?: boolean;
}) => <XMarkdown content={content} className={`x-markdown-light${annotation ? ' assistant-annotation' : ''}`}
    components={{a: TextOnlyLink, img: OmittedImage}} escapeRawHtml
    streaming={{hasNextChunk: streaming, tail: streaming}}/>;
