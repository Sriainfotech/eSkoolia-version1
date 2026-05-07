"use client";

/* Shimmer skeleton components for loading states */

function ShimmerBase({ className = "" }: { className?: string }) {
  return (
    <div
      className={`relative overflow-hidden bg-gray-100 rounded-lg ${className}`}
      style={{}}
    >
      <div
        className="absolute inset-0"
        style={{
          background: "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.6) 50%, transparent 100%)",
          backgroundSize: "200% 100%",
          animation: "shimmer 1.4s infinite",
        }}
      />
      <style>{`@keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }`}</style>
    </div>
  );
}

export function KPICardSkeleton() {
  return (
    <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm space-y-3">
      <div className="flex justify-between">
        <ShimmerBase className="w-10 h-10 rounded-full" />
        <ShimmerBase className="w-20 h-5 rounded-full" />
      </div>
      <ShimmerBase className="w-24 h-9 rounded-lg" />
      <ShimmerBase className="w-32 h-4 rounded" />
      <ShimmerBase className="w-full h-8 rounded" />
    </div>
  );
}

export function PipelineCardSkeleton() {
  return (
    <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm space-y-3">
      <div className="flex gap-3 items-center">
        <ShimmerBase className="w-9 h-9 rounded-full" />
        <div className="flex-1 space-y-2">
          <ShimmerBase className="w-32 h-4 rounded" />
          <ShimmerBase className="w-20 h-3 rounded" />
        </div>
        <ShimmerBase className="w-16 h-6 rounded-full" />
      </div>
      <ShimmerBase className="w-full h-2 rounded-full" />
      <div className="flex gap-2">
        <ShimmerBase className="w-20 h-5 rounded" />
        <ShimmerBase className="w-24 h-5 rounded" />
      </div>
      <div className="flex gap-2">
        <ShimmerBase className="w-14 h-7 rounded-lg" />
        <ShimmerBase className="w-14 h-7 rounded-lg" />
        <ShimmerBase className="w-14 h-7 rounded-lg" />
        <ShimmerBase className="ml-auto w-24 h-7 rounded-lg" />
      </div>
    </div>
  );
}

export function ChartSkeleton({ height = 200 }: { height?: number }) {
  return (
    <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm">
      <div className="flex justify-between mb-4">
        <ShimmerBase className="w-40 h-5 rounded" />
        <ShimmerBase className="w-20 h-5 rounded" />
      </div>
      <div
        className="relative overflow-hidden bg-gray-100 rounded-lg w-full"
        style={{ height }}
      >
        <div
          className="absolute inset-0"
          style={{
            background: "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.6) 50%, transparent 100%)",
            backgroundSize: "200% 100%",
            animation: "shimmer 1.4s infinite",
          }}
        />
      </div>
    </div>
  );
}
