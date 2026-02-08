import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const frontendDir = path.resolve(__dirname, '..')
const publicDir = path.join(frontendDir, 'public')

const SITE_URL = 'https://tradejaudit.com'
const OG_IMAGE = `${SITE_URL}/og/default-1200x630.png`
const OG_IMAGE_FALLBACK = `${SITE_URL}/og/default-fallback-1200x630.png`
const DEFAULT_LANG = 'en'
const TODAY = new Date().toISOString().slice(0, 10)

const navLabels = {
  en: {
    home: 'Home',
    features: 'Features',
    pricing: 'Pricing',
    about: 'About',
    terms: 'Terms',
    privacy: 'Privacy',
    cookies: 'Cookies',
    login: 'Login',
    register: 'Create account'
  },
  ro: {
    home: 'Acasa',
    features: 'Functionalitati',
    pricing: 'Preturi',
    about: 'Despre',
    terms: 'Termeni',
    privacy: 'Confidentialitate',
    cookies: 'Cookie-uri',
    login: 'Autentificare',
    register: 'Creeaza cont'
  }
}

const routeDefinitions = [
  {
    slug: '',
    key: 'home',
    includeJsonLd: true,
    en: {
      title: 'TradeJAudit | Trading Journal and Analytics Workspace',
      description:
        'Trading journal and analytics workspace for disciplined execution. Dashboard | Trades | Analytics | Calendar | Notebook | Insights. Educational scenarios and setups with clear criteria.',
      heading: 'Build trading discipline with a data-backed workflow',
      intro:
        'TradeJAudit helps you log trades, review decisions, and improve consistency through analytics, journaling, and structured post-session reviews.',
      bullets: [
        'Track execution quality with structured trade logs.',
        'Review behavior patterns using dashboard and analytics views.',
        'Use educational scenarios and setups with clear criteria.'
      ],
      ctaPrimary: 'Start free account',
      ctaSecondary: 'See features',
      note: 'Main areas: Dashboard | Trades | Analytics | Calendar | Notebook | Insights.'
    },
    ro: {
      title: 'TradeJAudit | Jurnal de Tranzactionare si Analiza',
      description:
        'Jurnal de tranzactionare si spatiu de analiza pentru executie disciplinata. Dashboard | Trades | Analytics | Calendar | Notebook | Insights. Scenarii educationale si set-up-uri cu criterii clare.',
      heading: 'Construieste disciplina cu un flux bazat pe date',
      intro:
        'TradeJAudit te ajuta sa inregistrezi tranzactii, sa revizuiesti decizii si sa imbunatatesti consistenta prin analiza, jurnalizare si revizii structurate.',
      bullets: [
        'Urmareste calitatea executiei cu jurnale de tranzactii structurate.',
        'Analizeaza tipare comportamentale cu dashboard si analytics.',
        'Foloseste scenarii educationale si set-up-uri cu criterii clare.'
      ],
      ctaPrimary: 'Creeaza cont gratuit',
      ctaSecondary: 'Vezi functionalitati',
      note: 'Zone principale: Dashboard | Trades | Analytics | Calendar | Notebook | Insights.'
    }
  },
  {
    slug: 'features',
    key: 'features',
    en: {
      title: 'Features | TradeJAudit',
      description:
        'Explore TradeJAudit features for trade journaling, analytics, calendar review, notebook workflows, and insight tracking. Dashboard | Trades | Analytics | Calendar | Notebook | Insights.',
      heading: 'Features built for repeatable execution',
      intro:
        'From quick trade logging to deep diagnostics, TradeJAudit focuses on process quality and evidence-based review.',
      bullets: [
        'Dashboard KPIs and equity curves for daily performance context.',
        'Trade, calendar, and analytics modules for structured feedback loops.',
        'Notebook and insights tools for setup notes, post-session lessons, and planning.'
      ],
      ctaPrimary: 'Create account',
      ctaSecondary: 'View pricing',
      note: 'Main areas in one workflow: Dashboard | Trades | Analytics | Calendar | Notebook | Insights.'
    },
    ro: {
      title: 'Functionalitati | TradeJAudit',
      description:
        'Descopera functionalitatile TradeJAudit pentru jurnalizare, analiza, calendar, notebook si urmarirea insight-urilor. Dashboard | Trades | Analytics | Calendar | Notebook | Insights.',
      heading: 'Functionalitati construite pentru executie repetabila',
      intro:
        'De la logare rapida pana la diagnoza aprofundata, TradeJAudit pune accent pe calitatea procesului si revizie bazata pe dovezi.',
      bullets: [
        'KPI-uri in dashboard si curbe de equity pentru context zilnic.',
        'Module Trades, Calendar si Analytics pentru bucle clare de feedback.',
        'Notebook si Insights pentru setup-uri, lectii post-sesiune si planificare.'
      ],
      ctaPrimary: 'Creeaza cont',
      ctaSecondary: 'Vezi preturi',
      note: 'Zone principale intr-un singur flux: Dashboard | Trades | Analytics | Calendar | Notebook | Insights.'
    }
  },
  {
    slug: 'pricing',
    key: 'pricing',
    en: {
      title: 'Pricing | TradeJAudit',
      description:
        'TradeJAudit pricing is built for transparent adoption: start with a free account and expand as your workflow grows. Dashboard | Trades | Analytics | Calendar | Notebook | Insights.',
      heading: 'Transparent pricing for serious journaling',
      intro:
        'Start with a free account and upgrade when your process needs advanced depth. No performance guarantees, only tools for disciplined review.',
      bullets: [
        'Free account onboarding for baseline journaling and review.',
        'Upgrade paths for deeper analytics and operational workflows.',
        'Designed for educational scenarios and setups with clear criteria.'
      ],
      ctaPrimary: 'Create account',
      ctaSecondary: 'Read about us',
      note: 'Core workflow: Dashboard | Trades | Analytics | Calendar | Notebook | Insights.'
    },
    ro: {
      title: 'Preturi | TradeJAudit',
      description:
        'Preturile TradeJAudit sunt concepute transparent: incepi cu cont gratuit si extinzi pe masura ce fluxul tau evolueaza. Dashboard | Trades | Analytics | Calendar | Notebook | Insights.',
      heading: 'Preturi transparente pentru jurnalizare serioasa',
      intro:
        'Incepi cu cont gratuit si extinzi cand ai nevoie de profunzime analitica. Fara promisiuni de randament, doar instrumente pentru revizie disciplinata.',
      bullets: [
        'Onboarding gratuit pentru jurnalizare si revizie de baza.',
        'Optiuni extinse pentru analize mai profunde si fluxuri operationale.',
        'Conceput pentru scenarii educationale si set-up-uri cu criterii clare.'
      ],
      ctaPrimary: 'Creeaza cont',
      ctaSecondary: 'Afla despre noi',
      note: 'Flux principal: Dashboard | Trades | Analytics | Calendar | Notebook | Insights.'
    }
  },
  {
    slug: 'about',
    key: 'about',
    en: {
      title: 'About TradeJAudit | Product Mission',
      description:
        'TradeJAudit is a technical trading journal and analytics product focused on process quality, decision review, and risk-aware execution.',
      heading: 'A product focused on process, not hype',
      intro:
        'TradeJAudit was designed to make decision review practical: log clearly, analyze consistently, and document lessons you can apply next session.',
      bullets: [
        'Built around repeatable workflows for journaling and post-trade review.',
        'Supports both structured metrics and qualitative notebook context.',
        'Promotes educational scenarios and clear setup criteria.'
      ],
      ctaPrimary: 'View features',
      ctaSecondary: 'Read pricing',
      note: 'TradeJAudit supports workflow quality; it does not provide investment advice.'
    },
    ro: {
      title: 'Despre TradeJAudit | Misiunea Produsului',
      description:
        'TradeJAudit este un produs tehnic de jurnalizare si analiza, concentrat pe calitatea procesului, revizia deciziilor si executia cu risc controlat.',
      heading: 'Un produs orientat pe proces, nu pe hype',
      intro:
        'TradeJAudit a fost conceput pentru revizie practica a deciziilor: loghezi clar, analizezi constant si documentezi lectii aplicabile.',
      bullets: [
        'Construit pe fluxuri repetabile pentru jurnalizare si revizie post-trade.',
        'Combina metrici structurate cu context calitativ in notebook.',
        'Promoveaza scenarii educationale si criterii clare pentru setup-uri.'
      ],
      ctaPrimary: 'Vezi functionalitati',
      ctaSecondary: 'Vezi preturi',
      note: 'TradeJAudit sustine calitatea fluxului de lucru; nu ofera sfaturi de investitii.'
    }
  },
  {
    slug: 'terms',
    key: 'terms',
    en: {
      title: 'Terms and Conditions | TradeJAudit',
      description:
        'Read TradeJAudit terms and conditions covering account responsibilities, acceptable use, and service scope.',
      heading: 'Terms and Conditions',
      intro:
        'These terms describe account responsibilities, acceptable use, and service boundaries for TradeJAudit.',
      bullets: [
        'Use must remain lawful and aligned with platform policy.',
        'Users keep ownership of their content while granting service operation rights.',
        'Service availability may change as features evolve.'
      ],
      ctaPrimary: 'Open app login',
      ctaSecondary: 'Privacy policy',
      note: 'Legal text should be reviewed by qualified counsel for your jurisdiction.'
    },
    ro: {
      title: 'Termeni si Conditii | TradeJAudit',
      description:
        'Citeste termenii si conditiile TradeJAudit despre responsabilitatile contului, utilizarea permisa si domeniul serviciului.',
      heading: 'Termeni si Conditii',
      intro:
        'Acesti termeni descriu responsabilitatile contului, utilizarea permisa si limitele serviciului TradeJAudit.',
      bullets: [
        'Utilizarea trebuie sa ramana legala si conforma cu politica platformei.',
        'Utilizatorii isi pastreaza proprietatea asupra continutului, cu drepturi limitate de operare.',
        'Disponibilitatea serviciului poate varia pe masura evolutiei functionalitatilor.'
      ],
      ctaPrimary: 'Deschide autentificarea',
      ctaSecondary: 'Politica de confidentialitate',
      note: 'Textul legal trebuie revizuit de consultanta juridica calificata pentru jurisdictia ta.'
    }
  },
  {
    slug: 'privacy',
    key: 'privacy',
    en: {
      title: 'Privacy Policy | TradeJAudit',
      description:
        'Read TradeJAudit privacy policy on collected data, usage, retention, safeguards, and user rights.',
      heading: 'Privacy Policy',
      intro:
        'This page summarizes what data is processed, why it is needed, and which rights users can exercise.',
      bullets: [
        'Data is used for account security, platform reliability, and product operation.',
        'TradeJAudit does not sell personal data.',
        'Users can request access, correction, export, or deletion where applicable.'
      ],
      ctaPrimary: 'Open app login',
      ctaSecondary: 'Cookie policy',
      note: 'Processing details should be aligned with legal counsel for your jurisdiction.'
    },
    ro: {
      title: 'Politica de Confidentialitate | TradeJAudit',
      description:
        'Citeste politica de confidentialitate TradeJAudit despre date colectate, utilizare, retentie, protectie si drepturile utilizatorului.',
      heading: 'Politica de Confidentialitate',
      intro:
        'Aceasta pagina rezuma ce date sunt prelucrate, de ce sunt necesare si ce drepturi poti exercita.',
      bullets: [
        'Datele sunt folosite pentru securitatea contului, fiabilitate si operarea platformei.',
        'TradeJAudit nu vinde date personale.',
        'Utilizatorii pot solicita acces, corectare, export sau stergere unde este aplicabil.'
      ],
      ctaPrimary: 'Deschide autentificarea',
      ctaSecondary: 'Politica cookie-uri',
      note: 'Detaliile de prelucrare trebuie aliniate cu consultanta juridica pentru jurisdictia aplicabila.'
    }
  },
  {
    slug: 'cookies',
    key: 'cookies',
    en: {
      title: 'Cookie Policy | TradeJAudit',
      description:
        'Read TradeJAudit cookie policy on session security, preference storage, and performance-related cookies.',
      heading: 'Cookie Policy',
      intro:
        'TradeJAudit uses cookies primarily for secure sessions, preference persistence, and performance monitoring.',
      bullets: [
        'Essential cookies support authentication and session continuity.',
        'Preference cookies keep language and interface settings consistent.',
        'Performance cookies help improve loading and stability.'
      ],
      ctaPrimary: 'Open app login',
      ctaSecondary: 'Terms and conditions',
      note: 'Cookie usage should be reviewed against local compliance requirements.'
    },
    ro: {
      title: 'Politica de Cookie-uri | TradeJAudit',
      description:
        'Citeste politica TradeJAudit privind cookie-urile pentru securitatea sesiunii, stocarea preferintelor si monitorizarea performantei.',
      heading: 'Politica de Cookie-uri',
      intro:
        'TradeJAudit foloseste cookie-uri in principal pentru securitatea sesiunilor, persistenta preferintelor si monitorizare de performanta.',
      bullets: [
        'Cookie-urile esentiale sustin autentificarea si continuitatea sesiunii.',
        'Cookie-urile de preferinta pastreaza limba si setarile interfetei.',
        'Cookie-urile de performanta ajuta la imbunatatirea vitezei si stabilitatii.'
      ],
      ctaPrimary: 'Deschide autentificarea',
      ctaSecondary: 'Termeni si conditii',
      note: 'Utilizarea cookie-urilor trebuie verificata in raport cu cerintele locale de conformitate.'
    }
  }
]

const localeToOg = {
  en: 'en_US',
  ro: 'ro_RO'
}

const languageLabel = {
  en: 'English',
  ro: 'Romana'
}

const routeLinkByKey = {
  home: '',
  features: 'features',
  pricing: 'pricing',
  about: 'about',
  terms: 'terms',
  privacy: 'privacy',
  cookies: 'cookies'
}

const dirTargets = [path.join(publicDir, 'en'), path.join(publicDir, 'ro')]
for (const target of dirTargets) {
  rmSync(target, { recursive: true, force: true })
}

const normalizePublicPath = (language, slug) => {
  const base = `/${language}`
  if (!slug) return `${base}/`
  return `${base}/${slug}/`
}

const toFileSystemPath = (publicPath) => {
  const trimmed = publicPath.replace(/^\//, '')
  return path.join(publicDir, trimmed)
}

const buildNav = (language) => {
  const labels = navLabels[language]
  const items = ['home', 'features', 'pricing', 'about', 'terms', 'privacy', 'cookies']
  return items
    .map((item) => {
      const href = normalizePublicPath(language, routeLinkByKey[item])
      return `<a href="${href}">${labels[item]}</a>`
    })
    .join('')
}

const buildJsonLd = (language, homePath) => {
  const softwareDescription = language === 'ro'
    ? 'Aplicatie de jurnal de tranzactionare si analiza pentru fluxuri disciplinate.'
    : 'Trading journal and analytics application for disciplined workflows.'

  const appName = 'TradeJAudit'

  const payload = [
    {
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: appName,
      url: SITE_URL,
      logo: `${SITE_URL}/android-chrome-512x512.png`
    },
    {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: appName,
      url: SITE_URL,
      inLanguage: language === 'ro' ? 'ro-RO' : 'en-US'
    },
    {
      '@context': 'https://schema.org',
      '@type': 'SoftwareApplication',
      name: appName,
      applicationCategory: 'FinanceApplication',
      operatingSystem: 'Web',
      url: `${SITE_URL}${homePath}`,
      inLanguage: language === 'ro' ? 'ro-RO' : 'en-US',
      description: softwareDescription,
      offers: {
        '@type': 'Offer',
        price: '0',
        priceCurrency: 'USD',
        description: language === 'ro' ? 'Cont gratuit disponibil.' : 'Free account available.'
      }
    }
  ]

  return `<script type="application/ld+json">${JSON.stringify(payload)}</script>`
}

const buildHtml = ({ language, page }) => {
  const current = page[language]
  const alternateLanguage = language === 'en' ? 'ro' : 'en'
  const route = normalizePublicPath(language, page.slug)
  const alternateRoute = normalizePublicPath(alternateLanguage, page.slug)
  const canonicalUrl = `${SITE_URL}${route}`
  const alternateUrl = `${SITE_URL}${alternateRoute}`
  const defaultUrl = `${SITE_URL}${normalizePublicPath(DEFAULT_LANG, page.slug)}`
  const ogLocale = localeToOg[language]
  const ogAltLocale = localeToOg[alternateLanguage]
  const labels = navLabels[language]
  const ctaPrimaryHref = page.key === 'home' || page.key === 'features' || page.key === 'pricing' || page.key === 'about'
    ? '/register'
    : '/login'

  let ctaSecondaryHref = normalizePublicPath(language, 'features')
  if (page.key === 'features') ctaSecondaryHref = normalizePublicPath(language, 'pricing')
  if (page.key === 'pricing') ctaSecondaryHref = normalizePublicPath(language, 'about')
  if (page.key === 'about') ctaSecondaryHref = normalizePublicPath(language, 'pricing')
  if (page.key === 'terms') ctaSecondaryHref = normalizePublicPath(language, 'privacy')
  if (page.key === 'privacy') ctaSecondaryHref = normalizePublicPath(language, 'cookies')
  if (page.key === 'cookies') ctaSecondaryHref = normalizePublicPath(language, 'terms')

  const jsonLd = page.includeJsonLd ? buildJsonLd(language, route) : ''

  return `<!doctype html>
<html lang="${language}">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${current.title}</title>
  <meta name="description" content="${current.description}" />
  <meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1" />
  <link rel="canonical" href="${canonicalUrl}" />
  <link rel="alternate" hreflang="en" href="${SITE_URL}${normalizePublicPath('en', page.slug)}" />
  <link rel="alternate" hreflang="ro" href="${SITE_URL}${normalizePublicPath('ro', page.slug)}" />
  <link rel="alternate" hreflang="x-default" href="${SITE_URL}${normalizePublicPath(DEFAULT_LANG, page.slug)}" />

  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="TradeJAudit" />
  <meta property="og:title" content="${current.title}" />
  <meta property="og:description" content="${current.description}" />
  <meta property="og:url" content="${canonicalUrl}" />
  <meta property="og:image" content="${OG_IMAGE}" />
  <meta property="og:image" content="${OG_IMAGE_FALLBACK}" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta property="og:image:alt" content="TradeJAudit main areas: Dashboard, Trades, Analytics, Calendar, Notebook, Insights." />
  <meta property="og:locale" content="${ogLocale}" />
  <meta property="og:locale:alternate" content="${ogAltLocale}" />

  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${current.title}" />
  <meta name="twitter:description" content="${current.description}" />
  <meta name="twitter:image" content="${OG_IMAGE}" />

  <meta name="theme-color" content="#0e1a33" />
  ${jsonLd}
  <style>
    :root {
      color-scheme: light;
      --bg: #f3f6fc;
      --surface: #ffffff;
      --ink: #10213f;
      --muted: #5c6f8f;
      --accent: #1d6eff;
      --border: #d8e3f7;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: radial-gradient(circle at top right, #dce8ff, var(--bg) 55%);
      color: var(--ink);
      line-height: 1.55;
    }
    .wrap {
      width: min(960px, calc(100% - 32px));
      margin: 0 auto;
      padding: 18px 0 38px;
    }
    header {
      display: flex;
      flex-wrap: wrap;
      justify-content: space-between;
      gap: 14px;
      align-items: center;
      margin-bottom: 20px;
      padding-bottom: 14px;
      border-bottom: 1px solid var(--border);
    }
    .brand {
      font-weight: 700;
      letter-spacing: 0.2px;
    }
    nav {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
    }
    nav a,
    .lang a,
    .auth a,
    .cta a {
      text-decoration: none;
      color: var(--ink);
      font-weight: 500;
      border: 1px solid transparent;
      border-radius: 999px;
      padding: 6px 12px;
    }
    nav a:hover,
    .lang a:hover,
    .auth a:hover,
    .cta a:hover {
      border-color: var(--border);
      background: #eef4ff;
    }
    .lang,
    .auth {
      display: flex;
      gap: 8px;
    }
    .panel {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 16px;
      padding: 24px;
      box-shadow: 0 10px 25px rgba(9, 24, 56, 0.08);
    }
    h1 {
      margin: 0;
      font-size: clamp(1.6rem, 3vw, 2.35rem);
      line-height: 1.2;
    }
    p { margin: 10px 0 0; color: var(--muted); }
    ul {
      margin: 16px 0 0;
      padding-left: 18px;
      color: var(--ink);
    }
    li + li { margin-top: 8px; }
    .note {
      margin-top: 16px;
      padding: 12px;
      border-left: 3px solid var(--accent);
      background: #f5f8ff;
      color: var(--ink);
      border-radius: 8px;
      font-size: 0.96rem;
    }
    .cta {
      margin-top: 18px;
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
    }
    .cta a.primary {
      background: var(--accent);
      border-color: var(--accent);
      color: #fff;
      font-weight: 700;
    }
    .meta {
      margin-top: 24px;
      font-size: 0.9rem;
      color: var(--muted);
      display: flex;
      flex-wrap: wrap;
      gap: 16px;
      justify-content: space-between;
    }
    .meta a { color: inherit; }
    @media (max-width: 720px) {
      header { flex-direction: column; align-items: flex-start; }
      .panel { padding: 20px; }
    }
  </style>
</head>
<body>
  <div class="wrap">
    <header>
      <div>
        <div class="brand">TradeJAudit</div>
        <small>${language === 'ro' ? 'Jurnal si analiza pentru executie disciplinata' : 'Journal and analytics for disciplined execution'}</small>
      </div>
      <nav aria-label="Public navigation">${buildNav(language)}</nav>
      <div class="lang">
        <a href="${route}">${languageLabel[language]}</a>
        <a href="${alternateRoute}">${languageLabel[alternateLanguage]}</a>
      </div>
      <div class="auth">
        <a href="/login?lang=${language}">${labels.login}</a>
        <a href="/register?lang=${language}">${labels.register}</a>
      </div>
    </header>

    <main class="panel">
      <h1>${current.heading}</h1>
      <p>${current.intro}</p>
      <ul>
        ${current.bullets.map((item) => `<li>${item}</li>`).join('')}
      </ul>
      <div class="note">${current.note}</div>
      <div class="cta">
        <a class="primary" href="${ctaPrimaryHref}${ctaPrimaryHref.includes('?') ? '' : `?lang=${language}`}">${current.ctaPrimary}</a>
        <a href="${ctaSecondaryHref}">${current.ctaSecondary}</a>
      </div>
    </main>

    <div class="meta">
      <span>Canonical: <a href="${canonicalUrl}">${canonicalUrl}</a></span>
      <span>Alternate: <a href="${alternateUrl}">${alternateUrl}</a></span>
      <span>Default: <a href="${defaultUrl}">${defaultUrl}</a></span>
      <span>Updated: ${TODAY}</span>
    </div>
  </div>
</body>
</html>`
}

const allPublicPaths = []

for (const language of ['en', 'ro']) {
  for (const page of routeDefinitions) {
    const route = normalizePublicPath(language, page.slug)
    const outDir = toFileSystemPath(route)
    mkdirSync(outDir, { recursive: true })
    const html = buildHtml({ language, page })
    writeFileSync(path.join(outDir, 'index.html'), html)
    allPublicPaths.push(route)
  }
}

const robots = `User-agent: *
Allow: /
Disallow: /dashboard
Disallow: /trades
Disallow: /calendar
Disallow: /notebook
Disallow: /insights
Disallow: /analytics
Disallow: /settings
Disallow: /profile
Disallow: /admin
Disallow: /login
Disallow: /register
Disallow: /forgot-password
Disallow: /reset-password
Disallow: /verify
Disallow: /check-email
Disallow: /api/

Sitemap: ${SITE_URL}/sitemap.xml
`

writeFileSync(path.join(publicDir, 'robots.txt'), robots)

const sitemapRows = allPublicPaths
  .sort()
  .map((route) => `  <url><loc>${SITE_URL}${route}</loc><lastmod>${TODAY}</lastmod></url>`)
  .join('\n')

const sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sitemapRows}
</urlset>
`

writeFileSync(path.join(publicDir, 'sitemap.xml'), sitemapXml)

console.log(`Generated SEO public pages for ${allPublicPaths.length} routes.`)
