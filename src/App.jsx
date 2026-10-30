import { useEffect, useState } from 'react'
import {
  BrowserRouter,
  Link,
  NavLink,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from 'react-router-dom'
import {
  explainAssessment,
  getExplanationStatus,
  getHealth,
  getModelExploration,
  getModelInfo,
  predictAssessment,
} from './lib/api.js'
import { searchLocations, searchNearbyFacilities } from './lib/facilities.js'
import { useAssessmentReport } from './lib/useAssessmentReport.js'
import { useAuth } from './lib/useAuth.js'
import { getPredictionHistory, savePredictionSummary } from './lib/history.js'
import { getPredictionDisplay } from './lib/prediction.js'
import StaffWorkspace from './staff/StaffWorkspace.jsx'
import './App.css'

const MEDICAL_DISCLAIMER = 'This application is developed for academic research and educational purposes only. It is not a medical diagnostic tool and must not be used to diagnose diabetes, determine treatment, or replace professional medical advice. Any model output is an estimate based on the model and data used, and it may be inaccurate. Consult a qualified healthcare professional for medical assessment.'

const routes = [
  { label: 'Home', to: '/' },
  { label: 'About Research', to: '/about' },
  { label: 'Methodology', to: '/methodology' },
  { label: 'Risk Prediction', to: '/assessment' },
  { label: 'Model Explainability', to: '/explainability' },
  { label: 'Validation', to: '/validation' },
  { label: 'Contact', to: '/contact' },
  { label: 'Staff demo', to: '/staff' },
]

function Icon({ name, size = 20, className = '' }) {
  const common = {
    'aria-hidden': true,
    className: `icon ${className}`,
    fill: 'none',
    height: size,
    stroke: 'currentColor',
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    strokeWidth: 1.8,
    viewBox: '0 0 24 24',
    width: size,
  }

  const paths = {
    arrow: <><path d="M5 12h14" /><path d="m13 6 6 6-6 6" /></>,
    check: <path d="m5 12 4 4L19 6" />,
    chevron: <path d="m9 18 6-6-6-6" />,
    clipboard: <><rect x="5" y="4" width="14" height="17" rx="2" /><path d="M9 4.5h6a1.5 1.5 0 0 0-1.5-1.5h-3A1.5 1.5 0 0 0 9 4.5Z" /><path d="M9 11h6M9 15h6" /></>,
    clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
    heart: <><path d="M20.8 8.7c0 5.2-8.8 10-8.8 10s-8.8-4.8-8.8-10a4.7 4.7 0 0 1 8.8-2.2 4.7 4.7 0 0 1 8.8 2.2Z" /><path d="M8 11h2l1.2-2.2 2 4 1.1-1.8H17" /></>,
    lock: <><rect x="4" y="10" width="16" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3" /></>,
    menu: <><path d="M4 7h16M4 12h16M4 17h16" /></>,
    map: <><path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3V6Z" /><path d="M9 3v15M15 6v15" /></>,
    phone: <><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.4 19.4 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 2 .7 2.9a2 2 0 0 1-.5 2.1L8 9.9a16 16 0 0 0 6 6l1.2-1.3a2 2 0 0 1 2.1-.5c.9.3 1.9.6 2.9.7a2 2 0 0 1 1.8 2.1Z" /></>,
    printer: <><path d="M6 9V3h12v6M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" /><path d="M6 14h12v7H6zM18 12h.01" /></>,
    leaf: <><path d="M20 4c-9 0-15 4-15 11a5 5 0 0 0 5 5c7 0 11-6 10-16Z" /><path d="M4 21c3-5 7-8 12-11" /></>,
    shield: <><path d="M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11Z" /><path d="m9 12 2 2 4-4" /></>,
    spark: <><path d="m12 3 1.9 5.8L20 11l-6.1 2.1L12 19l-1.9-5.9L4 11l6.1-2.2L12 3Z" /><path d="m19 14 .9 2.1L22 17l-2.1.9L19 20l-.9-2.1L16 17l2.1-.9L19 14Z" /></>,
    users: <><path d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="10" cy="7" r="4" /><path d="M20 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8" /></>,
  }

  return <svg {...common}>{paths[name] ?? paths.spark}</svg>
}

function Notice({ children, tone = 'info' }) {
  return (
    <div className={`notice notice-${tone}`} role={tone === 'error' ? 'alert' : 'status'}>
      <Icon name={tone === 'error' ? 'shield' : 'lock'} size={18} />
      <p>{children}</p>
    </div>
  )
}

function useBackendStatus() {
  const [state, setState] = useState({
    loading: true,
    online: false,
    info: null,
    exploration: null,
    explanation: null,
    error: '',
  })
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    let active = true
    async function check() {
      try {
        const [health, info, exploration, explanation] = await Promise.allSettled([
          getHealth(),
          getModelInfo(),
          getModelExploration(),
          getExplanationStatus(),
        ])
        if (!active) return
        const healthResult = health.status === 'fulfilled' ? health.value : null
        setState({
          loading: false,
          online: Boolean(healthResult?.ok && healthResult.data?.api === 'available'),
          info: info.status === 'fulfilled' ? info.value : null,
          exploration: exploration.status === 'fulfilled' ? exploration.value : null,
          explanation: explanation.status === 'fulfilled' ? explanation.value : null,
          error: healthResult?.ok
            ? ''
            : healthResult?.data?.message || 'Could not reach the Flask API at the configured address.',
        })
      } catch (error) {
        if (active) {
          setState({
            loading: false,
            online: false,
            info: null,
            exploration: null,
            explanation: null,
            error: error.message || 'Could not check the Flask API.',
          })
        }
      }
    }
    check()
    return () => { active = false }
  }, [refreshKey])

  return { ...state, refresh: () => setRefreshKey((key) => key + 1) }
}

function ModelMetrics({ evaluation, analyticSample }) {
  const metrics = evaluation?.metrics
  const test = evaluation?.test_set
  if (!metrics || !test) {
    return <p>Model artifacts exist, but the held-out evaluation summary is incomplete.</p>
  }
  const metricNames = [
    ['accuracy', 'Accuracy'],
    ['precision', 'Precision'],
    ['recall', 'Recall'],
    ['f1', 'F1 score'],
    ['roc_auc', 'ROC AUC'],
  ]
  const confusionMatrix = test.confusion_matrix
  const hasConfusionMatrix = Array.isArray(confusionMatrix)
    && confusionMatrix.length === 2
    && confusionMatrix.every((row) => Array.isArray(row) && row.length === 2)
  return (
    <>
      <div className="model-metric-grid">
        {metricNames.map(([key, label]) => (
          <div className="model-metric" key={key}>
            <span>{label}</span>
            <strong>{Number(metrics[key]).toFixed(3)}</strong>
          </div>
        ))}
      </div>
      <p className="model-metric-caption">
        Held-out sample: {test.n} records · Values are returned by the trained backend artifact.
      </p>
      {analyticSample && <p className="model-metric-caption">
        Complete-case analytic sample: {analyticSample.n} records · Target class counts: {Object.entries(analyticSample.target_class_counts).map(([label, count]) => `${label}: ${count}`).join('; ')}.
      </p>}
      {test.class_counts && <p className="model-metric-caption">
        Held-out class counts: {Object.entries(test.class_counts).map(([label, count]) => `${label}: ${count}`).join('; ')}.
      </p>}
      <p className="model-metric-caption">
        Recall (sensitivity) measures how many held-out “Yes” records were identified; precision measures how many predicted “Yes” records were correct. ROC AUC summarizes discrimination across thresholds.
      </p>
      {hasConfusionMatrix && (
        <div className="confusion-matrix-wrap">
          <table className="confusion-matrix">
            <caption>Held-out confusion matrix · actual rows, predicted columns</caption>
            <thead>
              <tr><th scope="col">Actual / predicted</th><th scope="col">No previous diagnosis</th><th scope="col">Previous diagnosis</th></tr>
            </thead>
            <tbody>
              <tr><th scope="row">No previous diagnosis</th><td>{confusionMatrix[0][0]}</td><td>{confusionMatrix[0][1]}</td></tr>
              <tr><th scope="row">Previous diagnosis</th><td>{confusionMatrix[1][0]}</td><td>{confusionMatrix[1][1]}</td></tr>
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}

function Header() {
  const [menuOpen, setMenuOpen] = useState(false)
  const [signOutError, setSignOutError] = useState('')
  const location = useLocation()
  const auth = useAuth()

  async function handleSignOut() {
    try {
      await auth.signOut()
      setSignOutError('')
    } catch (error) {
      setSignOutError(error.message || 'Could not sign out.')
    }
  }

  return (
    <header className="site-header">
      <div className="header-inner">
        <Link aria-label="Diabetes Research home" className="brand" to="/" onClick={() => setMenuOpen(false)}>
          <span className="brand-mark"><Icon name="heart" size={23} /></span>
          <span className="brand-copy">
            <strong>Faith Clinic</strong>
            <small>DIABETES RESEARCH</small>
          </span>
        </Link>

        <button
          aria-controls="main-navigation"
          aria-expanded={menuOpen}
          aria-label={menuOpen ? 'Close navigation menu' : 'Open navigation menu'}
          className="menu-toggle"
          onClick={() => setMenuOpen((open) => !open)}
          type="button"
        >
          <Icon name="menu" size={23} />
        </button>

        <nav aria-label="Main navigation" className={`main-nav ${menuOpen ? 'is-open' : ''}`} id="main-navigation">
          {routes.map((route) => (
            <NavLink
              end={route.to === '/'}
              key={route.to}
              onClick={() => setMenuOpen(false)}
              to={route.to}
            >
              {route.label}
            </NavLink>
          ))}
          <div className="nav-mobile-actions">
            {auth.user
              ? <><Link className="nav-login" onClick={() => setMenuOpen(false)} to="/dashboard">My workspace</Link><button className="nav-login nav-logout" onClick={handleSignOut} type="button">Sign out</button></>
              : <><Link className="nav-login" onClick={() => setMenuOpen(false)} to="/login">Log in</Link><Link className="button button-small" onClick={() => setMenuOpen(false)} to="/signup">Create account</Link></>}
          </div>
        </nav>

        <div className="header-actions">
          {auth.user
            ? <><Link className="nav-login" to="/dashboard">My workspace</Link><button className="nav-login nav-logout" onClick={handleSignOut} type="button">Sign out</button></>
            : <><Link className={`nav-login ${location.pathname === '/login' ? 'is-current' : ''}`} to="/login">Log in</Link><Link className="button button-small" to="/signup">Get started <Icon name="arrow" size={16} /></Link></>}
        </div>
      </div>
      {signOutError && <p className="auth-inline-error" role="alert">{signOutError}</p>}
    </header>
  )
}

function Footer() {
  return (
    <footer className="site-footer">
      <div className="footer-main">
        <div className="footer-brand">
          <Link aria-label="Faith Clinic home" className="brand brand-light" to="/">
            <span className="brand-mark"><Icon name="heart" size={22} /></span>
            <span className="brand-copy"><strong>Faith Clinic</strong><small>DIABETES RESEARCH</small></span>
          </Link>
          <p>Diabetes Risk Prediction and Feature Selection in a Web Application Using Random Forest and SHAP Analysis.</p>
        </div>
        <div className="footer-links">
          <div><strong>Explore</strong><Link to="/education">Diabetes education</Link><Link to="/about">About the research</Link><Link to="/methodology">Methodology</Link><Link to="/explainability">Model explainability</Link><Link to="/validation">Validation and testing</Link><Link to="/services">Research services</Link><Link to="/contact">Contact</Link></div>
          <div><strong>Workspace</strong><Link to="/staff">Hospital workspace demo</Link><Link to="/dashboard">Dashboard</Link><Link to="/assessment">Assessment preview</Link><Link to="/history">History status</Link></div>
          <div><strong>Contact</strong><a href="tel:07068432364">07068432364</a><a href="https://wa.me/2347068432364" rel="noreferrer" target="_blank">WhatsApp 07068432364</a><a href="mailto:olufunsho19@gmail.com">olufunsho19@gmail.com</a></div>
        </div>
      </div>
      <div className="footer-bottom">
        <span>Faith Clinic · HND II Academic Project</span>
        <span><Icon name="shield" size={15} /> Educational and research purposes only · Not a medical diagnosis</span>
      </div>
    </footer>
  )
}

function PageIntro({ eyebrow, title, description }) {
  return (
    <div className="page-intro">
      <span className="eyebrow">{eyebrow}</span>
      <h1>{title}</h1>
      <p>{description}</p>
    </div>
  )
}

function Home() {
  return (
    <>
      <section className="hero-section">
        <div className="hero-copy">
          <span className="eyebrow"><span className="eyebrow-dot" /> Faith Clinic · HND II academic project</span>
          <h1>Diabetes risk prediction<br /><span>and feature selection.</span></h1>
          <p className="hero-project-title">Diabetes Risk Prediction and Feature Selection in a Web Application Using Random Forest and SHAP Analysis</p>
          <p className="hero-lede">An academic research application exploring a Random Forest model and SHAP explanations for classifying self-reported previous diabetes diagnosis in US NHANES 2017–2018 data.</p>
          <div className="hero-actions">
            <Link className="button" to="/assessment">Explore the assessment <Icon name="arrow" size={17} /></Link>
            <Link className="button button-outline" to="/methodology">Read the methodology</Link>
          </div>
          <div className="hero-secondary-actions">
            <Link className="text-link" to="/about">About the research <Icon name="arrow" size={15} /></Link>
            <Link className="text-link" to="/contact">Contact Faith Clinic</Link>
          </div>
        </div>
        <div className="hero-art">
          <img
            alt="Original illustration of a healthcare professional listening to a patient"
            className="care-illustration"
            height="480"
            src="/faith-clinic-care-illustration.svg"
            width="560"
          />
          <span className="illustration-caption">Original illustration · not clinic staff</span>
        </div>
      </section>

      <section aria-labelledby="project-scope-title" className="scope-notice">
        <Icon name="shield" size={20} />
        <div>
          <h2 id="project-scope-title">Important project boundaries</h2>
          <p>This academic research project is not a clinical management service. It does not currently record ongoing glucose readings, provide clinician messaging or appointments, or monitor emergencies. The model classifies self-reported previous diagnosis in research data; it cannot diagnose current diabetes or predict future onset. Please do not enter real patient health information.</p>
        </div>
      </section>

      <section className="trust-strip" aria-label="Project principles">
        <div><Icon name="clipboard" /><span><strong>General education</strong><small>Information is not personal medical advice</small></span></div>
        <div><Icon name="spark" /><span><strong>Research explained</strong><small>Model output is separate from clinical care</small></span></div>
        <div><Icon name="users" /><span><strong>Student project</strong><small>No clinic accreditation or care service is implied</small></span></div>
      </section>

      <Notice>{MEDICAL_DISCLAIMER}</Notice>

      <section className="section-block home-overview">
        <div className="section-heading">
          <div><span className="eyebrow">THE RESEARCH APPROACH</span><h2>Methods, made understandable.</h2></div>
          <p>This project studies an existing, documented dataset and evaluated model. Its outputs are research classifications, not personal diagnoses or future-risk estimates.</p>
        </div>
        <div className="feature-grid">
          <article className="feature-card"><span className="feature-icon"><Icon name="users" size={22} /></span><span className="card-kicker">ABOUT</span><h3>A defined research question</h3><p>The model target is self-reported previous diabetes diagnosis in an adult NHANES complete-case sample.</p><Link className="text-link" to="/about">Read the project scope <Icon name="arrow" size={15} /></Link></article>
          <article className="feature-card feature-card-highlight"><span className="feature-icon"><Icon name="clipboard" size={22} /></span><span className="card-kicker">METHODS</span><h3>Random Forest and SHAP</h3><p>Review the model workflow, actual evaluation metrics, and the limits of feature attribution.</p><Link className="text-link" to="/methodology">Explore the methodology <Icon name="arrow" size={15} /></Link></article>
          <article className="feature-card"><span className="feature-icon"><Icon name="shield" size={22} /></span><span className="card-kicker">VERIFICATION</span><h3>What has been checked?</h3><p>See the live backend status separately from checks that still need manual or automated testing.</p><Link className="text-link" to="/validation">Review validation status <Icon name="arrow" size={15} /></Link></article>
        </div>
      </section>

      <section className="section-block research-methods" aria-labelledby="research-methods-title">
        <div className="section-heading">
          <div><span className="eyebrow">MODEL OVERVIEW</span><h2 id="research-methods-title">A model is a tool—not a diagnosis.</h2></div>
          <p>These methods are presented with the research target, dataset, and limitations alongside them.</p>
        </div>
        <div className="research-method-grid">
          <article className="research-method-card">
            <span className="feature-icon"><Icon name="spark" size={21} /></span>
            <h3>Random Forest</h3>
            <p>A collection of decision trees combines their outputs to classify patterns in the prepared study data. Its measured performance applies to the reported held-out sample only.</p>
          </article>
          <article className="research-method-card">
            <span className="feature-icon"><Icon name="clipboard" size={21} /></span>
            <h3>SHAP explanations</h3>
            <p>SHAP attributes parts of a model output to input features. These contributions describe model behavior; they do not prove causation or clinical importance.</p>
          </article>
          <article className="research-method-card">
            <span className="feature-icon"><Icon name="check" size={21} /></span>
            <h3>Research workflow</h3>
            <p>Document data, prepare and check it, compare feature sets, evaluate the model, interpret outputs, then verify the web integration and limitations.</p>
          </article>
        </div>
        <div className="research-home-links">
          <Link className="text-link" to="/explainability">How to read an explanation <Icon name="arrow" size={15} /></Link>
          <Link className="text-link" to="/education">Learn and Live Well <Icon name="arrow" size={15} /></Link>
          <Link className="text-link" to="/results#facility-title">Find a healthcare facility <Icon name="arrow" size={15} /></Link>
        </div>
      </section>

      <section className="home-cta">
        <div className="cta-mark"><Icon name="heart" size={26} /></div>
        <div><span className="eyebrow">FAITH CLINIC</span><h2>Questions about the project?</h2><p>Get in touch using the published contact details. Please do not send personal health information.</p></div>
        <Link className="button button-light" to="/contact">Contact Faith Clinic <Icon name="arrow" size={16} /></Link>
      </section>
    </>
  )
}

function Education() {
  return (
    <div className="content-page education-page">
      <PageIntro
        eyebrow="FAITH CLINIC · GENERAL EDUCATION"
        title="Learn and Live Well"
        description="Clear, beginner-friendly information about diabetes, food choices, and healthy routines. Explore at your own pace and speak with a qualified healthcare professional about personal concerns."
      />
      <div className="education-disclaimer" role="note">
        <Icon name="shield" size={21} />
        <p>Educational information only. This content does not replace professional medical advice, diagnosis, or treatment.</p>
      </div>

      <nav aria-label="Learning topics" className="learning-cards">
        <article className="learning-card">
          <span className="feature-icon"><Icon name="heart" size={22} /></span>
          <span className="card-kicker">START HERE</span>
          <h2>Understanding diabetes</h2>
          <p>Learn about common types, signs, risk factors, testing, and when to seek advice.</p>
          <a className="text-link" href="#understanding-diabetes">Read more <Icon name="arrow" size={15} /></a>
        </article>
        <article className="learning-card">
          <span className="feature-icon"><Icon name="leaf" size={22} /></span>
          <span className="card-kicker">FOOD AND NOURISHMENT</span>
          <h2>Healthy eating guide</h2>
          <p>Explore balanced meals, familiar food ideas, and simple meal-planning examples.</p>
          <a className="text-link" href="#healthy-eating">Read more <Icon name="arrow" size={15} /></a>
        </article>
        <article className="learning-card">
          <span className="feature-icon"><Icon name="spark" size={22} /></span>
          <span className="card-kicker">EVERYDAY WELLBEING</span>
          <h2>Healthy lifestyle guide</h2>
          <p>Find general information on movement, sleep, tobacco, alcohol, and check-ups.</p>
          <a className="text-link" href="#healthy-lifestyle">Read more <Icon name="arrow" size={15} /></a>
        </article>
        <article className="learning-card">
          <span className="feature-icon"><Icon name="clipboard" size={22} /></span>
          <span className="card-kicker">QUICK ANSWERS</span>
          <h2>Frequently asked questions</h2>
          <p>Get clear answers to common questions about diabetes and this research website.</p>
          <a className="text-link" href="#frequently-asked-questions">Read more <Icon name="arrow" size={15} /></a>
        </article>
      </nav>

      <section aria-labelledby="understanding-diabetes-title" className="learning-section" id="understanding-diabetes">
        <div className="learning-section-heading">
          <span className="feature-icon"><Icon name="heart" size={22} /></span>
          <div><span className="eyebrow">DIABETES EDUCATION</span><h2 id="understanding-diabetes-title">Understanding diabetes</h2></div>
        </div>
        <p>Diabetes is a long-term condition in which the level of glucose (sugar) in the blood is too high. This can happen when the body does not make enough insulin or cannot use insulin well. Insulin is a hormone that helps glucose move from the blood into the body’s cells for energy.</p>
        <h3>Common types</h3>
        <ul className="learning-list">
          <li><strong>Type 1:</strong> The immune system mistakenly attacks the cells that make insulin. It is not caused by eating sugar or by a person’s lifestyle.</li>
          <li><strong>Type 2:</strong> The body does not use insulin effectively and, over time, may not make enough. Several factors can contribute.</li>
          <li><strong>Gestational diabetes:</strong> High blood glucose first recognised during pregnancy. A healthcare professional can advise on testing and follow-up.</li>
        </ul>
        <h3>Possible signs and symptoms</h3>
        <p>Some people notice increased thirst or urination, tiredness, blurred vision, or unexplained weight loss. These symptoms can also have other causes, and some people with diabetes have no obvious symptoms.</p>
        <h3>Type 2 risk factors</h3>
        <p>Risk may be associated with factors such as family history, age, physical inactivity, higher body weight, and a history of gestational diabetes. Risk factors do not determine an individual’s health, and anyone can develop diabetes.</p>
        <h3>Testing, misconceptions, and getting help</h3>
        <p>Symptoms alone cannot confirm diabetes. A qualified healthcare professional can assess concerns and arrange or interpret appropriate blood tests, such as a blood glucose or HbA1c test (a test that reflects average blood glucose over time). The suitable test and interpretation depend on the person.</p>
        <p>Diabetes is not contagious. Eating sugar alone does not explain all diabetes, and type 1 is not caused by lifestyle. Healthy habits may support wellbeing but cannot guarantee that diabetes will be prevented or reversed. Contact a qualified healthcare professional if you are concerned about symptoms, risk factors, or test results. Seek urgent medical care for severe or rapidly worsening symptoms.</p>
        <p className="learning-source">Learn more: <a href="https://www.who.int/news-room/fact-sheets/detail/diabetes" rel="noreferrer" target="_blank">World Health Organization: Diabetes</a> · <a href="https://www.niddk.nih.gov/health-information/diabetes/overview/symptoms-causes" rel="noreferrer" target="_blank">NIDDK: Symptoms and causes of diabetes</a> · <a href="https://www.cdc.gov/diabetes/diabetes-testing/" rel="noreferrer" target="_blank">CDC: Diabetes testing</a></p>
      </section>

      <section aria-labelledby="healthy-eating-title" className="learning-section" id="healthy-eating">
        <div className="learning-section-heading">
          <span className="feature-icon"><Icon name="leaf" size={22} /></span>
          <div><span className="eyebrow">HEALTHY EATING GUIDE</span><h2 id="healthy-eating-title">Build balanced meals</h2></div>
        </div>
        <p>A varied eating pattern can include vegetables, fruits, beans and other legumes, whole grains, and suitable protein sources such as fish, eggs, beans, or poultry. Portion awareness can help make meals more balanced; needs and preferences differ from person to person.</p>
        <ul className="learning-list">
          <li>Add vegetables such as ugu, okra, garden egg, tomatoes, or leafy greens where available.</li>
          <li>Choose whole fruit more often than fruit juice, and include beans, lentils, or cowpeas as useful meal options.</li>
          <li>Where practical, choose whole-grain staples such as oats or brown rice. Be mindful of portions of starchy staples such as rice, yam, cassava, garri, fufu, or swallow.</li>
          <li>Include a suitable protein source and reduce frequent sugary drinks, excess added sugar, and highly processed foods where possible.</li>
        </ul>
        <h3>Simple meal-planning examples</h3>
        <ul className="learning-list">
          <li>Beans with a side of vegetables and a portion of fruit.</li>
          <li>A modest portion of rice with vegetable-rich stew and fish, egg, or beans.</li>
          <li>A portion of eba, amala, or another preferred swallow with vegetable-rich soup and a suitable protein source.</li>
        </ul>
        <p>These are examples, not a prescribed diet or a treatment plan. No food is a guaranteed cure for diabetes. Individual needs can vary with health conditions, medicines, pregnancy, culture, access, and preferences; ask a qualified healthcare professional or dietitian for personal dietary guidance when needed.</p>
        <p className="learning-source">Learn more: <a href="https://www.who.int/news-room/fact-sheets/detail/healthy-diet" rel="noreferrer" target="_blank">World Health Organization: Healthy diet</a> · <a href="https://www.niddk.nih.gov/health-information/diabetes/overview/healthy-living-with-diabetes" rel="noreferrer" target="_blank">NIDDK: Healthy living with diabetes</a></p>
      </section>

      <section aria-labelledby="healthy-lifestyle-title" className="learning-section" id="healthy-lifestyle">
        <div className="learning-section-heading">
          <span className="feature-icon"><Icon name="spark" size={22} /></span>
          <div><span className="eyebrow">HEALTHY LIFESTYLE GUIDE</span><h2 id="healthy-lifestyle-title">Small routines can support wellbeing</h2></div>
        </div>
        <ul className="learning-list">
          <li><strong>Move in ways that suit you:</strong> Regular physical activity can support general health. Choose safe activities that fit your ability and circumstances; ask a professional if you have concerns about starting.</li>
          <li><strong>Make room for rest:</strong> A regular sleep routine and enough rest can support overall wellbeing.</li>
          <li><strong>Avoid tobacco:</strong> Avoid smoking and seek support from a qualified service if you want help stopping.</li>
          <li><strong>Limit harmful alcohol use:</strong> Avoid alcohol or reduce intake where appropriate; ask a healthcare professional if alcohol may interact with a condition or medicine.</li>
          <li><strong>Keep up with check-ups:</strong> Regular health visits can provide an opportunity to discuss concerns and whether any checks are appropriate for you.</li>
        </ul>
        <p>Lifestyle changes can support health, but they do not prevent or reverse diabetes in every person. This information does not replace an individual care plan or advice from a qualified healthcare professional.</p>
        <p className="learning-source">Learn more: <a href="https://www.who.int/news-room/fact-sheets/detail/physical-activity" rel="noreferrer" target="_blank">World Health Organization: Physical activity</a> · <a href="https://www.niddk.nih.gov/health-information/diabetes/overview/healthy-living-with-diabetes" rel="noreferrer" target="_blank">NIDDK: Healthy living with diabetes</a></p>
      </section>

      <section aria-labelledby="frequently-asked-questions-title" className="learning-section faq-section" id="frequently-asked-questions">
        <div className="learning-section-heading">
          <span className="feature-icon"><Icon name="clipboard" size={22} /></span>
          <div><span className="eyebrow">QUICK ANSWERS</span><h2 id="frequently-asked-questions-title">Frequently asked questions</h2></div>
        </div>
        <details className="faq-item">
          <summary>Can diabetes be diagnosed from symptoms alone?</summary>
          <p>No. Symptoms can have different causes. Diagnosis requires appropriate assessment and testing by a qualified healthcare professional.</p>
        </details>
        <details className="faq-item">
          <summary>What is the difference between type 1 and type 2 diabetes?</summary>
          <p>In type 1, the immune system attacks insulin-producing cells. In type 2, the body does not use insulin effectively and may not make enough over time. A healthcare professional can explain an individual diagnosis.</p>
        </details>
        <details className="faq-item">
          <summary>Can someone have diabetes without obvious symptoms?</summary>
          <p>Yes. Some people may have no noticeable symptoms, which is one reason appropriate assessment and testing matter when a healthcare professional recommends them.</p>
        </details>
        <details className="faq-item">
          <summary>Does eating sugar alone cause diabetes?</summary>
          <p>No. Diabetes has different types and multiple contributing factors. Type 1 is not caused by eating sugar; type 2 is associated with a combination of factors, not one food alone.</p>
        </details>
        <details className="faq-item">
          <summary>What should I do if I am concerned about diabetes?</summary>
          <p>Contact a qualified healthcare professional to discuss your concerns and whether testing is appropriate. Seek urgent medical care for severe or rapidly worsening symptoms.</p>
        </details>
        <details className="faq-item">
          <summary>Can this website replace a medical test?</summary>
          <p>No. This is an academic research and education website. Its model classifies self-reported previous diabetes diagnosis in research data; it does not diagnose current diabetes or predict future onset. Only appropriate clinical assessment can address personal health concerns.</p>
        </details>
      </section>

      <section aria-labelledby="education-sources-title" className="education-sources">
        <h2 id="education-sources-title">Trusted information sources</h2>
        <p>This learning centre summarises general public-health information. Visit the source organisations for further reading:</p>
        <ul>
          <li><a href="https://www.who.int/news-room/fact-sheets/detail/diabetes" rel="noreferrer" target="_blank">World Health Organization (WHO) — Diabetes</a></li>
          <li><a href="https://idf.org/about-diabetes/what-is-diabetes/" rel="noreferrer" target="_blank">International Diabetes Federation (IDF) — What is diabetes?</a></li>
          <li><a href="https://www.niddk.nih.gov/health-information/diabetes/overview/symptoms-causes" rel="noreferrer" target="_blank">National Institute of Diabetes and Digestive and Kidney Diseases — Symptoms and causes</a></li>
          <li><a href="https://www.cdc.gov/diabetes/diabetes-testing/" rel="noreferrer" target="_blank">Centers for Disease Control and Prevention — Diabetes testing</a></li>
          <li><a href="https://www.who.int/news-room/fact-sheets/detail/healthy-diet" rel="noreferrer" target="_blank">World Health Organization — Healthy diet</a></li>
        </ul>
      </section>

      <div className="education-actions">
        <Link className="button button-outline" to="/">Back to Home</Link>
        <Link className="button" to="/assessment">Research assessment <Icon name="arrow" size={16} /></Link>
      </div>
    </div>
  )
}

function About() {
  const backend = useBackendStatus()
  return (
    <div className="content-page">
      <PageIntro eyebrow="ABOUT THE RESEARCH" title="A defined question, with clear limits." description="Diabetes Risk Prediction and Feature Selection in a Web Application Using Random Forest and SHAP Analysis is an HND II academic research project—not a clinical service." />
      <div className="about-layout">
        <section className="prose-panel">
          <span className="eyebrow">BACKGROUND AND PROBLEM</span>
          <h2>What this project is exploring</h2>
          <p>Diabetes research datasets contain multiple demographic and health measures. A supervised model can examine how combinations of these recorded features relate to an explicitly defined target, but model outputs can be difficult to interpret and can be mistaken for clinical conclusions.</p>
          <p>This project uses US NHANES 2017–2018 complete-case data to classify <strong>self-reported previous diabetes diagnosis</strong>. It does not predict future diabetes, identify undiagnosed disease, or establish a medical diagnosis. Results are not Nigerian-population estimates.</p>
          <h3>Aim and objectives</h3>
          <p>The aim is to implement and evaluate a web application that presents a Random Forest research classification with feature-selection comparison and interpretable-model research context.</p>
          <ul>
            <li>Prepare documented NHANES measures and define the target without mapping unknown responses to “No”.</li>
            <li>Train and evaluate a Random Forest model using a stratified holdout and training-only cross-validation.</li>
            <li>Compare the baseline feature set with a pre-specified reduced set excluding fasting glucose and HbA1c.</li>
            <li>Integrate validated inputs, model inference, and per-assessment SHAP explanations into the web application.</li>
          </ul>
          <h3>Significance and scope</h3>
          <p>The application demonstrates a transparent machine-learning workflow and makes evaluation and explanation limitations visible to reviewers. Its scope is an academic prototype using the documented complete-case cohort; it does not offer clinical workflow, treatment guidance, or future-risk estimation.</p>
        </section>
        <aside className="project-facts">
          <span className="eyebrow">PROJECT AT A GLANCE</span>
          <dl>
            <div><dt>Study data</dt><dd>Prepared NHANES 2017–2018 research dataset</dd></div>
            <div><dt>Study group</dt><dd>Adults aged 20 and older</dd></div>
            <div><dt>Model approach</dt><dd>Random Forest classifier</dd></div>
            <div><dt>Implemented</dt><dd>Prepared data, Random Forest evaluation, API prediction, and per-assessment SHAP endpoint</dd></div>
            <div><dt>Conditional</dt><dd>SHAP generation requires its optional backend dependency</dd></div>
            <div><dt>Not claimed</dt><dd>Clinical validation, future-onset prediction, or Nigerian population performance</dd></div>
            <div><dt>API status</dt><dd><span className={`status-pill ${backend.online ? 'status-online' : ''}`}>{backend.loading ? 'Checking backend' : backend.online ? 'Backend API available' : 'Backend API unavailable'}</span></dd></div>
          </dl>
        </aside>
      </div>
      <section className="about-architecture">
        <article className="research-detail-card">
          <span className="eyebrow">SYSTEM ARCHITECTURE</span>
          <h2>How the parts connect</h2>
          <p>React/Vite presents the research pages and form. The Flask API validates each request and loads the matching model and evaluation artifacts before inference. SHAP is generated by the backend when its optional dependency is available. Supabase is separate and supports optional account authentication and minimal prediction summaries only.</p>
        </article>
        <article className="research-detail-card">
          <span className="eyebrow">LIMITATIONS</span>
          <h2>What the results cannot establish</h2>
          <p>The complete-case sample is drawn from US NHANES 2017–2018; self-report can miss undiagnosed cases, and fasting glucose or HbA1c may be related to diagnosis or ascertainment. A single unweighted holdout has sampling variability. Neither performance metrics nor SHAP values establish clinical safety, causation, or suitability for care.</p>
        </article>
      </section>
      <section className="researcher-details" aria-label="Researcher information">
        <span className="eyebrow">RESEARCHER</span>
        <p><strong>Edun olufunsho Paul</strong><span>Matriculation number: H/CS/23/1189</span></p>
      </section>
      <Notice>{MEDICAL_DISCLAIMER}</Notice>
    </div>
  )
}

function Methodology() {
  const backend = useBackendStatus()
  const explorationReady = backend.exploration?.ok && backend.exploration.data?.status === 'ready'
  const steps = [
    { number: '01', title: 'Dataset selection and documentation', status: 'Implemented', description: 'Public US NHANES 2017–2018 component files are joined by participant ID. The target is self-reported previous diagnosis, not future onset.' },
    { number: '02', title: 'Quality checks and preprocessing', status: 'Implemented', description: 'The preparation workflow checks source records, joins, eligibility, missingness, and complete-case fields. Unknown or refused target responses are not treated as “No”.' },
    { number: '03', title: 'Exploratory data analysis', status: 'Not implemented', description: 'A separate exploratory-analysis report and interactive distribution dashboard are not currently part of the application.' },
    { number: '04', title: 'Feature selection comparison', status: 'Implemented', description: 'A targeted feature-exclusion experiment compares the eight-feature baseline with a six-feature model excluding fasting glucose and HbA1c. SHAP is not used as a selection method.' },
    { number: '05', title: 'Random Forest training and evaluation', status: 'Implemented', description: 'The serving model is evaluated with a stratified 80/20 holdout and five-fold cross-validation on the training partition. Preprocessing is fit on training data only.' },
    { number: '06', title: 'SHAP interpretation', status: 'Conditional', description: 'The API implements individual tree-model explanations when the optional SHAP dependency is installed. There is no global SHAP summary dashboard.' },
    { number: '07', title: 'Web application integration', status: 'Implemented', description: 'The React form calls the existing Flask validation, prediction, and explanation endpoints. Results are not fabricated when requests fail.' },
    { number: '08', title: 'Testing and responsible interpretation', status: 'Partially implemented', description: 'Automated frontend and backend tests exist. Responsive, accessibility, and manual end-to-end checks still require review; see Validation.' },
  ]

  return (
    <div className="content-page">
      <PageIntro eyebrow="METHODOLOGY" title="From documented data to cautious interpretation." description="The steps below distinguish implemented work from work that is incomplete or not part of this application." />
      <section className="methodology-steps" aria-label="Research workflow">
        {steps.map((step) => (
          <article className="methodology-step" key={step.number}>
            <span className="service-number">{step.number}</span>
            <div><h2>{step.title}<span className={`method-status method-status-${step.status.toLowerCase().replaceAll(' ', '-')}`}>{step.status}</span></h2><p>{step.description}</p></div>
          </article>
        ))}
      </section>
      <section className="research-detail-grid">
        <article className="research-detail-card">
          <span className="eyebrow">WHY RANDOM FOREST?</span>
          <h2>Flexible pattern classification</h2>
          <p>A Random Forest combines many decision trees, which can represent nonlinear relationships and interactions in tabular data. This project uses it as a research classifier; its performance on one holdout does not prove that the model is clinically useful or generalizable.</p>
        </article>
        <article className="research-detail-card">
          <span className="eyebrow">WHY SHAP?</span>
          <h2>Explaining model output</h2>
          <p>SHAP assigns feature contributions to a particular model output. A contribution can push that output up or down on the model’s attribution scale. It does not show that a feature caused diabetes, and it is not a clinical risk score.</p>
        </article>
      </section>
      <section aria-labelledby="evaluation-title" className="exploration-panel research-evaluation">
        <div className="section-heading">
          <div><span className="eyebrow">LIVE MODEL EVALUATION</span><h2 id="evaluation-title">Measured held-out performance</h2></div>
          <span className={`status-pill ${explorationReady ? 'status-online' : ''}`}>{backend.loading ? 'Checking API' : explorationReady ? 'Loaded from model API' : 'Metrics unavailable'}</span>
        </div>
        {explorationReady
          ? <ModelMetrics analyticSample={backend.exploration.data.analytic_sample} evaluation={backend.exploration.data.evaluation} />
          : <p>{backend.exploration?.data?.message || backend.error || 'Start the Flask API to read the actual evaluation artifact. No metrics are substituted or generated in the browser.'}</p>}
        <p className="form-footnote">These unweighted metrics describe the held-out complete-case analytic sample only. The target is self-reported previous diagnosis. The sample is from the United States and does not establish future-onset prediction, Nigerian population performance, clinical safety, or suitability for care.</p>
      </section>
      <div className="inline-action">
        <Link className="button button-outline" to="/explainability">Read about SHAP <Icon name="arrow" size={16} /></Link>
        <Link className="button" to="/validation">Review verification status <Icon name="arrow" size={16} /></Link>
      </div>
    </div>
  )
}

function Explainability() {
  const backend = useBackendStatus()
  const shapStatus = backend.explanation?.data?.status
  const explanationAvailable = shapStatus === 'ready'

  return (
    <div className="content-page">
      <PageIntro eyebrow="MODEL EXPLAINABILITY" title="What a model explanation can—and cannot—say." description="This project uses SHAP for individual outputs when the optional explanation dependency is available. No illustrative values are presented as research findings." />
      <section className="explanation-readiness">
        <div>
          <span className="eyebrow">LIVE SERVICE CHECK</span>
          <h2>Individual explanation availability</h2>
          <p>{backend.loading
            ? 'Checking the Flask model and SHAP service.'
            : !backend.online
              ? 'The Flask API is unavailable. No SHAP values have been requested or displayed.'
              : explanationAvailable
                ? 'The model and SHAP dependency are available. An individual explanation is generated with a real assessment request and shown on its result page.'
                : backend.explanation?.data?.message || 'The SHAP service is currently unavailable. No explanation values are invented.'}</p>
        </div>
        <span className={`status-pill ${explanationAvailable ? 'status-online' : ''}`}>{backend.loading ? 'Checking' : explanationAvailable ? 'Service available' : 'Unavailable'}</span>
      </section>
      <section className="research-detail-grid">
        <article className="research-detail-card">
          <span className="eyebrow">GLOBAL FEATURE IMPORTANCE</span>
          <h2>Patterns across data</h2>
          <p>Global summaries aggregate behavior across many records. This application does not currently publish a global SHAP summary or feature-importance chart, so no overall feature ranking is shown here.</p>
        </article>
        <article className="research-detail-card">
          <span className="eyebrow">INDIVIDUAL EXPLANATION</span>
          <h2>Contributions for one output</h2>
          <p>An individual SHAP result explains contributions to the specific model output for one submitted set of inputs. Positive and negative contributions refer to the model’s output scale, not a person’s medical risk.</p>
        </article>
      </section>
      <section className="research-detail-card explanation-limitations">
        <span className="eyebrow">INTERPRETATION LIMITS</span>
        <h2>Attribution is not causation</h2>
        <p>SHAP values depend on the trained model, input data, and explanation assumptions. Correlated features can affect attribution. A feature contribution does not prove biological causation, clinical significance, or that changing a feature would change health outcomes. The target itself is previous self-reported diagnosis.</p>
      </section>
      <div className="inline-action">
        <Link className="button" to="/assessment">Open the research assessment <Icon name="arrow" size={16} /></Link>
        <Link className="button button-outline" to="/methodology">Review methodology <Icon name="arrow" size={16} /></Link>
      </div>
      <Notice>{MEDICAL_DISCLAIMER}</Notice>
    </div>
  )
}

function Validation() {
  const backend = useBackendStatus()
  const backendStatus = backend.loading ? 'NOT TESTED' : backend.online ? 'PASS' : 'FAIL'
  const modelStatus = backend.loading || !backend.online
    ? 'NOT TESTED'
    : !backend.info?.ok
      ? 'FAIL'
    : backend.info?.data?.model_status === 'ready'
      ? 'PASS'
      : 'BLOCKED'
  const shapStatus = backend.loading || !backend.online
    ? 'NOT TESTED'
    : !backend.explanation?.ok
      ? 'FAIL'
    : backend.explanation?.data?.status === 'ready'
      ? 'PASS'
      : 'BLOCKED'
  const checks = [
    { name: 'Validation page rendering', status: 'PASS', detail: 'This page rendered. This does not verify the other routes or user workflows.' },
    { name: 'Navigation across all routes', status: 'NOT TESTED', detail: 'Visit each navigation destination, including the mobile menu, in a browser test.' },
    { name: 'Form validation and input ranges', status: 'NOT TESTED', detail: 'Validation exists in the form and API, but this page has not submitted test inputs.' },
    { name: 'Frontend build and unit tests', status: 'NOT TESTED', detail: 'Run the listed commands separately; this page does not receive their results.' },
    { name: 'Backend API connectivity', status: backendStatus, detail: backend.loading ? 'Waiting for the live health endpoint.' : backend.online ? 'The Flask health endpoint responded successfully. This confirms API availability only.' : backend.error || 'The Flask health endpoint did not respond successfully.' },
    { name: 'Prediction endpoint inference', status: 'NOT TESTED', detail: 'This page does not send a synthetic assessment or create a prediction.' },
    { name: 'Model artifact loading', status: modelStatus, detail: backend.loading || !backend.online ? 'Requires a live backend response.' : backend.info?.data?.model_status === 'ready' ? `Model ${backend.info.data.model_version || ''} and matching evaluation metadata are reported ready; this does not establish clinical validity.` : backend.info?.data?.message || backend.info?.data?.model_error || 'The backend did not report a ready model.' },
    { name: 'Individual SHAP generation', status: 'NOT TESTED', detail: 'This page does not submit an assessment to generate an individual explanation.' },
    { name: 'SHAP service readiness', status: shapStatus, detail: backend.loading || !backend.online ? 'Requires a live backend response.' : backend.explanation?.data?.message || 'The backend reports the SHAP service ready. This is not a test of an individual explanation.' },
    { name: 'API error handling', status: 'NOT TESTED', detail: 'Error responses are covered by automated backend tests; browser error paths have not been manually exercised here.' },
    { name: 'Patient record workflow', status: 'BLOCKED', detail: 'There is no patient registry, protected clinical-record storage, retention process, or clinical audit trail. Do not enter real patient information.' },
    { name: 'Laboratory diagnostic pathway', status: 'BLOCKED', detail: 'No clinician-approved diagnostic criteria or laboratory-result workflow is implemented. The research model is not a diagnostic pathway.' },
    { name: 'Clinician review and diagnosis', status: 'BLOCKED', detail: 'There are no clinician roles, assignments, review records, or authorized diagnosis workflow.' },
    { name: 'Authentication and authorization', status: 'BLOCKED', detail: 'Optional Supabase sign-in and row-level-secured prediction history do not provide staff roles or protect the Flask prediction endpoints.' },
    { name: 'Responsive layout', status: 'NOT TESTED', detail: 'Review the pages at mobile, tablet, and desktop viewport sizes.' },
    { name: 'Accessibility checks', status: 'NOT TESTED', detail: 'Keyboard, screen-reader, and contrast checks require manual or dedicated accessibility testing.' },
    { name: 'Security readiness', status: 'BLOCKED', detail: 'No hospital security assessment or production controls have been verified. CORS is not authentication; do not send patient data.' },
    { name: 'Clinical validation', status: 'BLOCKED', detail: 'The model uses US NHANES self-reported prior diagnosis data and has no documented clinical validation for Nigerian patients or diagnosis.' },
    { name: 'Production deployment readiness', status: 'BLOCKED', detail: 'HTTPS, production WSGI hosting, monitoring, backup/recovery, and operational approvals are not configured or verified.' },
  ]

  return (
    <div className="content-page">
      <PageIntro eyebrow="VALIDATION AND TESTING" title="Verification status, without guesswork." description="Live backend checks are reported from API responses. Checks that have not actually run remain Not Tested." />
      <div className="validation-note"><Icon name="shield" size={19} /><p><strong>Current readiness: READY FOR TECHNICAL DEMONSTRATION; NOT READY FOR CLINICAL USE.</strong> This is an academic research application, not a hospital clinical service. A passing API or artifact check does not establish clinical validity, production security, or safe use for patient care. This page does not submit sample inputs or create test predictions.</p></div>
      <div className="validation-list" role="list" aria-label="Project verification checklist">
        {checks.map((check) => (
          <article className="validation-row" key={check.name} role="listitem">
            <div><h2>{check.name}</h2><p>{check.detail}</p></div>
            <span className={`validation-status validation-status-${check.status.toLowerCase().replaceAll(' ', '-')}`}>{check.status}</span>
          </article>
        ))}
      </div>
      <section className="research-detail-card validation-commands">
        <span className="eyebrow">REPEATABLE CHECKS</span>
        <h2>Run the available project checks</h2>
        <p>From the project folder in PowerShell, run <code>npm.cmd run build</code>, <code>npm.cmd run lint</code>, and <code>npm.cmd test</code>. Backend tests are available from the backend folder with <code>.\.venv\Scripts\python.exe -m unittest discover -s tests -p &quot;test_*.py&quot; -v</code>.</p>
        <p>These commands verify software behavior, not clinical performance. Manual browser, responsive, keyboard, and accessibility review should be recorded separately.</p>
      </section>
      <div className="inline-action">
        <Link className="button button-outline" to="/assessment">Review the assessment form <Icon name="arrow" size={16} /></Link>
        <Link className="button" to="/methodology">Review measured results <Icon name="arrow" size={16} /></Link>
      </div>
    </div>
  )
}

function Services() {
  const backend = useBackendStatus()
  const auth = useAuth()
  const [historyStatus, setHistoryStatus] = useState({ loading: true, label: 'Checking private history' })

  useEffect(() => {
    let active = true
    async function checkHistory() {
      if (!auth.configured) {
        setHistoryStatus({ loading: false, label: 'Supabase credentials required' })
      } else if (!auth.ready) {
        setHistoryStatus({ loading: true, label: 'Checking authentication' })
      } else if (!auth.user) {
        setHistoryStatus({ loading: false, label: 'Sign-in required' })
      } else {
        try {
          await getPredictionHistory()
          if (active) setHistoryStatus({ loading: false, label: 'Private query available' })
        } catch {
          if (active) setHistoryStatus({ loading: false, label: 'Database setup or access required' })
        }
      }
    }
    checkHistory()
    return () => { active = false }
  }, [auth.configured, auth.ready, auth.user])

  const explorationReady = backend.exploration?.ok && backend.exploration.data?.status === 'ready'
  const modelStatus = backend.loading
    ? 'Checking model'
    : !backend.online
      ? 'Backend unavailable'
      : backend.info?.data?.model_error
        ? 'Model setup incomplete'
      : backend.info?.data?.model_status === 'ready'
        ? 'Evaluated model available'
        : 'Model artifacts unavailable'
  const shapStatus = backend.loading
    ? 'Checking SHAP service'
    : !backend.online
      ? 'Backend unavailable'
      : backend.explanation?.data?.status === 'ready'
        ? 'SHAP service available'
        : backend.explanation?.data?.message || 'SHAP unavailable'
  const services = [
    { number: '01', icon: 'clipboard', title: 'Assessment interface', description: 'Submits validated study fields to the local Flask API. No assessment values are saved in browser storage.', status: 'Form validation available', ready: true },
    { number: '02', icon: 'spark', title: 'Model exploration', description: 'Live status and held-out metrics come from the backend evaluation endpoint; metrics appear only when trained artifacts exist.', status: modelStatus, ready: explorationReady },
    { number: '03', icon: 'heart', title: 'Individual explanations', description: 'The Flask API uses SHAP with the loaded fitted preprocessing pipeline when a real model is configured.', status: shapStatus, ready: backend.explanation?.data?.status === 'ready' },
    { number: '04', icon: 'clock', title: 'Private history', description: 'Supabase Auth and row-level security protect an optional minimal summary; raw assessment fields are not saved.', status: historyStatus.label, ready: historyStatus.label === 'Private query available' },
  ]

  return (
    <div className="content-page">
      <PageIntro eyebrow="SERVICES" title="A research workflow, step by step." description="Model and SHAP availability are checked directly with the connected research service." />
      <div className="service-list">
        {services.map((service) => (
          <article className="service-row" key={service.number}>
            <span className="service-number">{service.number}</span>
            <span className="feature-icon"><Icon name={service.icon} size={21} /></span>
            <div className="service-copy"><h2>{service.title}</h2><p>{service.description}</p></div>
            <span className={`service-status ${service.ready ? 'is-ready' : ''}`}>{service.status}</span>
          </article>
        ))}
      </div>
      <section className="exploration-panel" aria-labelledby="exploration-title">
        <div className="section-heading">
          <div><span className="eyebrow">LIVE MODEL INFORMATION</span><h2 id="exploration-title">Model exploration</h2></div>
          <span className={`status-pill ${explorationReady ? 'status-online' : ''}`}>{explorationReady ? 'Evaluated model' : modelStatus}</span>
        </div>
        {explorationReady
          ? <ModelMetrics analyticSample={backend.exploration.data.analytic_sample} evaluation={backend.exploration.data.evaluation} />
          : <p>{backend.exploration?.data?.message || backend.error || 'No evaluation metrics are available. They will be reported only after model training and held-out evaluation.'}</p>}
        <p className="form-footnote">The approved objective is classification of self-reported previous diabetes diagnosis, not prediction of future diabetes. Any metrics will be unweighted held-out analytic-sample results, not nationally representative estimates.</p>
      </section>
      <div className="inline-action"><Link className="button" to="/assessment">Preview the assessment <Icon name="arrow" size={16} /></Link></div>
    </div>
  )
}

function Contact() {
  const [notice, setNotice] = useState('')

  function handleSubmit(event) {
    event.preventDefault()
    if (!event.currentTarget.reportValidity()) return
    setNotice('This contact form is a frontend preview. Your message has not been sent or saved.')
    event.currentTarget.reset()
  }

  return (
    <div className="content-page">
      <PageIntro eyebrow="CONTACT" title="Get in touch." description="Questions about Faith Clinic or this research service? Use the preview form below." />
      <div className="contact-layout">
        <div className="contact-aside">
          <span className="feature-icon"><Icon name="users" size={22} /></span>
          <h2>Contact Faith Clinic</h2>
          <p>Contact submission is not connected yet, so this form will not send or store your message. You can contact Faith Clinic by phone, WhatsApp, or email.</p>
          <div className="contact-details" aria-label="Faith Clinic contact details">
            <a href="tel:07068432364"><span className="contact-detail-icon"><Icon name="heart" size={17} /></span><span><small>Phone</small><strong>07068432364</strong></span></a>
            <a href="https://wa.me/2347068432364" rel="noreferrer" target="_blank"><span className="contact-detail-icon"><Icon name="users" size={17} /></span><span><small>WhatsApp</small><strong>07068432364</strong></span></a>
            <a href="mailto:olufunsho19@gmail.com"><span className="contact-detail-icon"><Icon name="clipboard" size={17} /></span><span><small>Email</small><strong>olufunsho19@gmail.com</strong></span></a>
          </div>
          <div className="contact-note"><Icon name="shield" size={18} /><span>Please do not include personal health information in this form.</span></div>
        </div>
        <form className="form-card" onSubmit={handleSubmit}>
          <label htmlFor="contact-name">Your name <span aria-hidden="true">*</span></label>
          <input autoComplete="name" id="contact-name" name="name" placeholder="e.g. Alex Morgan" required />
          <label htmlFor="contact-email">Email address <span aria-hidden="true">*</span></label>
          <input autoComplete="email" id="contact-email" name="email" placeholder="you@example.com" required type="email" />
          <label htmlFor="contact-message">Message <span aria-hidden="true">*</span></label>
          <textarea id="contact-message" name="message" placeholder="How can I help?" required rows="5" />
          {notice && <p className="form-message" role="status">{notice}</p>}
          <button className="button form-submit" type="submit">Preview message <Icon name="arrow" size={16} /></button>
          <p className="form-footnote">Required fields are marked with an asterisk.</p>
        </form>
      </div>
    </div>
  )
}

function AuthPage({ mode }) {
  const isSignup = mode === 'signup'
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const auth = useAuth()
  const navigate = useNavigate()

  async function handleSubmit(event) {
    event.preventDefault()
    if (!event.currentTarget.reportValidity()) return
    if (!auth.configured) {
      setMessage('Supabase authentication is not configured. No credentials were sent and no account was created.')
      return
    }

    setBusy(true)
    setMessage('')
    const formData = new FormData(event.currentTarget)
    const email = String(formData.get('email')).trim()
    const password = String(formData.get('password'))
    try {
      if (isSignup) {
        const data = await auth.signUp(email, password)
        if (data.session) {
          navigate('/dashboard', { replace: true })
        } else {
          setMessage('Your account was created, but automatic sign-in was unsuccessful. Please check your Supabase email confirmation settings.')
        }
      } else {
        await auth.signIn(email, password)
        navigate('/dashboard', { replace: true })
      }
    } catch (error) {
      setMessage(error.message || 'Authentication could not be completed.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-side">
        <span className="auth-decoration decoration-one" /><span className="auth-decoration decoration-two" />
        <span className="eyebrow">ACADEMIC RESEARCH</span>
        <h1>{isSignup ? 'Start with a clear picture.' : 'Welcome back.'}</h1>
        <p>{isSignup ? 'Create an account using the configured Supabase Auth project.' : 'Sign in through the configured Supabase Auth project.'}</p>
        <div className="auth-side-note"><Icon name="lock" size={18} /> {auth.configured ? 'Supabase Auth integration enabled' : 'Supabase setup required'}</div>
      </div>
      <div className="auth-form-wrap">
        <form className="form-card auth-form" onSubmit={handleSubmit}>
          <div className="form-heading"><span className="eyebrow">{isSignup ? 'CREATE ACCOUNT' : 'SIGN IN'}</span><h2>{isSignup ? 'Join the research workspace' : 'Log in to your workspace'}</h2><p>{auth.configured ? 'Authentication is handled by Supabase. Do not enter health information here.' : 'Connect the Supabase project in the local environment before using authentication.'}</p></div>
          {!isSignup && <>
            <label htmlFor="auth-full-name">Full name</label>
            <input autoComplete="off" id="auth-full-name" placeholder="Enter your full name" type="text" aria-describedby="auth-full-name-note" />
            <p className="form-footnote" id="auth-full-name-note">Optional. This field is not used for sign-in and is not sent or saved.</p>
          </>}
          <label htmlFor="auth-email">Email address <span aria-hidden="true">*</span></label>
          <input autoComplete="email" id="auth-email" name="email" placeholder="you@example.com" required type="email" />
          <label htmlFor="auth-password">Password <span aria-hidden="true">*</span></label>
          <input autoComplete={isSignup ? 'new-password' : 'current-password'} id="auth-password" minLength="8" name="password" placeholder="At least 8 characters" required type="password" />
          {message && <p className="form-message" role="status">{message}</p>}
          {auth.error && <Notice tone="error">{auth.error}</Notice>}
          {!auth.configured && <Notice tone="error">Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in the local environment and apply the database migration. A service-role key must never be used in frontend code.</Notice>}
          <button className="button form-submit" disabled={busy || !auth.configured} type="submit">{busy ? 'Connecting…' : isSignup ? 'Create account' : 'Log in'} <Icon name="arrow" size={16} /></button>
          <p className="auth-switch">{isSignup ? 'Already have an account?' : 'New to the project?'} <Link to={isSignup ? '/login' : '/signup'}>{isSignup ? 'Log in' : 'Create account'}</Link></p>
        </form>
      </div>
    </div>
  )
}

function Dashboard() {
  const auth = useAuth()
  return (
    <div className="content-page workspace-page">
      <PageIntro eyebrow="USER DASHBOARD" title="Your research workspace." description={`Signed in as ${auth.user?.email || 'authenticated user'}. Private history is queried from Supabase under row-level security.`} />
      <div className="dashboard-welcome"><div><span className="eyebrow">WORKSPACE OVERVIEW</span><h2>Welcome to your research workspace</h2><p>Assessment results are calculated by the configured Flask research API. Save a minimal history entry only when you explicitly opt in.</p></div><span className="status-pill status-online">Authenticated</span></div>
      <div className="dashboard-grid">
        <article className="dashboard-card"><span className="feature-icon"><Icon name="clipboard" /></span><span className="card-kicker">ASSESSMENT</span><h3>Start an assessment</h3><p>Explore the form fields approved for the study.</p><Link className="text-link" to="/assessment">Open form preview <Icon name="arrow" size={15} /></Link></article>
        <article className="dashboard-card"><span className="feature-icon"><Icon name="spark" /></span><span className="card-kicker">RESULTS</span><h3>Prediction results</h3><p>Actual classifications appear only when a trained model returns a result.</p><Link className="text-link" to="/results">View status <Icon name="arrow" size={15} /></Link></article>
        <article className="dashboard-card"><span className="feature-icon"><Icon name="clock" /></span><span className="card-kicker">HISTORY</span><h3>Prediction history</h3><p>Review saved summaries protected by your Supabase account and row-level security.</p><Link className="text-link" to="/history">View history <Icon name="arrow" size={15} /></Link></article>
      </div>
      <div className="dashboard-footnote"><Icon name="shield" size={17} /> Nothing entered in the form is stored in this browser.</div>
    </div>
  )
}

const assessmentFields = [
  { id: 'age', label: 'Age', type: 'number', unit: 'years', min: '20', max: '120', placeholder: 'e.g. 45', autocomplete: 'off', help: 'Study input range: 20–120 years.' },
  { id: 'sex', label: 'Sex (as recorded by NHANES)', type: 'select', options: ['Female', 'Male'], help: 'Choose one of the categories used in the model schema.' },
  { id: 'bmi', label: 'Body mass index (BMI)', type: 'number', unit: 'kg/m²', min: '0', step: '0.1', placeholder: 'e.g. 26.4', autocomplete: 'off', help: 'Enter a positive value in kilograms per square metre.' },
  { id: 'hypertension', label: 'Ever told you had high blood pressure?', type: 'select', options: ['Yes', 'No'], help: 'Select the recorded questionnaire category.' },
  { id: 'heart-disease', label: 'Ever told you had coronary heart disease?', type: 'select', options: ['Yes', 'No'], help: 'Select the recorded questionnaire category.' },
  { id: 'glucose', label: 'Fasting blood glucose', type: 'number', unit: 'mg/dL', min: '0', step: '0.1', placeholder: 'e.g. 98', autocomplete: 'off', help: 'Enter a positive fasting glucose value in mg/dL.' },
  { id: 'hba1c', label: 'HbA1c', type: 'number', unit: '%', min: '0', step: '0.1', placeholder: 'e.g. 5.6', autocomplete: 'off', help: 'Enter a positive percentage value.' },
  { id: 'smoking', label: 'Cigarette smoking history', type: 'select', options: ['Never', 'Former', 'Current'], help: 'Choose the category that matches the dataset field.' },
]

const featureLabels = {
  age: 'Age',
  sex: 'Sex as recorded by NHANES',
  bmi: 'Body mass index (BMI)',
  hypertension: 'Self-reported hypertension history',
  heart_disease: 'Self-reported coronary heart disease',
  fasting_glucose: 'Fasting blood glucose',
  hba1c: 'HbA1c',
  smoking_history: 'Cigarette smoking history',
}

function Assessment() {
  const navigate = useNavigate()
  const auth = useAuth()
  const { setReport } = useAssessmentReport()
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [saveHistory, setSaveHistory] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()
    const form = event.currentTarget
    if (!form.checkValidity()) {
      setError('Please complete each required field before continuing.')
      form.reportValidity()
      form.querySelector(':invalid')?.focus()
      return
    }
    setError('')
    setReport(null)
    setBusy(true)
    const values = new FormData(form)
    const features = {
      age: Number(values.get('age')),
      sex: String(values.get('sex')),
      bmi: Number(values.get('bmi')),
      hypertension: String(values.get('hypertension')),
      heart_disease: String(values.get('heart-disease')),
      fasting_glucose: Number(values.get('glucose')),
      hba1c: Number(values.get('hba1c')),
      smoking_history: String(values.get('smoking')),
    }

    try {
      const prediction = await predictAssessment(features)
      let explanation = null
      let explanationError = ''
      try {
        explanation = await explainAssessment(features)
      } catch (requestError) {
        explanationError = requestError.message || 'An individual SHAP explanation is unavailable.'
      }

      let historySaved = false
      let historyError = ''
      if (saveHistory) {
        try {
          await savePredictionSummary(prediction)
          historySaved = true
        } catch (requestError) {
          historyError = requestError.message || 'The result could not be saved to private history.'
        }
      }
      setReport({ prediction, explanation, explanationError, historySaved, historyError })
      navigate('/results')
    } catch (requestError) {
      setError(
        requestError.message
        || 'The research API could not calculate an assessment. No prediction was created.',
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="content-page assessment-page">
      <PageIntro eyebrow="RESEARCH ASSESSMENT" title="Research input form." description="A valid submission is sent to the configured research service. If the model or service is unavailable, an error is shown instead of an invented result." />
      <Notice>{MEDICAL_DISCLAIMER}</Notice>
      <div className="assessment-layout">
        <form className="form-card assessment-form" noValidate onSubmit={handleSubmit}>
          <div className="form-heading"><span className="eyebrow">ASSESSMENT FIELDS</span><h2>Enter the study fields</h2><p>Required values are sent to the configured Flask API for processing. They are held in page memory only and are not written to browser storage.</p></div>
          <div className="assessment-fields">
            {assessmentFields.map((field) => (
              <div className="field-group" key={field.id}>
                <label htmlFor={field.id}>{field.label} <span aria-hidden="true">*</span></label>
                <div className={`input-with-unit ${field.type === 'select' ? 'select-wrap' : ''}`}>
                  {field.type === 'select' ? (
                    <select aria-describedby={`${field.id}-help`} defaultValue="" id={field.id} name={field.id} required>
                      <option disabled value="">Select an option</option>
                      {field.options.map((option) => <option key={option} value={option}>{option}</option>)}
                    </select>
                  ) : (
                    <input aria-describedby={`${field.id}-help`} autoComplete={field.autocomplete} id={field.id} max={field.max} min={field.min} name={field.id} placeholder={field.placeholder} required step={field.step || '1'} type="number" />
                  )}
                  {field.unit && <span className="input-unit">{field.unit}</span>}
                </div>
                <p className="field-help" id={`${field.id}-help`}>{field.help}</p>
              </div>
            ))}
          </div>
          {error && <p className="form-message error-message" role="alert">{error}</p>}
          <fieldset className="history-opt-in">
            <legend>Optional private history</legend>
            <label className="history-opt-in-label">
              <input
                checked={saveHistory}
                disabled={!auth.user || !auth.configured}
                onChange={(event) => setSaveHistory(event.target.checked)}
                type="checkbox"
              />
              Save a minimal prediction summary to my authenticated history.
            </label>
            <p>Only the predicted class, model version, and database timestamp are saved. Assessment fields and uncalibrated model probabilities are not saved to history.</p>
            {!auth.configured && <p>Supabase is not configured; saving is unavailable.</p>}
            {auth.configured && !auth.user && <p><Link to="/login">Sign in</Link> to enable optional history saving.</p>}
          </fieldset>
          <button className="button form-submit" disabled={busy} type="submit">{busy ? 'Checking model…' : 'Submit assessment'} <Icon name="arrow" size={16} /></button>
          <p className="form-footnote">The target is self-reported previous diagnosis—not future diabetes. The model output is not medical advice.</p>
        </form>
        <aside className="assessment-aside">
          <div className="aside-icon"><Icon name="shield" size={23} /></div>
          <h2>How your information is handled</h2>
          <p>Assessment fields are sent only to the configured API for the submitted request. This interface does not keep them in localStorage or sessionStorage. Optional history stores only a minimal model-result summary in your authenticated Supabase account.</p>
          <div className="aside-divider" />
          <span className="eyebrow">INPUT NOTES</span>
          <ul><li>Study population: adults aged 20+</li><li>Glucose input refers to fasting glucose</li><li>Smoking categories follow questionnaire history</li><li>Sex wording reflects NHANES documentation</li></ul>
          <Link className="text-link" to="/about">Read about the study <Icon name="arrow" size={15} /></Link>
        </aside>
      </div>
    </div>
  )
}

function Results() {
  const [area, setArea] = useState('')
  const [facilityStatus, setFacilityStatus] = useState('idle')
  const [facilityError, setFacilityError] = useState('')
  const [facilityResults, setFacilityResults] = useState([])
  const [locationSuggestions, setLocationSuggestions] = useState([])
  const [locationLabel, setLocationLabel] = useState('')
  const [facilitySourceDate, setFacilitySourceDate] = useState('')
  const [facilitySource, setFacilitySource] = useState('')
  const [registryMessage, setRegistryMessage] = useState('')
  const backend = useBackendStatus()
  const { report } = useAssessmentReport()
  const prediction = report?.prediction
  const explanation = report?.explanation
  const predictionDisplay = getPredictionDisplay(prediction)
  const modelStatusLabel = backend.loading
    ? 'Checking status'
    : !backend.online
      ? 'Backend unavailable'
      : backend.info?.data?.model_error
        ? 'Model setup incomplete'
        : backend.info?.data?.model_status === 'ready'
          ? 'Model ready'
          : 'Model unavailable'
  const currentStatus = backend.loading
    ? 'Checking backend and model status…'
    : !backend.online
      ? 'The Flask backend is unavailable. No prediction has been calculated in this page.'
      : prediction
        ? 'A model result was returned for the assessment held in this page session.'
        : backend.info?.data?.model_error
          ? backend.info.data.message
        : backend.info?.data?.model_status === 'ready'
          ? 'No assessment has been submitted in this page session. Complete the form to request a real model result.'
          : 'Results are unavailable because the research model artifacts are missing or invalid. No prediction has been calculated.'
  const explanationMatchesPrediction = Boolean(
    prediction
    && explanation?.status === 'ready'
    && explanation.predicted_class === prediction.predicted_class
    && explanation.model_version === prediction.model_version,
  )

  async function loadNearbyFacilities(location, label) {
    setFacilityStatus('loading')
    setFacilityError('')
    setFacilityResults([])
    setLocationSuggestions([])
    setLocationLabel(label)
    try {
      const result = await searchNearbyFacilities(location)
      setFacilityResults(result.facilities)
      setFacilitySource(result.source)
      setRegistryMessage(result.registryMessage)
      setFacilityStatus('ready')
      const sourceDates = result.facilities
        .map((facility) => facility.updatedAt)
        .filter(Boolean)
        .sort()
      setFacilitySourceDate(sourceDates.at(-1) || '')
    } catch (error) {
      setFacilityStatus('error')
      setFacilityError(error.message || 'Nearby map listings could not be loaded.')
    }
  }

  function getCurrentLocation() {
    setFacilityError('')
    if (!navigator.geolocation) {
      setFacilityStatus('error')
      setFacilityError('Location access is not available in this browser. Search for a location by name instead.')
      return
    }
    setFacilityStatus('loading')
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const location = { latitude: coords.latitude, longitude: coords.longitude }
        void loadNearbyFacilities(location, 'your approximate current location')
      },
      (error) => {
        setFacilityStatus('error')
        setFacilityError(
          error.code === error.PERMISSION_DENIED
            ? 'Location permission was not granted. You can search by entering a city or area below.'
            : 'Your location could not be determined. You can search by entering a city or area below.',
        )
      },
      { enableHighAccuracy: false, maximumAge: 60000, timeout: 10000 },
    )
  }

  async function handleFacilitySearch(event) {
    event.preventDefault()
    const query = area.trim()
    if (!query) {
      setFacilityStatus('error')
      setFacilityError('Enter a city, town, or area to search nearby map listings.')
      return
    }
    setFacilityStatus('loading')
    setFacilityError('')
    setFacilityResults([])
    setLocationSuggestions([])
    try {
      const suggestions = await searchLocations(query)
      if (suggestions.length === 0) {
        setFacilityStatus('empty')
        setFacilityError('No matching location was found. Check the spelling or try a nearby city.')
        return
      }
      setLocationSuggestions(suggestions)
      setFacilityStatus('choose-location')
    } catch (error) {
      setFacilityStatus('error')
      setFacilityError(error.message || 'The location search is temporarily unavailable.')
    }
  }

  return (
    <div className="report-page">
      <header className="report-header">
        <div className="report-brand">
          <span className="report-brand-mark"><Icon name="heart" size={23} /></span>
          <span><strong>Faith Clinic</strong><small>HND II ACADEMIC RESEARCH PROJECT</small></span>
        </div>
        <button className="button report-print-button" onClick={() => window.print()} type="button">
          <Icon name="printer" size={17} /> Print Report
        </button>
      </header>

      <main className="report-content">
        <div className="report-heading">
          <span className="eyebrow">ASSESSMENT SUMMARY</span>
          <h1>Diabetes Assessment Report</h1>
          <p>Research classification report · Faith Clinic</p>
        </div>

        <section aria-labelledby="assessment-status-title" className="report-result-card">
          <div className="report-status-top">
            <span className="report-status-icon"><Icon name="clock" size={23} /></span>
            <span className={`status-pill ${prediction ? 'status-online' : ''}`}>{prediction ? 'Live model output' : modelStatusLabel}</span>
          </div>
          <h2 id="assessment-status-title">{prediction ? 'Research model classification' : 'Assessment result unavailable'}</h2>
          <p className="report-result-message" role="status">{prediction ? 'This is the model’s classification of the submitted information. It is not a finding about your current health.' : currentStatus}</p>
          <div className="report-result-divider" />
          {prediction
            ? <div className="report-prediction-output">
                <div><span>Model prediction</span><strong>{predictionDisplay.classification}</strong></div>
                <div><span>Research class</span><strong>{prediction.predicted_class}</strong></div>
                <div><span>Model version</span><strong>{prediction.model_version}</strong></div>
                <p>{predictionDisplay.isPositive
                  ? 'The model placed the submitted fields in the class associated with previously self-reported diabetes diagnosis in the research data. This is not confirmation of diabetes.'
                  : predictionDisplay.isNegative
                    ? 'The model placed the submitted fields in the class associated with no previously self-reported diabetes diagnosis in the research data. This does not rule out diabetes.'
                    : 'The model response did not include a recognized research class, so its result cannot be interpreted here.'}</p>
                <p>These classifications concern previous self-reported diagnosis only. A positive result is not a clinical diagnosis, and a negative result does not rule out diabetes or replace appropriate testing by a qualified healthcare professional.</p>
              </div>
            : <p className="report-result-context">No patient-specific information or assessment date is included in this report.</p>}
          {report?.historySaved && <p className="history-save-result" role="status">Minimal prediction summary saved to your authenticated Supabase history.</p>}
          {report?.historyError && <p className="history-save-error" role="alert">The model result was returned, but history could not be saved: {report.historyError}</p>}
          <Link className="button button-outline report-assessment-link" to="/assessment">Return to research assessment <Icon name="arrow" size={16} /></Link>
        </section>

        <section aria-labelledby="model-meaning-title" className="report-section">
          <div className="report-section-heading">
            <span className="report-section-icon"><Icon name="clipboard" size={20} /></span>
            <div><span className="eyebrow">ABOUT THE CLASSIFICATION</span><h2 id="model-meaning-title">What this result will mean</h2></div>
          </div>
          <p>Faith Clinic's diabetes assessment provides research-based model predictions and educational information. It does not establish a medical diagnosis. The model classifies self-reported previous diabetes diagnosis in a research dataset; it was not designed or clinically validated to diagnose current diabetes or predict future onset. Consult a qualified healthcare professional for appropriate testing, assessment, and treatment.</p>
          {prediction && <p className="report-small-note">Any class output shown above is uncalibrated and must not be interpreted as a person's clinical probability or health status. No classification can confirm or rule out a person's health condition.</p>}
        </section>

        <section aria-labelledby="factors-title" className="report-section factors-section">
          <div className="report-section-heading">
            <span className="report-section-icon"><Icon name="spark" size={20} /></span>
            <div><span className="eyebrow">MODEL EXPLANATION</span><h2 id="factors-title">Factors contributing to the model result</h2></div>
          </div>
          {explanationMatchesPrediction
            ? <div className="shap-results">
                <p>These real SHAP values explain the model classification shown above ({explanation.predicted_class}). Positive values push this model output upward; negative values push it downward. This technical output is not a measure of a person’s health or a medical risk.</p>
                <ul>
                  {explanation.feature_contributions.map((item) => (
                    <li key={item.feature}>
                      <span>{featureLabels[item.feature] || item.feature}</span>
                      <strong>{item.shap_value > 0 ? '+' : ''}{item.shap_value.toFixed(5)}</strong>
                    </li>
                  ))}
                </ul>
              </div>
            : <div className="shap-unavailable">
                <span className="shap-unavailable-icon"><Icon name="lock" size={18} /></span>
                <div><strong>{prediction ? 'SHAP explanation unavailable' : 'Feature contributions are not available yet'}</strong><p>{explanation?.status === 'ready' && !explanationMatchesPrediction ? 'This explanation does not match the displayed classification or model version, so it is not shown.' : report?.explanationError || backend.explanation?.data?.message || 'No SHAP values are shown because no genuine model explanation has been returned.'} No feature rankings or values are simulated.</p></div>
              </div>}
          {explanationMatchesPrediction && <p className="report-small-note">Baseline output: {explanation.base_value.toFixed(5)} ({explanation.attribution_scale}); shown for the same model version and class as the prediction.</p>}
          <p>SHAP values describe how features contribute to a model output; they do not prove that a feature caused diabetes or establish clinical significance.</p>
        </section>

        <section aria-labelledby="wellbeing-title" className="report-section wellbeing-section">
          <div className="report-section-heading">
            <span className="report-section-icon"><Icon name="leaf" size={20} /></span>
            <div><span className="eyebrow">GENERAL EDUCATION</span><h2 id="wellbeing-title">Healthy eating and everyday wellbeing</h2></div>
          </div>
          <p className="wellbeing-intro">A varied, balanced way of eating can include familiar foods from different food groups. These examples are general education and are not tied to a model result.</p>
          <ul className="wellbeing-list">
            <li><span className="wellbeing-bullet"><Icon name="check" size={15} /></span><span><strong>Include vegetables:</strong> ugu, spinach, and other leafy greens can add variety to meals.</span></li>
            <li><span className="wellbeing-bullet"><Icon name="check" size={15} /></span><span><strong>Choose legumes and protein sources:</strong> beans and other legumes, fish, eggs, and other suitable proteins can be part of varied meals.</span></li>
            <li><span className="wellbeing-bullet"><Icon name="check" size={15} /></span><span><strong>Balance carbohydrate portions:</strong> whole grains and sensible portions of rice, maize, yam, and other carbohydrate-rich foods can fit into balanced meals.</span></li>
            <li><span className="wellbeing-bullet"><Icon name="check" size={15} /></span><span><strong>Choose drinks thoughtfully:</strong> consider whole fruit more often than sweetened drinks or large amounts of fruit juice, and drink water.</span></li>
            <li><span className="wellbeing-bullet"><Icon name="check" size={15} /></span><span><strong>Vary foods:</strong> where possible, limit sugary drinks and foods high in excess salt or unhealthy fats.</span></li>
          </ul>
          <div className="diet-notice"><Icon name="shield" size={19} /><p>These are general educational suggestions, not a personalized medical diet. Dietary needs vary from person to person. People with diagnosed diabetes, kidney disease, food allergies, pregnancy, or other specific dietary needs should seek individualized advice from a qualified healthcare professional or registered dietitian. Do not stop prescribed medication or change treatment based on this report.</p></div>
        </section>

        <section aria-labelledby="facility-title" className="report-section facility-section">
          <div className="report-section-heading">
            <span className="report-section-icon"><Icon name="map" size={20} /></span>
            <div><span className="eyebrow">HEALTHCARE DIRECTORY</span><h2 id="facility-title">Find a healthcare facility</h2></div>
          </div>
          <p>Search nearby OpenStreetMap health facility listings using your approximate location or a place you enter. Listings come from community-contributed map data and are <strong>not verified as registered</strong> by this website. Use the official Nigeria Health Facility Registry below to check registration.</p>
          <form className="facility-search" onSubmit={handleFacilitySearch}>
            <label htmlFor="facility-area">State, city, or area</label>
            <div className="facility-search-controls">
              <input autoComplete="address-level2" id="facility-area" onChange={(event) => setArea(event.target.value)} placeholder="e.g. state, city, or area" value={area} />
              <button className="button" disabled={facilityStatus === 'loading'} type="submit">Search this area</button>
            </div>
            <button className="button button-outline facility-location-button" disabled={facilityStatus === 'loading'} onClick={getCurrentLocation} type="button">Use my current location</button>
            <p className="facility-privacy-note">Your approximate coordinates are sent to this service to search the official registry and may be sent to OpenStreetMap community servers if the registry is unavailable. A typed place is sent to the Photon geocoder. This website does not save your location.</p>
            {facilityStatus === 'loading' && <p className="facility-message" role="status">Finding nearby map listings…</p>}
            {facilityError && <p className="facility-message" role={facilityStatus === 'error' ? 'alert' : 'status'}>{facilityError}</p>}
            {locationSuggestions.length > 0 && <div aria-label="Choose a matching location" className="facility-location-options">
              <p>Select the matching location:</p>
              {locationSuggestions.map((suggestion) => (
                <button key={suggestion.id} onClick={() => void loadNearbyFacilities(suggestion, suggestion.label)} type="button">{suggestion.label}</button>
              ))}
            </div>}
          </form>
          {facilityStatus === 'ready' && (
            <div aria-live="polite" className="facility-results">
              <h3>Map listings near {locationLabel}</h3>
              {facilityResults.length === 0
                ? <p>No named healthcare listings were found within 5 km. Try a different area or check the official registry. {registryMessage && `The official registry search is unavailable: ${registryMessage}`}</p>
                : <>
                    <p className="facility-source-note">
                      {facilitySource === 'official_registry'
                        ? 'Source: Nigeria Health Facility Registry. Facilities confirmed as registered are listed first; other registration statuses are shown separately.'
                        : `Source: OpenStreetMap community data. Facility registration is unverified. ${registryMessage}`}
                      {' '}Distances are approximate straight-line distances, sorted by registration status and then distance. {facilitySourceDate ? `Latest listing update shown: ${new Date(facilitySourceDate).toLocaleDateString()}.` : 'The source did not provide listing update dates.'}
                    </p>
                    <ul className="facility-result-list">
                      {facilityResults.map((facility) => (
                        <li key={facility.id}>
                          <div className="facility-result-heading"><h4>{facility.name}</h4><span>{facility.distance < 1 ? `${Math.round(facility.distance * 1000)} m` : `${facility.distance.toFixed(1)} km`}</span></div>
                          <p>{facility.address || 'Address not provided in the registry record.'}</p>
                          <p className={facilitySource === 'official_registry' && facility.registered ? 'facility-registered' : 'facility-unverified'}>
                            {facilitySource === 'official_registry'
                              ? facility.registered
                                ? 'Registered · Nigeria Health Facility Registry'
                                : `Registration status: ${facility.registrationStatus}`
                              : 'OpenStreetMap listing · registration not verified'}
                          </p>
                          {facility.operationalStatus && <p>Operational status: {facility.operationalStatus}</p>}
                          <div className="facility-result-links">
                            {facility.phone && <a href={`tel:${facility.phone.replace(/[^\d+]/g, '')}`}>Call {facility.phone}</a>}
                            <a href={facility.directionsUrl} rel="noreferrer" target="_blank">Directions</a>
                            <a href={facility.mapUrl} rel="noreferrer" target="_blank">View map listing</a>
                          </div>
                          {facility.updatedAt && <small>{facilitySource === 'official_registry' ? 'Registry record updated' : 'Map entry last edited'} {new Date(facility.updatedAt).toLocaleDateString()}.</small>}
                        </li>
                      ))}
                    </ul>
                  </>}
            </div>
          )}
          <a className="registry-link" href="https://hfr.fmohconnect.gov.ng/" rel="noreferrer" target="_blank">
            <span><strong>Open the Nigeria Health Facility Registry</strong><small>Official Federal Ministry of Health registry · opens in a new tab</small></span>
            <Icon name="arrow" size={18} />
          </a>
          <p className="facility-reminder">The Health Facility Registry API requires an approved key configured only on the backend. Request access through its <a href="https://hfr.fmohconnect.gov.ng/developers" rel="noreferrer" target="_blank">developer portal</a>. When it is not configured or available, this page falls back to OpenStreetMap listings; registration is then unverified. Confirm current services and availability directly before travelling. Map data © <a href="https://www.openstreetmap.org/copyright" rel="noreferrer" target="_blank">OpenStreetMap contributors</a>.</p>
        </section>

        <section aria-labelledby="safety-title" className="report-safety">
          <span className="report-safety-icon"><Icon name="shield" size={22} /></span>
          <div><h2 id="safety-title">Important medical disclaimer</h2><p>{MEDICAL_DISCLAIMER}</p><p>The model was developed to classify self-reported previous diabetes diagnosis in a research dataset; it was not designed or clinically validated to diagnose current diabetes or predict future onset.</p></div>
        </section>

        <footer className="report-researcher">
          <div className="researcher-heading"><span className="eyebrow">PROJECT RESEARCHER</span><strong>HND II Academic Research Project</strong></div>
          <dl>
            <div><dt>Researcher</dt><dd>Edun olufunsho Paul</dd></div>
            <div><dt>Matriculation number</dt><dd>H/CS/23/1189</dd></div>
            <div><dt>Project</dt><dd>Diabetes Risk Prediction and Feature Selection in a Web Application Using Random Forest and SHAP Analysis.</dd></div>
          </dl>
        </footer>
      </main>
    </div>
  )
}

function History() {
  const auth = useAuth()
  const [records, setRecords] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    async function loadHistory() {
      if (!auth.configured || !auth.ready || !auth.user) {
        setLoading(false)
        return
      }
      setLoading(true)
      setError('')
      try {
        const history = await getPredictionHistory()
        if (active) setRecords(history)
      } catch (requestError) {
        if (active) setError(requestError.message || 'Private prediction history could not be loaded.')
      } finally {
        if (active) setLoading(false)
      }
    }
    loadHistory()
    return () => { active = false }
  }, [auth.configured, auth.ready, auth.user])

  return (
    <div className="content-page status-page">
      <PageIntro eyebrow="PREDICTION HISTORY" title="Your private prediction history." description="History is retrieved from Supabase using the signed-in account and database row-level security." />
      {auth.error && <Notice tone="error">{auth.error}</Notice>}
      {loading
        ? <p className="history-state" role="status">Loading private history…</p>
        : error
          ? <Notice tone="error">{error} Check that the migration is applied and that the signed-in user is authorized.</Notice>
          : records.length === 0
            ? <section className="unavailable-card history-unavailable">
                <div className="unavailable-icon"><Icon name="clock" size={25} /></div>
                <span className="status-pill status-online">Private query completed</span>
                <h2>No saved summaries yet</h2>
                <p>History saving is optional. On the assessment form, opt in to save a minimal summary after a genuine model response.</p>
                <div className="empty-history-row"><Icon name="lock" size={20} /><span>Raw assessment fields are not stored in history.</span></div>
                <Link className="button button-outline" to="/assessment">Open assessment <Icon name="arrow" size={16} /></Link>
              </section>
            : <section aria-label="Saved prediction summaries" className="history-list">
                {records.map((record) => (
                  <article className="history-record" key={record.id}>
                    <div className="history-record-icon"><Icon name="clipboard" size={20} /></div>
                    <div className="history-record-main">
                      <strong>{record.predicted_class}</strong>
                      <span>{new Date(record.created_at).toLocaleString()}</span>
                    </div>
                    <div className="history-record-meta">
                      <span>Model score</span>
                      <strong>Not displayed</strong>
                      <small>Model {record.model_version}</small>
                    </div>
                  </article>
                ))}
                <p className="form-footnote">Only minimal summaries are shown. Assessment input fields and SHAP feature details are not saved in this history.</p>
              </section>}
    </div>
  )
}

function ProtectedRoute({ children }) {
  const auth = useAuth()
  if (auth.error) {
    return (
      <div className="content-page status-page">
        <PageIntro eyebrow="AUTHENTICATION ERROR" title="We could not check your session." description="Supabase returned an error while checking your sign-in status. Please check the project settings and try again." />
        <Notice tone="error">{auth.error}</Notice>
        <Link className="button" to="/login">Go to login <Icon name="arrow" size={16} /></Link>
      </div>
    )
  }
  if (!auth.configured) {
    return (
      <div className="content-page status-page">
        <PageIntro eyebrow="ACCOUNT REQUIRED" title="Supabase setup is required." description="Private workspace pages are unavailable until the project's Supabase URL, public anon key, and database migration are configured." />
        <Notice tone="error">No service-role secret belongs in frontend configuration. Use only the Supabase project URL and public anon key.</Notice>
        <Link className="button" to="/login">Authentication setup <Icon name="arrow" size={16} /></Link>
      </div>
    )
  }
  if (!auth.ready) return <div className="content-page"><p role="status">Checking authentication…</p></div>
  if (!auth.user) {
    return (
      <div className="content-page status-page">
        <PageIntro eyebrow="SIGN IN REQUIRED" title="This workspace is private." description="Sign in through Supabase Auth to access the dashboard and prediction history." />
        <Link className="button" to="/login">Log in <Icon name="arrow" size={16} /></Link>
      </div>
    )
  }
  return children
}

function NotFound() {
  return (
    <div className="content-page not-found">
      <span className="eyebrow">PAGE NOT FOUND</span><h1>That page isn’t here.</h1><p>Use the site navigation to continue exploring the project.</p><Link className="button" to="/">Return home <Icon name="arrow" size={16} /></Link>
    </div>
  )
}

function AppLayout() {
  const location = useLocation()
  const isStaffWorkspace = location.pathname === '/staff' || location.pathname.startsWith('/staff/')

  return (
    <div className="app-shell">
      {!isStaffWorkspace && <Header />}
      <main id="main-content">
        <Routes>
          <Route element={<StaffWorkspace />} path="/staff/*" />
          <Route element={<Home />} path="/" />
          <Route element={<Education />} path="/education" />
          <Route element={<About />} path="/about" />
          <Route element={<Methodology />} path="/methodology" />
          <Route element={<Explainability />} path="/explainability" />
          <Route element={<Validation />} path="/validation" />
          <Route element={<Services />} path="/services" />
          <Route element={<Contact />} path="/contact" />
          <Route element={<AuthPage mode="signup" />} path="/signup" />
          <Route element={<AuthPage mode="login" />} path="/login" />
          <Route element={<ProtectedRoute><Dashboard /></ProtectedRoute>} path="/dashboard" />
          <Route element={<Assessment />} path="/assessment" />
          <Route element={<Results />} path="/results" />
          <Route element={<ProtectedRoute><History /></ProtectedRoute>} path="/history" />
          <Route element={<NotFound />} path="*" />
        </Routes>
      </main>
      {!isStaffWorkspace && <Footer />}
    </div>
  )
}

function App() {
  return (
    <BrowserRouter>
      <a className="skip-link" href="#main-content">Skip to content</a>
      <AppLayout />
    </BrowserRouter>
  )
}

export default App
