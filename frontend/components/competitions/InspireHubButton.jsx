'use client';

import React from 'react';

/**
 * InspireHubButton — premium gradient pill that feels alive.
 * - Animated shimmer on hover
 * - Sparkle icon with subtle continuous pulse
 * - "AI" badge that mimics modern AI-product callouts
 */
export default function InspireHubButton({ onClick, className = '' }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Open InspireHub — competitions and AI-generated student reviews"
      className={
        'group relative inline-flex items-center gap-2 overflow-hidden rounded-xl px-4 py-2.5 ' +
        'text-[12.5px] font-bold text-white whitespace-nowrap select-none ' +
        'bg-[linear-gradient(135deg,#4F1FE0_0%,#7C3AED_45%,#EC4899_100%)] ' +
        'shadow-[0_8px_24px_-8px_rgba(124,58,237,0.55),inset_0_1px_0_rgba(255,255,255,0.25)] ' +
        'hover:shadow-[0_12px_32px_-8px_rgba(236,72,153,0.6),inset_0_1px_0_rgba(255,255,255,0.35)] ' +
        'hover:-translate-y-[1px] active:translate-y-0 active:scale-[0.97] ' +
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-fuchsia-400 focus-visible:ring-offset-2 ' +
        'transition-[transform,box-shadow] duration-200 ' +
        className
      }
    >
      {/* Shimmer */}
      <span className="pointer-events-none absolute inset-0 -translate-x-full bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.35),transparent)] transition-transform duration-700 group-hover:translate-x-full" />
      {/* Sparkle */}
      <svg
        width="15" height="15" viewBox="0 0 24 24" fill="none"
        stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round"
        className="relative drop-shadow-[0_1px_2px_rgba(0,0,0,0.25)] [animation:inspireSparkle_2.4s_ease-in-out_infinite]"
      >
        <path d="M12 2l1.6 4.6L18 8l-4.4 1.4L12 14l-1.6-4.6L6 8l4.4-1.4L12 2z" />
        <path d="M19 14l.8 2.4L22 17l-2.2.6L19 20l-.8-2.4L16 17l2.2-.6L19 14z" />
      </svg>
      <span className="relative">Open InspireHub</span>
      <span className="relative ml-0.5 hidden md:inline-flex items-center rounded-md bg-white/25 px-1.5 py-[2px] text-[9.5px] font-extrabold tracking-[0.12em] backdrop-blur-sm border border-white/20">
        AI
      </span>
      <style jsx>{`
        @keyframes inspireSparkle {
          0%, 100% { transform: rotate(0deg) scale(1); opacity: 1 }
          50%      { transform: rotate(8deg) scale(1.12); opacity: 0.85 }
        }
      `}</style>
    </button>
  );
}
