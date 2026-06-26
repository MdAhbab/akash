import { motion } from 'framer-motion';

// Editorial page header: "02 - Command Center" with a big display title.
export function PageHeader({ index, title, subtitle, kicker }) {
  return (
    <header className="pt-28 pb-10 md:pt-36 md:pb-14">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
      >
        <div className="label mb-4">
          {index ? `${index} - ` : ''}
          {kicker || title}
        </div>
        <h1 className="font-display text-[clamp(2.2rem,5vw,4rem)] font-semibold leading-[0.95] tracking-tightest">
          {title}
        </h1>
        {subtitle && <p className="mt-4 max-w-xl text-muted">{subtitle}</p>}
      </motion.div>
      <div className="hairline mt-8" />
    </header>
  );
}

export function Spinner({ size = 18 }) {
  return (
    <span
      className="inline-block animate-spin rounded-full border-2 border-hairline border-t-violet"
      style={{ width: size, height: size }}
    />
  );
}

export function PageLoader({ label = 'Loading' }) {
  return (
    <div className="flex items-center gap-3 py-20 text-muted">
      <Spinner /> <span className="text-sm">{label}…</span>
    </div>
  );
}
