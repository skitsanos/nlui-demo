import 'antd/dist/reset.css';
import '@ant-design/x-markdown/themes/light.css';
import './styles.css';
import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';

const root = document.getElementById('root');

if (!root)
{
    throw new Error('Missing #root element');
}

createRoot(root).render(
    <StrictMode>
        <App/>
    </StrictMode>
);
