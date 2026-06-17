# Complaints Module — Complete Requirements Review

## Current State Analysis

**Frontend:** [ComplaintPanel.tsx](e:\Es_V1\eskoolia-v1\frontend\components\administration\ComplaintPanel.tsx)
- Complaint types and sources fetched from generic `/api/v1/admissions/admin-setups/` (types 2 and 3)
- No dedicated master data APIs
- Missing staff/employees lookup API

**Backend:** 
- [ComplaintEntryViewSet](e:\Es_V1\eskoolia-v1\backend\apps\admissions\views.py) — basic CRUD operations
- [ComplaintEntrySerializer](e:\Es_V1\eskoolia-v1\backend\apps\admissions\serializers.py) — minimal validation
- [ComplaintEntry Model](e:\Es_V1\eskoolia-v1\backend\apps\admissions\models.py) — all fields are CharField/TextField (no ForeignKeys to master data)

**Database Model Issues:**
```python
class ComplaintEntry(models.Model):
    complaint_type = CharField(max_length=120)      # ❌ Should be ForeignKey to ComplaintType
    complaint_source = CharField(max_length=120)    # ❌ Should be ForeignKey to ComplaintSource
    assigned = CharField(max_length=255)            # ❌ Should be ForeignKey to Staff/User
```

---

## Backend Requirements

### 1. Create Master Data Models

**File:** `backend/apps/admissions/models.py`

#### ComplaintType Model
```python
class ComplaintType(models.Model):
    school = ForeignKey('tenancy.School', on_delete=CASCADE)
    name = CharField(max_length=120, unique_together with school)
    # Examples: Academic Issue, Fee & Billing, Transport, Infrastructure, 
    #          Staff Behavior, Student Discipline, Safety & Security, General Grievance
    description = TextField(blank=True)
    is_active = BooleanField(default=True)
    created_at = DateTimeField(auto_now_add=True)
    updated_at = DateTimeField(auto_now=True)
    
    class Meta:
        unique_together = ('school', 'name')
        ordering = ['name']
```

#### ComplaintSource Model
```python
class ComplaintSource(models.Model):
    school = ForeignKey('tenancy.School', on_delete=CASCADE)
    name = CharField(max_length=120, unique_together with school)
    # Examples: Parent, Student, Staff, Teacher, Visitor, Email, Phone Call, Website, Walk-in
    description = TextField(blank=True)
    is_active = BooleanField(default=True)
    created_at = DateTimeField(auto_now_add=True)
    updated_at = DateTimeField(auto_now=True)
    
    class Meta:
        unique_together = ('school', 'name')
        ordering = ['name']
```

### 2. Migrate ComplaintEntry Model

**File:** Create new migration in `backend/apps/admissions/migrations/`

Update `ComplaintEntry` to use ForeignKeys:
```python
class ComplaintEntry(models.Model):
    school = ForeignKey('tenancy.School', on_delete=CASCADE)
    complaint_by = CharField(max_length=255)
    
    # ✅ Change to ForeignKey
    complaint_type = ForeignKey('ComplaintType', on_delete=PROTECT, null=True, blank=True)
    complaint_source = ForeignKey('ComplaintSource', on_delete=PROTECT, null=True, blank=True)
    
    # ✅ Change to ForeignKey to User (staff)
    assigned_to = ForeignKey('users.User', on_delete=SET_NULL, null=True, blank=True)
    
    phone = CharField(max_length=32, blank=True)
    date = DateField(null=True, blank=True)
    action_taken = CharField(max_length=500, blank=True)
    description = TextField(blank=True)
    file = FileField(upload_to='admissions/complaints/', blank=True, null=True)
    
    created_by = ForeignKey('users.User', on_delete=SET_NULL, null=True, blank=True, 
                            related_name='complaint_entries_created')
    created_at = DateTimeField(auto_now_add=True)
    updated_at = DateTimeField(auto_now=True)
```

### 3. Create Serializers for Master Data

**File:** `backend/apps/admissions/serializers.py`

#### ComplaintTypeSerializer
```python
class ComplaintTypeSerializer(serializers.ModelSerializer):
    class Meta:
        model = ComplaintType
        fields = ['id', 'name', 'description', 'is_active']
        read_only_fields = ['id']
    
    def validate_name(self, value):
        if not value.strip() or len(value.strip()) < 2:
            raise ValidationError("Complaint type name must be at least 2 characters.")
        if len(value.strip()) > 120:
            raise ValidationError("Complaint type name must not exceed 120 characters.")
        return value.strip()
```

#### ComplaintSourceSerializer
```python
class ComplaintSourceSerializer(serializers.ModelSerializer):
    class Meta:
        model = ComplaintSource
        fields = ['id', 'name', 'description', 'is_active']
        read_only_fields = ['id']
    
    def validate_name(self, value):
        if not value.strip() or len(value.strip()) < 2:
            raise ValidationError("Complaint source name must be at least 2 characters.")
        if len(value.strip()) > 120:
            raise ValidationError("Complaint source name must not exceed 120 characters.")
        return value.strip()
```

#### Staff Lookup Serializer
```python
class StaffLookupSerializer(serializers.ModelSerializer):
    designation = SerializerMethodField()
    full_name = SerializerMethodField()
    
    class Meta:
        model = User
        fields = ['id', 'username', 'full_name', 'designation', 'email']
    
    def get_full_name(self, obj):
        return obj.get_full_name() or obj.username
    
    def get_designation(self, obj):
        # Fetch from HR app if available, otherwise return empty
        # Example: if hasattr(obj, 'staff_designation'): return obj.staff_designation
        return ""
```

### 4. Create ViewSets for Master Data

**File:** `backend/apps/admissions/views.py`

#### ComplaintTypeViewSet
```python
class ComplaintTypeViewSet(AdminSectionRBACMixin, viewsets.ModelViewSet):
    serializer_class = ComplaintTypeSerializer
    permission_classes = [permissions.IsAuthenticated]
    queryset = ComplaintType.objects.all()
    permission_codes = {
        "list": "admin_section.complaint.view",
        "retrieve": "admin_section.complaint.view",
        "create": "admin_section.complaint.add",
        "update": "admin_section.complaint.edit",
        "partial_update": "admin_section.complaint.edit",
        "destroy": "admin_section.complaint.delete",
    }
    
    def get_queryset(self):
        user = self.request.user
        qs = ComplaintType.objects.filter(is_active=True)
        if user.school_id:
            qs = qs.filter(school_id=user.school_id)
        elif not user.is_superuser:
            qs = qs.none()
        return qs.order_by('name')
```

#### ComplaintSourceViewSet
```python
class ComplaintSourceViewSet(AdminSectionRBACMixin, viewsets.ModelViewSet):
    serializer_class = ComplaintSourceSerializer
    permission_classes = [permissions.IsAuthenticated]
    queryset = ComplaintSource.objects.all()
    permission_codes = { ... same as above ... }
    
    def get_queryset(self):
        user = self.request.user
        qs = ComplaintSource.objects.filter(is_active=True)
        if user.school_id:
            qs = qs.filter(school_id=user.school_id)
        elif not user.is_superuser:
            qs = qs.none()
        return qs.order_by('name')
```

#### StaffLookupViewSet (Read-only)
```python
class StaffLookupViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = StaffLookupSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_queryset(self):
        user = self.request.user
        qs = User.objects.filter(is_active=True)
        if user.school_id:
            qs = qs.filter(school_id=user.school_id)
        elif not user.is_superuser:
            qs = qs.none()
        return qs.select_related('school').order_by('first_name', 'last_name')
```

### 5. Register URLs

**File:** `backend/apps/admissions/urls.py`

```python
router.register("complaint-types", ComplaintTypeViewSet, basename="complaint-type")
router.register("complaint-sources", ComplaintSourceViewSet, basename="complaint-source")
router.register("staff-lookup", StaffLookupViewSet, basename="staff-lookup")
```

### 6. Update ComplaintEntrySerializer

**File:** `backend/apps/admissions/serializers.py`

#### ComplaintEntrySerializer with Full Validation
```python
class ComplaintEntrySerializer(serializers.ModelSerializer):
    complaint_type_name = SerializerMethodField(read_only=True)
    complaint_source_name = SerializerMethodField(read_only=True)
    assigned_to_name = SerializerMethodField(read_only=True)
    created_by_name = SerializerMethodField(read_only=True)
    file_upload = FileField(write_only=True, required=False, allow_null=True)
    file_url = SerializerMethodField(read_only=True)
    
    class Meta:
        model = ComplaintEntry
        fields = [
            'id',
            'complaint_by',
            'complaint_type',
            'complaint_type_name',
            'complaint_source',
            'complaint_source_name',
            'phone',
            'date',
            'action_taken',
            'assigned_to',
            'assigned_to_name',
            'description',
            'file_url',
            'file_upload',
            'created_by',
            'created_by_name',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'created_by', 'created_by_name', 'created_at', 'updated_at']
    
    def validate_complaint_by(self, value):
        name = _sanitize_text(value)
        if not name or len(name) < 3:
            raise ValidationError("Complainant name must be at least 3 characters.")
        if len(name) > 100:
            raise ValidationError("Complainant name must not exceed 100 characters.")
        if not NAME_PATTERN.match(name):
            raise ValidationError("Name must contain only letters, spaces, and hyphens.")
        return name
    
    def validate_complaint_type(self, value):
        if not value:
            raise ValidationError("Please select a complaint type.")
        return value
    
    def validate_complaint_source(self, value):
        if not value:
            raise ValidationError("Please select a complaint source.")
        return value
    
    def validate_phone(self, value):
        if not value:
            return ""
        return _normalize_phone(value, 'phone', required=False)
    
    def validate_date(self, value):
        if not value:
            raise ValidationError("Date is required.")
        if value > timezone.localdate():
            raise ValidationError("Future dates are not allowed.")
        return value
    
    def validate_action_taken(self, value):
        if value and len(value) > 500:
            raise ValidationError("Action taken must not exceed 500 characters.")
        return value
    
    def validate_description(self, value):
        if value and len(value) > 1000:
            raise ValidationError("Description must not exceed 1000 characters.")
        return value
    
    def validate_file_upload(self, value):
        if value is None:
            return None
        filename = str(getattr(value, 'name', '') or '').lower()
        ext = '.' + filename.rsplit('.', 1)[1] if '.' in filename else ''
        if ext not in ALLOWED_COMPLAINT_FILE_EXTENSIONS:
            raise ValidationError("Unsupported file type. Allowed: PDF, JPG, JPEG, PNG, DOC, DOCX.")
        if getattr(value, 'size', 0) > MAX_COMPLAINT_FILE_SIZE:
            raise ValidationError("File size must be 5MB or less.")
        return value
    
    def validate(self, attrs):
        errors = {}
        
        # Verify FK references exist
        if 'complaint_type' in attrs and attrs['complaint_type']:
            ct = attrs['complaint_type']
            school_id = self._current_school_id()
            if not ComplaintType.objects.filter(id=ct.id, school_id=school_id).exists():
                errors['complaint_type'] = "Invalid complaint type."
        
        if 'complaint_source' in attrs and attrs['complaint_source']:
            cs = attrs['complaint_source']
            school_id = self._current_school_id()
            if not ComplaintSource.objects.filter(id=cs.id, school_id=school_id).exists():
                errors['complaint_source'] = "Invalid complaint source."
        
        if 'assigned_to' in attrs and attrs['assigned_to']:
            assigned_user = attrs['assigned_to']
            school_id = self._current_school_id()
            if assigned_user.school_id != school_id:
                errors['assigned_to'] = "Staff member not found in your school."
        
        if errors:
            raise ValidationError(errors)
        
        return super().validate(attrs)
    
    def get_complaint_type_name(self, obj):
        if obj.complaint_type:
            return obj.complaint_type.name
        return None
    
    def get_complaint_source_name(self, obj):
        if obj.complaint_source:
            return obj.complaint_source.name
        return None
    
    def get_assigned_to_name(self, obj):
        if obj.assigned_to:
            return obj.assigned_to.get_full_name() or obj.assigned_to.username
        return None
    
    def get_created_by_name(self, obj):
        if obj.created_by:
            return obj.created_by.get_full_name() or obj.created_by.username
        return None
    
    def get_file_url(self, obj):
        if not obj.file:
            return ""
        request = self.context.get('request')
        url = obj.file.url
        return request.build_absolute_uri(url) if request else url
```

### 7. Update ComplaintEntryViewSet

**File:** `backend/apps/admissions/views.py`

```python
class ComplaintEntryViewSet(AdminSectionRBACMixin, DuplicateSafeWriteMixin, viewsets.ModelViewSet):
    serializer_class = ComplaintEntrySerializer
    pagination_class = ApiPageNumberPagination
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]
    create_success_message = "Complaint recorded successfully"
    update_success_message = "Complaint updated successfully"
    permission_codes = {
        "list": "admin_section.complaint.view",
        "retrieve": "admin_section.complaint.view",
        "create": "admin_section.complaint.add",
        "update": "admin_section.complaint.edit",
        "partial_update": "admin_section.complaint.edit",
        "destroy": "admin_section.complaint.delete",
    }
    
    def get_queryset(self):
        user = self.request.user
        qs = ComplaintEntry.objects.select_related(
            'school', 'complaint_type', 'complaint_source', 'assigned_to', 'created_by'
        )
        
        # Apply school filter
        if user.is_superuser:
            pass
        elif user.school_id:
            qs = qs.filter(school_id=user.school_id)
        else:
            return qs.none()
        
        # Apply search and filter params
        search = self.request.query_params.get('search', '').strip()
        if search:
            qs = qs.filter(
                models.Q(complaint_by__icontains=search) |
                models.Q(complaint_type__name__icontains=search) |
                models.Q(phone__icontains=search) |
                models.Q(description__icontains=search)
            )
        
        complaint_type_id = self.request.query_params.get('complaint_type', '').strip()
        if complaint_type_id:
            qs = qs.filter(complaint_type_id=complaint_type_id)
        
        complaint_source_id = self.request.query_params.get('complaint_source', '').strip()
        if complaint_source_id:
            qs = qs.filter(complaint_source_id=complaint_source_id)
        
        date = self.request.query_params.get('date', '').strip()
        if date:
            qs = qs.filter(date=date)
        
        return qs.order_by('-date', '-created_at')
    
    def perform_create(self, serializer):
        user = self.request.user
        school = user.school or getattr(self.request, 'school', None)
        if not school:
            raise PermissionDenied("School context is required.")
        serializer.save(school=school, created_by=user)
```

---

## Frontend Requirements

### 1. Update ComplaintPanel.tsx

#### Add Field Refs (similar to VisitorBook)
```typescript
const complaintByRef = useRef<HTMLInputElement | null>(null);
const complaintTypeRef = useRef<HTMLSelectElement | null>(null);
const complaintSourceRef = useRef<HTMLSelectElement | null>(null);
const phoneRef = useRef<HTMLInputElement | null>(null);
const dateRef = useRef<HTMLInputElement | null>(null);
const actionTakenRef = useRef<HTMLTextAreaElement | null>(null);
const assignedToRef = useRef<HTMLSelectElement | null>(null);
const descriptionRef = useRef<HTMLTextAreaElement | null>(null);
const attachmentRef = useRef<HTMLInputElement | null>(null);

const scrollToFirstError = (errors: Record<string, string>) => { ... }
```

#### Update load() to Fetch Master Data
```typescript
const load = async (targetPage = 1, filters = {}) => {
    const [complaintData, typeData, sourceData, staffData] = await Promise.all([
        apiGet(`/api/v1/admissions/complaints/?page=${targetPage}&...`),
        apiGet(`/api/v1/admissions/complaint-types/`),
        apiGet(`/api/v1/admissions/complaint-sources/`),
        apiGet(`/api/v1/admissions/staff-lookup/`),
    ]);
    // Map to SelectOptions...
}
```

#### Add Frontend Validations
```typescript
const submit = async (event: FormEvent) => {
    event.preventDefault();
    const nextErrors: Record<string, string> = {};
    
    // Required fields
    if (!complaintBy.trim()) 
        nextErrors.complaintBy = "Please enter the complainant name.";
    if (complaintBy.trim() && complaintBy.trim().length < 3)
        nextErrors.complaintBy = "Name must be at least 3 characters.";
    if (complaintBy.trim() && complaintBy.trim().length > 100)
        nextErrors.complaintBy = "Name must not exceed 100 characters.";
    
    if (!complaintType)
        nextErrors.complaintType = "Please select a complaint type.";
    
    if (!complaintSource)
        nextErrors.complaintSource = "Please select a complaint source.";
    
    if (!date)
        nextErrors.date = "Date is required.";
    if (date && date > todayDate)
        nextErrors.date = "Future dates are not allowed.";
    
    // Optional fields with validation
    if (phone && !/^\d{10}$/.test(phone.replace(/[^\d]/g, '')))
        nextErrors.phone = "Please enter a valid 10-digit phone number.";
    
    if (actionTaken && actionTaken.length > 500)
        nextErrors.actionTaken = "Action taken must not exceed 500 characters.";
    
    if (description && description.length > 1000)
        nextErrors.description = "Description must not exceed 1000 characters.";
    
    if (fileUpload && fileUpload.size > 5 * 1024 * 1024)
        nextErrors.attachment = "File size cannot exceed 5 MB.";
    
    if (Object.keys(nextErrors).length > 0) {
        setFieldErrors(nextErrors);
        setFormBanner("Please fix the errors below before submitting.");
        scrollToFirstError(nextErrors);
        return;
    }
    
    // API call...
}
```

#### Update applyFilters() to Use Backend Filtering
```typescript
const applyFilters = () => {
    setPage(1);
    void load(1, {
        search,
        complaint_type: filterType,
        complaint_source: filterSource,
        date: filterDate,
    });
};

const clearFilters = () => {
    setSearch("");
    setFilterType("");
    setFilterSource("");
    setFilterDate("");
    setFilterChips([]);
    setPage(1);
    void load(1, {});
};
```

### 2. Update CSS (VisitorBookPanel.module.css)

Already has `.roInputError` and `.fieldError` classes from VisitorBook — reuse them.

### 3. Form Fields with Error Display

Each field should:
- Use `fieldErrors.fieldName ? s.roInputError : s.roInput` for className
- Render `{fieldErrors.fieldName && <span className={s.fieldError}>{fieldErrors.fieldName}</span>}`
- Clear error on onChange: `if (fieldErrors.fieldName) setFieldErrors(p => ({ ...p, fieldName: "" }))`

---

## Migration Checklist

### Phase 1: Database & Models
- [ ] Create `ComplaintType` model
- [ ] Create `ComplaintSource` model
- [ ] Create migration to add new models
- [ ] Create migration to update `ComplaintEntry` ForeignKeys

### Phase 2: Backend APIs
- [ ] Create serializers for `ComplaintType`, `ComplaintSource`, `StaffLookup`
- [ ] Create ViewSets with proper filtering and permissions
- [ ] Register URLs in `urls.py`
- [ ] Update `ComplaintEntrySerializer` with full validation
- [ ] Update `ComplaintEntryViewSet` with filtering and proper error responses

### Phase 3: Seed Master Data
- [ ] Create management command to seed complaint types and sources for all schools

### Phase 4: Frontend
- [ ] Update `load()` to fetch master data from new endpoints
- [ ] Add field refs and auto-scroll-to-error logic
- [ ] Add all frontend validations
- [ ] Update `applyFilters()` to use backend filtering
- [ ] Map backend field_errors in catch block
- [ ] Test field-level error display and styling

---

## Response Format (All Master Data APIs)

### GET /api/v1/admissions/complaint-types/
```json
{
  "results": [
    { "id": 1, "name": "Academic Issue", "is_active": true },
    { "id": 2, "name": "Fee & Billing", "is_active": true },
    ...
  ],
  "count": 8,
  "next": null,
  "previous": null
}
```

### GET /api/v1/admissions/complaint-sources/
```json
{
  "results": [
    { "id": 1, "name": "Parent", "is_active": true },
    { "id": 2, "name": "Student", "is_active": true },
    ...
  ],
  "count": 9,
  "next": null,
  "previous": null
}
```

### GET /api/v1/admissions/staff-lookup/
```json
{
  "results": [
    { "id": 1, "username": "john_smith", "full_name": "John Smith", "designation": "Mathematics Teacher", "email": "john@school.com" },
    ...
  ],
  "count": 25,
  "next": null,
  "previous": null
}
```

### POST /api/v1/admissions/complaints/ (Error Response)
```json
{
  "success": false,
  "message": "Please select a complaint type.",
  "field_errors": {
    "complaint_by": ["Complainant name must be at least 3 characters."],
    "complaint_type": ["Please select a complaint type."],
    "date": ["Future dates are not allowed."],
    "file_upload": ["File size must be 5MB or less."]
  }
}
```

---

## Testing Scenarios

1. **Master Data Loading:** Verify complaint types, sources, and staff lists load correctly
2. **Frontend Validation:** Test each field with invalid data before clicking Save
3. **Backend Validation:** Submit invalid data from Postman to verify backend catches errors
4. **Error Display:** Verify field-level errors appear below corresponding fields
5. **Auto-scroll:** Check first invalid field is focused on validation failure
6. **Backend Filtering:** Test search, type, source, date filters return correct results
7. **File Upload:** Test various file types and sizes
8. **Data Persistence:** Verify complaint records are saved with correct relationships to master data
