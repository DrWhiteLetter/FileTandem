/** Native dialog only: no trust decisions or credentials in the webview. */
export function unknownHostKeyDialog(window) {
  return async request => {
    const answer = await window.showWarningMessage(
      `Unbekannter SSH-Host-Key: ${request.endpoint.label}`,
      { modal: true, detail: `Algorithmus: ${request.algorithm}\nFingerprint: ${request.fingerprint}\n\nFingerprint über einen unabhängigen vertrauenswürdigen Weg mit dem Serverbetreiber vergleichen. Nur bei Übereinstimmung vertrauen. Die Entscheidung wird lokal für diesen Host und Port gespeichert.` },
      'Ablehnen', 'Vertrauen und verbinden');
    return answer === 'Vertrauen und verbinden';
  };
}

/** A changed server identity requires independent verification and an exact fingerprint. */
export function changedHostKeyDialog(window) {
  return async (request, signal) => {
    if (signal?.aborted) return false;
    const answer = await window.showWarningMessage(
      `SSH-Host-Key geändert: ${request.endpoint.label}`,
      { modal: true, detail: `Ein Serverumzug kann den Schlüsselwechsel erklären. Ein fremder Server oder ein Angriff ist ebenfalls möglich.

Bisher (${request.expected.algorithm}): ${request.expected.fingerprint}
Neu (${request.received.algorithm}): ${request.received.fingerprint}

Vergleiche den neuen SHA256-Fingerprint über die Serverkonsole des Hosters oder mit dem Administrator. Nur bei Übereinstimmung fortfahren. Der gespeicherte Schlüssel wird ausschließlich für diesen Host und Port ersetzt.` },
      'Neuen Schlüssel prüfen …');
    if (signal?.aborted || answer !== 'Neuen Schlüssel prüfen …') return false;
    const fingerprint = await window.showInputBox({
      title: `FileTandem: Neuen Host-Key für ${request.endpoint.label} bestätigen`,
      prompt: 'Den unabhängig geprüften neuen SHA256-Fingerprint eingeben. Bestätigen ersetzt den bisherigen Host-Key und erlaubt die Verbindung.',
      placeHolder: 'SHA256:…', ignoreFocusOut: true,
      validateInput: value => value.trim() === request.received.fingerprint ? undefined : 'Der Fingerprint stimmt nicht mit dem neuen Server-Schlüssel überein.'
    });
    return !signal?.aborted && fingerprint?.trim() === request.received.fingerprint;
  };
}
