"use client";

import { useState, useMemo } from "react";
import { AcademicYear, SchoolClass, Subject } from "@/lib/types";
import { MOCK_YEARS, MOCK_CLASSES, MOCK_SUBJECTS } from "@/lib/mock-data";

import Hero from "@/components/core-setup/Hero";
import StatsRow from "@/components/core-setup/StatsRow";
import TabbedSection from "@/components/core-setup/TabbedSection";
import YearsTable from "@/components/core-setup/YearsTable";
import YearModal from "@/components/core-setup/YearModal";
import ClassesGrid from "@/components/core-setup/ClassesGrid";
import ClassModal from "@/components/core-setup/ClassModal";
import SubjectsGrid from "@/components/core-setup/SubjectsGrid";
import SubjectModal from "@/components/core-setup/SubjectModal";
import Toast from "@/components/core-setup/Toast";

type TabKey = "years" | "classes" | "subjects";

export default function CoreSetupPage() {
  // TODO: replace with API calls to GET /api/academic-years/, GET /api/classes/, and GET /api/core/subjects/
  const [years, setYears] = useState<AcademicYear[]>(MOCK_YEARS);
  const [classes, setClasses] = useState<SchoolClass[]>(MOCK_CLASSES);
  const [subjects, setSubjects] = useState<Subject[]>(MOCK_SUBJECTS);
  const [activeTab, setActiveTab] = useState<TabKey>("years");

  const [yearModalOpen, setYearModalOpen] = useState(false);
  const [editingYear, setEditingYear] = useState<AcademicYear | null>(null);

  const [classModalOpen, setClassModalOpen] = useState(false);
  const [editingClass, setEditingClass] = useState<SchoolClass | null>(null);

  const [subjectModalOpen, setSubjectModalOpen] = useState(false);
  const [editingSubject, setEditingSubject] = useState<Subject | null>(null);

  const [toast, setToast] = useState<string | null>(null);

  const totalSections = useMemo(
    () => classes.reduce((sum, c) => sum + c.sections.length, 0),
    [classes]
  );

  const stats = {
    years: years.length,
    classes: classes.length,
    sections: totalSections,
    subjects: subjects.length,
  };

  const heroAddLabel =
    activeTab === "classes"
      ? "New Class"
      : activeTab === "subjects"
        ? "New Subject"
        : "New Academic Year";

  const openAddYear = () => {
    setEditingYear(null);
    setYearModalOpen(true);
  };

  const openEditYear = (year: AcademicYear) => {
    setEditingYear(year);
    setYearModalOpen(true);
  };

  const deleteYear = (year: AcademicYear) => {
    // TODO: replace with API call to DELETE /api/academic-years/:id/
    if (!confirm(`Delete ${year.name}? This cannot be undone.`)) return;
    setYears((prev) => prev.filter((y) => y.id !== year.id));
    setToast(`${year.name} deleted.`);
  };

  const saveYear = (input: Omit<AcademicYear, "id"> & { id?: string }) => {
    // TODO: replace with API call to POST or PUT /api/academic-years/
    setYears((prev) => {
      let next = prev;
      // If saving as active, archive the existing active year
      if (input.status === "active") {
        next = next.map((y) =>
          y.status === "active" && y.id !== input.id
            ? { ...y, status: "archived" as const }
            : y
        );
      }
      if (input.id) {
        next = next.map((y) =>
          y.id === input.id ? ({ ...y, ...input } as AcademicYear) : y
        );
      } else {
        next = [
          { ...input, id: `y${Date.now()}` } as AcademicYear,
          ...next,
        ];
      }
      return next;
    });
    setYearModalOpen(false);
    setToast(input.id ? `${input.name} updated.` : `${input.name} created.`);
  };

  const openAddClass = () => {
    setEditingClass(null);
    setClassModalOpen(true);
  };

  const openEditClass = (schoolClass: SchoolClass) => {
    setEditingClass(schoolClass);
    setClassModalOpen(true);
  };

  const deleteClass = (schoolClass: SchoolClass) => {
    const warn =
      schoolClass.sections.length > 0
        ? `Delete ${schoolClass.name} and all ${schoolClass.sections.length} section${schoolClass.sections.length === 1 ? "" : "s"}? This cannot be undone.`
        : `Delete ${schoolClass.name}? This cannot be undone.`;
    if (!confirm(warn)) return;
    setClasses((prev) => prev.filter((c) => c.id !== schoolClass.id));
    setToast(`${schoolClass.name} deleted.`);
  };

  const saveClass = (input: Omit<SchoolClass, "id"> & { id?: string }) => {
    // TODO: replace with API call to POST or PUT /api/classes/
    setClasses((prev) => {
      if (input.id) {
        return prev.map((c) =>
          c.id === input.id ? ({ ...c, ...input } as SchoolClass) : c
        );
      }
      return [...prev, { ...input, id: `c${Date.now()}` } as SchoolClass];
    });
    setClassModalOpen(false);
    setToast(input.id ? `${input.name} updated.` : `${input.name} created.`);
  };

  const addSection = (classId: string, sectionName: string) => {
    const schoolClass = classes.find((c) => c.id === classId);
    if (!schoolClass) return { ok: false, reason: "class-not-found" };

    if (
      schoolClass.sections.some(
        (s) => s.toLowerCase() === sectionName.toLowerCase()
      )
    ) {
      setToast(`Section "${sectionName}" already exists in ${schoolClass.name}.`);
      return { ok: false, reason: "duplicate" };
    }

    setClasses((prev) =>
      prev.map((c) =>
        c.id === classId
          ? { ...c, sections: [...c.sections, sectionName] }
          : c
      )
    );
    setToast(`Section ${sectionName} added to ${schoolClass.name}.`);
    return { ok: true };
  };

  const removeSection = (classId: string, sectionName: string) => {
    setClasses((prev) =>
      prev.map((c) =>
        c.id === classId
          ? { ...c, sections: c.sections.filter((s) => s !== sectionName) }
          : c
      )
    );
    setToast(`Section ${sectionName} removed.`);
  };

  const openAddSubject = () => {
    setEditingSubject(null);
    setSubjectModalOpen(true);
  };

  const openEditSubject = (subject: Subject) => {
    setEditingSubject(subject);
    setSubjectModalOpen(true);
  };

  const saveSubject = (input: Omit<Subject, "id" | "classCount"> & { id?: string }) => {
    // TODO: replace with API call to POST or PUT /api/core/subjects/
    setSubjects((prev) => {
      if (input.id) {
        return prev.map((s) =>
          s.id === input.id ? ({ ...s, ...input, classCount: 0 } as Subject) : s
        );
      }
      return [...prev, { ...input, id: `s${Date.now()}`, classCount: 0 } as Subject];
    });
    setSubjectModalOpen(false);
    setToast(input.id ? `${input.name} updated.` : `${input.name} created.`);
  };

  const deleteSubject = (subject: Subject) => {
    if (subject.classCount > 0) {
      if (!confirm(`Detach ${subject.name} from ${subject.classCount} class${subject.classCount === 1 ? "" : "es"}? This cannot be undone.`)) return;
    } else {
      if (!confirm(`Delete ${subject.name}? This cannot be undone.`)) return;
    }
    setSubjects((prev) => prev.filter((s) => s.id !== subject.id));
    setToast(`${subject.name} deleted.`);
  };

  const handleHeroAdd = () => {
    if (activeTab === "years") openAddYear();
    else if (activeTab === "classes") openAddClass();
    else if (activeTab === "subjects") openAddSubject();
  };

  return (
    <main className="max-w-[1400px] mx-auto px-5 py-4 pb-8 animate-[fade_.4s_ease]">
      <Hero addLabel={heroAddLabel} onAddClick={handleHeroAdd} />
      <StatsRow stats={stats} />

      <TabbedSection
        activeKey={activeTab}
        onTabChange={(k) => setActiveTab(k as TabKey)}
        tabs={[
          {
            key: "years",
            label: "Academic Years",
            count: years.length,
            content: (
              <YearsTable
                years={years}
                onEdit={openEditYear}
                onDelete={deleteYear}
              />
            ),
          },
          {
            key: "classes",
            label: "Classes & Sections",
            count: classes.length,
            content: (
              <ClassesGrid
                classes={classes}
                onAdd={openAddClass}
                onEdit={openEditClass}
                onDelete={deleteClass}
                onAddSection={addSection}
                onRemoveSection={removeSection}
              />
            ),
          },
          {
            key: "subjects",
            label: "Subjects",
            count: subjects.length,
            content: (
              <SubjectsGrid
                subjects={subjects}
                onAdd={openAddSubject}
                onEdit={openEditSubject}
                onDelete={deleteSubject}
              />
            ),
          },
        ]}
      />

      <YearModal
        open={yearModalOpen}
        editing={editingYear}
        onClose={() => setYearModalOpen(false)}
        onSave={saveYear}
      />

      <ClassModal
        open={classModalOpen}
        editing={editingClass}
        existingNames={classes.map((c) => c.name)}
        onClose={() => setClassModalOpen(false)}
        onSave={saveClass}
      />

      <SubjectModal
        open={subjectModalOpen}
        editing={editingSubject}
        existingNames={subjects.map((s) => s.name)}
        onClose={() => setSubjectModalOpen(false)}
        onSave={saveSubject}
      />

      {toast && <Toast message={toast} onClose={() => setToast(null)} />}

      <style jsx global>{`
        @keyframes fade {
          from {
            opacity: 0;
            transform: translateY(4px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </main>
  );
}
