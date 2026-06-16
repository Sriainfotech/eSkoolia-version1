# Complaints Module - Quick Testing Guide

## Prerequisites
1. Backend server running: `python manage.py runserver`
2. Frontend dev server running: `npm run dev`
3. Database migrations applied: `python manage.py migrate admissions`
4. Complaint Type and Complaint Source master data created via Django admin

## Quick API Tests (Postman/cURL)

### 1. Get Complaint Types
```
GET /api/v1/admissions/complaint-types/
Authorization: Bearer {token}
```
Expected: 200 OK, list of complaint types

### 2. Get Complaint Sources  
```
GET /api/v1/admissions/complaint-sources/
Authorization: Bearer {token}
```
Expected: 200 OK, list of complaint sources

### 3. Get Staff Lookup
```
GET /api/v1/admissions/staff-lookup/
Authorization: Bearer {token}
```
Expected: 200 OK, list of active staff members

### 4. Create Complaint (Valid)
```
POST /api/v1/admissions/complaints/
Authorization: Bearer {token}
Content-Type: multipart/form-data

complaint_by: John Smith
complaint_type: 1  (ID of complaint type)
complaint_source: 2  (ID of complaint source)
phone: 9876543210
date: 2024-06-15
action_taken: Called parent
assigned_to: 3  (User ID - optional)
description: Student was absent for 3 days without notice
```
Expected: 201 Created

### 5. Create Complaint (Invalid - Missing Required)
```
POST /api/v1/admissions/complaints/
Authorization: Bearer {token}

complaint_by: John Smith
(complaint_type and complaint_source missing)
```
Expected: 400 Bad Request
Response: `{ success: false, field_errors: { complaint_type: "...", complaint_source: "..." } }`

### 6. List with Filtering
```
GET /api/v1/admissions/complaints/?search=john&complaint_type=1&date=2024-06-15
Authorization: Bearer {token}
```
Expected: 200 OK, filtered results

### 7. Update Complaint
```
PATCH /api/v1/admissions/complaints/1/
Authorization: Bearer {token}

complaint_by: Jane Smith  (updated)
```
Expected: 200 OK

### 8. Delete Complaint
```
DELETE /api/v1/admissions/complaints/1/
Authorization: Bearer {token}
```
Expected: 204 No Content

## Frontend UI Tests

### Test 1: Create with Valid Data
1. Navigate to Complaints tab
2. Fill all required fields:
   - Complaint By: "John Smith"
   - Complaint Type: Select from dropdown
   - Complaint Source: Select from dropdown
   - Date: Select today
3. Click "Add Complaint"
4. Expected: Success toast, form resets, list updates

### Test 2: Missing Required Fields
1. Leave "Complaint By" empty
2. Leave "Complaint Type" unselected
3. Click "Add Complaint"
4. Expected: 
   - Form banner shows: "Please fix the errors below before submitting."
   - Red borders around empty fields
   - Error messages below each field
   - Page scrolls to first error field (Complaint By)

### Test 3: Invalid Phone Format
1. Fill all required fields
2. Enter "123" in Phone field
3. Click "Add Complaint"
4. Expected:
   - Error below phone: "Phone must be at least 10 digits."
   - Red border on phone field

### Test 4: Future Date
1. Fill all required fields
2. Try to select tomorrow's date
3. Expected: Date input disabled (max=today)

### Test 5: Short Description
1. Fill all required fields
2. Enter "too short" in Description
3. Click "Add Complaint"
4. Expected: Error below description: "Description must be at least 10 characters."

### Test 6: Large File Upload
1. Try to upload file > 5MB
2. Expected: Error: "File size exceeds 5MB limit."

### Test 7: Invalid File Type
1. Try to upload .txt or .exe file
2. Expected: Error: "Invalid file type. Allowed: PDF, DOC, DOCX, JPG, JPEG, PNG."

### Test 8: Edit Complaint
1. Click "Edit" on any row
2. Form fills with existing data
3. Modify a field
4. Click "Update Complaint"
5. Expected: Success toast, list updates

### Test 9: Delete Complaint
1. Click "Delete" on any row
2. "Confirm" button appears
3. Click "Confirm"
4. Expected: Success toast, record removed from list

### Test 10: Search Filtering
1. Click Filters tab
2. Enter search term (e.g., "john")
3. Click "Apply Filters"
4. Expected: 
   - Filter chip appears: "Search: john"
   - List shows only matching records
   - Backend API called with ?search=john param

### Test 11: Type Filtering
1. Click Filters tab
2. Select a Complaint Type
3. Click "Apply Filters"
4. Expected:
   - Filter chip appears
   - List filtered by type
   - Backend API called with ?complaint_type=ID param

### Test 12: Date Filtering
1. Click Filters tab
2. Select a date
3. Click "Apply Filters"
4. Expected:
   - Filter chip appears
   - List shows only records for that date
   - Backend API called with ?date=YYYY-MM-DD param

### Test 13: Multiple Filters
1. Enter search term
2. Select type and source
3. Select date
4. Click "Apply Filters"
5. Expected: All 4 filters combined, single API call with all query params

### Test 14: Clear Filters
1. Apply some filters
2. Click "Clear"
3. Expected:
   - All filter fields cleared
   - All chips removed
   - Full list displayed again

### Test 15: Sorting
1. Click "Date" column header
2. Expected: Arrow appears, data sorted ascending
3. Click again: Arrow points down, data sorted descending
4. Client-side sort only (no API call needed)

### Test 16: Pagination
1. Ensure > 10 records exist
2. Table shows "Page 1 of X"
3. Click "Next"
4. Expected: Shows records 11-20
5. Click "Prev": Back to records 1-10

### Test 17: Error Handling
1. Stop backend server
2. Try to create complaint
3. Expected: Error message displayed, no success toast

### Test 18: Field Character Limits
1. Complaint By: Try to enter > 100 chars
2. Expected: Input truncates at 100 chars
3. Action Taken: Try to enter > 500 chars
4. Expected: Textarea truncates at 500 chars
5. Description: Try to enter > 1000 chars
6. Expected: Textarea truncates at 1000 chars

---

## Database Validation

### Check Models Created
```sql
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('complaint_types', 'complaint_sources');
```
Expected: Both tables exist

### Check Constraints
```sql
SELECT constraint_name FROM information_schema.table_constraints 
WHERE table_name = 'complaint_types' AND constraint_type = 'UNIQUE';
```
Expected: `unique_complaint_type_per_school` exists

### Check ForeignKeys
```sql
SELECT constraint_name FROM information_schema.table_constraints 
WHERE table_name = 'complaint_entries' AND constraint_type = 'FOREIGN KEY';
```
Expected: FK to complaint_types, complaint_sources, users_user

---

## Performance Checks

- [ ] List API with 1000 records loads < 2 seconds (pagination + filtering)
- [ ] Search performance acceptable (uses indexed name field)
- [ ] select_related() used for FK fields (no N+1 queries)
- [ ] File upload doesn't timeout (< 30 seconds for 5MB file)

---

## Edge Cases

1. **Duplicate Detection**: Try creating two identical complaints
   - Expected: 400 error with message about duplicate
   
2. **Staff Member Inactive**: Assign to inactive staff member
   - Expected: 400 error or staff lookup filters out inactive users
   
3. **Complaint Type Deleted**: Try to access complaint with deleted type
   - Expected: Type not displayed but record still exists
   - Note: on_delete=PROTECT prevents deletion if records exist
   
4. **Multi-school Isolation**: Create complaint in School A
   - Expected: Not visible to users in School B
   - Check via user.school_id filtering in ViewSet
   
5. **Very Long Text**: Paste long meaningful text (500+ chars)
   - Expected: Validates as meaningful, doesn't reject based on length alone
   - Only checks character limits, not count of repetitive chars

---

## API Response Examples

### Success Response (Create)
```json
{
  "success": true,
  "message": "Complaint created successfully",
  "data": {
    "id": 123,
    "complaint_by": "John Smith",
    "complaint_type": 1,
    "complaint_type_name": "Academic Issue",
    "complaint_source": 2,
    "complaint_source_name": "Parent",
    "phone": "9876543210",
    "date": "2024-06-15",
    "action_taken": "Called parent",
    "assigned_to": 5,
    "assigned_to_name": "Jane Doe",
    "description": "Student was absent...",
    "file_url": "http://...",
    "created_by_name": "Admin User",
    "created_at": "2024-06-16T10:30:00Z",
    "updated_at": "2024-06-16T10:30:00Z"
  }
}
```

### Validation Error Response
```json
{
  "success": false,
  "message": "Validation errors",
  "field_errors": {
    "complaint_by": "Complaint By is required.",
    "complaint_type": "Please select a complaint type.",
    "description": "Description must be at least 10 characters."
  }
}
```

### List Response with Filtering
```json
{
  "results": [
    {
      "id": 123,
      "complaint_by": "John Smith",
      "complaint_type": 1,
      "complaint_type_name": "Academic Issue",
      ...
    }
  ],
  "count": 42,
  "next": "http://.../complaints/?page=2",
  "previous": null
}
```

---

## Browser Console Checks

1. Open DevTools Console (F12)
2. No error messages should appear
3. Network tab: All API calls show 200/201/204 status
4. No 404 or 500 errors
5. Form submission should show successful POST/PATCH requests

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| 401 Unauthorized | Check token is valid and not expired |
| 403 Permission Denied | Check user has admin_section.complaint.view permission |
| 404 Endpoint not found | Check migrations ran and URLs registered |
| "No complaints found" on fresh install | Populate master data (Complaint Types & Sources) |
| Slow list loading | Check database has proper indexes on school_id |
| File upload fails | Check media directory permissions and 5MB limit |
| Filter not working | Check query params in browser Network tab |
| Dropdown empty | Check master data exists and is_active=True |

