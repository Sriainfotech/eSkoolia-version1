from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ("students", "0012_repair_missing_district_column"),
        ("attendance", "0006_rename_attendance_s_student_idx_student_att_student_10af52_idx_and_more"),
        ("fees", "0001_initial"),
        ("exams", "0010_seatplansetting_seatplan_admitcardsetting_admitcard_and_more"),
        ("behaviour", "0003_remove_incident_school_title_constraint"),
    ]

    operations = [
        migrations.RunSQL(
            sql="""
            CREATE INDEX IF NOT EXISTS idx_students_school_del_class_sec
            ON students (school_id, is_deleted, current_class_id, current_section_id);

            CREATE INDEX IF NOT EXISTS idx_students_school_status_active
            ON students (school_id, status, is_active);

            CREATE INDEX IF NOT EXISTS idx_student_att_sch_date_class_sec
            ON student_attendances (school_id, attendance_date, class_id, section_id);

            CREATE INDEX IF NOT EXISTS idx_fees_pay_sch_date_method
            ON fees_payments (school_id, paid_at, method);

            CREATE INDEX IF NOT EXISTS idx_fees_asg_sch_status_due
            ON fees_assignments (school_id, status, due_date);

            CREATE INDEX IF NOT EXISTS idx_exam_reg_sch_term_class_sec_sub
            ON exam_mark_registers (school_id, exam_term_id, school_class_id, section_id, subject_id);

            CREATE INDEX IF NOT EXISTS idx_behv_asg_sch_year_student_created
            ON behaviour_assigned_incidents (school_id, academic_year_id, student_id, created_at);
            """,
            reverse_sql="""
            DROP INDEX IF EXISTS idx_behv_asg_sch_year_student_created;
            DROP INDEX IF EXISTS idx_exam_reg_sch_term_class_sec_sub;
            DROP INDEX IF EXISTS idx_fees_asg_sch_status_due;
            DROP INDEX IF EXISTS idx_fees_pay_sch_date_method;
            DROP INDEX IF EXISTS idx_student_att_sch_date_class_sec;
            DROP INDEX IF EXISTS idx_students_school_status_active;
            DROP INDEX IF EXISTS idx_students_school_del_class_sec;
            """,
        ),
    ]
