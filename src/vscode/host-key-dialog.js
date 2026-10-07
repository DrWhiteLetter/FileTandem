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
