# Complete Testing Guide - Student Creation + Document Upload

## What's Ready Now ✅

### Backend
- ✅ StudentDocument model with FileField (nullable)
- ✅ Migration 0015 applied (database schema updated)
- ✅ Media folder created at `backend/media/`
- ✅ API endpoint: POST `/api/students/documents/upload_document/`
- ✅ File upload handlers with validation (5MB limit, PDF/JPG/PNG only)

### Frontend
- ✅ StudentAddPanel component updated
- ✅ New state: `newlyCreatedStudentId` to store ID after creation
- ✅ Upload handlers use either URL param ID or newly created ID
- ✅ Documents section stays visible after student creation (no redirect)
- ✅ Success UI with green cards, checkmarks, filenames
- ✅ Detailed console logging for debugging

---

## Step-by-Step Testing

### Prerequisites
1. **Django server running** on port 8000
   ```bash
   cd backend
   daphne -b 0.0.0.0 -p 8000 config.asgi:application
   ```

2. **Frontend server running** on port 3000
   ```bash
   cd frontend
   npm run dev
   ```

3. **Logged in** as admin or staff user with permission to create students

---

## Test Scenario: Create Student + Upload Documents

### Phase 1: Create New Student

**1. Open Student Enrollment Page**
- Navigate to: `http://localhost:3000/students/add`
- Left sidebar shows all sections: Identity, Academic, Contact & Address, Guardians, Documents, Review
- Top right shows "Draft not saved yet"

**2. Fill Identity Section** (Required)
```
- First name: Triveni (or any name)
- Last name: CH
- Date of birth: 09-02-2016
- Gender: Female
- Mother tongue: Marathi
- Religion: Prefer not to say
- Nationality: Indian
- Admission number: (auto-generated - e.g., ADM20266620)
- Status: Active
```

**3. Fill Academic Section** (Required)
```
- Academic year: 2026-2027
- Class: 5
- Section: B
```

**4. Fill Contact & Address** (Optional but recommended)
```
- Phone: Any 10 digits
- Email: test@example.com
- Address: Any address
- City: Any city
```

**5. Fill Guardians** (Optional)
- Click "Add Guardian" or skip

**6. Review** (Optional)
- Scroll through to verify

**7. Click "Enroll Student" Button**
- Located at bottom of form
- Button shows loading state
- Look for: **Green success message at top** 
  - "Student added successfully."

---

### Phase 2: Upload Documents (NEW WORKFLOW!)

**Key Point**: Page should **NOT redirect**. You stay on the same page.

**8. Verify Success Message**
- Check top of page for green notification
- Should say: "Student added successfully."
- Student record is now saved in database

**9. Scroll Down to "Know your student" Section**
- Find section labeled: "Know your student"
- Should show section counter: "05 / 06"
- Should see 3 document cards in a 2-column grid:
  1. **Birth certificate** (REQUIRED badge - red)
  2. **Aadhaar card** (MASKED badge - amber)
  3. **Medical information** (OPTIONAL badge - gray)

**10. Upload Birth Certificate**
- Click "↑ Upload file" button on Birth Certificate card
- File picker opens
- Select a PDF file (or JPG/PNG)
- File should be **less than 5MB**

**Expected Result After Selection:**
- Button shows: "⏳ Uploading..."
- Card remains white (for a moment)
- Verify browser console for logs:
  ```
  🔄 Starting document upload: {...}
  ✅ Upload response received: {...}
  ✅ Upload successful - updating UI state
  ```

**11. Verify Success State**
- ✅ Card background turns **GREEN** (#D1FAE5)
- ✅ Icon changes to **checkmark** (✓)
- ✅ Shows "✓ Uploaded"
- ✅ Shows filename (e.g., "Birth_Certificate.pdf")
- ✅ Button changes to "↻ Replace"

**12. Upload Aadhaar Card**
- Repeat same process for Aadhaar card
- Same green success state expected

**13. Upload Medical Information**
- Repeat same process for Medical information
- Same green success state expected

---

## Troubleshooting

### Issue: After clicking "Enroll Student", page shows error

**Check:**
1. Identity section is filled (all * fields required)
2. Academic section is filled (Class and Section)
3. Browser console for errors (F12 → Console)

**Fix:**
- Fill missing required fields (red error text will appear)
- Click "Enroll Student" again

### Issue: Documents section not visible after enrollment

**Check:**
1. Did you see the success message at top?
2. Is Django server still running?
3. Check browser console for JavaScript errors

**Fix:**
- Refresh page: `Ctrl+R` or `Cmd+R`
- Documents section should load
- Should show the 3 document cards

### Issue: File picker opens but nothing happens after selection

**Check:**
1. Is Django server running? (check terminal)
2. Is media folder present? (`backend/media/` should exist)
3. File is correct format (PDF/JPG/PNG)?
4. File is less than 5MB?

**Solution:**
```bash
# Verify media folder exists
cd backend
dir media

# If missing, create it:
mkdir media

# Restart Django
daphne -b 0.0.0.0 -p 8000 config.asgi:application
```

### Issue: Upload button shows loading but never completes

**Check Browser Console (F12 → Console):**
- Should see: `🔄 Starting document upload: ...`
- Then: `✅ Upload response received: ...`
- Or error: `❌ Upload error details: ...`

**If you see error:**
- Check the error message
- Common errors:
  - "File size must be less than 5MB" → Select smaller file
  - "Only PDF, JPG, JPEG, PNG" → Wrong file type
  - "You must save student first" → Shouldn't happen after successful enrollment

### Issue: Card shows "✓ Uploaded" but file not actually saved

**Check Django Logs:**
- Look for errors in Django terminal
- Verify `backend/media/` folder has subdirectories:
  - Should have: `student_documents/2026/04/` (with year/month)
  - Files should be stored there

**Check Database:**
```bash
cd backend
python manage.py shell
```
```python
from students.models import StudentDocument
# Should show uploaded documents
StudentDocument.objects.all().count()
```

---

## Console Logging Guide

**When uploading, you should see these logs:**

```
🔄 Starting document upload: {
  studentId: 123,
  documentType: "birth_certificate",
  fileName: "Birth_Certificate.pdf",
  fileSize: 102400,
  isNewStudent: true,
  endpoint: "/api/students/documents/upload_document/"
}

✅ Upload response received: {
  id: 456,
  student: 123,
  file: "/media/student_documents/2026/04/Birth_Certificate.pdf",
  original_name: "Birth_Certificate.pdf",
  ...
}

✅ Upload successful - updating UI state
```

**If you see errors, they will show:**
```
❌ Upload error details: {
  error: Error object,
  message: "Specific error message",
  stack: "Full stack trace"
}
```

---

## Success Criteria Checklist

- [ ] Open `/students/add` page
- [ ] Fill Identity section with name, DOB, class
- [ ] Fill Academic section with year, class, section
- [ ] Click "Enroll Student" button
- [ ] See green success message: "Student added successfully"
- [ ] Page does NOT redirect away
- [ ] Scroll down to see "Know your student" section
- [ ] See 3 document cards (Birth, Aadhaar, Medical)
- [ ] Click "Upload file" on Birth Certificate
- [ ] Select a PDF/JPG/PNG file (< 5MB)
- [ ] Card background turns GREEN
- [ ] Icon becomes checkmark ✓
- [ ] Shows "✓ Uploaded" text
- [ ] Shows filename
- [ ] Button changes to "↻ Replace"
- [ ] Browser console shows 🔄 and ✅ logs
- [ ] No red ❌ error logs
- [ ] Repeat for Aadhaar and Medical cards
- [ ] All 3 cards show green success state

---

## File Storage Location

After successful upload, files are stored at:
```
backend/media/student_documents/2026/04/filename.pdf
```

Example paths:
```
backend/media/student_documents/2026/04/Birth_Certificate.pdf
backend/media/student_documents/2026/04/Aadhaar_1234.pdf
backend/media/student_documents/2026/04/Medical_Report.pdf
```

---

## Next Steps After Testing

1. ✅ Test complete flow end-to-end (create + upload)
2. ✅ Verify all 3 document types upload successfully
3. ✅ Test "Replace" functionality (upload different file)
4. ✅ Check Django logs for any warnings
5. ✅ Verify database entries created (StudentDocument records)

Then you can:
- Add validation for existing documents
- Add admin UI to view uploaded documents
- Add file download functionality
- Set up document verification workflow
