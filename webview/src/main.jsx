import '@vscode/codicons/dist/codicon.css';
import { createRoot } from 'react-dom/client';
import { App } from './App.jsx';
import './style.css';
const bridge = acquireVsCodeApi();
const sessionId = document.querySelector('meta[name="xscp-session"]').content;
createRoot(document.getElementById('root')).render(<App bridge={bridge} sessionId={sessionId} />);
