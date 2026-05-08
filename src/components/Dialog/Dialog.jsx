import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import './Dialog.css';

// ─── Context ──────────────────────────────────────────────────────────────────
const DialogContext = createContext(null);

export function useDialog() {
  return useContext(DialogContext);
}

// ─── Provider ─────────────────────────────────────────────────────────────────
export function DialogProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const [confirmState, setConfirmState] = useState(null); // { title, message, variant, resolve }
  const idRef = useRef(0);

  // ── Toast ────────────────────────────────────────────────────────────────────
  const toast = useCallback((message, variant = 'info', duration = 3500) => {
    const id = ++idRef.current;
    setToasts(prev => [...prev, { id, message, variant }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), duration);
  }, []);

  const dismiss = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  // ── Confirm ──────────────────────────────────────────────────────────────────
  const confirm = useCallback(({ title, message, confirmLabel = 'Confirm', cancelLabel = 'Cancel', variant = 'danger' }) => {
    return new Promise(resolve => {
      setConfirmState({ title, message, confirmLabel, cancelLabel, variant, resolve });
    });
  }, []);

  function handleConfirmClose(result) {
    if (confirmState) confirmState.resolve(result);
    setConfirmState(null);
  }

  return (
    <DialogContext.Provider value={{ toast, confirm }}>
      {children}

      {/* Toast Stack */}
      <div className="toast-stack" aria-live="polite">
        {toasts.map(t => (
          <Toast key={t.id} toast={t} onDismiss={() => dismiss(t.id)} />
        ))}
      </div>

      {/* Confirm Modal */}
      {confirmState && (
        <div className="overlay dialog-overlay" onClick={e => e.target === e.currentTarget && handleConfirmClose(false)}>
          <div className={`dialog-box glass dialog-${confirmState.variant}`} role="alertdialog">
            <div className="dialog-icon-wrap">
              {confirmState.variant === 'danger' && <span className="dialog-icon danger-icon">!</span>}
              {confirmState.variant === 'warning' && <span className="dialog-icon warning-icon">?</span>}
              {confirmState.variant === 'info' && <span className="dialog-icon info-icon">i</span>}
            </div>
            <h4 className="dialog-title">{confirmState.title}</h4>
            <p className="dialog-message">{confirmState.message}</p>
            <div className="dialog-actions">
              <button className="btn btn-ghost" onClick={() => handleConfirmClose(false)}>
                {confirmState.cancelLabel}
              </button>
              <button
                className={`btn ${confirmState.variant === 'danger' ? 'btn-danger-solid' : 'btn-primary'}`}
                onClick={() => handleConfirmClose(true)}
              >
                {confirmState.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </DialogContext.Provider>
  );
}

// ─── Toast Component ───────────────────────────────────────────────────────────
function Toast({ toast, onDismiss }) {
  const icons = { success: '✓', error: '✕', warning: '⚠', info: 'ℹ' };

  return (
    <div className={`toast toast-${toast.variant}`} onClick={onDismiss} role="alert">
      <span className="toast-icon">{icons[toast.variant] || icons.info}</span>
      <span className="toast-message">{toast.message}</span>
      <button className="toast-close" onClick={onDismiss} aria-label="Dismiss">✕</button>
    </div>
  );
}
