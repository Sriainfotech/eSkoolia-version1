# School ERP Rewrite Master Task Tracker

## How to use this file

- Keep this file as the single source of truth for scope and progress.
- Each checkbox represents a deliverable feature.
- Do not start a module unless dependencies listed for that module are complete.
- Status legend: `[ ]` not started, `[-]` in progress, `[x]` done.
- For every code update, also append one entry in IMPLEMENTATION_LOG.md.
- Follow the mandatory workflow in IMPLEMENTATION_PROCESS.md.

## Global foundation tasks

### Platform and governance

- [x] Create separate frontend and backend workspaces
- [x] Create initial Django backend scaffold
- [x] Create initial Next.js frontend scaffold
- [ ] Define API versioning and error response standard
- [ ] Define pagination, sorting, filtering conventions
- [ ] Add OpenAPI generation and contract review process
- [ ] Add structured logging and correlation IDs
- [ ] Add audit event standard

### Security and access control

- [-] Implement JWT auth flows (login, refresh, logout, revoke) [frontend login/logout + backend revoke added]
- [-] Implement role and permission matrix from legacy behavior
- [ ] Implement tenant-level data isolation guardrails
- [ ] Add password policy, account lock, and session controls
- [ ] Add optional two-factor authentication module

### DevOps and quality

- [ ] Add Docker setup for backend, frontend, postgres, redis
- [ ] Add CI pipelines (lint, test, build)
- [ ] Add pre-commit hooks
- [ ] Add integration test harness for API contracts
- [ ] Add data migration script framework
- [ ] Add seed data for demo school and users

## Module roadmap and feature checklist

## 1. Core Setup and Configuration

Dependencies: Global foundation tasks

- [x] Academic years management
- [ ] Base setup master data (religion, blood group, etc.)
- [x] Class and section configuration
- [x] Subject and class-subject assignment
- [x] Class periods and routine setup [class period master API + planner period selector/grid alignment done; management frontend screen at /setup/class-periods done]
- [ ] Language and localization settings
- [ ] Date, time, currency, and timezone settings
- [ ] Email and SMS provider configuration
- [ ] Background, theme, and dashboard settings
- [ ] Header and menu manager
- [ ] System backup management

## 2. Multi-school SaaS and Tenancy

Dependencies: Core Setup and Configuration

- [ ] School onboarding and activation
- [ ] School profile and subscription metadata
- [ ] Subdomain and tenant routing strategy
- [ ] Tenant-specific settings and branding
- [ ] Tenant-scoped user and role isolation
- [ ] Tenant plan-based module access
- [ ] Tenant billing/subscription hooks

## 3. Role and Permission

Dependencies: Security and access control

- [x] Role CRUD
- [x] Granular permission matrix
- [x] Permission assignment UI (role create/edit form with checkbox picker)
- [ ] Menu visibility based on permission
- [ ] School admin delegation
- [ ] Permission audit trail

## 4. Admissions and Enquiry

Dependencies: Core Setup and Role and Permission

- [x] Admission inquiry model and CRUD API starter
- [x] Admission inquiry follow-up timeline
- [ ] Lead source and conversion tracking
- [ ] Applicant profile and document uploads
- [ ] Admission decision workflow
- [ ] Student record creation from admitted applicant

## 5. Student Information

Dependencies: Admissions and Enquiry

- [x] Student registration and profile
- [x] Parent and guardian profile linkage
- [x] Student category and group management
- [x] Student document management
- [x] Student record edit and transfer
- [x] Disabled student and history tracking
- [x] Student promote logic

## 6. Academics

Dependencies: Student Information, Core Setup

- [x] Class routine management
- [x] Class teacher assignment
- [x] Subject assignment by class/section
- [x] Optional subject handling
- [x] Lesson and topic planning module
- [x] Lesson/topic/planner frontend parity screens
- [x] Lesson/topic/planner edit-delete-report parity
- [x] Legacy lesson route path parity
- [x] Legacy lesson visual frame parity
- [x] Lesson planner teacher selector parity
- [x] Lesson planner weekly grid parity
- [x] Assignment and study material management
- [x] Syllabus and content publication

## 7. Attendance

Dependencies: Student Information, Academics

- [x] Daily student attendance [strict APIView endpoints + PHP-style request keys + present-status notification hook path added]
- [x] Subject-wise attendance [APIViews for index/search/store/holiday/report/report-search/print + Next.js parity pages for subject attendance and subject attendance report]
- [x] Attendance bulk actions and corrections [PHP-style store payload parity + import bulk store + sample file download + StudentAttendanceBulk staging table parity done]
- [x] Attendance reports by student/class/date [monthly report endpoint + frontend done]
- [ ] Student absent notification flow
- [ ] Device-based attendance hooks

## 8. Examination and Result

Dependencies: Academics, Attendance

- [x] Exam type and setup [Exam type CRUD + exam setup mark distribution parity APIs and Next.js screens implemented; duplicate name/title guards hardened for exams]
- [x] Exam scheduling [APIView schedule index/search/store/report-search/print + Next.js schedule and schedule-report screens implemented]
- [x] Exam attendance [APIView attendance index/create-search/store/report-search + Next.js attendance and attendance-report screens implemented]
- [x] Marks register and grade processing [APIView exam-marks index/create-search/store/report-search + per-part mark register storage + grade scale based GPA/grade calculation + Next.js marks register and add-marks screens implemented]
- [x] Result publishing [APIView exam-result-publish index/search/store + publish-state persistence by exam/class/section + Next.js result-publish screen implemented]
- [x] Exam reports and merit views [APIView exam-report index/student-search/merit-search + Next.js student marksheet and merit list screens implemented]
- [x] Online exam module parity [APIView online-exam index/store/update/delete/publish/publish-cancel/marks-register/result + Next.js online exam management screen implemented]
- [x] Exam plan parity module [APIView exam-plan admit-card + seat-plan setting/index/search/generate + Next.js admit-card and seat-plan screens implemented]

## 9. Fees and Finance

Dependencies: Student Information, Role and Permission

- [x] Fees group/type/master setup [Next.js fees group/type/master setup screens + sidebar links + JWT refresh-safe API client integration implemented against existing fees backend CRUD]
- [ ] Fees assignment and discount
- [x] Fees collection and payment records [Next.js fees collection screen with payment create/list/delete + receipt preview integrated with fees payments API]
- [x] Carry forward and due management [due summary + overdue assignment report + carry-forward posting flow endpoint/UI implemented]
- [ ] Bank payment slip processing
- [ ] Wallet module integration
- [ ] Expense and income management
- [ ] Chart of accounts
- [ ] Account transfer and statements

## 10. Human Resources

Dependencies: Role and Permission, Core Setup

- [ ] Staff profile management
- [ ] Designation and department setup
- [ ] Role mapping for staff users
- [ ] Attendance for staff
- [ ] Leave and approval workflow
- [ ] Payroll baseline (if required by current ERP scope)

## 11. Front Desk and Office Operations

Dependencies: Role and Permission

- [ ] Visitor management
- [ ] Complaint management
- [ ] Postal receive and dispatch
- [ ] Phone call log
- [ ] Enquiry desk workflow

## 12. Communication and Notification

Dependencies: Core Setup, Security

- [ ] Internal notice and announcements
- [ ] Email campaign and template support
- [ ] SMS sending and provider abstraction
- [ ] Push notification service
- [ ] Chat module parity
- [ ] Notification preferences and logs

## 13. Library and Inventory

Dependencies: Student Information, HR

- [ ] Library book and category management
- [ ] Book issue and return workflow
- [ ] Inventory module parity
- [ ] Item stock movement logs

## 14. Transport and Dormitory

Dependencies: Student Information

- [ ] Vehicle and route management
- [ ] Transport assignment
- [ ] Dormitory room allocation
- [ ] Boarding status reports

## 15. Content, CMS, and Website

Dependencies: Core Setup

- [ ] About and contact page management
- [ ] Custom pages and links
- [ ] Course and content pages
- [ ] Download center module parity
- [ ] Template settings parity module

## 16. Certificates and Documents

Dependencies: Student Information, Examination and Result

- [ ] Certificate template setup
- [ ] Student certificate generation
- [ ] Bulk print workflows
- [ ] Download and verification options

## 17. Payment Gateways and Billing Integrations

Dependencies: Fees and Finance

- [ ] Stripe integration
- [ ] PayPal integration
- [ ] Paystack integration
- [ ] Xendit integration
- [ ] MercadoPago integration
- [ ] RazorPay and local gateway integration
- [ ] Payment webhook reliability and retry handling

## 18. Reports and Analytics

Dependencies: All transactional modules

- [ ] Student demographic reports
- [ ] Attendance analytics
- [ ] Exam performance analytics
- [ ] Fees collection and outstanding reports
- [ ] Front desk reports
- [ ] Audit and compliance reports
- [ ] CSV, Excel, PDF export parity

## 19. Platform Integrations

Dependencies: Core Setup, Communication

- [ ] Google integration baseline
- [ ] Zoom/BBB/Jitsi/Gmeet parity where needed
- [ ] Mobile app API compatibility layer
- [ ] External webhook and callback framework

## 20. QA, Hardening, and Cutover

Dependencies: All required modules for go-live

- [ ] Module-level UAT checklists
- [ ] Data migration dry run in staging
- [ ] Parallel run with legacy verification
- [ ] Performance and load testing
- [ ] Security scan and remediation
- [ ] Rollback and incident runbook
- [ ] Production go-live by school/tenant wave

## Current sprint checklist

- [x] Create rewrite folder with frontend/backend/docs
- [x] Scaffold Django settings, tenancy, auth, and admissions starter
- [x] Scaffold Next.js professional dashboard shell
- [x] Create process and implementation log documents
- [ ] Add backend Docker and local compose
- [ ] Add frontend design system tokens and reusable components
- [x] Build admissions UI list/create pages with API integration
- [-] Implement roles and permissions API (create/update UI + backend revoke wired)
