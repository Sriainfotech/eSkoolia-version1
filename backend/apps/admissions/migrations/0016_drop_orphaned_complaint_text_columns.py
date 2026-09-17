# Drops orphaned legacy columns left behind by 0014/0015.
#
# 0014 added a ForeignKey field named "complaint_type" while a CharField of
# the same name (from 0004) still existed in migration state. Django's
# AddField.state_forwards() just overwrites the state dict entry for that
# field name instead of erroring, so from that point on migration state only
# knew about the new FK - the old "complaint_type"/"complaint_source" varchar
# columns were never targeted by a RemoveField and stayed in the database.
# 0015's later RemoveField+AddField pair (already believing the field was the
# FK) ended up dropping and re-adding the *_id column instead, a no-op that
# left the true legacy columns untouched. Net result: complaint_entries has
# had two independent columns per field (varchar "complaint_type" NOT NULL,
# and bigint "complaint_type_id" nullable) ever since - the ORM only reads/
# writes the *_id columns, but the orphaned NOT NULL varchar ones still get
# included in every INSERT (as an empty column list entry) and raise a
# not-null-constraint IntegrityError on every complaint creation.
#
# Verified via information_schema.columns / pg_constraint / pg_indexes that
# no constraint or index references the orphaned columns before dropping them.
from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ("admissions", "0015_fix_complaint_entry_text_to_fk"),
    ]

    operations = [
        migrations.RunSQL(
            sql=[
                'ALTER TABLE "complaint_entries" DROP COLUMN IF EXISTS "complaint_type";',
                'ALTER TABLE "complaint_entries" DROP COLUMN IF EXISTS "complaint_source";',
            ],
            reverse_sql=[
                'ALTER TABLE "complaint_entries" ADD COLUMN "complaint_type" varchar(120) NOT NULL DEFAULT \'\';',
                'ALTER TABLE "complaint_entries" ADD COLUMN "complaint_source" varchar(120) NOT NULL DEFAULT \'\';',
            ],
            state_operations=[],
        ),
    ]
