"use client";

import { useEffect } from "react";
import { CheckCircle } from "lucide-react";

interface ToastProps {
  message: string;
  onClose: () => void;
}

export default function Toast({ message, onClose }: ToastProps) {
  useEffect(() => {
    const timer = setTimeout(onClose, 2400);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div className="fixed bottom-6 right-6 z-50 animate-[slideUp_.25s_ease-out]">
      <div className="inline-flex items-center gap-2.5 px-4 py-3 rounded-full bg-zinc-900 text-white text-[13px] font-medium shadow-lg">
        <CheckCircle size={16} className="text-green-400" />
        {message}
      </div>
    </div>
  );
}
