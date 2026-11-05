// Distinct silhouettes remain recognizable without color and in selected rows.
export function FileIcon({kind}) {
  if (kind === 'symlink') return <span className="entry-icon codicon codicon-file-symlink-file" aria-hidden="true" />;
  return <svg className={`entry-icon ${kind === 'directory' ? 'entry-icon-folder':'entry-icon-file'}`} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    {kind === 'directory' ? <path fill="currentColor" d="M3 4h6l2 2h10a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Zm1 5v1h16V9Z" fillRule="evenodd" />:<g fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"><path d="M6 2.5h8l5 5v14H6Z" /><path d="M14 2.5v5h5M9 12h7M9 16h7" /></g>}
  </svg>;
}
