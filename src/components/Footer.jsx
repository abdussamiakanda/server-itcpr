import './Footer.css'

function Footer() {
  return (
    <footer className="server-footer">
      <div className="footer-line"></div>
      <p>
        <span className="footer-prompt">©</span> {new Date().getFullYear()} ITCPR. All Rights Reserved.
      </p>
    </footer>
  )
}

export default Footer
