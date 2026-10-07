import { validateRequest, SCENARIOS } from '../shared/messages.js';
export class ManagerSessions {
  #sessions = new Map();
  create(id, location, scenario = 'ready') {
    if (this.#sessions.has(id)) throw new Error('Sitzung bereits vorhanden.');
    this.#sessions.set(id, { location: { local: location.local === true, remoteWindow: location.windowRemoteName !== null }, scenario: SCENARIOS.includes(scenario) ? scenario : 'ready', requests: new Set() });
  }
  handle(id, message) {
    const session = this.#sessions.get(id);
    if (!session || !validateRequest(message,id) || session.requests.has(message.id)) return undefined;
    session.requests.add(message.id);
    if (session.requests.size > 256) session.requests.delete(session.requests.values().next().value);
    if (message.type === 'setScenario') session.scenario = message.scenario;
    return { version: 1, type: 'model', id: message.id, sessionId: id, location: session.location, scenario: session.scenario };
  }
  remove(id) { this.#sessions.delete(id); }
  dispose() { this.#sessions.clear(); }
}
