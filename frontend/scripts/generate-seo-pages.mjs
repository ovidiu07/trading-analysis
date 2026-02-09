import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const frontendDir = path.resolve(__dirname, '..')
const publicDir = path.join(frontendDir, 'public')

const SITE_URL = 'https://tradejaudit.com'
const OG_IMAGE_VERSION = '20260209'
const OG_IMAGE = `${SITE_URL}/og/tradejaudit-1200x630.jpg?v=${OG_IMAGE_VERSION}`
const OG_IMAGE_FALLBACK = `${SITE_URL}/og/tradejaudit-600x315.jpg?v=${OG_IMAGE_VERSION}`
const DEFAULT_LANG = 'en'
const TODAY = new Date().toISOString().slice(0, 10)

const i18nPayload = {
  en: JSON.parse(readFileSync(path.join(frontendDir, 'src/i18n/en.json'), 'utf8')),
  ro: JSON.parse(readFileSync(path.join(frontendDir, 'src/i18n/ro.json'), 'utf8'))
}

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
    register: 'Create account',
    language: 'Language'
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
    register: 'Creeaza cont',
    language: 'Limba'
  }
}

const routeDefinitions = [
  {
    slug: '',
    key: 'home',
    includeJsonLd: true,
    en: {
      title: 'TradeJAudit - Trading Journal + Analytics',
      description:
        'Journal trades, review execution, and see analytics that highlight what works. Built for beginners and active traders: clear setups, insights, scenarios, and education.',
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
      title: 'TradeJAudit - Jurnal de Tranzactionare + Analytics',
      description:
        'Jurnalizeaza tranzactiile, analizeaza executia si vezi statistici clare despre ce functioneaza. Pentru incepatori si traderi activi: setup-uri, insight-uri, scenarii si educatie continua.',
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

const pageBlueprints = {
  home: {
    en: {
      heroBadge: 'Trading Journal + Analytics',
      sectionTitle: 'Built for beginners and active traders',
      sectionBody: 'A clean workflow for execution, review, and learning consistency.',
      mainAreasTitle: 'Main areas',
      socialProof: 'Built for beginners + active traders who want repeatable routines, not hype.',
      finalCtaTitle: 'Start your review system in minutes'
    },
    ro: {
      heroBadge: 'Jurnal de Trading + Analiza',
      sectionTitle: 'Construit pentru incepatori si traderi activi',
      sectionBody: 'Un flux clar pentru executie, revizie si invatare constanta.',
      mainAreasTitle: 'Zone principale',
      socialProof: 'Construit pentru incepatori + traderi activi care vor rutina repetabila, nu hype.',
      finalCtaTitle: 'Porneste sistemul tau de revizie in cateva minute'
    }
  },
  features: {
    en: {
      heroBadge: 'Feature Overview',
      outcomesTitle: 'Organized by outcomes',
      outcomes: [
        {
          title: 'Execution',
          items: [
            'Log structured trades quickly with consistent fields.',
            'Capture setup, risk, and context before and after execution.',
            'Track symbols, tags, and notes for clean recall.'
          ]
        },
        {
          title: 'Review',
          items: [
            'Inspect KPIs, equity path, and grouped performance.',
            'Use calendar and analytics views for behavior pattern review.',
            'Turn observations into action points for the next session.'
          ]
        },
        {
          title: 'Education',
          items: [
            'Store structured playbooks and checklist-style notes.',
            'Publish strategy and weekly-plan insights to your team.',
            'Reinforce process quality with repeatable study loops.'
          ]
        }
      ]
    },
    ro: {
      heroBadge: 'Prezentare functionalitati',
      outcomesTitle: 'Grupate pe rezultate',
      outcomes: [
        {
          title: 'Executie',
          items: [
            'Loghezi tranzactii structurate rapid, cu campuri consistente.',
            'Salvezi setup, risc si context inainte si dupa executie.',
            'Urmaresti simboluri, etichete si note pentru revizie clara.'
          ]
        },
        {
          title: 'Revizie',
          items: [
            'Inspectezi KPI-uri, curba de equity si performanta pe intervale.',
            'Folosesti calendar si analytics pentru tipare comportamentale.',
            'Transformi observatiile in actiuni pentru sesiunea urmatoare.'
          ]
        },
        {
          title: 'Educatie',
          items: [
            'Pastrezi playbook-uri structurate si checklist-uri practice.',
            'Publici strategii si planuri saptamanale pentru echipa.',
            'Consolidezi disciplina prin bucle repetabile de invatare.'
          ]
        }
      ]
    }
  },
  pricing: {
    en: {
      heroBadge: 'Plans',
      tiers: [
        {
          name: 'Start free',
          price: '$0',
          period: '/month',
          featured: true,
          bullets: [
            'Core journaling workflow',
            'Dashboard, trades, and basic review',
            'No credit card required'
          ],
          cta: 'Start free'
        },
        {
          name: 'Pro workflow',
          price: '$19',
          period: '/month',
          featured: false,
          bullets: [
            'Deeper analytics context',
            'Expanded notebook and insight tools',
            'Priority feature access'
          ],
          cta: 'Upgrade to Pro'
        },
        {
          name: 'Team',
          price: 'Custom',
          period: '',
          featured: false,
          bullets: [
            'Shared educational workflows',
            'Team-ready content publishing',
            'Operational support options'
          ],
          cta: 'Contact us'
        }
      ],
      tiersTitle: 'Choose the right depth for your workflow'
    },
    ro: {
      heroBadge: 'Planuri',
      tiers: [
        {
          name: 'Start gratuit',
          price: '$0',
          period: '/luna',
          featured: true,
          bullets: [
            'Flux de jurnalizare de baza',
            'Dashboard, tranzactii si revizie initiala',
            'Fara card necesar'
          ],
          cta: 'Incepe gratuit'
        },
        {
          name: 'Pro workflow',
          price: '$19',
          period: '/luna',
          featured: false,
          bullets: [
            'Context analitic mai profund',
            'Notebook si insights extinse',
            'Acces prioritar la functionalitati'
          ],
          cta: 'Treci la Pro'
        },
        {
          name: 'Team',
          price: 'Personalizat',
          period: '',
          featured: false,
          bullets: [
            'Fluxuri educationale comune',
            'Publicare de continut pentru echipa',
            'Optiuni de suport operational'
          ],
          cta: 'Contacteaza-ne'
        }
      ],
      tiersTitle: 'Alege nivelul potrivit pentru fluxul tau'
    }
  },
  about: {
    en: {
      heroBadge: 'About TradeJAudit',
      valuesTitle: 'How the product is shaped',
      values: [
        {
          title: 'Process over prediction',
          body: 'The platform is focused on execution quality, review quality, and risk awareness.'
        },
        {
          title: 'Structured + qualitative',
          body: 'Metrics and notes work together so numbers and context stay connected.'
        },
        {
          title: 'Educational by design',
          body: 'Insights, plans, and playbooks are built to support practical learning loops.'
        }
      ]
    },
    ro: {
      heroBadge: 'Despre TradeJAudit',
      valuesTitle: 'Cum este construit produsul',
      values: [
        {
          title: 'Proces inainte de predictie',
          body: 'Platforma este orientata spre calitatea executiei, reviziei si controlului riscului.'
        },
        {
          title: 'Structurat + calitativ',
          body: 'Metricile si notele functioneaza impreuna pentru a lega cifrele de context.'
        },
        {
          title: 'Educational din constructie',
          body: 'Insights, planuri si playbook-uri sustin bucle practice de invatare.'
        }
      ]
    }
  },
  legal: {
    en: {
      heroBadge: 'Legal',
      keyPoints: 'Key points',
      tocTitle: 'On this page',
      sectionLabel: 'Section',
      fullTextTitle: 'Detailed sections',
      mobileTocLabel: 'Jump to section'
    },
    ro: {
      heroBadge: 'Juridic',
      keyPoints: 'Puncte cheie',
      tocTitle: 'Pe aceasta pagina',
      sectionLabel: 'Sectiune',
      fullTextTitle: 'Sectiuni detaliate',
      mobileTocLabel: 'Mergi la sectiune'
    }
  }
}

const mainAreas = {
  en: ['Dashboard', 'Trades', 'Analytics', 'Calendar', 'Notebook', 'Insights'],
  ro: ['Dashboard', 'Tranzactii', 'Analiza', 'Calendar', 'Caiet', 'Insights']
}

const legalPages = new Set(['terms', 'privacy', 'cookies'])

const legalSections = {
  en: {
    terms: Object.values(i18nPayload.en.legal.terms.sections || {}),
    privacy: Object.values(i18nPayload.en.legal.privacy.sections || {}),
    cookies: Object.values(i18nPayload.en.legal.cookies.sections || {})
  },
  ro: {
    terms: Object.values(i18nPayload.ro.legal.terms.sections || {}),
    privacy: Object.values(i18nPayload.ro.legal.privacy.sections || {}),
    cookies: Object.values(i18nPayload.ro.legal.cookies.sections || {})
  }
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

const escapeHtml = (value) => String(value)
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#39;')

const toSlug = (value) => value
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')

const buildJsonLd = (language, homePath) => {
  const softwareDescription = language === 'ro'
    ? 'Aplicatie de jurnal de tranzactionare si analiza pentru fluxuri disciplinate.'
    : 'Trading journal and analytics application for disciplined workflows.'

  const payload = [
    {
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: 'TradeJAudit',
      url: SITE_URL,
      logo: `${SITE_URL}/android-chrome-512x512.png`
    },
    {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: 'TradeJAudit',
      url: SITE_URL,
      inLanguage: language === 'ro' ? 'ro-RO' : 'en-US'
    },
    {
      '@context': 'https://schema.org',
      '@type': 'SoftwareApplication',
      name: 'TradeJAudit',
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

const buildNav = (language, pageKey) => {
  const labels = navLabels[language]
  const items = ['home', 'features', 'pricing', 'about']
  return items
    .map((item) => {
      const href = normalizePublicPath(language, routeLinkByKey[item])
      const activeClass = item === pageKey ? ' is-active' : ''
      return `<a class="nav-link${activeClass}" href="${href}">${escapeHtml(labels[item])}</a>`
    })
    .join('')
}

const buildLanguageLinks = (language, pageSlug) => {
  const alternateLanguage = language === 'en' ? 'ro' : 'en'
  return {
    current: normalizePublicPath(language, pageSlug),
    alternate: normalizePublicPath(alternateLanguage, pageSlug),
    alternateLanguage
  }
}

const buildPrimaryCtaHref = (language, pageKey) => {
  const base = legalPages.has(pageKey) ? '/login' : '/register'
  return `${base}?lang=${language}`
}

const buildSecondaryCtaHref = (language, pageKey) => {
  const secondaryByPage = {
    home: 'features',
    features: 'pricing',
    pricing: 'about',
    about: 'pricing',
    terms: 'privacy',
    privacy: 'cookies',
    cookies: 'terms'
  }
  const slug = secondaryByPage[pageKey]
  return normalizePublicPath(language, slug)
}

const buildHeader = (language, page) => {
  const labels = navLabels[language]
  const langLinks = buildLanguageLinks(language, page.slug)

  return `
    <header class="site-header">
      <div class="site-container header-shell">
        <a class="brand" href="${normalizePublicPath(language, '')}">
          <span class="brand-logo" aria-hidden="true">TJ</span>
          <span>
            <strong>TradeJAudit</strong>
            <small>${escapeHtml(language === 'ro' ? 'Jurnal si analiza pentru executie disciplinata' : 'Journal and analytics for disciplined execution')}</small>
          </span>
        </a>

        <nav class="desktop-nav" aria-label="Public navigation">
          ${buildNav(language, page.key)}
        </nav>

        <div class="desktop-actions">
          <div class="language-switch" aria-label="${escapeHtml(labels.language)}">
            <a class="chip-link is-active" href="${langLinks.current}">${escapeHtml(languageLabel[language])}</a>
            <a class="chip-link" href="${langLinks.alternate}">${escapeHtml(languageLabel[langLinks.alternateLanguage])}</a>
          </div>
          <a class="button button-ghost" href="/login?lang=${language}">${escapeHtml(labels.login)}</a>
          <a class="button button-primary" href="/register?lang=${language}">${escapeHtml(labels.register)}</a>
        </div>

        <button class="menu-toggle" type="button" aria-expanded="false" aria-controls="mobile-menu" data-menu-toggle>
          <span class="menu-toggle-label">Menu</span>
          <span aria-hidden="true">☰</span>
        </button>
      </div>

      <div class="mobile-menu" id="mobile-menu" data-mobile-menu>
        <div class="site-container mobile-menu-inner">
          <nav aria-label="Mobile navigation" class="mobile-nav-links">
            ${buildNav(language, page.key)}
          </nav>
          <div class="mobile-menu-utility">
            <div class="language-switch" aria-label="${escapeHtml(labels.language)}">
              <a class="chip-link is-active" href="${langLinks.current}">${escapeHtml(languageLabel[language])}</a>
              <a class="chip-link" href="${langLinks.alternate}">${escapeHtml(languageLabel[langLinks.alternateLanguage])}</a>
            </div>
            <div class="mobile-cta-row">
              <a class="button button-ghost" href="/login?lang=${language}">${escapeHtml(labels.login)}</a>
              <a class="button button-primary" href="/register?lang=${language}">${escapeHtml(labels.register)}</a>
            </div>
          </div>
        </div>
      </div>
    </header>
  `
}

const buildFooter = (language) => {
  const labels = navLabels[language]
  return `
    <footer class="site-footer">
      <div class="site-container footer-shell">
        <p class="footer-copy">${escapeHtml(language === 'ro' ? 'Doar pentru jurnal si analiza. Nu reprezinta sfat de investitii.' : 'For journaling and analytics only. Not investment advice.')}</p>
        <nav class="footer-links" aria-label="Legal links">
          <a href="${normalizePublicPath(language, 'terms')}">${escapeHtml(labels.terms)}</a>
          <a href="${normalizePublicPath(language, 'privacy')}">${escapeHtml(labels.privacy)}</a>
          <a href="${normalizePublicPath(language, 'cookies')}">${escapeHtml(labels.cookies)}</a>
        </nav>
      </div>
    </footer>
  `
}

const renderHero = (language, page, current) => {
  const isLegal = legalPages.has(page.key)
  const blueprint = isLegal
    ? pageBlueprints.legal[language]
    : pageBlueprints[page.key]?.[language]

  const badge = blueprint?.heroBadge || 'TradeJAudit'
  const ctaPrimaryHref = buildPrimaryCtaHref(language, page.key)
  const ctaSecondaryHref = buildSecondaryCtaHref(language, page.key)

  return `
    <section class="section hero" aria-labelledby="hero-title">
      <div class="hero-grid">
        <article class="hero-content card">
          <p class="hero-badge">${escapeHtml(badge)}</p>
          <h1 id="hero-title">${escapeHtml(current.heading)}</h1>
          <p class="hero-intro">${escapeHtml(current.intro)}</p>
          <div class="hero-actions">
            <a class="button button-primary" href="${ctaPrimaryHref}">${escapeHtml(current.ctaPrimary)}</a>
            <a class="button button-ghost" href="${ctaSecondaryHref}">${escapeHtml(current.ctaSecondary)}</a>
          </div>
        </article>

        <aside class="hero-side card" aria-label="${escapeHtml(language === 'ro' ? 'Rezumat rapid' : 'Quick summary')}">
          <h2>${escapeHtml(language === 'ro' ? 'Ce obtii' : 'What you get')}</h2>
          <ul>
            ${current.bullets.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}
          </ul>
          <p class="hero-note">${escapeHtml(current.note)}</p>
        </aside>
      </div>
    </section>
  `
}

const renderHome = (language, current) => {
  const blueprint = pageBlueprints.home[language]
  return `
    <section class="section" aria-labelledby="benefits-title">
      <div class="section-heading">
        <h2 id="benefits-title">${escapeHtml(blueprint.sectionTitle)}</h2>
        <p>${escapeHtml(blueprint.sectionBody)}</p>
      </div>
      <div class="card-grid card-grid-3">
        ${current.bullets.map((item) => `
          <article class="card card-soft">
            <h3>${escapeHtml(language === 'ro' ? 'Beneficiu' : 'Benefit')}</h3>
            <p>${escapeHtml(item)}</p>
          </article>
        `).join('')}
      </div>
    </section>

    <section class="section" aria-labelledby="areas-title">
      <div class="section-heading">
        <h2 id="areas-title">${escapeHtml(blueprint.mainAreasTitle)}</h2>
      </div>
      <div class="chip-grid">
        ${mainAreas[language].map((item) => `<span class="chip-item">${escapeHtml(item)}</span>`).join('')}
      </div>
      <p class="section-note">${escapeHtml(blueprint.socialProof)}</p>
    </section>

    <section class="section">
      <div class="cta-panel card">
        <h2>${escapeHtml(blueprint.finalCtaTitle)}</h2>
        <p>${escapeHtml(current.intro)}</p>
        <div class="hero-actions">
          <a class="button button-primary" href="/register?lang=${language}">${escapeHtml(current.ctaPrimary)}</a>
          <a class="button button-ghost" href="${normalizePublicPath(language, 'features')}">${escapeHtml(current.ctaSecondary)}</a>
        </div>
      </div>
    </section>
  `
}

const renderFeatures = (language, current) => {
  const blueprint = pageBlueprints.features[language]
  return `
    <section class="section" aria-labelledby="outcomes-title">
      <div class="section-heading">
        <h2 id="outcomes-title">${escapeHtml(blueprint.outcomesTitle)}</h2>
      </div>
      <div class="card-grid card-grid-3">
        ${blueprint.outcomes.map((group) => `
          <article class="card">
            <h3>${escapeHtml(group.title)}</h3>
            <ul>
              ${group.items.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}
            </ul>
          </article>
        `).join('')}
      </div>
    </section>

    <section class="section">
      <div class="card card-soft">
        <h2>${escapeHtml(language === 'ro' ? 'Rezumat functionalitati' : 'Feature summary')}</h2>
        <ul>
          ${current.bullets.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}
        </ul>
      </div>
    </section>
  `
}

const renderPricing = (language, current) => {
  const blueprint = pageBlueprints.pricing[language]
  return `
    <section class="section" aria-labelledby="pricing-title">
      <div class="section-heading">
        <h2 id="pricing-title">${escapeHtml(blueprint.tiersTitle)}</h2>
      </div>
      <div class="card-grid card-grid-3">
        ${blueprint.tiers.map((tier) => `
          <article class="card pricing-card${tier.featured ? ' pricing-card-featured' : ''}">
            <p class="plan-name">${escapeHtml(tier.name)}</p>
            <p class="plan-price">${escapeHtml(tier.price)}<span>${escapeHtml(tier.period)}</span></p>
            <ul>
              ${tier.bullets.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}
            </ul>
            <a class="button ${tier.featured ? 'button-primary' : 'button-ghost'}" href="/register?lang=${language}">${escapeHtml(tier.cta)}</a>
          </article>
        `).join('')}
      </div>
    </section>

    <section class="section">
      <div class="card card-soft">
        <h2>${escapeHtml(language === 'ro' ? 'Claritate si responsabilitate' : 'Clarity and responsibility')}</h2>
        <ul>
          ${current.bullets.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}
        </ul>
      </div>
    </section>
  `
}

const renderAbout = (language, current) => {
  const blueprint = pageBlueprints.about[language]
  return `
    <section class="section" aria-labelledby="about-values-title">
      <div class="section-heading">
        <h2 id="about-values-title">${escapeHtml(blueprint.valuesTitle)}</h2>
      </div>
      <div class="card-grid card-grid-3">
        ${blueprint.values.map((value) => `
          <article class="card card-soft">
            <h3>${escapeHtml(value.title)}</h3>
            <p>${escapeHtml(value.body)}</p>
          </article>
        `).join('')}
      </div>
    </section>

    <section class="section">
      <div class="card">
        <h2>${escapeHtml(language === 'ro' ? 'Fundamente operationale' : 'Operational fundamentals')}</h2>
        <ul>
          ${current.bullets.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}
        </ul>
      </div>
    </section>
  `
}

const renderLegal = (language, pageKey, current) => {
  const blueprint = pageBlueprints.legal[language]
  const sections = legalSections[language][pageKey]

  const sectionRows = sections.length > 0
    ? sections
    : current.bullets.map((body, idx) => ({
      title: `${blueprint.sectionLabel} ${idx + 1}`,
      body
    }))

  const sectionAnchors = sectionRows.map((section, idx) => {
    const slug = toSlug(section.title || `${blueprint.sectionLabel}-${idx + 1}`)
    return {
      id: `section-${idx + 1}-${slug}`,
      title: section.title,
      body: section.body
    }
  })

  return `
    <section class="section" aria-labelledby="legal-points-title">
      <div class="section-heading">
        <h2 id="legal-points-title">${escapeHtml(blueprint.keyPoints)}</h2>
      </div>
      <div class="card-grid card-grid-3">
        ${current.bullets.map((item) => `
          <article class="card card-soft">
            <p>${escapeHtml(item)}</p>
          </article>
        `).join('')}
      </div>
    </section>

    <section class="section legal-section" aria-labelledby="legal-detail-title">
      <div class="section-heading">
        <h2 id="legal-detail-title">${escapeHtml(blueprint.fullTextTitle)}</h2>
        <p>${escapeHtml(i18nPayload[language].legal.disclaimer)}</p>
      </div>

      <details class="legal-toc-mobile">
        <summary>${escapeHtml(blueprint.mobileTocLabel)}</summary>
        <nav aria-label="${escapeHtml(blueprint.tocTitle)}" class="toc-list">
          ${sectionAnchors.map((row) => `<a href="#${row.id}">${escapeHtml(row.title)}</a>`).join('')}
        </nav>
      </details>

      <div class="legal-layout">
        <aside class="card legal-toc" aria-label="${escapeHtml(blueprint.tocTitle)}">
          <h3>${escapeHtml(blueprint.tocTitle)}</h3>
          <nav class="toc-list">
            ${sectionAnchors.map((row) => `<a href="#${row.id}">${escapeHtml(row.title)}</a>`).join('')}
          </nav>
        </aside>

        <article class="card legal-article">
          ${sectionAnchors.map((row) => `
            <section id="${row.id}" class="legal-article-section" aria-labelledby="${row.id}-title">
              <h3 id="${row.id}-title">${escapeHtml(row.title)}</h3>
              <p>${escapeHtml(row.body)}</p>
            </section>
          `).join('')}
        </article>
      </div>
    </section>
  `
}

const renderPageContent = (language, page, current) => {
  const hero = renderHero(language, page, current)

  if (page.key === 'home') {
    return `${hero}${renderHome(language, current)}`
  }

  if (page.key === 'features') {
    return `${hero}${renderFeatures(language, current)}`
  }

  if (page.key === 'pricing') {
    return `${hero}${renderPricing(language, current)}`
  }

  if (page.key === 'about') {
    return `${hero}${renderAbout(language, current)}`
  }

  return `${hero}${renderLegal(language, page.key, current)}`
}

const styles = `
  :root {
    --bg-0: #050b16;
    --bg-1: #0a1220;
    --bg-2: #102338;
    --surface-0: rgba(16, 25, 39, 0.88);
    --surface-1: rgba(23, 36, 56, 0.72);
    --surface-2: #121f31;
    --text-0: #eef4ff;
    --text-1: #c4d0e5;
    --muted: #91a2bc;
    --border: rgba(67, 93, 126, 0.74);
    --shadow: 0 16px 40px rgba(2, 8, 16, 0.42);
    --radius-sm: 10px;
    --radius-md: 14px;
    --radius-lg: 18px;
    --space-1: 4px;
    --space-2: 8px;
    --space-3: 12px;
    --space-4: 16px;
    --space-5: 24px;
    --space-6: 32px;
    --space-7: 48px;
    --space-8: 64px;
    --accent: #45a3ff;
    --danger: #ef6e6e;
    --focus-ring: 0 0 0 3px rgba(69, 163, 255, 0.32);
    --max-width: 1160px;
  }

  * {
    box-sizing: border-box;
  }

  html,
  body {
    width: 100%;
    margin: 0;
    max-width: 100%;
    overflow-x: hidden;
  }

  body {
    color: var(--text-0);
    font-family: "IBM Plex Sans", "Inter", "Roboto", "Helvetica", "Arial", sans-serif;
    line-height: 1.6;
    background:
      radial-gradient(850px 420px at 13% -8%, rgba(69, 163, 255, 0.32), rgba(69, 163, 255, 0) 64%),
      radial-gradient(760px 360px at 90% 0%, rgba(109, 157, 255, 0.16), rgba(109, 157, 255, 0) 66%),
      linear-gradient(164deg, var(--bg-0) 0%, var(--bg-1) 44%, var(--bg-2) 100%);
  }

  body::after {
    content: '';
    position: fixed;
    inset: 0;
    pointer-events: none;
    background-image: radial-gradient(rgba(255, 255, 255, 0.06) 0.65px, transparent 0.65px);
    background-size: 4px 4px;
    opacity: 0.04;
  }

  img,
  video,
  canvas {
    max-width: 100%;
    height: auto;
  }

  a,
  button,
  summary,
  input,
  select,
  textarea {
    transition: all 180ms ease;
  }

  :where(a, button, summary, input, select, textarea):focus-visible {
    outline: none;
    box-shadow: var(--focus-ring);
  }

  .skip-link {
    position: absolute;
    left: -9999px;
    top: 0;
  }

  .skip-link:focus {
    left: 16px;
    top: 16px;
    z-index: 1001;
    background: #0f1b2b;
    color: #fff;
    border: 1px solid var(--border);
    border-radius: 999px;
    padding: 8px 12px;
  }

  .site-container {
    width: min(var(--max-width), calc(100% - 32px));
    margin: 0 auto;
    min-width: 0;
  }

  .site-header {
    position: sticky;
    top: 0;
    z-index: 1000;
    backdrop-filter: blur(10px);
    background: rgba(10, 18, 32, 0.82);
    border-bottom: 1px solid var(--border);
  }

  .header-shell {
    min-height: 74px;
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto auto;
    align-items: center;
    gap: var(--space-4);
    padding: var(--space-3) 0;
  }

  .brand {
    min-width: 0;
    display: inline-flex;
    align-items: center;
    gap: var(--space-3);
    color: var(--text-0);
    text-decoration: none;
  }

  .brand strong {
    display: block;
    font-size: 1rem;
    line-height: 1.3;
    letter-spacing: 0.2px;
  }

  .brand small {
    display: block;
    font-size: 0.77rem;
    color: var(--muted);
    line-height: 1.3;
  }

  .brand-logo {
    width: 40px;
    height: 40px;
    border-radius: 12px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    background: linear-gradient(135deg, rgba(69, 163, 255, 0.9), rgba(105, 190, 255, 0.9));
    color: #031225;
    font-weight: 700;
    box-shadow: 0 6px 14px rgba(24, 88, 145, 0.4);
    flex-shrink: 0;
  }

  .desktop-nav {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
  }

  .nav-link {
    color: var(--text-1);
    text-decoration: none;
    font-size: 0.92rem;
    font-weight: 600;
    border: 1px solid transparent;
    border-radius: 999px;
    padding: 8px 12px;
  }

  .nav-link:hover {
    color: var(--text-0);
    border-color: var(--border);
    background: rgba(196, 214, 238, 0.08);
  }

  .nav-link.is-active {
    color: #06162a;
    border-color: transparent;
    background: rgba(126, 198, 255, 0.94);
  }

  .desktop-actions {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
  }

  .language-switch {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    min-width: 0;
  }

  .chip-link {
    text-decoration: none;
    color: var(--text-1);
    border: 1px solid var(--border);
    border-radius: 999px;
    font-size: 0.8rem;
    padding: 6px 10px;
    background: rgba(31, 46, 67, 0.6);
    line-height: 1.2;
  }

  .chip-link.is-active,
  .chip-link:hover {
    color: var(--text-0);
    border-color: rgba(127, 193, 255, 0.85);
  }

  .button {
    text-decoration: none;
    border-radius: var(--radius-sm);
    border: 1px solid transparent;
    font-size: 0.9rem;
    font-weight: 600;
    padding: 9px 14px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-height: 44px;
    line-height: 1.2;
    white-space: nowrap;
  }

  .button-primary {
    color: #041525;
    background: linear-gradient(130deg, #45a3ff, #70c3ff);
    border-color: rgba(134, 206, 255, 0.9);
  }

  .button-primary:hover {
    filter: brightness(1.04);
    transform: translateY(-1px);
  }

  .button-ghost {
    color: var(--text-0);
    border-color: var(--border);
    background: rgba(20, 32, 50, 0.6);
  }

  .button-ghost:hover {
    border-color: rgba(127, 193, 255, 0.82);
    background: rgba(30, 46, 67, 0.7);
  }

  .menu-toggle {
    display: none;
    border: 1px solid var(--border);
    background: rgba(20, 32, 50, 0.8);
    color: var(--text-0);
    border-radius: var(--radius-sm);
    min-height: 44px;
    min-width: 44px;
    padding: 8px 12px;
    font-size: 0.95rem;
    font-weight: 600;
    align-items: center;
    gap: 8px;
    justify-self: end;
  }

  .menu-toggle-label {
    font-size: 0.82rem;
    color: var(--text-1);
  }

  .mobile-menu {
    display: none;
    border-top: 1px solid var(--border);
    background: rgba(11, 20, 33, 0.96);
  }

  .mobile-menu[data-open='true'] {
    display: block;
  }

  .mobile-menu-inner {
    display: grid;
    gap: var(--space-4);
    padding: var(--space-4) 0 var(--space-5);
  }

  .mobile-nav-links {
    display: grid;
    gap: var(--space-2);
  }

  .mobile-nav-links .nav-link {
    width: 100%;
    text-align: left;
  }

  .mobile-menu-utility {
    display: grid;
    gap: var(--space-3);
  }

  .mobile-cta-row {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: var(--space-2);
  }

  .page-main {
    width: 100%;
    overflow-x: hidden;
    padding: var(--space-6) 0 var(--space-8);
  }

  .section {
    margin-top: var(--space-6);
  }

  .section:first-of-type {
    margin-top: 0;
  }

  .hero-grid {
    display: grid;
    grid-template-columns: 1.08fr 0.92fr;
    gap: var(--space-5);
    align-items: stretch;
  }

  .card {
    border: 1px solid var(--border);
    border-radius: var(--radius-lg);
    background: var(--surface-0);
    box-shadow: var(--shadow);
    padding: clamp(18px, 3vw, 28px);
    min-width: 0;
  }

  .card-soft {
    background: var(--surface-1);
  }

  .hero-content h1 {
    margin: var(--space-2) 0 0;
    font-size: clamp(1.85rem, 4vw, 2.85rem);
    line-height: 1.18;
    letter-spacing: -0.4px;
    max-width: 20ch;
  }

  .hero-badge {
    display: inline-flex;
    align-items: center;
    margin: 0;
    border-radius: 999px;
    border: 1px solid rgba(127, 193, 255, 0.62);
    background: rgba(22, 43, 67, 0.7);
    color: #b8daf9;
    font-size: 0.78rem;
    font-weight: 600;
    letter-spacing: 0.2px;
    padding: 6px 10px;
  }

  .hero-intro {
    margin: var(--space-3) 0 0;
    color: var(--text-1);
    max-width: 64ch;
  }

  .hero-actions {
    margin-top: var(--space-4);
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
  }

  .hero-side h2 {
    margin: 0;
    font-size: 1.08rem;
    line-height: 1.3;
  }

  .hero-side ul,
  .card ul,
  .legal-article ul {
    margin: var(--space-3) 0 0;
    padding-left: 18px;
    color: var(--text-1);
  }

  .hero-side li + li,
  .card li + li,
  .legal-article li + li {
    margin-top: 8px;
  }

  .hero-note,
  .section-note {
    margin: var(--space-4) 0 0;
    color: var(--muted);
    font-size: 0.93rem;
  }

  .section-heading h2 {
    margin: 0;
    font-size: clamp(1.35rem, 2.4vw, 1.85rem);
    line-height: 1.2;
    letter-spacing: -0.2px;
  }

  .section-heading p {
    margin: var(--space-2) 0 0;
    color: var(--text-1);
    max-width: 72ch;
  }

  .card-grid {
    display: grid;
    gap: var(--space-4);
    margin-top: var(--space-4);
  }

  .card-grid-3 {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .card h3 {
    margin: 0;
    font-size: 1.02rem;
    line-height: 1.3;
  }

  .card p {
    margin: var(--space-2) 0 0;
    color: var(--text-1);
  }

  .chip-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: var(--space-2);
    margin-top: var(--space-4);
  }

  .chip-item {
    min-height: 44px;
    border-radius: 999px;
    border: 1px solid var(--border);
    background: rgba(23, 37, 56, 0.72);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 8px 12px;
    color: var(--text-0);
    font-weight: 600;
    font-size: 0.86rem;
    text-align: center;
  }

  .cta-panel h2 {
    margin: 0;
    font-size: clamp(1.35rem, 2.6vw, 1.85rem);
    line-height: 1.25;
  }

  .plan-name {
    margin: 0;
    color: var(--text-1);
    font-weight: 600;
  }

  .plan-price {
    margin: var(--space-2) 0 0;
    font-size: 2rem;
    font-weight: 700;
    letter-spacing: -0.2px;
    line-height: 1;
  }

  .plan-price span {
    font-size: 0.95rem;
    color: var(--muted);
    margin-left: 4px;
  }

  .pricing-card {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }

  .pricing-card .button {
    margin-top: auto;
    width: 100%;
  }

  .pricing-card-featured {
    border-color: rgba(111, 193, 255, 0.92);
    background: linear-gradient(160deg, rgba(19, 37, 59, 0.95), rgba(16, 28, 43, 0.93));
  }

  .legal-section .section-heading {
    margin-bottom: var(--space-4);
  }

  .legal-layout {
    display: grid;
    grid-template-columns: minmax(220px, 260px) minmax(0, 1fr);
    gap: var(--space-4);
    align-items: start;
  }

  .legal-toc {
    position: sticky;
    top: 96px;
  }

  .legal-toc h3 {
    margin: 0 0 var(--space-2);
    font-size: 0.98rem;
    color: var(--text-0);
  }

  .toc-list {
    display: grid;
    gap: var(--space-2);
  }

  .toc-list a {
    color: var(--text-1);
    text-decoration: none;
    border-radius: var(--radius-sm);
    border: 1px solid transparent;
    padding: 7px 8px;
    font-size: 0.88rem;
    line-height: 1.35;
  }

  .toc-list a:hover {
    color: var(--text-0);
    border-color: var(--border);
    background: rgba(26, 39, 58, 0.8);
  }

  .legal-article {
    display: grid;
    gap: var(--space-4);
  }

  .legal-article-section h3 {
    margin: 0;
    font-size: 1.1rem;
    line-height: 1.3;
  }

  .legal-article-section p {
    margin: var(--space-2) 0 0;
    color: var(--text-1);
    overflow-wrap: anywhere;
  }

  .legal-toc-mobile {
    display: none;
    margin-bottom: var(--space-3);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    background: rgba(17, 30, 46, 0.86);
    padding: 10px 12px;
  }

  .legal-toc-mobile summary {
    cursor: pointer;
    list-style: none;
    font-weight: 600;
  }

  .legal-toc-mobile[open] .toc-list {
    margin-top: var(--space-3);
  }

  .site-footer {
    border-top: 1px solid var(--border);
    background: rgba(10, 17, 29, 0.86);
  }

  .footer-shell {
    min-height: 76px;
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-3);
    align-items: center;
    justify-content: space-between;
    padding: var(--space-4) 0;
  }

  .footer-copy {
    margin: 0;
    color: var(--muted);
    font-size: 0.85rem;
    max-width: 55ch;
  }

  .footer-links {
    display: inline-flex;
    gap: var(--space-2);
    flex-wrap: wrap;
  }

  .footer-links a {
    color: var(--text-1);
    text-decoration: none;
    font-size: 0.88rem;
    border-radius: 999px;
    border: 1px solid transparent;
    padding: 7px 10px;
  }

  .footer-links a:hover {
    color: var(--text-0);
    border-color: var(--border);
    background: rgba(29, 44, 64, 0.65);
  }

  @media (max-width: 1080px) {
    .header-shell {
      grid-template-columns: minmax(0, 1fr) auto;
    }

    .desktop-nav,
    .desktop-actions {
      display: none;
    }

    .menu-toggle {
      display: inline-flex;
    }

    .hero-grid {
      grid-template-columns: 1fr;
    }

    .card-grid-3,
    .chip-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }

  @media (max-width: 900px) {
    .legal-layout {
      grid-template-columns: 1fr;
    }

    .legal-toc {
      display: none;
    }

    .legal-toc-mobile {
      display: block;
    }

    .legal-toc-mobile .toc-list a {
      display: block;
    }
  }

  @media (max-width: 720px) {
    .site-container {
      width: calc(100% - 24px);
    }

    .page-main {
      padding-top: var(--space-5);
      padding-bottom: var(--space-7);
    }

    .hero-content h1 {
      font-size: clamp(1.6rem, 8vw, 2rem);
    }

    .chip-grid,
    .card-grid-3 {
      grid-template-columns: 1fr;
    }

    .mobile-cta-row {
      grid-template-columns: 1fr;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    *,
    *::before,
    *::after {
      transition: none !important;
      animation: none !important;
    }
  }
`

const buildHtml = ({ language, page }) => {
  const current = page[language]
  const alternateLanguage = language === 'en' ? 'ro' : 'en'
  const route = normalizePublicPath(language, page.slug)
  const alternateRoute = normalizePublicPath(alternateLanguage, page.slug)
  const isDefaultHomeRoute = language === DEFAULT_LANG && page.slug === ''
  const canonicalUrl = isDefaultHomeRoute ? `${SITE_URL}/` : `${SITE_URL}${route}`
  const alternateUrl = `${SITE_URL}${alternateRoute}`
  const ogLocale = localeToOg[language]
  const ogAltLocale = localeToOg[alternateLanguage]
  const jsonLdRoute = isDefaultHomeRoute ? '/' : route
  const jsonLd = page.includeJsonLd ? buildJsonLd(language, jsonLdRoute) : ''
  const enHref = page.slug === '' ? `${SITE_URL}/` : `${SITE_URL}${normalizePublicPath('en', page.slug)}`

  return `<!doctype html>
<html lang="${language}">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(current.title)}</title>
  <meta name="description" content="${escapeHtml(current.description)}" />
  <meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1" />
  <link rel="canonical" href="${canonicalUrl}" />
  <link rel="alternate" hreflang="en" href="${enHref}" />
  <link rel="alternate" hreflang="ro" href="${SITE_URL}${normalizePublicPath('ro', page.slug)}" />
  <link rel="alternate" hreflang="x-default" href="${enHref}" />

  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="TradeJAudit" />
  <meta property="og:title" content="${escapeHtml(current.title)}" />
  <meta property="og:description" content="${escapeHtml(current.description)}" />
  <meta property="og:url" content="${canonicalUrl}" />
  <meta property="og:image" content="${OG_IMAGE}" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta property="og:image:type" content="image/jpeg" />
  <meta property="og:image:alt" content="TradeJAudit trading journal with dashboard, trades, analytics, calendar, notebook, and insights." />
  <meta property="og:image" content="${OG_IMAGE_FALLBACK}" />
  <meta property="og:image:width" content="600" />
  <meta property="og:image:height" content="315" />
  <meta property="og:image:type" content="image/jpeg" />
  <meta property="og:image:alt" content="TradeJAudit trading workflow overview for social previews." />
  <meta property="og:locale" content="${ogLocale}" />
  <meta property="og:locale:alternate" content="${ogAltLocale}" />

  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${escapeHtml(current.title)}" />
  <meta name="twitter:description" content="${escapeHtml(current.description)}" />
  <meta name="twitter:image" content="${OG_IMAGE}" />
  <meta name="theme-color" content="#060b12" />
  <!-- Google tag (gtag.js) -->
  <script async src="https://www.googletagmanager.com/gtag/js?id=G-8H5HCBG170"></script>
  <script>
    window.dataLayer = window.dataLayer || [];
    function gtag(){dataLayer.push(arguments);}
    gtag('js', new Date());
    gtag('config', 'G-8H5HCBG170');
  </script>
  ${jsonLd}
  <style>${styles}</style>
</head>
<body>
  <a href="#main-content" class="skip-link">Skip to content</a>
  ${buildHeader(language, page)}

  <main id="main-content" class="page-main">
    <div class="site-container">
      ${renderPageContent(language, page, current)}
    </div>
  </main>

  ${buildFooter(language)}

  <script>
    (() => {
      const menuToggle = document.querySelector('[data-menu-toggle]')
      const mobileMenu = document.querySelector('[data-mobile-menu]')
      if (!menuToggle || !mobileMenu) return

      const setMenuOpen = (open) => {
        menuToggle.setAttribute('aria-expanded', open ? 'true' : 'false')
        mobileMenu.setAttribute('data-open', open ? 'true' : 'false')
      }

      setMenuOpen(false)

      menuToggle.addEventListener('click', () => {
        const expanded = menuToggle.getAttribute('aria-expanded') === 'true'
        setMenuOpen(!expanded)
      })

      mobileMenu.querySelectorAll('a').forEach((link) => {
        link.addEventListener('click', () => setMenuOpen(false))
      })

      window.addEventListener('resize', () => {
        if (window.innerWidth > 1080) {
          setMenuOpen(false)
        }
      })
    })()
  </script>

  <noscript>
    <style>
      .mobile-menu { display: block !important; }
      .menu-toggle { display: none !important; }
    </style>
  </noscript>

  <!-- Canonical: ${canonicalUrl} | Alternate: ${alternateUrl} | Updated: ${TODAY} -->
</body>
</html>`
}

const dirTargets = [path.join(publicDir, 'en'), path.join(publicDir, 'ro')]
for (const target of dirTargets) {
  rmSync(target, { recursive: true, force: true })
}

const allPublicPaths = []

for (const language of ['en', 'ro']) {
  for (const page of routeDefinitions) {
    const route = normalizePublicPath(language, page.slug)
    const outDir = toFileSystemPath(route)
    mkdirSync(outDir, { recursive: true })
    const html = buildHtml({ language, page })
    writeFileSync(path.join(outDir, 'index.html'), html)
    const sitemapRoute = language === DEFAULT_LANG && page.slug === '' ? '/' : route
    allPublicPaths.push(sitemapRoute)
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
