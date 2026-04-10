from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("students", "0005_student_transport"),
    ]

    operations = [
        migrations.AlterField(
            model_name="studentcategory",
            name="name",
            field=models.CharField(max_length=100),
        ),
        migrations.AddField(
            model_name="studentcategory",
            name="code",
            field=models.CharField(blank=True, max_length=30, null=True),
        ),
        migrations.AddField(
            model_name="studentcategory",
            name="status",
            field=models.CharField(
                choices=[("active", "Active"), ("inactive", "Inactive")],
                default="active",
                max_length=10,
            ),
        ),
        migrations.AddConstraint(
            model_name="studentcategory",
            constraint=models.UniqueConstraint(fields=("school", "code"), name="uq_student_category_school_code"),
        ),
    ]
