import os, django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.local')
django.setup()

from django.apps import apps
from django.contrib.auth import get_user_model
User = get_user_model()
try:
    user = User.objects.get(id=930)
except User.DoesNotExist:
    print("User not found")
    exit()

print("--- User details ---")
print(user.first_name, user.last_name)
print("Groups:", [g.name for g in user.groups.all()])

print("--- Inspecting Related Objects for user ---")
for rel in user._meta.related_objects:
    print(f"Related: {rel.get_accessor_name()} (model: {rel.related_model.__name__})")

print("--- Searching for Teacher profile ---")
teacher = None
for model in apps.get_models():
    if model.__name__ in ['Teacher', 'Staff', 'Employee']:
        try:
            # Maybe the user field is called `user`
            if hasattr(model, 'user'):
                t = model.objects.filter(user=user).first()
                if t:
                    teacher = t
                    print(f"Found Teacher profile in {model.__name__}: {teacher.id}")
                    break
        except Exception:
            pass

if not teacher:
    # Maybe the model is the User itself? Let's check groups.
    print("Could not find a separate Teacher/Staff profile via standard fields. They might be a User.")
    teacher = user # Fallback

print("--- Inspecting Teacher Related Objects ---")
for rel in teacher._meta.related_objects:
    print(f"Teacher Related: {rel.get_accessor_name()} (model: {rel.related_model.__name__})")
        
print("--- Searching for assigned classes (Class Teacher) ---")
try:
    # A common pattern is Class or Section has a class_teacher ForeignKey
    Class = apps.get_model('academics', 'Class')
    Section = apps.get_model('academics', 'Section')
    
    # Let's try to query Sections or Classes where teacher is the class teacher
    sections = Section.objects.filter(class_teacher=teacher)
    for s in sections:
        print(f"Class Teacher for Section: {s.class_id.name} - {s.name}")
except Exception as e:
    print(f"Error checking direct Section.class_teacher: {e}")
    try:
        # Check if field name is different
        for f in apps.get_model('academics', 'Section')._meta.get_fields():
            if f.is_relation and f.related_model and f.related_model.__name__ in ['User', 'Teacher', 'Staff']:
                sections = apps.get_model('academics', 'Section').objects.filter(**{f.name: teacher})
                for s in sections:
                    print(f"Class Teacher for Section (via {f.name}): {s.class_id.name if hasattr(s, 'class_id') else s} - {s.name}")
    except Exception:
        pass

print("--- Searching for subjects taught ---")
try:
    SubjectTeacher = apps.get_model('academics', 'SubjectTeacher')
    allocations = SubjectTeacher.objects.filter(teacher=teacher)
    for alloc in allocations:
        print(f"Teaches Subject: {alloc.subject.name} in Section: {alloc.section.class_id.name} - {alloc.section.name}")
except Exception as e:
    print(f"Error checking SubjectTeacher: {e}")
    # Let's search all models that relate to teacher and subject
    for model in apps.get_models():
        has_teacher = False
        has_subject = False
        teacher_field = None
        for f in model._meta.get_fields():
            if f.is_relation and f.related_model:
                if f.related_model.__name__ in ['User', 'Teacher', 'Staff']:
                    has_teacher = True
                    teacher_field = f.name
                if f.related_model.__name__ in ['Subject']:
                    has_subject = True
        
        if has_teacher and has_subject:
            print(f"Found mapping model: {model.__name__}")
            try:
                allocations = model.objects.filter(**{teacher_field: teacher})
                for alloc in allocations:
                    # try to stringify
                    print(f"Allocation in {model.__name__}: {alloc}")
            except Exception:
                pass
