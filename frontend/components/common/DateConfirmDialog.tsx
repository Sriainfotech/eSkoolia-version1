"use client";

type DateConfirmDialogProps = {
  open: boolean;
  title: string;
  message: string;
  onAccept: () => void;
  onCancel: () => void;
};

export function DateConfirmDialog({ open, title, message, onAccept, onCancel }: DateConfirmDialogProps) {
  if (!open) return null;

  return (
    <div className="date-confirm-overlay" role="dialog" aria-modal="true" aria-labelledby="date-confirm-title">
      <div className="date-confirm-dialog">
        <h4 id="date-confirm-title" className="date-confirm-title">{title}</h4>
        <p className="date-confirm-message">{message}</p>
        <div className="date-confirm-actions">
          <button type="button" className="btn btn-outline-secondary date-confirm-cancel" onClick={onCancel}>No, let me change it</button>
          <button type="button" className="btn btn-primary date-confirm-accept" onClick={onAccept}>Yes, keep this date</button>
        </div>
      </div>
    </div>
  );
}
