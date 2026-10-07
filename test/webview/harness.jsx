import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from '../../webview/src/App.jsx';
window.testAct = act;
window.testMount = (bridge,sessionId) => act(() => createRoot(document.getElementById('root')).render(<App bridge={bridge} sessionId={sessionId} />));
import { BrowserApp } from '../../webview/src/BrowserApp.jsx';
window.testMountBrowser = (bridge,sessionId) => act(() => createRoot(document.getElementById('root')).render(<BrowserApp bridge={bridge} sessionId={sessionId} />));
