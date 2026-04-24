type AttendancePageHeaderProps = {
  onImport: () => void;
  onExport: () => void;
};

export default function AttendancePageHeader({ onImport, onExport }: AttendancePageHeaderProps) {
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 className="text-2xl font-semibold text-[#1C1C28]">Student Attendance</h1>
        <p className="text-sm text-[#646B80]">Track daily attendance by class and section</p>
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onImport}
          className="rounded-lg border border-[#C9CCE3] bg-white px-3 py-2 text-sm text-[#2A3155]"
        >
          Import
        </button>
        <button
          type="button"
          onClick={onExport}
          className="rounded-lg border border-[#2F4DFF] bg-[#2F4DFF] px-3 py-2 text-sm text-white"
        >
          Export
        </button>
      </div>
    </div>
  );
}
