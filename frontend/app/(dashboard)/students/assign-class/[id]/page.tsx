import { redirect } from "next/navigation";

export default function AssignClassPage({ params }: { params: { id: string } }) {
  const studentId = Number(params.id);
  if (Number.isNaN(studentId)) {
    redirect("/students/list");
  }
  redirect(`/students/add?mode=edit&id=${studentId}`);
}
