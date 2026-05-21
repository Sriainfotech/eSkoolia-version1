# Staff Module Migration Steps

## Generate and Apply Database Migrations

### Step 1: Generate Migration File
```bash
cd /path/to/project
python manage.py makemigrations hr
```

This will create a new migration file in `apps/hr/migrations/` with a timestamp, e.g., `0002_staffdocument.py`

### Step 2: Review Migration
```bash
python manage.py sqlmigrate hr 0002
```

This shows the SQL that will be executed. Expected output:
```sql
BEGIN;
--
-- Create model StaffDocument
--
CREATE TABLE "hr_staff_documents" (
    "id" integer NOT NULL PRIMARY KEY AUTOINCREMENT,
    "document_type" varchar(50) NOT NULL,
    "file_path" varchar(500) NOT NULL,
    "file_name" varchar(255) NOT NULL,
    "file_size" integer unsigned NOT NULL,
    "created_at" datetime NOT NULL,
    "updated_at" datetime NOT NULL,
    "school_id" integer NOT NULL,
    "staff_id" integer NOT NULL,
    FOREIGN KEY ("school_id") REFERENCES "tenancy_schools" ("id"),
    FOREIGN KEY ("staff_id") REFERENCES "hr_staff" ("id")
);
CREATE INDEX "hr_staff_documents_staff_id_document_type_abc123" ON "hr_staff_documents" ("staff_id", "document_type");
CREATE INDEX "hr_staff_documents_school_id_created_at_def456" ON "hr_staff_documents" ("school_id", "created_at");
CREATE UNIQUE INDEX "uq_staff_doc_scope_ghi789" ON "hr_staff_documents" ("staff_id", "document_type", "file_name");
COMMIT;
```

### Step 3: Apply Migration
```bash
python manage.py migrate hr
```

### Step 4: Verify Migration
```bash
# Check migration status
python manage.py showmigrations hr

# Output should show:
# [X] 0001_initial
# [X] 0002_staffdocument

# Verify table creation
python manage.py dbshell
# In shell:
# .schema hr_staff_documents
# SELECT COUNT(*) FROM hr_staff_documents;  -- Should return 0
```

## Expected Migration File Content

The auto-generated migration file should look similar to:

```python
# Generated migration file
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('tenancy', '0XXX_previous_migration'),
        ('hr', '0001_initial'),
    ]

    operations = [
        migrations.CreateModel(
            name='StaffDocument',
            fields=[
                ('id', models.AutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('document_type', models.CharField(choices=[('resume', 'Resume'), ('joining_letter', 'Joining Letter'), ...], max_length=50)),
                ('file_path', models.CharField(help_text='S3 or file storage path', max_length=500)),
                ('file_name', models.CharField(max_length=255)),
                ('file_size', models.PositiveIntegerField(help_text='File size in bytes')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('school', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='staff_documents', to='tenancy.school')),
                ('staff', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='documents', to='hr.staff')),
            ],
            options={
                'db_table': 'hr_staff_documents',
                'ordering': ['-created_at'],
            },
        ),
        migrations.AddIndex(
            model_name='staffdocument',
            index=models.Index(fields=['staff', 'document_type'], name='hr_staff__staff_id_document_type_abc123'),
        ),
        migrations.AddIndex(
            model_name='staffdocument',
            index=models.Index(fields=['school', 'created_at'], name='hr_staff__school_id_created_at_def456'),
        ),
        migrations.AddConstraint(
            model_name='staffdocument',
            constraint=models.UniqueConstraint(fields=['staff', 'document_type', 'file_name'], name='uq_staff_doc_scope'),
        ),
    ]
```

## Troubleshooting Migrations

### Issue: "No changes detected in app 'hr'"
**Solution:** Ensure model changes are saved in `models.py`

### Issue: "Foreign key error"
**Solution:** Check that dependent apps have their migrations applied first
```bash
python manage.py migrate tenancy
python manage.py migrate hr
```

### Issue: "Duplicate constraint names"
**Solution:** If Django generates conflicting names, rename in the constraint definition

### Rollback Migration
```bash
# List migrations
python manage.py showmigrations hr

# Rollback to specific migration
python manage.py migrate hr 0001_initial
```

## Post-Migration Tasks

1. **Verify database integrity:**
   ```bash
   python manage.py sqlsequencereset hr | python manage.py dbshell
   ```

2. **Test API endpoints:**
   ```bash
   curl -X GET http://localhost:8000/api/v1/hr/staff-documents/
   ```

3. **Check Django ORM:**
   ```bash
   python manage.py shell
   >>> from apps.hr.models import StaffDocument
   >>> StaffDocument.objects.all()  # Should return empty queryset
   ```

---

## Timeline for Developer

1. **Before deployment (5 min):** Generate migration locally
2. **Code review (review):** Get approval on changes
3. **Deployment (immediate):** Run migration on production
4. **Post-deployment (monitor):** Watch logs for errors
5. **Verification (manual):** Test API endpoints work

---

*Note: Migrations are auto-generated by Django. No manual SQL needed in most cases.*
