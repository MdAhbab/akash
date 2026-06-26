import { Link } from 'react-router-dom';
import { BRAND } from '../lib/brand.js';

export default function Footer() {
  return (
    <footer className="relative mt-32 border-t border-hairline">
      <div className="shell py-16">
        <div className="grid gap-12 md:grid-cols-[1.5fr_1fr_1fr]">
          <div>
            <div className="font-display text-2xl font-semibold">{BRAND.name}</div>
            <p className="mt-3 max-w-xs text-sm text-muted">
              {BRAND.promise}
            </p>
            {/* Safety trust mark */}
            <div className="mt-6 inline-flex items-center gap-2 rounded-full border border-hairline px-3 py-1.5 text-xs text-muted">
              <span className="h-1.5 w-1.5 rounded-full bg-mint" />
              We will never ask for your PIN, OTP, or password.
            </div>
          </div>
          <div>
            <div className="label mb-4">Product</div>
            <ul className="space-y-2.5 text-sm text-muted">
              <li><Link to="/playground" className="transition hover:text-ink">Playground</Link></li>
              <li><Link to="/console" className="transition hover:text-ink">Command Center</Link></li>
              <li><Link to="/sentinel" className="transition hover:text-ink">Sentinel</Link></li>
              <li><Link to="/insights" className="transition hover:text-ink">Insights</Link></li>
            </ul>
          </div>
          <div>
            <div className="label mb-4">Reference</div>
            <ul className="space-y-2.5 text-sm text-muted">
              <li><Link to="/docs" className="transition hover:text-ink">API Docs · For Judges</Link></li>
              <li><a href={`${BRAND.publicBase}/health`} className="transition hover:text-ink" target="_blank" rel="noreferrer">Live /health</a></li>
              <li><a href={BRAND.repo} className="transition hover:text-ink" target="_blank" rel="noreferrer">GitHub repository</a></li>
              <li><Link to="/settings" className="transition hover:text-ink">Settings</Link></li>
            </ul>
          </div>
        </div>
        <div className="mt-14 flex flex-col items-start justify-between gap-3 border-t border-hairline pt-6 text-xs text-faint md:flex-row md:items-center">
          <span>© {BRAND.year} {BRAND.name} - bKash · Codex Community Hackathon</span>
          <span className="font-mono">FastAPI · MySQL · Gemini + GPT-4o · rules-first hybrid</span>
        </div>
      </div>
    </footer>
  );
}
