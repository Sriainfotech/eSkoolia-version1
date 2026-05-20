"""
Replace the uq_role_school_name constraint with one that uses NULLS NOT DISTINCT
(PostgreSQL 15+ / Django 5.0+).  This ensures that two roles whose school IS NULL
but share the same name are still treated as duplicates at the database level.
"""
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("access_control", "0011_alter_moduleaccesstier_id_alter_rolemoduleaccess_id_and_more"),
    ]

    operations = [
        migrations.RemoveConstraint(
            model_name="role",
            name="uq_role_school_name",
        ),
        migrations.AddConstraint(
            model_name="role",
            constraint=models.UniqueConstraint(
                fields=["school", "name"],
                name="uq_role_school_name",
                nulls_distinct=False,
            ),
        ),
    ]
