import { useState } from 'react';

// Minimal syntax-tinted JSON panel with copy.
function tint(json) {
  return json
    .replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d+)?)/g, (m) => {
      let cls = 'text-mint'; // number
      if (/^"/.test(m)) cls = /:$/.test(m) ? 'text-violet' : 'text-ink';
      else if (/true|false|null/.test(m)) cls = 'text-magenta';
      return `<span class="${cls}">${m}</span>`;
    });
}

export function JsonViewer({ data, className = '' }) {
  const [copied, setCopied] = useState(false);
  const json = JSON.stringify(data, null, 2);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(json);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch { /* ignore */ }
  };
  return (
    <div className={`relative rounded-2xl border border-hairline bg-base/60 ${className}`}>
      <div className="flex items-center justify-between border-b border-hairline px-4 py-2">
        <span className="label">response.json</span>
        <button onClick={copy} className="text-xs font-medium text-muted transition hover:text-ink">
          {copied ? 'copied ✓' : 'copy'}
        </button>
      </div>
      <pre
        className="max-h-[420px] overflow-auto p-4 font-mono text-[13px] leading-relaxed tnum"
        dangerouslySetInnerHTML={{ __html: tint(json) }}
      />
    </div>
  );
}
