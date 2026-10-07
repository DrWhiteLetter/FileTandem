import { createRoot } from 'react-dom/client';
import './style.css';

function App() {
  return <main>
    <h1>xScp</h1>
    <p>Die Entwicklungsgrundlage ist bereit.</p>
    <p>Verbindungen und Dateiübertragungen folgen in den nächsten Aufgaben.</p>
  </main>;
}

createRoot(document.getElementById('root')).render(<App />);
