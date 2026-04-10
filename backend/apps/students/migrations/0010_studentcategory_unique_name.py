from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("students", "0009_student_soft_delete_audit"),
    ]

    operations = [
        migrations.AddConstraint(
            model_name="studentcategory",
            constraint=models.UniqueConstraint(fields=("school", "name"), name="uq_student_category_school_name"),
        ),
    ]