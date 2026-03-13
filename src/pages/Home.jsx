import { useEffect } from 'react'
import { HardDrive, ShieldCheck, Wrench } from 'lucide-react'
import Navbar from '../components/Navbar'
import Footer from '../components/Footer'
import './Home.css'

const policySections = [
  {
    title: 'Access Policy',
    items: [
      'Access is restricted to ITCPR members. All unauthorized attempts are logged.',
      'Personal credentials only - sharing is prohibited.',
      'Multi-factor authentication is required where applicable.',
      'SSH keys must be registered with the system administrator.'
    ]
  },
  {
    title: 'Use Policy',
    items: [
      'Use resources only for approved research and educational work.',
      'Refrain from unauthorized access, data sharing, or unlawful activity.',
      'Obtain prior approval before installing third-party software.',
      'Maintain system stability and respect shared resource limitations.'
    ]
  },
  {
    title: 'Security Policy',
    items: [
      'All activities are monitored and logged.',
      'Sensitive data must be encrypted in transit and at rest.',
      'Security incidents must be reported immediately.',
      'Accounts with prolonged inactivity may be disabled.'
    ]
  }
]

const serverSpecs = [
  {
    name: 'Alpha',
    summary: 'Primary compute node',
    statusClass: 'alpha',
    specs: [
      ['CPU', 'AMD Ryzen 7 7800X3D'],
      ['GPU', 'NVIDIA RTX 4070 12GB'],
      ['RAM', '64GB DDR4'],
      ['Storage', '2TB NVMe SSD'],
      ['OS', 'Windows 11 and Linux']
    ]
  },
  {
    name: 'Beta',
    summary: 'Extended workstation',
    statusClass: 'beta',
    specs: [
      ['CPU', 'AMD Threadripper 2970WX'],
      ['GPU', 'NVIDIA RTX 3080 10GB'],
      ['RAM', '128GB DDR4'],
      ['Storage', '500GB NVMe + 2TB HDD'],
      ['OS', 'Windows 10 and Linux']
    ]
  }
]

const operationsCards = [
  {
    title: 'Storage guidance',
    description: 'Users are assigned home directories with soft storage limits. The server is not a backup solution.',
    Icon: HardDrive
  },
  {
    title: 'Maintenance',
    description: 'Maintenance and upgrades may be scheduled with advance notice to avoid workflow disruption.',
    Icon: Wrench
  }
]

function Home() {
  useEffect(() => {
    document.body.classList.add('server-theme')
    return () => {
      document.body.classList.remove('server-theme')
    }
  }, [])

  return (
    <div className="server-home">
      <Navbar />

      <main className="server-main">
        <section className="home-hero">
          <div className="hero-copy">
            <h1>Private research infrastructure for ITCPR members.</h1>
            <p>
              ITCPR maintains a dedicated computing environment for theoretical and computational physics,
              with secure remote access, shared resources, and coordinated support for simulation, data
              analysis, and collaborative development.
            </p>
            <div className="hero-meta">
              <div className="hero-meta-item">
                <span className="hero-meta-label">Environment</span>
                <span className="hero-meta-value">Private and managed</span>
              </div>
              <div className="hero-meta-item">
                <span className="hero-meta-label">Access</span>
                <span className="hero-meta-value">ITCPR members</span>
              </div>
            </div>
          </div>

          <aside className="hero-panel">
            <div className="hero-panel-header">
              <div>
                <div className="hero-panel-label">Workspace status</div>
                <div className="hero-panel-title">Operational</div>
              </div>
              <span className="hero-panel-badge">Managed</span>
            </div>
            <div className="hero-metrics">
              <div className="status-item">
                <div className="status-label">System</div>
                <div className="status-value online">Online</div>
              </div>
              <div className="status-item">
                <div className="status-label">Service uptime</div>
                <div className="status-value">99.9%</div>
              </div>
              <div className="status-item">
                <div className="status-label">User state</div>
                <div className="status-value">Active</div>
              </div>
            </div>
            <div className="hero-panel-note">
              <ShieldCheck size={16} />
              <span>Access is restricted to ITCPR members and activity is logged.</span>
            </div>
          </aside>
        </section>

        <section className="home-section">
          <div className="section-heading">
            <span className="section-eyebrow">Infrastructure</span>
            <h2>Server hardware</h2>
            <p>
              Primary and extended compute resources available across the ITCPR server environment.
            </p>
          </div>

          <div className="home-grid">
            {serverSpecs.map((server) => (
              <article key={server.name} className="server-card">
                <div className="card-header hardware-card-header">
                  <div className="hardware-card-title-group">
                    <h2 className="card-title">{server.name}</h2>
                    <span className="spec-summary">{server.summary}</span>
                  </div>
                  <span className="server-status-light active" />
                </div>
                <div className="card-content">
                  <div className="spec-server">
                    <div className="spec-grid">
                      {server.specs.map(([key, value]) => (
                        <div key={`${server.name}-${key}`} className="spec-item">
                          <span className="spec-key">{key}</span>
                          <span className="spec-value">{value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="home-section">
          <div className="section-heading">
            <span className="section-eyebrow">Policies</span>
            <h2>Access, usage, and security</h2>
            <p>
              The platform is intended for approved academic work and is operated with clear security
              and usage expectations for ITCPR members.
            </p>
          </div>

          <div className="home-policies">
            {policySections.map((section) => (
              <article key={section.title} className="server-card policy-card">
                <div className="card-header">
                  <h2 className="card-title">{section.title}</h2>
                </div>
                <div className="card-content">
                  {section.intro && <p className="policy-intro">{section.intro}</p>}
                  <ul className="policy-list">
                    {section.items.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="home-section">
          <div className="section-heading">
            <span className="section-eyebrow">Operations</span>
            <h2>Support and practical guidance</h2>
            <p>
              Storage expectations, maintenance, citation guidance, and support details for day-to-day use.
            </p>
          </div>

          <div className="home-resources-grid">
            {operationsCards.map(({ title, description, Icon }) => (
              <article key={title} className="server-card resource-card">
                <div className="card-content resource-card-content">
                  <div className="resource-icon">
                    <Icon size={18} />
                  </div>
                  <div>
                    <h3>{title}</h3>
                    <p>{description}</p>
                  </div>
                </div>
              </article>
            ))}

            <article className="server-card citation-card">
              <div className="card-header">
                <h2 className="card-title">Citation policy</h2>
              </div>
              <div className="card-content">
                <div className="code-block">
                  <div className="code-block-header">citation.txt</div>
                  <pre className="citation-text">
{`We would like to thank the Institute for
Theoretical and Computational Physics Research
(ITCPR), Bangladesh, for providing sufficient
platform, space, and resources to accommodate
this study. Their support is hugely appreciated
by the authors.`}
                  </pre>
                </div>
              </div>
            </article>

            <article className="server-card contact-card">
              <div className="card-header">
                <h2 className="card-title">Support contact</h2>
              </div>
              <div className="card-content">
                <p className="contact-text">For technical support or issue reporting, please contact:</p>
                <div className="contact-command">
                  <span className="command-prefix">Email:</span>
                  <a href="mailto:info@itcpr.org" className="contact-link">info@itcpr.org</a>
                </div>
              </div>
            </article>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  )
}

export default Home
