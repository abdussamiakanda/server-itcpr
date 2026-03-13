import './Footer.css'

function Footer() {
  return (
    <footer className="server-footer">
      <div className="footer-shell">
        <div className="footer-content">
          <div className="footer-brand-block">
            <p className="footer-brand">ITCPR Server</p>
            <p className="footer-note">Private research infrastructure for ITCPR members.</p>
          </div>
          <p className="footer-meta">
            <span className="footer-prompt">©</span> {new Date().getFullYear()} ITCPR. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  )
}

export default Footer
