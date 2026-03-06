"use client";

import { useEffect, useState } from "react";

interface ToastProps {
  message: string;
  type?: "success" | "error" | "info";
  duration?: number;
  onClose?: () => void;
}

export function Toast({
  message,
  type = "info",
  duration = 5000,
  onClose,
}: ToastProps) {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false);
      setTimeout(() => {
        onClose?.();
      }, 300);
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, onClose]);

  if (!isVisible) return null;

  const bgColor =
    type === "success"
      ? "bg-green-500"
      : type === "error"
        ? "bg-red-500"
        : "bg-[var(--accent)]";

  return (
    <div className="fixed top-4 right-4 z-50 animate-in slide-in-from-top-5">
      <div
        className={`neo-card ${bgColor} border-2 border-[var(--ink)] p-4 shadow-[8px_8px_0_rgba(0,0,0,0.18)]`}
      >
        <p className="text-sm font-semibold text-[var(--ink)]">{message}</p>
      </div>
    </div>
  );
}

