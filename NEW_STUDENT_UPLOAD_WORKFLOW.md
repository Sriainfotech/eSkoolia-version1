# NEW Workflow - Create Student + Upload Documents in One Go

## What Changed

The system now supports creating a student AND uploading documents on the same page without requiring a page redirect.

### Before (Old Workflow)
1. Fill student details → Click "Enroll student"
2. Student saved → Redirected to student list
3. Click "Edit" → Only then can you upload documents
4. ❌ Time-consuming, requires multiple steps

### After (New Workflow)
1. Fill student details → Click "Enroll student"  
2. Student saved → **Stay on page** with Document section active
3. Upload documents immediately  
4. ✅ Complete enrollment in one session

## How It Works Now

### Step-by-Step

**Step 1: Fill Identity Section**
- Name, DOB, Class, Section, Gender, etc.
- All required fields marked with *

**Step 2: Fill Remaining Sections** (Optional)
- Academic placement
- Contact & Address
- Guardians
- Review everything

**Step 3: Click "Enroll Student" Button**
- System validates and saves to database
- ✅ Student record created with new ID
- 🟢 Success message shows at top
- ✅ Page stays open - doesn't redirect

**Step 4: Scroll Down to "Know your student"**
- Document upload cards now visible
- Cards show: Birth Certificate, Aadhaar, Medical

**Step 5: Upload Documents**
- Click "Upload file" on any card
- Select PDF/JPG/PNG (max 5MB)
- Watch for green success state:
  - Card background turns green
  - Icon becomes checkmark ✓
  - Shows filename
  - Button changes to "Replace"

**Step 6: (Optional) Click "Next" or Navigate**
- After documents uploaded, can click navigation button
- Or continue with other tasks

## Key Features

✅ **No page reload** - Documents section becomes active after save
✅ **Automatic student ID capture** - ID stored in state, not URL
✅ **One session** - Create student + upload docs in single workflow
✅ **Clear feedback** - Toast notifications + visual state changes
✅ **Error handling** - If upload fails, card stays white, can retry

## Technical Implementation

### Frontend Changes
```javascript
// New state to track newly created student
const [newlyCreatedStudentId, setNewlyCreatedStudentId] = useState<number | null>(null);

// After student creation, capture the ID
const response = await apiPostJson("/api/v1/students/students/", payload);
if (response?.id) {
  setNewlyCreatedStudentId(response.id);  // ← Store ID for uploads
}

// Use either URL param ID (edit mode) or newly created ID
const effectiveStudentId = studentId || newlyCreatedStudentId;
```

### API Endpoint
```
POST /api/students/documents/upload_document/

Request:
- student_id: 123 (numeric ID, auto-captured)
- document_type: "birth_certificate"
- file: <binary PDF/JPG>

Response on Success:
{
  "id": 456,
  "file": "/media/student_documents/2026/04/filename.pdf",
  "original_name": "filename.pdf",
  ...
}
```

## Troubleshooting

### Documents Section Not Visible After Saving
**Possible causes:**
1. ❌ Page redirected away
2. ❌ Browser auto-refresh
3. ❌ Student save failed

**Solution:**
- Check that success message appeared
- Open browser console (F12) for errors
- Try saving again

### Upload Shows Loading But Doesn't Complete
**Possible causes:**
1. ❌ Django server not running
2. ❌ Media folder missing
3. ❌ Migrations not applied

**Solution:**
```bash
# Make sure these are done:
cd backend
python manage.py migrate students    # Apply migrations
mkdir -p media                        # Create media folder
daphne -b 0.0.0.0 -p 8000 config.asgi:application  # Start server
```

### "Student not found" Error During Upload
**Possible cause:**
- Student ID not passed correctly

**Solution:**
- Check browser console (F12 → Console)
- Look for `🔄 Starting document upload` log
- Verify `studentId` is a number, not null

## Testing Checklist

- [ ] Fill student form with all required fields
- [ ] Click "Enroll student" button
- [ ] Verify success message appears
- [ ] Scroll to Documents section
- [ ] See document upload cards
- [ ] Click "Upload file" on Birth Certificate
- [ ] Select a PDF file
- [ ] Verify card turns green after upload
- [ ] See checkmark, filename, "Uploaded" text
- [ ] Button now shows "Replace"
- [ ] Click Replace to upload different file

## File Location

This logic is implemented in:
- **Component:** `frontend/components/students/StudentAddPanel.tsx`
- **Backend API:** `backend/apps/students/views.py` (upload_document action)
- **Backend Model:** `backend/apps/students/models.py` (StudentDocument)

## Success Criteria

✅ User creates new student
✅ System returns student ID
✅ ID stored in state (newlyCreatedStudentId)
✅ Documents section remains visible
✅ User can upload documents without page reload
✅ Upload succeeds → Card turns green
✅ Filename and checkmark displayed
✅ No console errors
