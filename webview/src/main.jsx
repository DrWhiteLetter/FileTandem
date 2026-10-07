import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './style.css';

const vscode = acquireVsCodeApi();

function App() {
  const [location, setLocation] = useState(null);
  useEffect(() => {
    const receive = event => {
      const message = event.data;
      if (message?.type === 'executionLocation' && typeof message.local === 'boolean'
        && typeof message.remoteWindow === 'boolean') setLocation(message);
    };
    window.addEventListener('message', receive);
    vscode.postMessage({ type: 'ready' });
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
