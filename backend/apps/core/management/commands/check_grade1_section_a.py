"""
Diagnostic command: check why Grade 1 Section A and its students
might not be appearing in the attendance frontend.

Run with:
    python manage.py check_grade1_section_a

Optional: filter by school id
    python manage.py check_grade1_section_a --school_id=1
"""
from django.core.management.base import BaseCommand
from django.db.models import Q


class Command(BaseCommand):
    help = "Diagnose missing Grade 1 / Section A in attendance frontend"

    def add_arguments(self, parser):
        parser.add_argument("--school_id", type=int, default=None)

    def handle(self, *args, **options):
        from apps.core.models import Class, Section
        from apps.students.models import Student

        school_id = options.get("school_id")

        self.stdout.write(self.style.MIGRATE_HEADING("\n=== Schools ==="))
        try:
            from apps.tenancy.models import School
            schools = School.objects.all()
            for s in schools:
                self.stdout.write(f"  School id={s.id} name={s.name}")
        except Exception as e:
            self.stdout.write(self.style.WARNING(f"  Could not list schools: {e}"))

        self.stdout.write(self.style.MIGRATE_HEADING("\n=== All Classes ==="))
        class_qs = Class.objects.prefetch_related("sections").order_by("school_id", "numeric_order", "name")
        if school_id:
            class_qs = class_qs.filter(school_id=school_id)

        grade1_classes = []
        for cls in class_qs:
            secs = list(cls.sections.all())
            sec_names = [s.name for s in secs]
            self.stdout.write(
                f"  Class id={cls.id} name='{cls.name}' school_id={cls.school_id} "
                f"numeric_order={cls.numeric_order} sections={sec_names}"
            )
            if "1" in cls.name or "grade 1" in cls.name.lower() or cls.name.lower() in ("grade 1", "1"):
                grade1_classes.append((cls, secs))

        if not grade1_classes:
            self.stdout.write(self.style.ERROR("\nNo class matching 'Grade 1' found at all!"))
            self.stdout.write("  --> The Class record may not exist or has a wrong name format.")
            self.stdout.write("  --> Run 'python manage.py shell' and check Class.objects.all() manually.")
            return

        self.stdout.write(self.style.MIGRATE_HEADING("\n=== Grade 1 Details ==="))
        for cls, secs in grade1_classes:
            self.stdout.write(f"\n  Class: id={cls.id} name='{cls.name}' school_id={cls.school_id}")
            self.stdout.write(f"  Sections from prefetch_related: {[(s.id, s.name) for s in secs]}")

            # Check sections from the DB directly
            direct_secs = Section.objects.filter(school_class=cls).order_by("name")
            self.stdout.write(f"  Sections from direct query: {[(s.id, s.name) for s in direct_secs]}")

            for sec in direct_secs:
                student_count = Student.objects.filter(
                    current_section=sec, is_active=True
                ).count()
                student_count_inactive = Student.objects.filter(
                    current_section=sec, is_active=False
                ).count()
                null_section_students = Student.objects.filter(
                    current_class=cls, current_section__isnull=True, is_active=True
                ).count()
                self.stdout.write(
                    f"    Section id={sec.id} name='{sec.name}': "
                    f"{student_count} active students, {student_count_inactive} inactive, "
                    f"{null_section_students} active students with null section in this class"
                )

            # Check students linked to this class
            total_class_students = Student.objects.filter(current_class=cls, is_active=True)
            self.stdout.write(f"\n  Students in Grade 1 (active, any section): {total_class_students.count()}")
            for stu in total_class_students[:20]:
                self.stdout.write(
                    f"    Student id={stu.id} name='{stu.first_name} {stu.last_name}' "
                    f"current_section_id={stu.current_section_id} "
                    f"current_class_id={stu.current_class_id} "
                    f"school_id={getattr(stu, 'school_id', 'N/A')}"
                )

        self.stdout.write(self.style.MIGRATE_HEADING("\n=== Section A across all classes ==="))
        section_a_qs = Section.objects.filter(name__iexact="A").select_related("school_class")
        if school_id:
            section_a_qs = section_a_qs.filter(school_class__school_id=school_id)
        for sec in section_a_qs:
            students = Student.objects.filter(current_section=sec, is_active=True).count()
            self.stdout.write(
                f"  Section id={sec.id} name='{sec.name}' class='{sec.school_class.name}' "
                f"(class_id={sec.school_class_id}) school_id={sec.school_class.school_id} "
                f"students={students}"
            )

        self.stdout.write(self.style.SUCCESS("\n=== Done ==="))
        self.stdout.write("If Grade 1 shows 0 students but you know there are 8:")
        self.stdout.write("  → Check if students have current_class_id matching the Grade 1 class id above")
        self.stdout.write("  → Check if students have current_section_id matching Section A's id above")
        self.stdout.write("  → If school_id mismatches: update the student records or the class record")
