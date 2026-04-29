'use client';

import React, { useEffect } from 'react';
import { CheckCircle, AlertCircle, XCircle, Info, X } from 'lucide-react';

type ToastType = 'success' | 'error' | 'warning' | 'info';

interface Toast {
  id: string;
  type: ToastType;
  message: string;
  duration?: number;
}

interface ToastContainerProps {
  toasts: Toast[];
  onRemove: (id: string) => void;
}

const ToastIcon: React.FC<{ type: ToastType }> = ({ type }) => {
  const iconProps = { size: 20, strokeWidth: 2 };
  
  switch (type) {
    case 'success':
      return <CheckCircle {...iconProps} className="text-green-600" />;
    case 'error':
      return <XCircle {...iconProps} className="text-red-600" />;
    case 'warning':
      return <AlertCircle {...iconProps} className="text-amber-600" />;
    case 'info':
      return <Info {...iconProps} className="text-blue-600" />;
  }
};

const Toast: React.FC<{ toast: Toast; onRemove: () => void }> = ({
  toast,
  onRemove,
}) => {
  useEffect(() => {
    if (toast.duration) {
      const timer = setTimeout(onRemove, toast.duration);
      return () => clearTimeout(timer);
    }
  }, [toast.duration, onRemove]);

  const bgColor = {
    success: 'bg-green-50 border-green-200',
    error: 'bg-red-50 border-red-200',
    warning: 'bg-amber-50 border-amber-200',
    info: 'bg-blue-50 border-blue-200',
  }[toast.type];

  return (
    <div
      className={`flex items-center gap-3 px-4 py-3 rounded-lg border ${bgColor} shadow-md animate-slideIn`}
    >
      <ToastIcon type={toast.type} />
      <p className="flex-1 text-sm font-medium text-gray-800">{toast.message}</p>
      <button
        onClick={onRemove}
        aria-label="Dismiss notification"
        title="Dismiss notification"
        className="flex-shrink-0 text-gray-500 hover:text-gray-700"
      >
        <X size={18} />
      </button>
    </div>
  );
};

export const ToastContainer: React.FC<ToastContainerProps> = ({
  toasts,
  onRemove,
}) => {
  return (
    <div className="fixed top-4 right-4 z-[3000] space-y-2 w-[min(24rem,calc(100vw-2rem))]">
      {toasts.map((toast) => (
        <Toast
          key={toast.id}
          toast={toast}
          onRemove={() => onRemove(toast.id)}
        />
      ))}
      <style jsx>{`
        @keyframes slideIn {
          from {
            transform: translateX(400px);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }

        :global(.animate-slideIn) {
          animation: slideIn 300ms ease-out;
        }
      `}</style>
    </div>
  );
};

// Hook for managing toasts
export const useToast = () => {
  const [toasts, setToasts] = React.useState<Toast[]>([]);

  const DEFAULT_DURATIONS: Record<ToastType, number> = {
    success: 3000,
    info: 4000,
    warning: 6000,
    error: 6000,
  };

  const MAX_TOASTS = 3;

  const addToast = (
    message: string,
    type: ToastType = 'info',
    duration?: number
  ) => {
    const id = Math.random().toString(36).substr(2, 9);
    const resolvedDuration = typeof duration === 'number' ? duration : DEFAULT_DURATIONS[type];
    const newToast: Toast = { id, message, type, duration: resolvedDuration };
    setToasts((prev) => {
      const next = [...prev, newToast];
      // Trim oldest to keep UI tidy
      return next.slice(-MAX_TOASTS);
    });
    return id;
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const success = (message: string, duration?: number) =>
    addToast(message, 'success', duration);
  const error = (message: string, duration?: number) =>
    addToast(message, 'error', duration);
  const warning = (message: string, duration?: number) =>
    addToast(message, 'warning', duration);
  const info = (message: string, duration?: number) =>
    addToast(message, 'info', duration);

  // Helper to show API errors given a response.payload or Error
  const showApiError = (payload: any, fallback = 'An unexpected error occurred') => {
    // Expected backend shape: { status: 500, error: { code: 'internal_server_error', message: 'An unexpected error occurred' } }
    if (!payload) {
      error(fallback);
      return;
    }

    if (payload.error && typeof payload.error === 'object') {
      const code = payload.error.code;
      const message = payload.error.message || fallback;
      const statusVal = payload.status || payload.statusCode || null;

      // Map internal codes to user-friendly messages
      if (code === 'internal_server_error') {
        error(`${message}${statusVal ? ` (${statusVal})` : ''}`);
      } else if (code === 'validation_error') {
        error(message);
      } else {
        // Generic
        error(`${message}${statusVal ? ` (${statusVal})` : ''}`);
      }
      // Also log details for developers
      // eslint-disable-next-line no-console
      console.debug('API error payload:', payload);
      return;
    }

    // If it's an Error or string
    if (payload instanceof Error) {
      error(payload.message || fallback);
      return;
    }

    if (typeof payload === 'string') {
      error(payload);
      return;
    }

    error(fallback);
  };

  return {
    toasts,
    addToast,
    removeToast,
    success,
    error,
    warning,
    info,
    showApiError,
  };
};
