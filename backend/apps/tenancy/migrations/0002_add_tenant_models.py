from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("tenancy", "0001_initial"),
    ]

    operations = [
        # Add Tenant model skeleton to be used by provisioning utilities.
        migrations.CreateModel(
            name="SchoolTenant",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("tenant_id", models.CharField(max_length=32, unique=True)),
                ("name", models.CharField(max_length=255)),
                ("short_code", models.CharField(blank=True, max_length=64)),
                ("subdomain_url", models.CharField(blank=True, max_length=128)),
                ("shard_region", models.CharField(blank=True, max_length=64)),
                ("storage_region", models.CharField(blank=True, max_length=64)),
                ("backup_retention", models.IntegerField(blank=True, null=True)),
                ("sso_method", models.CharField(blank=True, max_length=64)),
                ("api_access", models.BooleanField(default=False)),
                ("plan", models.CharField(blank=True, max_length=64)),
                ("status", models.CharField(default="pending", max_length=32)),
                ("provisioned_at", models.DateTimeField(blank=True, null=True)),
                ("schema_name", models.CharField(max_length=63, unique=True)),
            ],
            options={
                "db_table": "school_tenants",
            },
        ),
        migrations.CreateModel(
            name="Domain",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("domain", models.CharField(max_length=255, unique=True)),
                ("is_primary", models.BooleanField(default=False)),
            ],
            options={
                "db_table": "tenant_domains",
            },
        ),
    ]
