export default function PageIntro({
  eyebrow = 'InstaLar',
  title,
  description,
  actions,
  stats = [],
}) {
  return (
    <section className="page-intro-grid grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1.2fr)_350px] xl:items-end">
      <div className="page-intro-main lux-panel fade-up min-w-0 overflow-hidden p-6 sm:p-7">
        <div className="relative z-10 min-w-0">
          <p className="eyebrow">{eyebrow}</p>
          <h1 className="page-title mt-3 max-w-4xl">{title}</h1>
          <p className="page-copy mt-4 max-w-2xl break-words">{description}</p>
          {actions ? <div className="page-intro-actions mt-6 flex flex-wrap gap-3">{actions}</div> : null}
        </div>
      </div>

      <div className="page-intro-stats grid min-w-0 gap-3 sm:grid-cols-3 xl:grid-cols-1">
        {stats.map((stat, index) => (
          <article
            className="metric-card fade-up min-w-0 !p-5"
            key={`${stat.label}-${index}`}
            style={{ animationDelay: `${index * 0.08}s` }}
          >
            <p className="break-words text-[0.68rem] uppercase tracking-[0.18em] text-[var(--muted)]">
              {stat.label}
            </p>
            <p className="metric-value mt-2 break-words">{stat.value}</p>
            {stat.detail ? <p className="mt-2 break-words text-sm text-[var(--muted)]">{stat.detail}</p> : null}
          </article>
        ))}
      </div>
    </section>
  );
}
