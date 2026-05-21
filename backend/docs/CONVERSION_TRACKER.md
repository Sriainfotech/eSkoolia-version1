# Conversion Tracker (PHP to Django DRF)

Last updated: 2026-03-18

## Completed so far

1. Foundation and platform setup
- Django project structure finalized
- DRF, JWT auth, filtering, schema docs configured
- Unified error handling added
- Standard response helpers and reusable serializer/viewset utilities added

2. Converted Django apps (live)
- users
- tenancy
- core
- admissions
- access_control
- students
- academics
- attendance
- fees
- exams
- finance
- hr
- library

3. New conversion completed in this step
- fees app created and integrated
- Added API route prefix: /api/v1/fees/
- Added to installed apps in settings
- Initial migration generated: apps/fees/migrations/0001_initial.py
- Added fees parity endpoints:
	- GET /api/v1/fees/assignments/summary/
	- GET /api/v1/fees/assignments/overdue/
	- GET /api/v1/fees/payments/{id}/receipt/
- exams app created and integrated
- Added API route prefix: /api/v1/exams/
- Initial migration generated and applied: apps/exams/migrations/0001_initial.py
- Added exam result publication support
- Added exam grade policy support via grade scales
- Added exams migration: apps/exams/migrations/0002_exam_is_result_published_exam_published_at_and_more.py
- finance app created and integrated
- Added API route prefix: /api/v1/finance/
- Initial migration generated and applied: apps/finance/migrations/0001_initial.py
- Added finance endpoints for chart of accounts, bank accounts, ledger entries and fund transfers
- Added ledger summary endpoint: GET /api/v1/finance/ledger-entries/summary/
- Added bank statement endpoint: GET /api/v1/finance/bank-accounts/{id}/statement/
- Added trial balance endpoint: GET /api/v1/finance/ledger-entries/trial-balance/
- hr app created and integrated
- Added API route prefix: /api/v1/hr/
- Initial migration generated and applied: apps/hr/migrations/0001_initial.py
- Added HR endpoints for departments, designations, staff, leave types, leave requests and payroll
- Added leave approval/rejection endpoints and payroll summary/payment actions
- library app created and integrated
- Added API route prefix: /api/v1/library/
- Initial migration generated and applied: apps/library/migrations/0001_initial.py
- Added library endpoints for categories, books, members, issue records
- Added overdue and return-book actions

4. Runtime and docs readiness
- Swagger docs enabled at /api/docs/
- Health endpoint available at /health/
- Dev startup scripts prepared for Windows and Unix

## What is still pending in conversion

Priority P1 (core business critical)
- exam and marks module
- finance/accounting ledger module
- library module
- transport module

Priority P2 (operations)
- inventory module
- hostel/dormitory module
- communication module (sms/email/notifications)
- reports and analytics module

Priority P3 (extensions from PHP Modules folder)
- BehaviourRecords
- BulkPrint
- Chat
- DownloadCenter
- ExamPlan
- Lesson (if remaining features)
- MenuManage
- RolePermission advanced parity
- StudentAbsentNotification
- TemplateSettings
- TwoFactorAuth
- VideoWatch
- Wallet
- AiAssistant

## Current API conversion coverage

Converted API groups
- /api/v1/auth/
- /api/v1/access-control/
- /api/v1/admissions/
- /api/v1/core/
- /api/v1/students/
- /api/v1/academics/
- /api/v1/attendance/
- /api/v1/fees/
- /api/v1/exams/
	- /api/v1/exams/grade-scales/
	- /api/v1/exams/exams/{id}/publish-results/
	- /api/v1/exams/exams/{id}/student-results/?student_id=<id>
- /api/v1/finance/
	- /api/v1/finance/chart-of-accounts/
	- /api/v1/finance/bank-accounts/
	- /api/v1/finance/ledger-entries/
	- /api/v1/finance/ledger-entries/summary/
	- /api/v1/finance/ledger-entries/trial-balance/
	- /api/v1/finance/fund-transfers/
	- /api/v1/finance/bank-accounts/{id}/statement/
- /api/v1/hr/
	- /api/v1/hr/departments/
	- /api/v1/hr/designations/
	- /api/v1/hr/staff/
	- /api/v1/hr/leave-types/
	- /api/v1/hr/leave-requests/
	- /api/v1/hr/leave-requests/{id}/approve/
	- /api/v1/hr/leave-requests/{id}/reject/
	- /api/v1/hr/payroll/
	- /api/v1/hr/payroll/summary/
	- /api/v1/hr/payroll/{id}/mark-paid/
- /api/v1/library/
	- /api/v1/library/categories/
	- /api/v1/library/books/
	- /api/v1/library/members/
	- /api/v1/library/issues/
	- /api/v1/library/issues/overdue/
	- /api/v1/library/issues/{id}/return/

## Next execution plan (recommended order)

1. Complete fees parity
- add class-wise and student-wise grouped summaries
- add permission matrix for finance roles
- add tests for fee assignment and payment

2. Build exam module
- exam setup, schedules, marks register
- grade policy and result publication logic
- pass/fail finalization rules per school policy

3. Build accounting ledger
- chart of accounts
- income/expense records
- transfers
- bank statement and reconciliation views

4. Cross-cutting completion
- role-permission checks on all endpoints
- audit logs for critical write operations
- data migration scripts from PHP schema
- endpoint parity checklist against legacy routes

## Done definition for each module

A module is considered done only when all are complete:
- models + migrations
- serializers with validations
- class-based API views/viewsets
- urls and schema docs visible
- tenant and role permission enforcement
- error handling consistency
- unit/integration tests
- seed data and migration script if needed

## Quick run commands

Backend
- cd rewrite/backend
- py manage.py migrate
- py manage.py runserver

Frontend
- cd rewrite/frontend
- npm run dev

If frontend says port 3000 is busy, it will auto-switch to 3001 or 3002.
