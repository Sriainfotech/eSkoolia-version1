from django.db import migrations, models


class Migration(migrations.Migration):
    """
    Column 'must_change_password' already exists in the DB (added outside
    Django). This migration only registers it in Django's ORM state so that
    future makemigrations doesn't try to recreate it.
    Django model default=False ensures all ORM inserts supply the value.
    """

    dependencies = [
        ("users", "0002_user_login_flags"),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            # No DB changes needed — column already exists.
            database_operations=[],
            # Tell Django's ORM the field is present.
            state_operations=[
                migrations.AddField(
                    model_name="user",
                    name="must_change_password",
                    field=models.BooleanField(default=False),
                ),
            ],
        ),
    ]
