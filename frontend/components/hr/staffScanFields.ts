import type { FieldGroup } from "@/components/students/ScanFillModal";

// Keys here match the HR onboard wizard's `form` state keys (see
// `frontend/app/(dashboard)/hr/onboard/page.tsx` and the field_data keys read by
// `StaffOnboardFilledFormView` in `backend/apps/hr/views.py`), so ScanFillModal's
// onApply results can be applied directly via setField(key, value).
//
// Department/Designation/Role are FK selects, not free text — intentionally excluded
// from OCR extraction since a scanned label can't be safely mapped to a database id.
export const STAFF_FIELD_GROUPS: FieldGroup[] = [
  {
    section: "Personal Identity",
    fields: [
      { key: "first_name",  label: "First Name",    required: true,  aliases: ["GIVEN NAME"] },
      { key: "last_name",   label: "Last Name",     required: true,  aliases: ["SURNAME"] },
      { key: "date_of_birth", label: "Date of Birth", required: false, hint: "DD / MM / YYYY", type: "text", aliases: ["DOB", "D.O.B"] },
      { key: "gender",      label: "Gender",        required: false, hint: "MALE / FEMALE / OTHER", aliases: ["SEX"] },
      { key: "blood_group_input", label: "Blood Group", required: false, hint: "e.g. A+", aliases: ["BLOOD TYPE"] },
    ],
  },
  {
    section: "Contact Details",
    fields: [
      { key: "mobile",         label: "Mobile",        required: true,  hint: "10-digit", aliases: ["MOBILE PHONE", "PHONE"] },
      { key: "personal_email", label: "Personal Email", required: false, aliases: ["EMAIL"] },
    ],
  },
  {
    section: "Current Address",
    fields: [
      { key: "current_address_line1", label: "Address", required: false, aliases: ["ADDRESS LINE"] },
      { key: "current_city",          label: "City",    required: false, aliases: ["TOWN"] },
      { key: "current_state",         label: "State",   required: false },
      { key: "current_pin",           label: "Pincode", required: false, hint: "6-digit", aliases: ["PIN CODE", "POSTAL CODE"] },
    ],
  },
  {
    section: "Government & Statutory IDs",
    fields: [
      { key: "aadhaar_number", label: "Aadhaar Number", required: false, hint: "12 digits", aliases: ["AADHAR", "UID"] },
      { key: "pan_number",     label: "PAN Number",     required: false, aliases: ["PAN"] },
      { key: "passport_number", label: "Passport Number", required: false },
      { key: "driving_license", label: "Driving License", required: false },
    ],
  },
  {
    section: "Bank & Payroll",
    fields: [
      { key: "bank_name",           label: "Bank Name",      required: false },
      { key: "bank_branch",         label: "Branch",         required: false },
      { key: "bank_account_name",   label: "Account Holder", required: false, aliases: ["ACCOUNT HOLDER NAME"] },
      { key: "bank_account_number", label: "Account Number", required: false },
      { key: "ifsc_code",           label: "IFSC Code",      required: false, aliases: ["IFSC"] },
    ],
  },
];
