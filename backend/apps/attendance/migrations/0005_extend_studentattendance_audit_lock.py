# Generated migration to add audit and lock fields to StudentAttendance

from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('attendance', '0004_subjectattendance'),
    ]

    operations = [
        migrations.AlterField(
            model_name='studentattendance',
            name='notes',
            field=models.TextField(blank=True, default='', max_length=250),
        ),
        migrations.AddField(
            model_name='studentattendance',
            name='is_locked',
            field=models.BooleanField(default=False, help_text='Prevents editing of locked attendance'),
        ),
        migrations.AddField(
            model_name='studentattendance',
            name='marked_by',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='attendances_marked', to=settings.AUTH_USER_MODEL),
        ),
        migrations.AddField(
            model_name='studentattendance',
            name='updated_by',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='attendances_updated', to=settings.AUTH_USER_MODEL),
        ),
        migrations.RemoveField(
            model_name='studentattendance',
            name='created_at',
        ),
        migrations.AddField(
            model_name='studentattendance',
            name='marked_at',
            field=models.DateTimeField(auto_now_add=True, null=True),
        ),
        migrations.AlterField(
            model_name='studentattendance',
            name='updated_at',
            field=models.DateTimeField(auto_now=True),
        ),
        migrations.AlterModelOptions(
            name='studentattendance',
            options={'ordering': ['-attendance_date', 'student_id']},
        ),
        migrations.AddIndex(
            model_name='studentattendance',
            index=models.Index(fields=['student_id'], name='attendance_s_student_idx'),
        ),
        migrations.AddIndex(
            model_name='studentattendance',
            index=models.Index(fields=['class_id'], name='attendance_s_class_id_idx'),
        ),
        migrations.AddIndex(
            model_name='studentattendance',
            index=models.Index(fields=['section_id'], name='attendance_s_section_idx'),
        ),
        migrations.AddIndex(
            model_name='studentattendance',
            index=models.Index(fields=['attendance_date'], name='attendance_s_attendan_idx'),
        ),
    ]
