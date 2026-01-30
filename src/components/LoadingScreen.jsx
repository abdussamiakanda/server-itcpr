import './LoadingScreen.css'

export default function LoadingScreen() {
  return (
    <div className="loading-screen" role="status" aria-label="Loading">
      <div className="loading-screen__content">
        <div className="loading-screen__spinner" aria-hidden="true" />
        <span className="loading-screen__label">
          Loading
          <span className="loading-screen__bounce">
            <span>.</span><span>.</span><span>.</span>
          </span>
        </span>
      </div>
    </div>
  )
}
