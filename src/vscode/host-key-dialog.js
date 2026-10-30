/** Native dialog only: no trust decisions or credentials in the webview. */
export function unknownHostKeyDialog(window) {
  return async request => {
    const answer = await window.showWarningMessage(
      `Unknown SSH host key: ${request.endpoint.label}`,
      { modal: true, detail: `Algorithm: ${request.algorithm}
Fingerprint: ${request.fingerprint}

Verify the fingerprint independently with the server operator. Trust only a matching fingerprint. This decision is stored locally for this host and port.` },
      "Reject", "Trust and connect");
    return answer === "Trust and connect";
  };
}

/** A changed server identity requires explicit consent for this host and port. */
export function changedHostKeyDialog(window) {
  return async (request, signal) => {
    if (signal?.aborted) return false;
    const answer = await window.showWarningMessage(
      `SSH host key changed: ${request.endpoint.label}`,
      { modal: true, detail: `A server migration may explain the key change. A different server or an attack is also possible.

Previous (${request.expected.algorithm}): ${request.expected.fingerprint}
New (${request.received.algorithm}): ${request.received.fingerprint}

Verify the new SHA256 fingerprint using the hosting provider’s server console or with the administrator. Alternatively, you can trust without verification. This risks sending credentials to a different server. Both options replace the saved key only for this host and port.` },
      "Verify new key …", "Trust without verification and connect");
    if (signal?.aborted) return false;
    if (answer === "Trust without verification and connect") return true;
    if (answer !== "Verify new key …") return false;
    const fingerprint = await window.showInputBox({
      title: `FileTandem: Confirm new host key for ${request.endpoint.label}`,
      prompt: "Enter the independently verified new SHA256 fingerprint. Confirming replaces the previous host key and allows the connection.",
      placeHolder: 'SHA256:…', ignoreFocusOut: true,
      validateInput: value => value.trim() === request.received.fingerprint ? undefined : "The fingerprint does not match the new server key."
    });
    return !signal?.aborted && fingerprint?.trim() === request.received.fingerprint;
  };
}
