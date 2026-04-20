'use client';

import React, { useState } from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';

interface DeleteCategoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  onDeactivate?: () => void;
  categoryName: string;
  studentCount?: number;
  mode: 'safe-delete' | 'conflict';
  isLoading?: boolean;
  isDeactivating?: boolean;
  conflictMessage?: string;
}

export const DeleteCategoryModal: React.FC<DeleteCategoryModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  onDeactivate,
  categoryName,
  studentCount = 0,
  mode,
  isLoading = false,
  isDeactivating = false,
  conflictMessage,
}) => {
  if (!isOpen) return null;

  const isSafeDelete = mode === 'safe-delete';

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
        style={{ animation: 'fadeIn 200ms ease-out' }}
      />

      {/* Modal */}
      <div
        className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl bg-white p-6 shadow-2xl"
        style={{ animation: 'slideUp 300ms cubic-bezier(0.16, 1, 0.3, 1)' }}
      >
        {/* Header */}
        <div className="flex items-start gap-3 mb-4">
          <div className="flex-shrink-0 flex h-10 w-10 items-center justify-center rounded-lg bg-red-100">
            <AlertTriangle size={22} className="text-red-600" strokeWidth={2} />
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-semibold text-gray-900">
              {isSafeDelete ? 'Delete Category?' : 'Cannot Delete Category'}
            </h2>
          </div>
        </div>

        {/* Body */}
        <div className="mb-6 space-y-3">
          {isSafeDelete ? (
            <>
              <p className="text-sm text-gray-600">
                This category has no assigned students.
              </p>
              <p className="text-sm text-gray-700 font-medium">
                Are you sure you want to permanently delete{' '}
                <span className="font-semibold text-gray-900">&quot;{categoryName}&quot;</span>?
              </p>
              <p className="text-xs text-gray-500">
                This action cannot be undone. The category will be permanently removed from the system.
              </p>
            </>
          ) : (
            <>
              {conflictMessage ? (
                <p className="text-sm text-gray-700">{conflictMessage}</p>
              ) : (
                <p className="text-sm text-gray-700">
                  This category is currently assigned to{' '}
                  <span className="font-semibold text-gray-900">
                    {studentCount} {studentCount === 1 ? 'student' : 'students'}
                  </span>
                  .
                </p>
              )}
              <p className="text-sm text-gray-600">
                Deleting it may affect student records and reports.
              </p>
              <p className="text-sm text-gray-700 font-medium">
                Please reassign students first or deactivate this category instead.
              </p>
            </>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex gap-3">
          {isSafeDelete ? (
            <>
              <button
                onClick={onClose}
                disabled={isLoading}
                className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={onConfirm}
                disabled={isLoading}
                className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Deleting...
                  </>
                ) : (
                  'Delete Permanently'
                )}
              </button>
            </>
          ) : (
            <>
              <button
                onClick={onClose}
                disabled={isDeactivating}
                className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={onDeactivate}
                disabled={isDeactivating}
                className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-amber-600 hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                {isDeactivating ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Deactivating...
                  </>
                ) : (
                  'Deactivate Category'
                )}
              </button>
            </>
          )}
        </div>
      </div>

      <style jsx>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }

        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translate(-50%, -48%);
          }
          to {
            opacity: 1;
            transform: translate(-50%, -50%);
          }
        }
      `}</style>
    </>
  );
};
