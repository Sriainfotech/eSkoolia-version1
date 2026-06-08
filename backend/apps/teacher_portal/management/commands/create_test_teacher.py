"""
Management command: create_test_teacher

Creates minimal test data to verify the teacher portal end-to-end:
  - 1 Role with portal_type='teacher'
  - 1 User linked to that Role
  - 1 Staff record linked to that User
  - 1 ClassTeacherAssignment (class teacher for Class 5-A)
  - Subject assignments matching the Priya use case:
      Hindi: Class 4-A, 4-B
      Math:  Class 3-B

Requires an active School, AcademicYear, and Class/Section records
to already exist. Run after initial school setup.

Usage:
  python manage.py create_test_teacher --school-code SCHOOL_CODE
  python manage.py create_test_teacher --school-code SCHOOL_CODE --reset
"""

from django.core.management.base import BaseCommand, CommandError
from django.contrib.auth import get_user_model
from django.db import transaction

User = get_user_model()


class Command(BaseCommand):
    help = "Create a test teacher user for portal testing"

    def add_arguments(self, parser):
        parser.add_argument(
            '--school-code',
            required=True,
            help='School code (e.g. SCH001)',
        )
        parser.add_argument(
            '--reset',
            action='store_true',
            help='Delete existing test teacher before creating a new one',
        )

    def handle(self, *args, **options):
        from apps.tenancy.models import School
        from apps.access_control.models import Role, UserRole, PortalType
        from apps.hr.models import Staff, Department, Designation
        from apps.core.models import AcademicYear, Class, Section, Subject
        from apps.academics.models import ClassTeacherAssignment, ClassSubjectAssignment

        school_code = options['school_code']

        # ── Fetch school ──────────────────────────────────────────────────────
        try:
            school = School.objects.get(code=school_code)
        except School.DoesNotExist:
            raise CommandError(f"School with code '{school_code}' not found.")

        self.stdout.write(f"School: {school.name}")

        # ── Academic year ─────────────────────────────────────────────────────
        year = AcademicYear.objects.filter(school=school, is_current=True).first()
        if not year:
            year = AcademicYear.objects.filter(school=school, is_active=True).first()
        if not year:
            raise CommandError(
                "No active academic year found for this school. "
                "Create one in the admin console first."
            )
        self.stdout.write(f"Academic year: {year.name}")

        # ── Reset if requested ────────────────────────────────────────────────
        if options['reset']:
            User.objects.filter(username='test_teacher_priya').delete()
            self.stdout.write(self.style.WARNING("Deleted existing test_teacher_priya"))

        with transaction.atomic():
            # ── Role ──────────────────────────────────────────────────────────
            role, created = Role.objects.get_or_create(
                school=school,
                name='Class Teacher',
                defaults={
                    'portal_type': PortalType.TEACHER,
                    'is_system': False,
                    'is_active': True,
                },
            )
            if not created and role.portal_type != PortalType.TEACHER:
                role.portal_type = PortalType.TEACHER
                role.save(update_fields=['portal_type'])
            self.stdout.write(f"Role: {role.name} (portal_type={role.portal_type})")

            # ── User ──────────────────────────────────────────────────────────
            user, created = User.objects.get_or_create(
                username='test_teacher_priya',
                defaults={
                    'first_name': 'Priya',
                    'last_name': 'Sharma',
                    'email': 'priya.sharma@eskoolia.edu',
                    'school': school,
                    'is_active': True,
                    'access_status': True,
                },
            )
            if created:
                user.set_password('Test@1234')
                user.save()
            self.stdout.write(f"User: {user.username} (created={created})")

            # Assign role
            UserRole.objects.get_or_create(user=user, role=role)

            # ── Department + Designation ──────────────────────────────────────
            dept, _ = Department.objects.get_or_create(
                school=school, name='Languages',
                defaults={'is_active': True},
            )
            desig, _ = Designation.objects.get_or_create(
                school=school, department=dept, name='Teacher',
                defaults={'role_template': 'Teacher', 'employment_type': 'Full-time'},
            )

            # ── Staff ─────────────────────────────────────────────────────────
            staff, created = Staff.objects.get_or_create(
                school=school,
                staff_no='TCH-TEST-001',
                defaults={
                    'user': user,
                    'first_name': 'Priya',
                    'last_name': 'Sharma',
                    'email': 'priya.sharma@eskoolia.edu',
                    'phone': '9876543210',
                    'department': dept,
                    'designation': desig,
                    'join_date': '2023-06-01',
                    'status': Staff.STATUS_ACTIVE,
                },
            )
            if not created and staff.user != user:
                staff.user = user
                staff.save(update_fields=['user'])
            self.stdout.write(f"Staff: {staff.staff_no} (created={created})")

            # ── Class + Section lookup helpers ────────────────────────────────
            def get_class(name):
                obj = Class.objects.filter(school=school, name=name).first()
                if not obj:
                    self.stdout.write(
                        self.style.WARNING(f"  Class '{name}' not found — skipping")
                    )
                return obj

            def get_section(cls, name):
                if not cls:
                    return None
                obj = Section.objects.filter(school_class=cls, name=name).first()
                if not obj:
                    self.stdout.write(
                        self.style.WARNING(
                            f"  Section '{name}' for {cls.name} not found — skipping"
                        )
                    )
                return obj

            def get_subject(name):
                obj = Subject.objects.filter(school=school, name=name).first()
                if not obj:
                    self.stdout.write(
                        self.style.WARNING(f"  Subject '{name}' not found — skipping")
                    )
                return obj

            # ── Class Teacher Assignment (Class 5-A) ──────────────────────────
            cls5 = get_class('Class 5')
            sec_a = get_section(cls5, 'A')
            if cls5 and sec_a:
                ClassTeacherAssignment.objects.get_or_create(
                    school=school,
                    academic_year=year,
                    school_class=cls5,
                    section=sec_a,
                    defaults={'teacher': user, 'active_status': True},
                )
                self.stdout.write("  Class teacher: Class 5-A ✓")
            else:
                self.stdout.write(
                    self.style.WARNING("  Skipped class teacher assignment (Class 5 / Section A missing)")
                )

            # ── Subject Assignments ───────────────────────────────────────────
            hindi = get_subject('Hindi')
            maths = get_subject('Mathematics')
            cls4  = get_class('Class 4')
            cls3  = get_class('Class 3')
            sec_b = get_section(cls3, 'B') if cls3 else None
            sec4a = get_section(cls4, 'A') if cls4 else None
            sec4b = get_section(cls4, 'B') if cls4 else None

            assignments_to_create = []
            if hindi and cls4:
                for sec in [sec4a, sec4b]:
                    if sec:
                        assignments_to_create.append(('Hindi', cls4, sec, hindi))
            if maths and cls3 and sec_b:
                assignments_to_create.append(('Maths', cls3, sec_b, maths))

            for label, cls, sec, subj in assignments_to_create:
                ClassSubjectAssignment.objects.get_or_create(
                    school=school,
                    academic_year=year,
                    school_class=cls,
                    section=sec,
                    subject=subj,
                    defaults={'teacher': user, 'active_status': True},
                )
                self.stdout.write(f"  Subject: {label} → {cls.name}-{sec.name} ✓")

        self.stdout.write(self.style.SUCCESS(
            "\n✓ Test teacher created successfully.\n"
            "  Username: test_teacher_priya\n"
            "  Password: Test@1234\n"
            "  Portal:   /teacher/home\n"
            "  API:      GET /api/v1/teacher/me/ (with Bearer token)\n"
        ))
