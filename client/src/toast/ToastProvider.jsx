import { useState, useCallback, useRef } from "react";
import { ToastContext } from "./ToastContextObj.js";
import { IconCheckCircle, IconAlertCircle, IconX } from "../icons.jsx";
import "./toast.css";

const DURATION = 3200;
const LEAVE_DURATION = 300;

const ICONS = {
  success: IconCheckCircle,
  error: IconAlertCircle,
};

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const timers = useRef(new Map());

  const dismissToast = useCallback((id) => {
    setToasts((ts) => ts.map((t) => (t.id === id ? { ...t, leaving: true } : t)));
    const leaveTimer = setTimeout(() => {
      setToasts((ts) => ts.filter((t) => t.id !== id));
      timers.current.delete(id);
    }, LEAVE_DURATION);
    timers.current.set(id, leaveTimer);
  }, []);

  const showToast = useCallback((message, type = "success") => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    setToasts((ts) => [...ts, { id, message, type, leaving: false }]);
    const timer = setTimeout(() => dismissToast(id), DURATION);
    timers.current.set(id, timer);
  }, [dismissToast]);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="toast-viewport" role="status" aria-live="polite">
        {toasts.map((t) => {
          const Icon = ICONS[t.type] || ICONS.success;
          return (
            <div key={t.id} className={`toast toast-${t.type}${t.leaving ? " toast-leaving" : ""}`}>
              <span className="toast-icon"><Icon /></span>
              <span className="toast-message">{t.message}</span>
              <button type="button" className="toast-close" onClick={() => dismissToast(t.id)} aria-label="Dismiss">
                <IconX />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}
