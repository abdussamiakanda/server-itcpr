import { useEffect } from 'react'
import './Modal.css'

function Modal({ isOpen, onClose, children, size = 'default' }) {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }
    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [isOpen])

  if (!isOpen) return null

  const sizeClass = size === 'full' ? 'modal-full' : size === 'small' ? 'modal-small' : ''

  return (
    <>
      <div className="modal-backdrop show" onClick={onClose} />
      <div className={`modal show ${sizeClass}`}>
        {children}
      </div>
    </>
  )
}

export function ModalHeader({ children, onClose }) {
  return (
    <div className="modal-header">
      {children}
      {onClose && (
        <button className="btn-close" onClick={onClose}>
          ×
        </button>
      )}
    </div>
  )
}

export function ModalBody({ children }) {
  return <div className="modal-body">{children}</div>
}

export function ModalFooter({ children }) {
  return <div className="modal-footer">{children}</div>
}

export default Modal

