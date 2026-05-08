from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('access_control', '0009_seed_communication_permissions'),
    ]

    operations = [
        # ModuleAccessTier table
        migrations.CreateModel(
            name='ModuleAccessTier',
            fields=[
                ('id', models.AutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('module', models.CharField(max_length=120)),
                ('tier', models.CharField(
                    choices=[
                        ('none', 'No Access'),
                        ('view', 'View Only'),
                        ('operate', 'Operate'),
                        ('manage', 'Manage'),
                        ('full', 'Full Access'),
                    ],
                    max_length=20,
                )),
                ('permissions', models.ManyToManyField(
                    blank=True,
                    related_name='module_access_tiers',
                    to='access_control.permission',
                )),
            ],
            options={
                'db_table': 'module_access_tiers',
                'ordering': ['module', 'tier'],
            },
        ),
        migrations.AddConstraint(
            model_name='moduleaccesstier',
            constraint=models.UniqueConstraint(fields=('module', 'tier'), name='uq_module_tier'),
        ),

        # RoleModuleAccess table
        migrations.CreateModel(
            name='RoleModuleAccess',
            fields=[
                ('id', models.AutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('module', models.CharField(max_length=120)),
                ('tier', models.CharField(
                    choices=[
                        ('none', 'No Access'),
                        ('view', 'View Only'),
                        ('operate', 'Operate'),
                        ('manage', 'Manage'),
                        ('full', 'Full Access'),
                    ],
                    default='none',
                    max_length=20,
                )),
                ('role', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='module_accesses',
                    to='access_control.role',
                )),
            ],
            options={
                'db_table': 'role_module_accesses',
                'ordering': ['module'],
            },
        ),
        migrations.AddConstraint(
            model_name='rolemoduleaccess',
            constraint=models.UniqueConstraint(fields=('role', 'module'), name='uq_role_module_access'),
        ),

        # RoleTemplate table
        migrations.CreateModel(
            name='RoleTemplate',
            fields=[
                ('id', models.AutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(max_length=120, unique=True)),
                ('description', models.TextField(blank=True)),
                ('module_tiers', models.JSONField(default=dict)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
            ],
            options={
                'db_table': 'role_templates',
                'ordering': ['name'],
            },
        ),
    ]
