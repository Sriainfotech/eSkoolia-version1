from django.db import migrations, models


class Migration(migrations.Migration):
    """
    The UniqueConstraint uq_student_category_school_name was already created
    by 0001_initial. This migration updates Django's internal state to record
    the constraint without issuing a second CREATE INDEX on the database.
    """

    dependencies = [
        ("students", "0009_student_soft_delete_audit"),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            # Tell Django the model now has this constraint (state only)
            state_operations=[
                migrations.AddConstraint(
                    model_name="studentcategory",
                    constraint=models.UniqueConstraint(
                        fields=("school", "name"),
                        name="uq_student_category_school_name",
                    ),
                ),
            ],
            # Constraint already exists from 0001_initial — nothing to run
            database_operations=[],
        ),
    ]