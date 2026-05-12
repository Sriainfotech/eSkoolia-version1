"use client";

import { useState, useMemo } from "react";
import { Search, Edit2, Trash2 } from "lucide-react";
import { AcademicYear, AcademicYearStatus } from "@/lib/types";
import { formatDate } from "@/lib/utils";
import StatusPill from "./StatusPill";

interface YearsTableProps {
  years: AcademicYear[];
  onEdit: (year: AcademicYear) => void;
  onDelete: (year: AcademicYear) => void;
}

type FilterStatus = "all" | "active" | "upcoming" | "archived";

export default function YearsTable({ years, onEdit, onDelete }: YearsTableProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState<FilterStatus>("all");

  const filteredYears = useMemo(() => {
    return years.filter((year) => {
      const matchesSearch = year.name
        .toLowerCase()
        .includes(searchTerm.toLowerCase());
      const matchesFilter =
        filterStatus === "all" || year.status === filterStatus;
      return matchesSearch && matchesFilter;
    });
  }, [years, searchTerm, filterStatus]);

  const filterChips: { label: string; value: FilterStatus }[] = [
    { label: "All", value: "all" },
    { label: "Active", value: "active" },
    { label: "Upcoming", value: "upcoming" },
    { label: "Archived", value: "archived" },
  ];

  return (
    <div className="flex flex-col gap-4">
      {/* Search & Filter toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        {/* Search input */}
        <div className="relative flex-1">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400"
          />
          <input
            type="text"
            placeholder="Search by year name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-[10px] border border-zinc-300 bg-white text-[13.5px] placeholder-zinc-400 focus:outline-none focus:border-violet-600 focus:ring-2 focus:ring-violet-100 transition"
          />
        </div>

        {/* Filter chips */}
        <div className="flex items-center gap-2 flex-wrap">
          {filterChips.map((chip) => (
            <button
              key={chip.value}
              onClick={() => setFilterStatus(chip.value)}
              className={`px-3.5 py-2 rounded-full text-[13px] font-medium transition ${
                filterStatus === chip.value
                  ? "bg-violet-50 text-violet-600 border border-violet-200"
                  : "bg-zinc-50 text-zinc-600 border border-zinc-200 hover:bg-zinc-100"
              }`}
            >
              {chip.label}
            </button>
          ))}
        </div>
      </div>

      {/* Table or empty state */}
      {filteredYears.length === 0 ? (
        <div className="py-12 text-center">
          <p className="text-[14px] text-zinc-500">
            No academic years match your filters.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-[13.5px]">
            <thead>
              <tr className="border-b border-zinc-200 bg-zinc-50">
                <th className="px-4 py-3 text-left font-semibold text-zinc-600 tracking-wide uppercase text-[11px]">
                  Name
                </th>
                <th className="px-4 py-3 text-left font-semibold text-zinc-600 tracking-wide uppercase text-[11px]">
                  Start Date
                </th>
                <th className="px-4 py-3 text-left font-semibold text-zinc-600 tracking-wide uppercase text-[11px]">
                  End Date
                </th>
                <th className="px-4 py-3 text-left font-semibold text-zinc-600 tracking-wide uppercase text-[11px]">
                  Status
                </th>
                <th className="px-4 py-3 text-right font-semibold text-zinc-600 tracking-wide uppercase text-[11px]">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredYears.map((year, idx) => (
                <tr
                  key={year.id}
                  className={`border-b border-zinc-200 hover:bg-zinc-50 transition ${
                    idx % 2 === 0 ? "bg-white" : "bg-zinc-50"
                  }`}
                >
                  <td className="px-4 py-3">
                    <span className="font-[var(--font-playfair)] text-[17px] font-medium text-zinc-900">
                      {year.name}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-tabular-nums text-zinc-600">
                    {formatDate(year.start)}
                  </td>
                  <td className="px-4 py-3 font-tabular-nums text-zinc-600">
                    {formatDate(year.end)}
                  </td>
                  <td className="px-4 py-3">
                    <StatusPill status={year.status} />
                  </td>
                  <td className="px-4 py-3 text-right flex items-center justify-end gap-2">
                    <button
                      onClick={() => onEdit(year)}
                      className="p-2 rounded-lg bg-violet-50 text-violet-600 hover:bg-violet-100 transition"
                      title="Edit year"
                    >
                      <Edit2 size={14} />
                    </button>
                    <button
                      onClick={() => onDelete(year)}
                      className="p-2 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition"
                      title="Delete year"
                    >
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Footer with pagination info and controls */}
      <div className="flex items-center justify-between pt-4 border-t border-zinc-200 text-[13px] text-zinc-600">
        <span>
          Page 1 of 1 · {filteredYears.length} total
        </span>
        <div className="flex items-center gap-2">
          <button
            disabled
            className="px-3 py-1.5 rounded-[8px] border border-zinc-300 bg-white text-zinc-600 disabled:opacity-50 disabled:cursor-not-allowed hover:enabled:bg-zinc-50 transition text-[12px] font-medium"
          >
            Previous
          </button>
          <button
            disabled
            className="px-3 py-1.5 rounded-[8px] border border-zinc-300 bg-white text-zinc-600 disabled:opacity-50 disabled:cursor-not-allowed hover:enabled:bg-zinc-50 transition text-[12px] font-medium"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
