# Eskoolia Admissions — 10x Improvement Plan & Copilot Prompts
**Goal:** Reduce human workload, mental load, physical follow-ups, and manual remembering.  
**Stack:** Next.js frontend · Django/Python backend · existing Eskoolia blue/white theme  
**Date:** May 2026

---

## PART 1 — AUDIT OF CURRENT PAGE

### What exists today
| Area | Current State | Problem |
|---|---|---|
| Inquiry form | Single right-side panel, 10 flat fields | No validation, no steps, no auto-fill |
| Pipeline view | Static Kanban cards (Contacted/Visited/Enrolled/Declined) | Cannot drag, no auto-stage move |
| Follow-up | Manual "Call" + "Log" buttons only | Staff must remember who to call and when |
| Reminders | None | Overdue items just turn red — no auto-alert |
| Communication | WhatsApp button opens app manually | No template, no auto-send, no log |
| Analytics | Conversion heatmap (static numbers) | No funnel, no source ROI, no trends |
| Grade capacity | Shows 0% fill with 0 inquiries | Not connected to seat capacity data |
| AI | None | Zero automation |
| Documents | Not present | No document checklist per inquiry |
| Duplicate detection | None | Same family can be entered twice |

---

## PART 2 — IMPROVEMENT PLAN (Priority Order)

### 🔴 PRIORITY 1 — Automation & Zero-Manual-Follow-Up

#### Feature A: Auto Follow-Up Engine
- When a follow-up date is set, auto-send WhatsApp/SMS/email to parent at 9 AM that day
- If no response in 24 hrs → auto-send a gentle reminder
- If no response in 48 hrs → push to "Today's Priority" for a human call
- Staff never has to remember who to call — system tells them

#### Feature B: Smart Overdue Escalation
- Inquiry overdue by 1 day → yellow flag
- Overdue by 3 days → orange flag + auto-notify assigned counsellor
- Overdue by 7 days → red flag + notify principal/admin + suggest "mark lost"

#### Feature C: Auto Stage Progression
- When counsellor logs "Visit Scheduled" → inquiry auto-moves to "Visited" stage on the date of visit
- When fee is paid → auto-moves to "Enrolled"
- When parent declines via WhatsApp reply → auto-moves to "Declined"

#### Feature D: Auto-Send Communication Templates
- "Thank you for your inquiry" → auto-sent immediately on form submission
- "Reminder: Your school visit is tomorrow at [time]" → auto-sent 24 hrs before
- "We noticed you haven't enrolled yet — here's what's pending" → auto-sent after 5 days of inactivity
- "Admission is now open for [Grade] — seats filling fast" → bulk campaign trigger

---

### 🟠 PRIORITY 2 — Smart Admission Form

#### Feature E: Multi-Step Inquiry Form (3 steps)
- Step 1: Parent/Guardian Info (name, phone, email, relationship)
- Step 2: Child Info (name, DOB, current school, grade applying for)
- Step 3: Preferences (source, reference, preferred visit date, description)
- Progress bar at top
- Auto-save draft every 30 seconds
- Smart duplicate detection: "A sibling may already be enrolled — link records?"

#### Feature F: Inline Validation
- Phone: +91 format, 10 digits, live check
- Email: real-time format validation
- Required fields: red border + inline message on blur
- Grade capacity warning: "Only 3 seats left in Grade 5"

#### Feature G: Fee Preview Panel
- After grade is selected, show: Admission fee, Term fee, Transport (optional), Sibling discount (if detected)
- Show total before form is submitted
- Parent sees cost upfront → reduces drop-off

---

### 🟡 PRIORITY 3 — Dashboard Intelligence

#### Feature H: Live Conversion Funnel
- Visual funnel: Inquiries → Contacted → Visited → Enrolled
- Drop-off % between each stage
- Click any stage → filter pipeline to show those records
- Compare this month vs last month

#### Feature I: Source ROI Tracker
- Track where each inquiry came from (Word of Mouth, Instagram, Phone Call, etc.)
- Show: inquiries per source, conversion rate per source, best performing channel
- Help admin decide where to spend marketing budget

#### Feature J: Seat Capacity Meter
- Each grade tile (Nursery, LKG, 1–10) shows: Total seats / Filled / Pipeline / Available
- Color: green (>50% available) → yellow (20–50%) → red (<20%)
- Auto-alert when a grade is 90% full

#### Feature K: Counsellor Performance Board
- Show each assigned counsellor: inquiries handled, conversion rate, avg response time
- Friendly leaderboard (not punitive) — encourages faster follow-up

---

### 🟢 PRIORITY 4 — Communication Hub

#### Feature L: In-App WhatsApp/SMS Log
- Every message sent/received is logged against the inquiry record
- Staff can see full conversation history without opening WhatsApp
- One-click template send from within the card

#### Feature M: Bulk Campaign Sender
- Select multiple inquiries → "Send Bulk Message"
- Choose template → preview → send
- Track delivery + read status

#### Feature N: Parent Self-Service Portal Link
- Auto-send parents a private link to: check their inquiry status, upload documents, schedule a visit
- Reduces inbound "what's the status?" calls by ~70%

---

### 🔵 PRIORITY 5 — AI Layer

#### Feature O: AI Lead Scoring
- Score each inquiry 1–100 based on: days since inquiry, stage, source, engagement, grade demand
- Hot leads (score >70) float to top of priority list automatically
- Staff focus energy on highest-likelihood conversions

#### Feature P: AI Reply Suggestions
- When logging a call/note, AI suggests next action: "Based on 3 days of no response, suggest sending visit reminder"
- When a parent asks a question in chat, AI drafts a reply for counsellor to approve + send

#### Feature Q: Predictive Seat Planning
- Based on historical data, predict how many seats will fill per grade by March
- Alert admin in November if a grade is trending to over/under-enroll

---

## PART 3 — DETAILED COPILOT PROMPTS

Use each prompt independently. Paste into GitHub Copilot Chat, Cursor, or any AI coding assistant.

---

### PROMPT 1 — Auto Follow-Up Engine (Backend: Django)

```
You are working on a Django-based School ERP called Eskoolia. 
The admissions module has an AdmissionInquiry model with these fields:
- full_name, phone, email, grade_applying_for, source, reference
- query_date, next_follow_up (DateField)
- assigned_to (ForeignKey to User)
- status (choices: active, contacted, visited, enrolled, declined, lost)
- stage (choices: inquiry_received, phone_call, visited, enrolled, declined)

TASK: Build a fully automated follow-up engine with zero manual triggering.

Requirements:
1. Create a Django management command `python manage.py run_followup_engine` that:
   a. Queries all AdmissionInquiry records where next_follow_up == today and status is not enrolled/declined/lost
   b. For each record, sends a WhatsApp message to the parent phone using the Gupshup or Meta WhatsApp Cloud API
      - Template: "Dear {parent_name}, this is a reminder from {school_name}. Your inquiry for {grade} admission is pending. Please call us at {school_phone} or reply to this message. — {school_name} Admissions Team"
   c. Logs the message in a new model AdmissionCommunicationLog (inquiry FK, channel, message_text, sent_at, delivered, read)
   d. Sets next_follow_up = today + 2 days automatically
   
2. Create a Celery periodic task (beat schedule) that runs this management command every day at 9:00 AM IST

3. Create an escalation check:
   a. If next_follow_up is more than 3 days in the past → send email to assigned_to user with subject "⚠️ Overdue Follow-up: {parent_name} ({grade})"
   b. If next_follow_up is more than 7 days in the past → send email to all users with role 'admin' with subject "🚨 Critical: Inquiry at risk of being lost — {parent_name}"

4. Add a new field to AdmissionInquiry: last_auto_followup_sent (DateTimeField, null=True)
   Only send auto follow-up if last_auto_followup_sent is None or > 48 hours ago (to prevent spam)

5. Create a Django REST API endpoint:
   GET /api/admissions/followup-due-today/ → returns list of today's follow-ups with parent info, stage, assigned counsellor, days overdue
   POST /api/admissions/{id}/mark-contacted/ → updates status to 'contacted', sets next_follow_up to today+3, logs the action

Use: Django 4.x, Celery with Redis, django-rest-framework. Add proper error handling and logging throughout. Show the complete models.py additions, tasks.py, management command file, and API viewset.
```

---

### PROMPT 2 — Smart Multi-Step Inquiry Form (Frontend: Next.js)

```
You are working on a Next.js 14 School ERP called Eskoolia.
The app uses a blue/white theme (#1a56db primary blue, white backgrounds, Inter font).
Existing components are in /components. The current admission form is a single right-side slide-over panel.

TASK: Replace the existing "New Admission Inquiry" slide-over with a fully production-ready multi-step form.

Requirements:

Step 1 — Parent/Guardian Info:
- Full Name (required, min 3 chars)
- Phone (required, +91 prefix auto-added, 10-digit validation, live format check)
- Email (optional, but validate format if entered)
- Relationship to child (dropdown: Father, Mother, Guardian)

Step 2 — Child Info:
- Child Full Name (required)
- Date of Birth (date picker, must be realistic for the grade)
- Grade Applying For (dropdown matching existing grade options)
- Current School (optional text)
- When form detects same phone/email already in system → show yellow banner: 
  "Looks like this family already has an inquiry. Is this a sibling? [Yes, link records] [No, new inquiry]"

Step 3 — Preferences:
- Source (dropdown: Word of Mouth, Instagram, Facebook, Google, Newspaper, Phone Call, Other)
- Reference (free text, show only when Source is Word of Mouth)
- Preferred Visit Date (date picker, min = tomorrow)
- Query Date (auto-filled to today, read-only)
- Next Follow-up Date (auto-filled to today+2, editable)
- Assigned To (staff dropdown)
- Description (textarea, optional)
- Note/Internal (textarea, optional, labelled "Internal note — not visible to parents")

UI Requirements:
- Progress bar at top showing Step 1 / 2 / 3 with % complete
- "Back" and "Next" buttons. Final step has "Save Inquiry" button
- Each field: label above, helper text below in gray, red border + inline error on invalid blur
- aria-describedby and role="alert" for screen reader support
- Auto-save draft to localStorage every 30 seconds with "Draft saved" indicator
- On Step 2, after grade is selected, fetch from /api/admissions/grade-capacity/{grade}/ and show: 
  "Grade 5 has 12 seats — 8 filled — 4 available" as a green/yellow/red pill

On submit:
- POST to /api/admissions/inquiry/create/
- Show success toast: "Inquiry saved! Auto follow-up scheduled for {next_follow_up_date}"
- Reset form and close panel

Use TypeScript, Tailwind CSS (match existing theme). No new UI libraries. Reuse existing Button, Input, Select, DatePicker components from /components/ui.
```

---

### PROMPT 3 — Auto Communication Templates + WhatsApp Log (Full Stack)

```
You are working on Eskoolia School ERP (Next.js frontend + Django backend).

TASK: Build an in-app communication system so counsellors never have to manually open WhatsApp or remember what to say.

Backend (Django):

1. Create a CommunicationTemplate model:
   - name (CharField)
   - channel (choices: whatsapp, sms, email)
   - trigger (choices: on_inquiry_created, on_visit_scheduled, on_followup_overdue, manual)
   - subject (CharField, for email only)
   - body (TextField, supports variables: {parent_name}, {child_name}, {grade}, {school_name}, {visit_date}, {counsellor_name}, {school_phone})
   - is_active (BooleanField)

2. Pre-populate with these 5 default templates:
   a. "Thank You for Inquiry" — WhatsApp — trigger: on_inquiry_created
      Body: "Dear {parent_name}, thank you for your interest in {school_name}! We've received your inquiry for {grade} admission. Our team will contact you within 24 hours. — {school_name} Admissions Team"
   b. "Visit Reminder" — WhatsApp — trigger: on_visit_scheduled (sent 24 hrs before)
      Body: "Dear {parent_name}, this is a reminder that your school visit is scheduled for tomorrow. Please arrive by 10 AM. Looking forward to meeting you! — {school_name}"
   c. "Follow-up Nudge" — WhatsApp — trigger: on_followup_overdue
      Body: "Dear {parent_name}, we noticed we haven't connected yet about {child_name}'s admission to {grade}. We'd love to help — please call {school_phone} or reply here. — {school_name}"
   d. "Seats Filling Fast" — WhatsApp — trigger: manual (bulk campaign)
      Body: "Dear {parent_name}, admission to {grade} at {school_name} is closing soon — only a few seats remain! Secure your child's seat today. Call {school_phone}. — {school_name}"
   e. "Enrollment Confirmed" — Email+WhatsApp — trigger: on_enrolled
      Body: "Congratulations! {child_name}'s enrollment at {school_name} is confirmed for {grade}. Welcome to our school family! Please visit the office to complete document submission. — {school_name} Admin Team"

3. API endpoints:
   GET /api/admissions/templates/ → list all templates
   POST /api/admissions/{inquiry_id}/send-message/ → body: {template_id, channel, custom_message (optional)}
     → renders template with inquiry data, sends via WhatsApp/SMS/Email, logs in AdmissionCommunicationLog
   GET /api/admissions/{inquiry_id}/communication-log/ → full history for that inquiry

Frontend (Next.js):

4. Inside each inquiry pipeline card, add a "Message" dropdown button that:
   - Shows list of active templates
   - One-click sends the template (no typing required)
   - Shows a "Sent ✓" toast confirmation

5. Inside the inquiry detail view, add a "Communication History" tab:
   - Timeline of all messages: date, channel icon (WhatsApp/SMS/Email), message preview, status (sent/delivered/read)
   - "Send New Message" button with template picker + option to write custom message
   - Character count for SMS (160 char limit)

Use Django signals to auto-trigger on_inquiry_created and on_enrolled templates automatically when status changes. Everything else is one-click manual from the UI.
```

---

### PROMPT 4 — Live Conversion Funnel + Source ROI Dashboard (Frontend: Next.js)

```
You are working on Eskoolia School ERP (Next.js 14 + Django REST).
The admissions command center is at /admissions/command-center.
Add a new collapsible analytics section below the pipeline stats.

TASK: Build a live analytics dashboard section for the admissions page.

Backend API (Django — add to existing admissions viewset):

GET /api/admissions/analytics/funnel/
Response: {
  "period": "2026-04",
  "stages": [
    {"stage": "Inquiries", "count": 45, "percent": 100},
    {"stage": "Contacted", "count": 38, "percent": 84},
    {"stage": "Visited", "count": 22, "percent": 49},
    {"stage": "Enrolled", "count": 14, "percent": 31}
  ],
  "vs_last_month": {"inquiries": +12, "enrolled": +3}
}

GET /api/admissions/analytics/sources/
Response: {
  "sources": [
    {"source": "Word of Mouth", "inquiries": 18, "enrolled": 9, "conversion_rate": 50},
    {"source": "Instagram", "inquiries": 12, "enrolled": 3, "conversion_rate": 25},
    ...
  ]
}

GET /api/admissions/analytics/grade-capacity/
Response: {
  "grades": [
    {"grade": "Nursery", "total_seats": 40, "enrolled": 28, "pipeline": 5, "available": 7},
    ...
  ]
}

Frontend (Next.js):

1. Conversion Funnel Component:
   - Horizontal funnel bars: each stage is a full-width bar, width = % of total inquiries
   - Color: blue for Inquiries → lighter blue for each step → green for Enrolled
   - Show drop-off % between stages in red: "↓ 16% dropped off here"
   - Clicking a stage filters the Active Pipeline list to show only those records

2. Source ROI Table:
   - Columns: Source | Inquiries | Enrolled | Conversion % | Trend
   - Sort by conversion rate descending
   - Best row highlighted green, worst row highlighted red
   - "🏆 Word of Mouth is your best channel this month" as a callout card

3. Grade Capacity Meters:
   - Replace the existing grade tiles at the top
   - Each tile: Grade name + progress bar (enrolled/total) + small pipeline bubble
   - Color coding: green/yellow/red based on availability
   - Tooltip on hover: "28 enrolled, 5 in pipeline, 7 seats available"

4. Add filter bar: "This Month | Last Month | This Year | Custom Range" — all charts respond to this filter

5. Add "Export" button → downloads admissions report as CSV with columns:
   Inquiry Date, Parent Name, Phone, Grade, Source, Stage, Assigned To, Last Follow-up, Status

All data fetched from the APIs above. Show loading skeletons while fetching. Handle empty states gracefully. Use Recharts (already in project) for any chart elements.
```

---

### PROMPT 5 — AI Lead Scoring + Smart Priority Engine (Full Stack)

```
You are working on Eskoolia School ERP (Django backend + Next.js frontend).

TASK: Add an AI-powered lead scoring system that automatically ranks inquiries so counsellors always know exactly who to focus on — no guesswork.

Backend (Django):

1. Create a LeadScore model linked to AdmissionInquiry:
   - inquiry (OneToOneField)
   - score (IntegerField, 0–100)
   - score_breakdown (JSONField — stores individual factor scores)
   - label (CharField: choices: hot, warm, cold)
   - last_calculated (DateTimeField)

2. Write a scoring function calculate_lead_score(inquiry) that returns 0–100 based on:
   - Days since inquiry: 0 days = 20pts, 1-3 days = 15pts, 4-7 days = 8pts, >7 days = 0pts
   - Stage: enrolled=100, visited=40pts, contacted=20pts, inquiry_received=5pts
   - Source quality: Word of Mouth=15pts, Referral=15pts, Instagram=8pts, Other=5pts
   - Communication responsiveness: replied to last message=15pts, no reply=0pts
   - Grade demand: grade is >80% full = +10pts urgency bonus
   - Days overdue: not overdue=10pts, 1-3 days overdue=5pts, >3 days=-5pts

3. Labels: score ≥70 → "hot" (red flame icon), 40–69 → "warm" (yellow), <40 → "cold" (blue)

4. Celery task: recalculate all scores every 6 hours. Also recalculate for a specific inquiry when:
   - Stage changes
   - Communication is logged
   - Follow-up date is updated

5. API: GET /api/admissions/inquiries/?sort_by=lead_score → returns inquiries sorted by score desc

Frontend (Next.js):

6. In each pipeline card, add a score badge (top-right): 
   - 🔥 Hot (red pill) / Warm (yellow pill) / Cold (blue pill) + score number
   - Tooltip: breakdown of score factors

7. In "Today's Priority" sidebar:
   - Sort by lead score descending (not just by date)
   - Add a filter: "Show Hot Only" toggle
   - Hot leads get a subtle red left border on their card

8. Add "AI Suggestion" text under each priority card:
   - Hot + overdue → "⚡ Call now — high intent, overdue follow-up"
   - Warm + visit scheduled → "📅 Send visit reminder template"
   - Cold + >7 days → "❄️ Send re-engagement message or mark lost"
   - These suggestions are generated based on score factors, not an external LLM call (rule-based, free to run)

No external AI API calls needed — this is rule-based intelligence that runs on your server for zero cost.
```

---

### PROMPT 6 — Drag-and-Drop Pipeline + Auto Stage Rules (Frontend: Next.js)

```
You are working on Eskoolia School ERP. The Active Admission Pipelines section shows inquiry cards in stages.
Currently the stages are static — cards cannot be moved.

TASK: Make the pipeline fully interactive with drag-and-drop and smart auto-rules.

Requirements:

1. Install and use @dnd-kit/core and @dnd-kit/sortable (these are lightweight and tree-shakeable).
   Add to package.json and import correctly in the admissions command center page.

2. Make each stage column a DndKit droppable zone:
   Columns: Inquiry Received | Phone Call | Visit Scheduled | Visited | Enrolled | Declined

3. Make each inquiry card a draggable item.
   When a card is dragged to a new column:
   a. Optimistically update the UI immediately
   b. Call PATCH /api/admissions/{id}/update-stage/ with {stage: "visited"}
   c. If the API call fails, revert the card to its original position and show error toast

4. Stage change rules (enforce on frontend and validate on backend):
   - Cannot move directly from "Inquiry Received" to "Enrolled" (must pass through Contacted, Visited)
   - Show a warning modal: "Are you sure? This skips the Visit stage." with [Confirm] [Cancel]
   - Moving to "Enrolled" → trigger auto-send "Enrollment Confirmed" WhatsApp template (call /api/admissions/{id}/send-message/ with template_id for enrolled)
   - Moving to "Declined" → show modal: "Reason for declining?" (dropdown: Fee too high, Location, Other school, No response) → save reason to inquiry record

5. Add column headers with count badges: "Visited (4)" — update counts live as cards move

6. Add "Collapse column" toggle on each stage — useful when pipeline is long

7. On mobile (< 768px): replace drag-drop with a "Move to stage" dropdown button on each card
   (DnD is not ergonomic on mobile)

8. Backend: PATCH /api/admissions/{id}/update-stage/ should:
   - Validate the stage transition is allowed
   - Update the stage field
   - Auto-set next_follow_up based on new stage: 
     contacted → +2 days, visited → +3 days, enrolled → null, declined → null
   - Log the stage change in AdmissionActivityLog (inquiry, from_stage, to_stage, changed_by, changed_at)
   - Trigger Celery task to send appropriate WhatsApp template

Show the complete DnD component, the Django API view, and the AdmissionActivityLog model.
```

---

### PROMPT 7 — Parent Self-Service Portal (Full Stack)

```
You are working on Eskoolia School ERP.

TASK: Build a lightweight parent-facing inquiry status portal so parents can check their own status, upload documents, and book a visit — reducing inbound "what's the status?" calls by ~70%.

Backend (Django):

1. When an inquiry is created, generate a unique token (UUID) and store it on the inquiry: portal_token (UUIDField, default=uuid.uuid4)

2. API endpoints (no auth required — token in URL acts as auth):
   GET /api/parent-portal/{token}/ → returns:
     {parent_name, child_name, grade, status, stage_label, next_follow_up, school_name, school_phone, school_email}
     Do NOT expose internal fields: assigned_to, score, internal notes
   
   POST /api/parent-portal/{token}/book-visit/ → body: {preferred_date, preferred_time_slot: morning|afternoon}
     → creates a VisitBooking record, auto-notifies assigned counsellor via email

   POST /api/parent-portal/{token}/upload-document/ → body: multipart/form-data {doc_type, file}
     → stores document linked to inquiry, notifies admin

3. Auto-send portal link in the "Thank You for Inquiry" WhatsApp template:
   Append: "\n\nTrack your admission status anytime: {school_domain}/parent-portal/{portal_token}"

Frontend (Next.js — new route: /parent-portal/[token]/page.tsx):

4. Simple, mobile-first page (parents open this on their phone):
   - School logo + school name at top
   - Greeting: "Hello {parent_name} 👋"
   - Status card: stage shown as progress steps (Inquiry → Contacted → Visit Scheduled → Enrolled)
     Current stage highlighted in blue
   - Next step card: "Your next step: Our counsellor will call you by {next_follow_up_date}"
   - "Book a School Visit" section: date picker + morning/afternoon slot → submit → "Visit request sent! We'll confirm shortly."
   - Document Upload section: "Upload Birth Certificate / Previous Marksheet / Transfer Certificate" — drag-drop or file picker
   - Contact card: school phone + WhatsApp link

5. This page requires NO login — just the token in the URL.
   Add rate limiting on the API: max 20 requests per token per hour.

6. Show "Page not found" if token is invalid or inquiry is enrolled/declined (no need to show post-decision).

This page should feel welcoming, not like an admin tool. Use clean cards, emojis sparingly, and mobile-first layout. Match the school's blue/white theme.
```

---

### PROMPT 8 — Bulk Campaign Sender + Scheduled Broadcasts (Full Stack)

```
You are working on Eskoolia School ERP.

TASK: Add a bulk messaging tool to the admissions page so the admin can send WhatsApp/SMS campaigns to filtered inquiry lists — with scheduling support.

Backend (Django):

1. Create a BulkCampaign model:
   - name, template (FK to CommunicationTemplate), channel, filters (JSONField), 
   - scheduled_at (DateTimeField, nullable — if null, send immediately)
   - status (pending/running/completed/failed), sent_count, failed_count
   - created_by (FK User), created_at

2. API:
   POST /api/admissions/campaigns/create/ → body:
     {name, template_id, channel, scheduled_at (optional), filters: {grade, source, stage, assigned_to}}
     → creates campaign, triggers immediately or schedules via Celery beat
   GET /api/admissions/campaigns/ → list all campaigns with status
   GET /api/admissions/campaigns/{id}/report/ → sent_count, failed_count, delivery_rate

3. Campaign execution Celery task:
   - Fetch all inquiries matching filters (excluding enrolled, declined, lost)
   - For each inquiry, render template with inquiry variables
   - Send via WhatsApp/SMS API
   - Log each send in AdmissionCommunicationLog
   - Update campaign sent_count + failed_count in real time
   - On completion, email campaign report to created_by

Frontend (Next.js):

4. Add "Bulk Message" button to the admissions command center top bar (next to "New Admission" button)

5. Clicking opens a modal with 3 steps:
   Step 1 — Audience Filter:
     - Grade (multi-select)
     - Source (multi-select)
     - Stage (multi-select)
     - Assigned To (multi-select)
     - Preview count: "This will reach 23 parents"
   
   Step 2 — Message:
     - Select template (dropdown with preview)
     - Channel: WhatsApp / SMS / Both
     - Option to add custom line at end of template
   
   Step 3 — Schedule:
     - Send Now button
     - Schedule for Later: date + time picker
     - "This campaign will be sent at 9:00 AM on 10 May 2026 to 23 parents"
   
   Confirm → "Campaign queued ✓"

6. Add "Campaigns" tab to the admissions analytics section:
   - Table: Campaign name | Sent | Delivered | Failed | Date | Status
   - Click row → view individual send log

Guardrails: Maximum 500 recipients per campaign. Minimum 6-hour gap between campaigns to same recipient (enforced backend). Add confirmation step showing recipient count before sending.
```

---

## PART 4 — IMPLEMENTATION SEQUENCE

Run these prompts in this order for cleanest integration:

```
Step 1  → PROMPT 1  (Auto Follow-up Engine) — backend foundation
Step 2  → PROMPT 3  (Communication Templates) — needed by all other prompts
Step 3  → PROMPT 2  (Smart Form) — replaces existing form
Step 4  → PROMPT 6  (Drag-Drop Pipeline) — upgrades existing pipeline
Step 5  → PROMPT 5  (Lead Scoring) — depends on stage + communication data
Step 6  → PROMPT 4  (Analytics Dashboard) — reads all data from above
Step 7  → PROMPT 7  (Parent Portal) — standalone, can run anytime
Step 8  → PROMPT 8  (Bulk Campaigns) — builds on communication templates
```

---

## PART 5 — HOW MUCH HUMAN WORK IS ELIMINATED

| Task | Before | After |
|---|---|---|
| Daily follow-up calls | Staff manually checks list every morning | System auto-sends WhatsApp at 9 AM, escalates only if no response |
| Deciding who to call | Mental load — staff remembers | AI Lead Score sorts priority list automatically |
| Sending "thank you" messages | Manual WhatsApp typing | Auto-sent within seconds of inquiry creation |
| Visit reminders | Staff manually sends the day before | Auto-sent 24 hrs before booked date |
| "What's my status?" parent calls | Staff answers 10–15 calls/day | Parent checks self-service portal link |
| Tracking which counsellor did what | Manual spreadsheet or memory | Activity log + counsellor performance board |
| Knowing which grade is filling up | Staff checks count manually | Live capacity meter with auto-alert |
| Campaign broadcast | Manual one-by-one WhatsApp | Bulk campaign tool with scheduling |
| Overdue escalation | Never happens — falls through cracks | Auto-email to admin after 3 days |
| Document collection | Calls/WhatsApp asking for docs | Parent uploads via portal link |

---

*Document prepared for Eskoolia ERP — May 2026*
