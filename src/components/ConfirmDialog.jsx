import { useEffect } from 'react'
import { Loader2 } from 'lucide-react'
import Modal, { ModalHeader, ModalBody, ModalFooter } from './Modal'
import './ConfirmDialog.css'

function ConfirmDialog({ isOpen, onClose, onConfirm, title, message, loading }) {
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

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="small">
      <ModalHeader onClose={onClose}>
        <h3>{title || 'Confirm Action'}</h3>
      </ModalHeader>
      <ModalBody>
        <p className="confirm-message">{message || 'Are you sure you want to proceed?'}</p>
      </ModalBody>
      <ModalFooter>
        <button className="modal-btn secondary" onClick={onClose} disabled={loading}>
          Cancel
        </button>
        <button className="modal-btn primary danger" onClick={onConfirm} disabled={loading}>
          {loading ? (
            <>
              <Loader2 size={18} className="btn-spinner" />
              Confirming...
            </>
          ) : (
            'Confirm'
          )}
        </button>
      </ModalFooter>
    </Modal>
  )
}

export default ConfirmDialog

