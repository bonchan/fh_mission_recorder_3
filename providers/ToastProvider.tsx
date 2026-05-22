import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';
export type ToastPosition = 'bottom-left' | 'bottom-center' | 'bottom-right';

export interface ToastOptions {
  type?: ToastType;
  duration?: number;
  swarm?: boolean;
  permanent?: boolean;
  position?: ToastPosition;
}

interface ToastMessage extends ToastOptions {
  id: string;
  title: string;
  text: string;
  type: ToastType;
  duration: number;
  position: ToastPosition;
}

interface ToastContextType {
  showToast: (title: string, text: string, options?: ToastOptions) => void;
}

const ToastContext = createContext<ToastContextType | null>(null);

// --- THE INDIVIDUAL TOAST COMPONENT ---
function ToastItem({ toast, onRemove, swarmResetKey }: { toast: ToastMessage; onRemove: (id: string) => void; swarmResetKey: number }) {
  const [isLeaving, setIsLeaving] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [timerKey, setTimerKey] = useState(0);

  useEffect(() => {
    if (toast.swarm && swarmResetKey > 0 && !isLeaving) {
      setTimerKey(prev => prev + 1);
    }
  }, [swarmResetKey, toast.swarm]);

  useEffect(() => {
    if (isHovered || isLeaving || toast.permanent) return;

    const leaveTimer = setTimeout(() => {
      setIsLeaving(true);
    }, toast.duration);

    return () => clearTimeout(leaveTimer);
  }, [toast.duration, isHovered, isLeaving, timerKey, toast.permanent]);

  useEffect(() => {
    if (isLeaving) {
      const removeTimer = setTimeout(() => onRemove(toast.id), 300);
      return () => clearTimeout(removeTimer);
    }
  }, [isLeaving, onRemove, toast.id]);

  const handleMouseEnter = () => setIsHovered(true);

  const handleMouseLeave = () => {
    setIsHovered(false);
    setTimerKey(prev => prev + 1);
  };

  const theme = {
    success: { border: '#10B981', bg: 'rgba(16, 185, 129, 0.1)', icon: '✓' },
    error: { border: '#EF4444', bg: 'rgba(239, 68, 68, 0.1)', icon: '✕' },
    warning: { border: '#F59E0B', bg: 'rgba(245, 158, 11, 0.1)', icon: '!' },
    info: { border: '#3B82F6', bg: 'rgba(59, 130, 246, 0.1)', icon: 'i' },
  }[toast.type];

  const CIRCUMFERENCE = 63;

  return (
    <div
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      style={{
        display: 'flex', alignItems: 'flex-start', gap: '12px',
        width: 'max-content', minWidth: '280px', maxWidth: '400px',
        padding: '12px 16px', backgroundColor: 'rgba(15, 15, 15, 0.95)',
        borderLeft: `4px solid ${theme.border}`, borderRadius: '6px',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)', backdropFilter: 'blur(8px)',
        pointerEvents: 'auto', fontFamily: 'system-ui, -apple-system, sans-serif',
        animation: isLeaving
          ? 'toast-slide-out 0.3s cubic-bezier(0.4, 0, 0.2, 1) forwards'
          : 'toast-slide-in 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards',
      }}
    >
      <div style={{ position: 'relative', width: '24px', height: '24px', flexShrink: 0 }}>
        <svg width="24" height="24" viewBox="0 0 24 24" style={{ transform: 'rotate(-90deg)' }}>
          <circle cx="12" cy="12" r="10" fill={theme.bg} stroke={theme.bg} strokeWidth="2" />

          {!toast.permanent && (
            <circle
              key={timerKey}
              cx="12" cy="12" r="10"
              fill="none"
              stroke={theme.border}
              strokeWidth="2"
              strokeDasharray={CIRCUMFERENCE}
              strokeDashoffset="0"
              strokeLinecap="round"
              style={{
                animation: isHovered || isLeaving
                  ? 'none'
                  : `toast-progress ${toast.duration}ms linear forwards`
              }}
            />
          )}
        </svg>

        <div style={{
          position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: theme.border, fontWeight: 'bold', fontSize: '12px'
        }}>
          {theme.icon}
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <span style={{ color: '#fff', fontSize: '14px', fontWeight: 600 }}>{toast.title}</span>
        <span style={{ color: '#aaa', fontSize: '13px', lineHeight: '1.4' }}>{toast.text}</span>
      </div>

      <button
        onClick={() => setIsLeaving(true)}
        style={{
          background: 'none', border: 'none', color: '#666', fontSize: '18px',
          cursor: 'pointer', padding: '0 4px', marginLeft: 'auto',
        }}
      >
        ×
      </button>
    </div>
  );
}

// --- THE PROVIDER & CONTAINER ---
export function ToastProvider({ children, position = 'bottom-center' }: { children: React.ReactNode, position?: ToastPosition }) {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [swarmResetKey, setSwarmResetKey] = useState(0);

  const showToast = useCallback((title: string, text: string, options?: ToastOptions) => {
    const newToast: ToastMessage = {
      id: crypto.randomUUID(),
      title,
      text,
      // Provide defaults, but allow the options object to override them!
      type: options?.type || 'info',
      duration: options?.duration || 3000,
      swarm: options?.swarm || false,
      permanent: options?.permanent || false,
      position: options?.position || 'bottom-center',
    };

    if (newToast.swarm) {
      setSwarmResetKey(Date.now());
    }

    setToasts((prev) => [...prev, newToast]);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const getContainerStyles = (): React.CSSProperties => {
    const base: React.CSSProperties = {
      position: 'fixed',
      bottom: '24px',
      display: 'flex',
      flexDirection: 'column-reverse',
      gap: '10px',
      zIndex: 9999,
      pointerEvents: 'none',
    };

    switch (position) {
      case 'bottom-left':
        return { ...base, left: '24px', alignItems: 'flex-start' };
      case 'bottom-right':
        return { ...base, right: '24px', alignItems: 'flex-end' };
      case 'bottom-center':
      default:
        return { ...base, left: '50%', transform: 'translateX(-50%)', alignItems: 'center' };
    }
  };

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}

      <div style={getContainerStyles()}>
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} onRemove={removeToast} swarmResetKey={swarmResetKey} />
        ))}
      </div>

      <style>{`
        @keyframes toast-slide-in {
          0% { transform: translateY(50px) scale(0.9); opacity: 0; }
          100% { transform: translateY(0) scale(1); opacity: 1; }
        }
        @keyframes toast-slide-out {
          0% { transform: translateY(0) scale(1); opacity: 1; height: auto; margin-bottom: 10px; }
          100% { transform: translateY(20px) scale(0.9); opacity: 0; height: 0; margin-bottom: 0; padding-top: 0; padding-bottom: 0; border: none; overflow: hidden; }
        }
        @keyframes toast-progress {
          0% { stroke-dashoffset: 0; }
          100% { stroke-dashoffset: 63; } 
        }
      `}</style>
    </ToastContext.Provider>
  );
}

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast must be used within ToastProvider");
  return context;
};