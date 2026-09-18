with open('backend/apps/teacher_portal/views.py', 'r', encoding='utf-8') as f:
    code = f.read()

code = code.replace(
    "parts_data: dict = row.get('parts', {})",
    "parts_data: dict = row.get('marks', {})"
)

with open('backend/apps/teacher_portal/views.py', 'w', encoding='utf-8') as f:
    f.write(code)
print("Fixed Save View parts to marks")
