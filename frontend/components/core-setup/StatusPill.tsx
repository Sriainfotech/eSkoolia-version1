"use client";

import { AcademicYearStatus } from "@/lib/types";

interface StatusPillProps {
  status: AcademicYearStatus;
}

export default function StatusPill({ status }: StatusPillProps) {
  if (status === "active") {
    return (
      <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-[12px] font-medium bg-green-50 text-green-700">
        <span className="w-1.5 h-1.5 rounded-full bg-green-600" />
        Active
      </span>
    );
  }

  if (status === "upcoming") {
    return (
      <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-[12px] font-medium bg-amber-50 text-amber-700">
        <span className="w-1.5 h-1.5 rounded-full bg-amber-600" />
        Upcoming
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-[12px] font-medium bg-white border border-zinc-200 text-zinc-600">
      <span className="w-1.5 h-1.5 rounded-full bg-zinc-400" />
      Archived
    </span>
  );
}
