import type { LevelFilter } from '../types';

type AttendanceFilterBarProps = {
  academicYear: string;
  levelFilter: LevelFilter;
  onYearChange: (year: string) => void;
  onLevelChange: (level: LevelFilter) => void;
};

export default function AttendanceFilterBar({
  academicYear,
  levelFilter,
  onYearChange,
  onLevelChange,
}: AttendanceFilterBarProps) {
  return (
    <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-[#E6E6EC] bg-white p-3">
      <select
        value={academicYear}
        onChange={(e) => onYearChange(e.target.value)}
        className="rounded-lg border border-[#D3D7EB] bg-white px-3 py-2 text-sm"
      >
        <option value="2025-26">2025-26</option>
        <option value="2024-25">2024-25</option>
      </select>

      <select
        value={levelFilter}
        onChange={(e) => onLevelChange(e.target.value as LevelFilter)}
        className="rounded-lg border border-[#D3D7EB] bg-white px-3 py-2 text-sm"
      >
        <option value="all">All Levels</option>
        <option value="primary">Primary</option>
        <option value="middle">Middle</option>
        <option value="secondary">Secondary</option>
      </select>
    </div>
  );
}
