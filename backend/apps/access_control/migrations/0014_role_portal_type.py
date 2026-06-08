from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("access_control", "0013_role_name_30_and_is_active"),
    ]

    operations = [
        migrations.AddField(
            model_name="role",
            name="portal_type",
            field=models.CharField(
                choices=[
                    ("admin",   "Admin Console"),
                    ("teacher", "Teacher Portal"),
                    ("parent",  "Parent Portal"),
                    ("student", "Student Portal"),
                    ("custom",  "Custom"),
                ],
                default="admin",
                max_length=20,
                help_text="Which portal this role belongs to. Controls post-login redirect.",
            ),
        ),
    ]
