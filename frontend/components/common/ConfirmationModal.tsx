"use client";

import type { ReactNode } from "react";

type ConfirmationModalProps = {
  isOpen: boolean;
  title: string;
  message: string;
  details?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  loadingLabel?: string;
  isConfirming?: boolean;
  /** "danger" (default) uses a red confirm button + warning icon.
   *  "primary" uses the brand purple + neutral icon for positive actions. */
  variant?: "danger" | "primary";
  onConfirm: () => void;
  onCancel: () => void;
};

export function ConfirmationModal({
  isOpen,
  title,
  message,
  details,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  loadingLabel,
  isConfirming = false,
  variant = "danger",
  onConfirm,
  onCancel,
}: ConfirmationModalProps) {
  if (!isOpen) return null;

  const icon = variant === "danger" ? "⚠️" : "ℹ️";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-modal-title"
      className="modal-overlay"
      onClick={isConfirming ? undefined : onCancel}
    >
      <div
        className={`confirm-modal ${variant}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={`warn-icon ${variant}`} aria-hidden="true">
          <span>{icon}</span>
        </div>

        <h3 id="confirm-modal-title" className="confirm-title">{title}</h3>
        <p className="confirm-message">{message}</p>
        {details ? <p className="confirm-details">{details}</p> : null}

        <div className="modal-actions">
          <button
            type="button"
            className="btn-cancel"
            onClick={onCancel}
            disabled={isConfirming}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            className={`btn-confirm ${variant}`}
            onClick={onConfirm}
            disabled={isConfirming}
          >
            {isConfirming ? (loadingLabel || `${confirmLabel}...`) : confirmLabel}
          </button>
        </div>
      </div>

      <style jsx>{`
        .modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.55);
          -webkit-backdrop-filter: blur(2px);
          backdrop-filter: blur(2px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 9999;
          padding: 16px;
          animation: modal-fade-in 140ms ease-out;
        }

        .confirm-modal {
          width: 460px;
          max-width: 92vw;
          background: #ffffff;
          border-radius: 18px;
          padding: 28px;
          box-shadow: 0 25px 70px rgba(0, 0, 0, 0.18);
          font-family: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI",
            Roboto, "Helvetica Neue", Arial, sans-serif;
          animation: modal-pop-in 180ms cubic-bezier(0.16, 1, 0.3, 1);
        }

        .warn-icon {
          width: 48px;
          height: 48px;
          border-radius: 50%;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 14px;
        }
        .warn-icon.danger {
          background: #fee2e2;
        }
        .warn-icon.primary {
          background: #ede9fe;
        }
        .warn-icon span {
          font-size: 22px;
          line-height: 1;
        }

        .confirm-title {
          margin: 0 0 10px;
          font-size: 18px;
          font-weight: 600;
          /* Undo any global letter-spacing (e.g. .dashboard-main h3
             crushes the title into "ConfirmDeactivation" without this). */
          letter-spacing: 0;
          color: #111827;
          font-family: inherit;
        }

        .confirm-message {
          margin: 0 0 10px;
          font-size: 14px;
          line-height: 1.5;
          color: #1f2937;
        }

        .confirm-details {
          margin: 0;
          font-size: 13px;
          line-height: 1.5;
          color: #6b7280;
        }

        .modal-actions {
          display: flex;
          justify-content: flex-end;
          gap: 12px;
          margin-top: 24px;
        }

        .btn-cancel,
        .btn-confirm {
          height: 42px;
          padding: 0 18px;
          border-radius: 10px;
          font-size: 14px;
          font-weight: 500;
          font-family: inherit;
          cursor: pointer;
          transition: background-color 140ms ease, border-color 140ms ease,
            transform 140ms ease;
        }
        .btn-cancel:disabled,
        .btn-confirm:disabled {
          cursor: not-allowed;
          opacity: 0.75;
        }

        .btn-cancel {
          border: 1px solid #dddddd;
          background: #ffffff;
          color: #111827;
        }
        .btn-cancel:hover:not(:disabled) {
          background: #f3f4f6;
        }

        .btn-confirm {
          border: 1px solid transparent;
          color: #ffffff;
        }
        .btn-confirm.danger {
          background: #ef4444;
        }
        .btn-confirm.danger:hover:not(:disabled) {
          background: #dc2626;
        }
        .btn-confirm.primary {
          background: #5b3df5;
        }
        .btn-confirm.primary:hover:not(:disabled) {
          background: #4c33e6;
        }

        @keyframes modal-fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        @keyframes modal-pop-in {
          from {
            opacity: 0;
            transform: translateY(8px) scale(0.98);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        @media (max-width: 540px) {
          .modal-actions {
            flex-direction: column-reverse;
          }
          .btn-cancel,
          .btn-confirm {
            width: 100%;
          }
        }
      `}</style>
    </div>
  );
}
