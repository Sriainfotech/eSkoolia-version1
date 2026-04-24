type AttendanceAlertProps = {
  count: number;
};

export default function AttendanceAlert({ count }: AttendanceAlertProps) {
  return (
    <div className="mb-4 rounded-xl border border-[#F3C4C7] bg-[#FFF3F4] p-3 text-sm text-[#9E1C2B]">
      {count} students are at attendance risk and need attention.
    </div>
  );
}
