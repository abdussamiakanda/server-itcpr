import { useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { HardDrive, Wrench } from 'lucide-react'
import Navbar from '../components/Navbar'
import Footer from '../components/Footer'
import './Home.css'

function Home() {
  const { user } = useAuth()

  useEffect(() => {
    // Add class to body for dark theme
    document.body.classList.add('server-theme')
    
    return () => {
      // Remove class when component unmounts
      document.body.classList.remove('server-theme')
    }
  }, [])

  return (
    <div className="server-home">
      <Navbar />
      <main className="server-main">
        {/* Hero Section with Server Status */}
        <section className="server-hero">
          <div className="server-status-panel">
            <div className="status-grid">
              <div className="status-item">
                <div className="status-label">SYSTEM</div>
                <div className="status-value online">ONLINE</div>
              </div>
              <div className="status-item">
                <div className="status-label">UPTIME</div>
                <div className="status-value">99.9%</div>
              </div>
              <div className="status-item">
                <div className="status-label">USERS</div>
                <div className="status-value">ACTIVE</div>
              </div>
            </div>
          </div>
        </section>

        {/* About Section - Terminal Style */}
        <section className="server-card terminal-card">
          <div className="card-header">
            <div className="terminal-window-controls">
              <span className="control-dot red"></span>
              <span className="control-dot yellow"></span>
              <span className="control-dot green"></span>
            </div>
            <div className="card-title">
              <span className="code-symbol">#</span> ABOUT_SERVER
            </div>
          </div>
          <div className="card-content">
            <div className="terminal-output">
              <p className="code-line">
                <span className="code-comment">// ITCPR Private Server Infrastructure</span>
              </p>
              <p className="code-line">
                The ITCPR private servers are maintained by the Institute for Theoretical and Computational Physics
                Research to support high-performance computing, code development, data storage, and remote access for
                authorized researchers and collaborators in theoretical and computational physics.
              </p>
            </div>
          </div>
        </section>

        {/* Server Specs - Grid Layout */}
        <section className="server-card specs-card">
          <div className="card-header">
            <div className="terminal-window-controls">
              <span className="control-dot red"></span>
              <span className="control-dot yellow"></span>
              <span className="control-dot green"></span>
            </div>
            <div className="card-title">
              <span className="code-symbol">$</span> SERVER_SPECS
            </div>
          </div>
          <div className="card-content">
            <div className="server-specs-container">
              <div className="spec-server">
                <div className="spec-header">
                  <span className="server-badge alpha">ALPHA</span>
                  <div className="server-status-light active"></div>
                </div>
                <div className="spec-grid">
                  <div className="spec-item">
                    <span className="spec-key">CPU</span>
                    <span className="spec-value">AMD RYZEN 7 7800X3D</span>
                  </div>
                  <div className="spec-item">
                    <span className="spec-key">GPU</span>
                    <span className="spec-value">NVIDIA RTX 4070 12GB</span>
                  </div>
                  <div className="spec-item">
                    <span className="spec-key">RAM</span>
                    <span className="spec-value">64GB DDR4</span>
                  </div>
                  <div className="spec-item">
                    <span className="spec-key">STORAGE</span>
                    <span className="spec-value">2TB NVME SSD</span>
                  </div>
                  <div className="spec-item">
                    <span className="spec-key">OS</span>
                    <span className="spec-value">Windows 11 & Linux</span>
                  </div>
                </div>
              </div>

              <div className="spec-server">
                <div className="spec-header">
                  <span className="server-badge beta">BETA</span>
                  <div className="server-status-light active"></div>
                </div>
                <div className="spec-grid">
                  <div className="spec-item">
                    <span className="spec-key">CPU</span>
                    <span className="spec-value">AMD Threadripper 2970WX</span>
                  </div>
                  <div className="spec-item">
                    <span className="spec-key">GPU</span>
                    <span className="spec-value">NVIDIA RTX 3080 10GB</span>
                  </div>
                  <div className="spec-item">
                    <span className="spec-key">RAM</span>
                    <span className="spec-value">128GB DDR4</span>
                  </div>
                  <div className="spec-item">
                    <span className="spec-key">STORAGE</span>
                    <span className="spec-value">500GB NVME + 2TB HDD</span>
                  </div>
                  <div className="spec-item">
                    <span className="spec-key">OS</span>
                    <span className="spec-value">Windows 10 & Linux</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Policies - Terminal List Style */}
        <section className="server-card policy-card">
          <div className="card-header">
            <div className="terminal-window-controls">
              <span className="control-dot red"></span>
              <span className="control-dot yellow"></span>
              <span className="control-dot green"></span>
            </div>
            <div className="card-title">
              <span className="code-symbol">{'>'}</span> ACCESS_POLICY
            </div>
          </div>
          <div className="card-content">
            <div className="policy-terminal">
              <p className="terminal-line-text">
                <span className="terminal-prompt">$</span> Access is restricted to approved users. All unauthorized attempts are logged.
              </p>
              <ul className="policy-list">
                <li>
                  <span className="list-marker">→</span>
                  <span>Personal credentials only — sharing is prohibited</span>
                </li>
                <li>
                  <span className="list-marker">→</span>
                  <span>Multi-factor authentication required where applicable</span>
                </li>
                <li>
                  <span className="list-marker">→</span>
                  <span>SSH keys must be registered with the system administrator</span>
                </li>
              </ul>
            </div>
          </div>
        </section>

        <section className="server-card policy-card">
          <div className="card-header">
            <div className="terminal-window-controls">
              <span className="control-dot red"></span>
              <span className="control-dot yellow"></span>
              <span className="control-dot green"></span>
            </div>
            <div className="card-title">
              <span className="code-symbol">{'>'}</span> USE_POLICY
            </div>
          </div>
          <div className="card-content">
            <div className="policy-terminal">
              <ul className="policy-list">
                <li>
                  <span className="list-marker">→</span>
                  <span>Use resources solely for approved research and educational purposes</span>
                </li>
                <li>
                  <span className="list-marker">→</span>
                  <span>Refrain from unauthorized access, data sharing, or unlawful activity</span>
                </li>
                <li>
                  <span className="list-marker">→</span>
                  <span>Obtain prior approval before installing third-party software</span>
                </li>
                <li>
                  <span className="list-marker">→</span>
                  <span>Maintain system stability and respect shared resource limitations</span>
                </li>
              </ul>
            </div>
          </div>
        </section>

        <section className="server-card policy-card">
          <div className="card-header">
            <div className="terminal-window-controls">
              <span className="control-dot red"></span>
              <span className="control-dot yellow"></span>
              <span className="control-dot green"></span>
            </div>
            <div className="card-title">
              <span className="code-symbol">{'>'}</span> SECURITY_POLICY
            </div>
          </div>
          <div className="card-content">
            <div className="policy-terminal">
              <ul className="policy-list">
                <li>
                  <span className="list-marker">→</span>
                  <span>All activities are monitored and logged</span>
                </li>
                <li>
                  <span className="list-marker">→</span>
                  <span>Sensitive data must be encrypted during transfer and at rest</span>
                </li>
                <li>
                  <span className="list-marker">→</span>
                  <span>Security breaches must be reported immediately</span>
                </li>
                <li>
                  <span className="list-marker">→</span>
                  <span>Accounts with prolonged inactivity may be disabled</span>
                </li>
              </ul>
            </div>
          </div>
        </section>

        {/* Storage & Maintenance - Info Cards */}
        <section className="info-cards-grid">
          <div className="info-card">
            <div className="info-icon">
              <HardDrive size={48} />
            </div>
            <h3>Storage Policy</h3>
            <p>Users are assigned home directories with soft storage limits. The server is not a backup solution.</p>
          </div>
          <div className="info-card">
            <div className="info-icon">
              <Wrench size={48} />
            </div>
            <h3>Maintenance</h3>
            <p>Occasional maintenance or upgrades may be scheduled as needed with advance notice via email.</p>
          </div>
        </section>

        {/* Citation - Code Block Style */}
        <section className="server-card citation-card">
          <div className="card-header">
            <div className="terminal-window-controls">
              <span className="control-dot red"></span>
              <span className="control-dot yellow"></span>
              <span className="control-dot green"></span>
            </div>
            <div className="card-title">
              <span className="code-symbol">//</span> CITATION_POLICY
            </div>
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
        </section>

        {/* Contact - Terminal Command Style */}
        <section className="server-card contact-card">
          <div className="card-header">
            <div className="terminal-window-controls">
              <span className="control-dot red"></span>
              <span className="control-dot yellow"></span>
              <span className="control-dot green"></span>
            </div>
            <div className="card-title">
              <span className="code-symbol">$</span> CONTACT
            </div>
          </div>
          <div className="card-content">
            <div className="contact-terminal">
              <p className="terminal-line-text">
                <span className="terminal-prompt">$</span> For technical support or to report issues:
              </p>
              <div className="contact-command">
                <span className="command-prefix">mailto:</span>
                <a href="mailto:info@itcpr.org" className="contact-link">info@itcpr.org</a>
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  )
}

export default Home
