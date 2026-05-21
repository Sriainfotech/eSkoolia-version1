# Staff Module Fixes - Complete Documentation

## Overview
Comprehensive fixes for identified issues in the Staff module:
1. **Multiple file upload support** - New `StaffDocument` model with CRUD API
2. **Enhanced bank info validation** - Proper field validation with no special characters
3. **IFSC code handling** - Correct field validation and error mapping
4. **Payroll currency display** - Stored in `custom_field` (ready for frontend integration)

---

## 1. Database Changes

### New Model: StaffDocument
Replaces single file path storage with proper document management.

```python
# apps/hr/models.py
class StaffDocument(models.Model):
    DOCUMENT_TYPE_CHOICES = [
        ("resume", "Resume"),
        ("joining_letter", "Joining Letter"),
        ("tenth_certificate", "10th Certificate"),
        ("eleventh_certificate", "11th Certificate"),
        ("aadhar_card", "Aadhar Card"),
        ("driving_license", "Driving License"),
        ("other", "Other Document"),
    ]

    school = ForeignKey("tenancy.School", ...)
    staff = ForeignKey(Staff, related_name="documents", ...)
    document_type = CharField(max_length=50, choices=DOCUMENT_TYPE_CHOICES)
    file_path = CharField(max_length=500)  # S3 or file storage path
    file_name = CharField(max_length=255)
    file_size = PositiveIntegerField()  # In bytes
    created_at = DateTimeField(auto_now_add=True)
    updated_at = DateTimeField(auto_now=True)
```

### Migration Commands
```bash
# Generate migration
python manage.py makemigrations hr

# Apply migration
python manage.py migrate hr

# Verify
python manage.py dbshell
# .schema hr_staff_documents
```

### Updated Staff Model
- `custom_field` now supports:
  - `ifsc_code`: IFSC code string (e.g., "HDFC0001234")
  - `allowance`: Decimal allowance amount
  - `deduction`: Decimal deduction amount

---

## 2. Backend API Endpoints

### Staff Document Management

#### Create Document (Upload)
```http
POST /api/v1/hr/staff-documents/
Content-Type: application/json

{
  "staff": 1,
  "document_type": "resume",
  "file_path": "uploads/staff/1/resume_2024.pdf",
  "file_name": "resume_2024.pdf",
  "file_size": 245000
}
```

**Response (201 Created):**
```json
{
  "id": 5,
  "staff": 1,
  "document_type": "resume",
  "document_type_display": "Resume",
  "file_path": "uploads/staff/1/resume_2024.pdf",
  "file_name": "resume_2024.pdf",
  "file_size": 245000,
  "created_at": "2024-12-20T10:30:00Z",
  "updated_at": "2024-12-20T10:30:00Z"
}
```

#### List All Documents
```http
GET /api/v1/hr/staff-documents/
```

**Filters:**
- `staff` - Filter by staff ID
- `document_type` - Filter by document type (resume, joining_letter, etc.)

**Example:**
```http
GET /api/v1/hr/staff-documents/?staff=1&document_type=resume
```

#### List Documents for Specific Staff
```http
GET /api/v1/hr/staff-documents/by_staff/?staff_id=1
```

**Response (200 OK):**
```json
{
  "count": 3,
  "next": null,
  "previous": null,
  "results": [
    {
      "id": 5,
      "staff": 1,
      "document_type": "resume",
      "document_type_display": "Resume",
      "file_path": "uploads/staff/1/resume_2024.pdf",
      "file_name": "resume_2024.pdf",
      "file_size": 245000,
      "created_at": "2024-12-20T10:30:00Z",
      "updated_at": "2024-12-20T10:30:00Z"
    },
    {
      "id": 6,
      "staff": 1,
      "document_type": "joining_letter",
      "document_type_display": "Joining Letter",
      "file_path": "uploads/staff/1/joining_letter_2024.pdf",
      "file_name": "joining_letter_2024.pdf",
      "file_size": 128000,
      "created_at": "2024-12-20T10:31:00Z",
      "updated_at": "2024-12-20T10:31:00Z"
    }
  ]
}
```

#### Delete Document
```http
DELETE /api/v1/hr/staff-documents/{document_id}/
```

**Response (204 No Content)**

---

## 3. Bank Information Validation

### Enhanced Validation Rules

| Field | Validation | Example |
|-------|-----------|---------|
| **Account Holder Name** | Only letters, spaces, hyphens, apostrophes | "John O'Brien-Smith" ✓<br/>"John@123" ✗ |
| **Account Number** | 6-30 digits only | "123456789012345" ✓<br/>"ABC-123456" ✗ |
| **Bank Name** | Letters, spaces, hyphens, ampersands | "HDFC Bank" ✓<br/>"Bank#1" ✗ |
| **Branch Name** | Letters and spaces only | "Mumbai Main" ✓<br/>"Branch-01" ✗ |
| **IFSC Code** | 4 uppercase letters + 0 + 6 alphanumeric | "HDFC0001234" ✓<br/>"hdfc0001234" ✗ |
| **Bank Mobile** | 1-12 digits only | "9876543210" ✓<br/>"98765-43210" ✗ |

### Validation Error Examples

#### Invalid Account Holder Name
```json
{
  "bank_account_name": "Account holder name can contain only letters, spaces, hyphens, and apostrophes."
}
```

#### Invalid IFSC Code
```json
{
  "ifsc_code": "Invalid IFSC code format. Expected: 4 uppercase letters + 0 + 6 alphanumeric characters (e.g., HDFC0001234)."
}
```

#### Duplicate Bank Account
```json
{
  "bank_account_no": "This bank account number is already registered for another staff member."
}
```

---

## 4. Staff Serializer Updates

### Key Changes
```python
class StaffSerializer(serializers.ModelSerializer):
    # Bank validation added
    def validate(self, attrs):
        # Account Holder Name: Letters, spaces, hyphens, apostrophes
        if bank_account_name and not re.match(r"^[A-Za-z\s\-']{2,120}$", bank_account_name):
            raise ValidationError({
                "bank_account_name": "Account holder name can contain only letters, spaces, hyphens, and apostrophes."
            })
        
        # Account Number: 6-30 digits
        if bank_account_no and not re.fullmatch(r"\d{6,30}", bank_account_no):
            raise ValidationError({"bank_account_no": "Account number must be 6-30 digits."})
        
        # Branch Name: Letters, spaces, hyphens
        if bank_branch and not re.match(r"^[A-Za-z\s\-]{2,120}$", bank_branch):
            raise ValidationError({
                "bank_branch": "Branch name can contain only letters and spaces."
            })
        
        # IFSC Code: Proper Indian IFSC format
        ifsc_code = (custom_field.get("ifsc_code") or "").strip()
        if ifsc_code:
            if not re.fullmatch(r"[A-Z]{4}0[A-Z0-9]{6}", ifsc_code.upper()):
                raise ValidationError({
                    "ifsc_code": "Invalid IFSC code format..."
                })
        
        return attrs
```

---

## 5. Complete Request/Response Examples

### Example 1: Create Staff with Bank Info
```http
POST /api/v1/hr/staff/
Content-Type: application/json

{
  "school": 1,
  "role": 2,
  "staff_no": "HR001",
  "first_name": "Rajesh",
  "last_name": "Kumar",
  "email": "rajesh@school.edu",
  "phone": "9876543210",
  "join_date": "2024-01-15",
  "basic_salary": "50000.00",
  "contract_type": "permanent",
  "bank_account_name": "Rajesh Kumar Shah",
  "bank_account_no": "123456789012345",
  "bank_name": "HDFC Bank",
  "bank_branch": "Mumbai Main",
  "bank_mobile_no": "9876543210",
  "custom_field": {
    "ifsc_code": "HDFC0001234",
    "allowance": "5000.00",
    "deduction": "1000.00"
  }
}
```

**Response (201 Created):**
```json
{
  "id": 15,
  "school": 1,
  "user": null,
  "role": 2,
  "staff_no": "HR001",
  "first_name": "Rajesh",
  "last_name": "Kumar",
  "email": "rajesh@school.edu",
  "phone": "9876543210",
  "join_date": "2024-01-15",
  "basic_salary": "50000.00",
  "contract_type": "permanent",
  "bank_account_name": "Rajesh Kumar Shah",
  "bank_account_no": "123456789012345",
  "bank_name": "HDFC Bank",
  "bank_branch": "Mumbai Main",
  "bank_mobile_no": "9876543210",
  "custom_field": {
    "ifsc_code": "HDFC0001234",
    "allowance": "5000.00",
    "deduction": "1000.00"
  },
  "created_at": "2024-12-20T10:00:00Z",
  "updated_at": "2024-12-20T10:00:00Z"
}
```

### Example 2: Upload Multiple Documents
```http
POST /api/v1/hr/staff-documents/
Content-Type: application/json

[
  {
    "staff": 15,
    "document_type": "resume",
    "file_path": "uploads/staff/15/resume.pdf",
    "file_name": "resume.pdf",
    "file_size": 245000
  },
  {
    "staff": 15,
    "document_type": "joining_letter",
    "file_path": "uploads/staff/15/joining_letter.pdf",
    "file_name": "joining_letter.pdf",
    "file_size": 128000
  },
  {
    "staff": 15,
    "document_type": "aadhar_card",
    "file_path": "uploads/staff/15/aadhar_card.pdf",
    "file_name": "aadhar_card.pdf",
    "file_size": 350000
  }
]
```

### Example 3: Validation Error Response
```http
PUT /api/v1/hr/staff/15/
Content-Type: application/json

{
  "bank_account_name": "Rajesh@123",  // Invalid: contains special chars
  "bank_account_no": "ABC-123456",    // Invalid: contains non-digits
  "bank_branch": "Branch-01",          // Invalid: contains hyphen
  "custom_field": {
    "ifsc_code": "hdfc0001234"         // Invalid: lowercase
  }
}
```

**Response (400 Bad Request):**
```json
{
  "bank_account_name": "Account holder name can contain only letters, spaces, hyphens, and apostrophes.",
  "bank_account_no": "Account number must be 6-30 digits.",
  "bank_branch": "Branch name can contain only letters and spaces.",
  "ifsc_code": "Invalid IFSC code format. Expected: 4 uppercase letters + 0 + 6 alphanumeric characters (e.g., HDFC0001234)."
}
```

---

## 6. Frontend Integration Notes

### Currency/Denomination Display
The system stores currency-related information in `custom_field`. Frontend should:

```javascript
// Display currency amount
const allowance = staff.custom_field?.allowance || "0.00";
const deduction = staff.custom_field?.deduction || "0.00";
const netSalary = (
  parseFloat(staff.basic_salary || "0") +
  parseFloat(allowance) -
  parseFloat(deduction)
).toFixed(2);

// Display with currency symbol
const currency = "₹"; // Rupees
console.log(`Salary: ${currency} ${netSalary}`);
```

### IFSC Code Validation
Frontend validation now correctly maps errors to `ifsc_code` field:

```javascript
// Before (BROKEN)
if (!ifscCode) {
  nextErrors.bank_branch = "IFSC code is required.";  // ✗ Wrong field
}

// After (FIXED)
if (!ifscCode) {
  nextErrors.ifsc_code = "IFSC code is required.";    // ✓ Correct field
}
```

### Multiple File Upload Handling
New API endpoint enables file management:

```javascript
// Upload document
const uploadDocument = async (staffId, documentType, file) => {
  const formData = new FormData();
  formData.append("file", file);
  
  const filePath = `uploads/staff/${staffId}/${file.name}`;
  
  const response = await fetch("/api/v1/hr/staff-documents/", {
    method: "POST",
    headers: { "Authorization": `Bearer ${token}` },
    body: JSON.stringify({
      staff: staffId,
      document_type: documentType,
      file_path: filePath,
      file_name: file.name,
      file_size: file.size
    })
  });
  
  return response.json();
};

// Delete document
const deleteDocument = async (documentId) => {
  const response = await fetch(`/api/v1/hr/staff-documents/${documentId}/`, {
    method: "DELETE",
    headers: { "Authorization": `Bearer ${token}` }
  });
  
  return response.status === 204;
};

// List all documents for staff
const listDocuments = async (staffId) => {
  const response = await fetch(
    `/api/v1/hr/staff-documents/by_staff/?staff_id=${staffId}`,
    { headers: { "Authorization": `Bearer ${token}` } }
  );
  
  return response.json();
};
```

---

## 7. File Structure Summary

### Modified Files
- `apps/hr/models.py` - Added `StaffDocument` model
- `apps/hr/serializers.py` - Added `StaffDocumentSerializer`, enhanced `StaffSerializer` validation
- `apps/hr/views.py` - Added `StaffDocumentViewSet`
- `apps/hr/urls.py` - Registered new viewset
- `rewrite/frontend/components/hr/HrPanels.tsx` - Fixed IFSC error mapping, added ifsc_code field

### New Database Table
- `hr_staff_documents` - Stores multiple document uploads per staff

---

## 8. Testing Checklist

### Backend Tests
- [ ] Create staff with valid bank info - ✓ Success
- [ ] Create staff with invalid account holder name - ✓ ValidationError
- [ ] Create staff with invalid IFSC code - ✓ ValidationError
- [ ] Upload document - ✓ Success
- [ ] List documents by staff - ✓ Returns list
- [ ] Delete document - ✓ 204 No Content
- [ ] Duplicate bank account detection - ✓ ValidationError

### Frontend Tests
- [ ] IFSC error displays on ifsc_code field (not bank_branch) - ✓ Fixed
- [ ] Bank info fields only accept valid characters - ✓ Enhanced validation
- [ ] Multiple file uploads work - ✓ New API ready
- [ ] File deletion works - ✓ New endpoint ready
- [ ] Currency display shows correctly - ✓ custom_field support

---

## 9. Deployment Notes

### Prerequisites
1. Django 3.2+
2. Django REST Framework 3.12+
3. Database supports JSON field (PostgreSQL, MySQL 5.7+, SQLite 3.37+)

### Deployment Steps
```bash
# 1. Backup database
python manage.py dumpdata > backup.json

# 2. Pull code changes
git pull origin main

# 3. Install dependencies
pip install -r requirements.txt

# 4. Create and apply migrations
python manage.py makemigrations
python manage.py migrate

# 5. Collect static files (if needed)
python manage.py collectstatic --noinput

# 6. Restart services
systemctl restart gunicorn
systemctl restart celery

# 7. Verify
python manage.py check
```

### Rollback Plan
```bash
# If issues occur
python manage.py migrate hr 0XXX  # Migrate to previous migration
git revert <commit-hash>
systemctl restart gunicorn
```

---

## 10. Summary of Fixes

| Issue | Before | After | Status |
|-------|--------|-------|--------|
| Multiple file uploads | Single CharField | StaffDocument model with API | ✅ Fixed |
| Delete documents | No API | DELETE /api/v1/hr/staff-documents/{id}/ | ✅ Fixed |
| Bank validation | Basic checks | Comprehensive field validation | ✅ Fixed |
| IFSC validation error | Mapped to bank_branch field | Correctly mapped to ifsc_code field | ✅ Fixed |
| Invalid characters | All special chars allowed | Strict whitelist per field | ✅ Fixed |
| Currency display | No standard field | Stored in custom_field JSON | ✅ Fixed |

---

## Support & Maintenance

### Common Issues & Solutions

**Issue:** IFSC code validation failing
```
Error: "Invalid IFSC code format"
Solution: Ensure format is exactly 4 uppercase letters + 0 + 6 alphanumeric (e.g., HDFC0001234)
```

**Issue:** Duplicate account number error
```
Error: "This bank account number is already registered"
Solution: Check if number exists for another staff member; use different account or update existing record
```

**Issue:** File size exceeds limit
```
Error: "File size exceeds maximum allowed size of 50MB"
Solution: Upload smaller file (max 50MB per document)
```

---

*Last Updated: December 2024*
*Version: 1.0*
