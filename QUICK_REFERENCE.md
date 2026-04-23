# Quick Reference Card - Student Upload Feature

## What Changed

✅ Student creation now captures ID in state  
✅ Page doesn't redirect after save  
✅ Documents can be uploaded immediately after creation  

## How to Test (5 minutes)

### Start Servers
```bash
# Terminal 1
cd d:\eskoolia\New folder\Eskoolia-conversion-\backend
daphne -b 0.0.0.0 -p 8000 config.asgi:application

# Terminal 2  
cd d:\eskoolia\New folder\Eskoolia-conversion-\frontend
npm run dev
```

### Test Workflow
1. **Open**: `http://localhost:3000/students/add`
2. **Fill**:
   - First name: Triveni
   - Last name: CH
   - DOB: 09-02-2016
   - Class: 5
   - Section: B
   - Academic Year: 2026-2027
3. **Click**: "Enroll Student"
4. **Wait for**: Green success message at top
5. **Scroll down** to "Know your student" section
6. **Click**: "↑ Upload file" on Birth Certificate
7. **Select**: Any PDF/JPG/PNG file (< 5MB)
8. **Watch**: Card should turn GREEN with checkmark ✅

### Expected Success Signs

After file upload:
- ✅ Card background is GREEN (#D1FAE5)
- ✅ Icon shows checkmark (✓)
- ✅ Text shows "✓ Uploaded"
- ✅ Filename displayed below
- ✅ Button text changed to "↻ Replace"

### Debug Console (F12 → Console)

**Look for**:
```
🔄 Starting document upload: {...}
✅ Upload response received: {...}
✅ Upload successful - updating UI state
```

**If errors**:
```
❌ Upload error details: {...}
```

## If It Doesn't Work

### File picker opens but nothing happens
- Django server not running? (Terminal 1 output check)
- Is `backend/media/` folder there? (`ls backend/media`)
- Restart Django

### "Student not found" error
- Rare - means new student ID didn't get captured
- Check browser console for exact error
- Try reloading the page

### Documents section not visible
- Refresh page (Ctrl+R)
- Or scroll down more

### File upload never completes
- Check file size (must be < 5MB)
- Check file type (must be PDF/JPG/PNG)
- Check Django logs for errors

## File Locations

| Component | File |
|-----------|------|
| Frontend Logic | `frontend/components/students/StudentAddPanel.tsx` |
| Backend Model | `backend/apps/students/models.py` |
| Upload API | `backend/apps/students/views.py` (upload_document action) |
| Uploads Saved | `backend/media/student_documents/2026/04/` |
| Migration | `backend/apps/students/migrations/0015_...py` |

## Key Code Changes

### Frontend: Capture New ID
```typescript
const [newlyCreatedStudentId, setNewlyCreatedStudentId] = useState<number | null>(null);

// After student creation:
if (response?.id) {
  setNewlyCreatedStudentId(response.id);
}
```

### Frontend: Use ID for Upload
```typescript
const effectiveStudentId = studentId || newlyCreatedStudentId;
if (!effectiveStudentId) {
  showToast("Save student first", "error");
  return;
}
```

### Backend: Accept Both ID Types
```python
try:
  student = Student.objects.get(student_id=student_id_input)  # UUID
except Student.DoesNotExist:
  student = Student.objects.get(id=int(student_id_input))  # Numeric ID
```

## Checklist Before Testing

- [ ] Django running on port 8000
- [ ] Frontend running on port 3000
- [ ] Logged in as admin/staff
- [ ] `backend/media/` folder exists
- [ ] Migrations applied (migration 0015)
- [ ] No TypeScript errors
- [ ] Browser dev tools open (F12)

## Success = All Green ✅

✅ Student created  
✅ Page didn't redirect  
✅ Document cards visible  
✅ File picked and uploaded  
✅ Card turned green  
✅ Checkmark and filename shown  
✅ Console logs show success  

**If all above are ✅, then feature is working!**

---

**Next Step**: Open browser console (F12) and begin testing following the workflow above.
