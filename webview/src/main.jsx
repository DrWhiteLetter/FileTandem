import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './style.css';
import { validateResponse } from '../../src/shared/messages.js';

const vscode = acquireVsCodeApi();
const sessionId = document.querySelector('meta[name="xscp-session"]').content;
const send = (type, extra = {}) => vscode.postMessage({ version: 1, type, id: crypto.randomUUID(), sessionId, ...extra });

function App() {
  const [location, setLocation] = useState(null);
  useEffect(() => {
    const receive = event => {
      const message = event.data;
      if (validateResponse(message,sessionId)) setLocation(message.location);
    };
    window.addEventListener('message', receive);
    send('ready');
    return () => window.removeEventListener('message', receive);
  }, []);
  return <main>
    <h1>xScp</h1>
    <h2>Lokal · Mein Rechner</h2>
    <p role="status">{location?.local ? 'Dateiquelle: Desktop-Rechner mit VS Code.' : 'Ausführungsort wird geprüft …'}</p>
    {location?.remoteWindow && <p>Der Remote-Workspace gehört nicht zur lokalen Dateiquelle.</p>}
    <p>Mit „xScp: Lokalen Dateizugriff nachweisen“ in der Befehlspalette eine lokale Testdatei prüfen.</p>
    <p>Verbindungen und Dateiübertragungen folgen in den nächsten Aufgaben.</p>
  </main>;
}

createRoot(document.getElementById('root')).render(<App />);
