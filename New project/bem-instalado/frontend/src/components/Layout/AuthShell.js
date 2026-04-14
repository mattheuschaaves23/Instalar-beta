import BrandWordmark from './BrandWordmark';

export default function AuthShell({
  eyebrow,
  title,
  description,
  children,
  asideTitle,
  asideCopy,
  highlights = [],
  landingPoints = [],
  landingSteps = [],
  landingNote = '',
  landingAudienceBlocks = [],
  compact = false,
}) {
  return (
    <div className={`auth-scene auth-shell-wrap min-h-screen overflow-x-hidden px-4 md:px-6 lg:px-8 ${compact ? 'py-5' : 'py-8'}`}>
      <div
        className={`auth-shell-grid mx-auto grid max-w-6xl gap-6 ${
          compact
            ? 'min-h-[calc(100vh-2.5rem)] md:grid-cols-[minmax(0,1fr)_minmax(0,0.95fr)] md:items-center'
            : 'min-h-[calc(100vh-4rem)] lg:grid-cols-[minmax(0,1.02fr)_minmax(0,0.98fr)] lg:items-center'
        }`}
      >
        <section
          className={`auth-visual-panel lux-panel fade-up relative overflow-hidden ${
            compact ? 'order-2 hidden p-6 md:order-1 md:block lg:p-8' : 'p-7 sm:p-8 lg:p-10'
          }`}
        >
          <div className="auth-orb auth-orb-left" />
          <div className="auth-orb auth-orb-right" />

          <div className="relative z-10">
            <p className="eyebrow">{eyebrow}</p>
            <BrandWordmark className="mt-2" size={compact ? 'md' : 'lg'} />
            <h1 className={`auth-visual-title ${compact ? 'page-title text-[2.9rem]' : 'hero-title'} mt-4`}>{title}</h1>
            <p className="page-copy mt-4 max-w-xl">{description}</p>

            {landingAudienceBlocks.length > 0 ? (
              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                {landingAudienceBlocks.map((block) => (
                  <article className="auth-audience-card" key={block.title}>
                    <p className="auth-audience-kicker">{block.kicker}</p>
                    <h2 className="auth-audience-title">{block.title}</h2>
                    <div className="auth-audience-list">
                      {block.items.map((item) => (
                        <p className="auth-audience-item" key={item}>
                          {item}
                        </p>
                      ))}
                    </div>
                  </article>
                ))}
              </div>
            ) : null}

            {highlights.length > 0 ? (
              <div className="mt-6 grid gap-3 sm:grid-cols-3">
                {highlights.map((item) => (
                  <article className="auth-highlight-card" key={item.title}>
                    <p className="auth-highlight-kicker">{item.kicker}</p>
                    <h3 className="mt-2 text-base font-semibold text-[var(--text)]">{item.title}</h3>
                    <p className="mt-2 text-sm text-[var(--muted)]">{item.copy}</p>
                  </article>
                ))}
              </div>
            ) : null}

            {landingPoints.length > 0 ? (
              <div className="auth-landing-points mt-5">
                {landingPoints.map((point) => (
                  <span className="auth-landing-point" key={point}>
                    {point}
                  </span>
                ))}
              </div>
            ) : null}

            {!compact && landingSteps.length > 0 ? (
              <div className="auth-landing-steps mt-6">
                {landingSteps.map((step, index) => (
                  <article className="auth-landing-step" key={step.title}>
                    <p className="auth-landing-step-index">{String(index + 1).padStart(2, '0')}</p>
                    <h3 className="auth-landing-step-title">{step.title}</h3>
                    <p className="auth-landing-step-copy">{step.copy}</p>
                  </article>
                ))}
              </div>
            ) : null}

            {landingNote ? <p className="auth-landing-note mt-5">{landingNote}</p> : null}
          </div>
        </section>

        <section
          className={`auth-form-panel lux-panel fade-up mx-auto w-full overflow-hidden ${
            compact ? 'order-1 max-w-[36rem] p-5 sm:p-6 md:order-2' : 'max-w-[34rem] p-6 sm:p-8'
          }`}
          style={{ animationDelay: '0.1s' }}
        >
          <div className="auth-form-head">
            <p className="eyebrow">{asideTitle}</p>
            <BrandWordmark className="mt-2" size="sm" />
            <h2 className={`page-title mt-2 leading-none ${compact ? 'text-[2rem]' : 'text-[2.25rem]'}`}>{asideCopy}</h2>
            {compact ? <p className="auth-form-note mt-3">{description}</p> : null}
          </div>
          <div className={compact ? 'mt-5' : 'mt-7'}>{children}</div>
        </section>
      </div>
    </div>
  );
}
