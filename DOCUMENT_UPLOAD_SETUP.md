# Student Document Upload - Setup Guide

## Overview
This guide walks through the complete setup needed to enable student document uploads in the Student Enrollment form.

## Backend Setup

### 1. Run Django Migrations
The StudentDocument model has been updated. Apply the migrations:

```bash
cd backend
python manage.py makemigrations students
python manage.py migrate students
```

### 2. Create Media Folder
Ensure the media folder exists for storing uploaded files:

```bash
# Windows PowerShell
mkdir -p media

# Or manually create the folder in:
# backend/media
```

### 3. Update Django Settings
✅ Already configured in `backend/config/settings/base.py`:
- `MEDIA_URL = "/media/"`
- `MEDIA_ROOT = BASE_DIR / "media"`

### 4. Verify Django URLs
✅ Already configured in `backend/config/urls.py`:
- Media files are served at `/media/` in development

### 5. Restart Django Server
```bash
# Stop current server (Ctrl+C)
# Then restart:
cd backend
daphne -b 0.0.0.0 -p 8000 config.asgi:application
```

## Frontend Setup

### 1. Student Must Be Saved First
⚠️ **IMPORTANT**: Document uploads only work for saved students. Users must:
1. Fill in the Identity section (name, DOB, class, section, etc.)
2. Click "Save draft" or "Enroll student"
3. Then navigate to Documents section
4. Uploads will work only after student is saved in database

### 2. Expected Workflow
```
1. User fills Identity → Click "Save draft" → Student gets ID
2. User navigates to Documents section
3. User clicks "Upload file" on any document card
4. Browser file picker opens
5. User selects PDF/JPG/PNG file (max 5MB)
6. Upload starts → "⏳ Uploading..." button
7. On success:
   - Card background turns green (#D1FAE5)
   - Icon changes to green checkmark (✓)
   - Shows "✓ Uploaded"
   - Shows filename
   - Button changes to "↻ Replace"
8. User can replace/re-upload by clicking button again
```

## Troubleshooting

### Error: "Student not found. Please save..."
**Cause**: Student record doesn't exist in database yet
**Solution**: Save the student record first (complete Identity section)

### Error: "File size must be less than 5MB"
**Cause**: Selected file is too large
**Solution**: Compress the file or choose a smaller one

### Error: "Only PDF, JPG, JPEG, PNG files allowed"
**Cause**: Wrong file type selected
**Solution**: Use supported formats only

### Upload button shows loading but nothing happens
**Cause**: Django server not running or media folder missing
**Solution**: 
1. Check Django server is running
2. Verify media folder exists: `backend/media`
3. Check browser console (F12) for error details

### "Server unreachable" error
**Cause**: API endpoint not responding
**Solution**:
1. Verify Django server is running on port 8000
2. Check if `/api/students/documents/upload_document/` endpoint exists
3. Ensure authentication token is valid

## API Endpoint

**URL**: `POST /api/students/documents/upload_document/`

**Required Fields**:
- `student_id` (integer or UUID): Student database ID
- `document_type` (string): birth_certificate, aadhaar_card, medical_information
- `file` (file): PDF/JPG/PNG, max 5MB

**Example Request**:
```javascript
const formData = new FormData();
formData.append("student_id", "123");
formData.append("document_type", "birth_certificate");
formData.append("file", fileObject);

const response = await fetch("/api/students/documents/upload_document/", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${token}`,
  },
  body: formData,
});
```

**Success Response** (201):
```json
{
  "id": 1,
  "student": 123,
  "school": 1,
  "document_type": "birth_certificate",
  "file": "/media/student_documents/2024/01/Birth_Certificate.pdf",
  "file_url": "http://localhost:8000/media/student_documents/2024/01/Birth_Certificate.pdf",
  "original_name": "Birth_Certificate.pdf",
  "file_size": 102400,
  "uploaded_by": "admin@example.com",
  "uploaded_at": "2024-01-15T10:30:00Z"
}
```

**Error Response**:
```json
{
  "error": "Only PDF, JPG, JPEG, and PNG files are allowed."
}
```

## Database Schema

### StudentDocument Model
```python
- id: Primary Key
- student: ForeignKey to Student
- school: ForeignKey to School
- document_type: CharField (birth_certificate, aadhaar_card, medical_information, etc.)
- file: FileField (uploaded to media/student_documents/%Y/%m/)
- original_name: CharField (original filename)
- file_size: PositiveBigIntegerField (in bytes)
- uploaded_by: ForeignKey to User
- is_verified: BooleanField (default False)
- remarks: TextField (for admin notes)
- uploaded_at: DateTimeField (auto_now_add)
- updated_at: DateTimeField (auto_now)
```

## Security Features

✅ **Authentication Required**: JWT token required
✅ **Authorization**: Users can only upload for their school
✅ **File Type Validation**: Only PDF, JPG, PNG allowed
✅ **File Size Limit**: 5MB maximum
✅ **Filename Sanitization**: Automatic handling
✅ **Secure Storage**: Files stored outside public web root
✅ **School Isolation**: Documents scoped to school

## Next Steps

1. ✅ Backend setup complete
2. ✅ Frontend UI implemented
3. ⏳ **Test the upload flow**:
   - Create a new student → Fill Identity → Save
   - Navigate to Documents
   - Upload a test PDF
   - Verify success state appears
4. ⏳ **Test error scenarios**:
   - Try uploading wrong file type
   - Try file larger than 5MB
   - Check browser console (F12) for debug logs

## Development Notes

### Console Logging
Upload handler includes detailed console logs for debugging:
```javascript
🔄 Starting document upload: {...}
✅ Upload response received: {...}
❌ Upload error details: {...}
```

Check browser console (F12 → Console tab) to see these logs during testing.

### File Storage Path
Uploaded files are stored at:
```
backend/media/student_documents/YYYY/MM/filename.ext
```

Example:
```
backend/media/student_documents/2024/01/Birth_Certificate.pdf
```

### Accessing Uploaded Files
Files are accessible via:
```
http://localhost:8000/media/student_documents/2024/01/Birth_Certificate.pdf
```

In production, configure a proper media server (nginx, S3, etc.).
