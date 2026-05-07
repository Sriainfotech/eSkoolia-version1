# Eskoolia Admissions — Complete 10x Improvement Plan v2
**Goal:** End-to-end automation · Zero mental load · AI-assisted selling · Full marketing control  
**Stack:** Next.js · Django/Python · Existing Eskoolia blue/white theme  
**Updated:** May 2026 — Expanded with Analytics Page, Marketing Page, Improved Form, AI Guidance, Templates, Organiser, Notifications

---

## MASTER FEATURE MAP (13 Modules, 16 Copilot Prompts)

| # | Module | Page/Location | Reduces |
|---|---|---|---|
| 1 | Improved Admission Form (child details + AI tips) | Admissions → New Inquiry | Data gaps, counsellor guesswork |
| 2 | Auto Follow-up Engine | Background / Celery | Daily manual follow-up calls |
| 3 | Drag-Drop Pipeline | Admissions Command Center | Manual stage updating |
| 4 | Communication Templates (professional + personal) | All admission pages | Writing messages from scratch |
| 5 | **Analytics Page** | /admissions/analytics | Not knowing what's working |
| 6 | **Marketing Campaign Page** | /admissions/marketing | Manual campaign execution |
| 7 | AI Lead Scoring | Command Center sidebar | Deciding who to call first |
| 8 | Parent Self-Service Portal | /parent-portal/[token] | Inbound "status" calls |
| 9 | **Day Organiser** | Home screen widget + /organiser/day | Forgetting today's tasks |
| 10 | **Week Organiser** | /organiser/week | Poor weekly planning |
| 11 | **Home Screen Notification Widget** | /dashboard (main ERP home) | Missing urgent alerts |
| 12 | Bulk Campaign Sender | Marketing page | Manual WhatsApp blasting |
| 13 | Seat Capacity Meter | Command Center top bar | Over/under-enrolment surprises |

---

## PART 1 — IMPROVED ADMISSION FORM (Full Field Audit)

### Current Form Problems
| Field | Issue | Fix |
|---|---|---|
| Full Name | Unclear — parent or child? | Split into Parent Name + Child Name (two separate fields) |
| No child name field | Missing — most critical data point | Add: Child's Full Name, DOB, Gender |
| No previous school | Missing | Add: Current/Previous School Name |
| Class Applying For | Present | Keep, add seat availability pill below |
| No sibling field | Missing | Add: "Does child have a sibling already enrolled?" toggle |
| Source/Reference | Present but flat | Add sub-field logic — if Word of Mouth, show "Referred by (name)" |
| Assigned To | Free text | Replace with staff dropdown fetched from API |
| No visit preference | Missing | Add: Preferred Visit Date + Time slot picker |
| No priority signal | Missing | After form save, show AI Conversion Tip panel |
| Query Date | Present | Auto-set to today, read-only |
| Next Follow-up | Present | Auto-set to today+2, editable |
| Description | Present | Keep — rename to "Parent's Message / Notes" |
| Note Internal | Present | Keep — label clearly "Internal note (not visible to parent)" |

### New Complete Field List (3-Step Wizard)
```
STEP 1 — PARENT / GUARDIAN
─────────────────────────────────────────────
• Parent / Guardian Full Name  [required]
• Relationship to Child        [Father | Mother | Guardian | Other]
• Mobile Number                [required, +91, 10 digit, WhatsApp-check icon]
• Alternate Number             [optional]
• Email Address                [optional, validates format]
• Home Area / Locality         [optional — helps with transport planning]

STEP 2 — CHILD DETAILS
─────────────────────────────────────────────
• Child's Full Name            [required]
• Date of Birth                [required, date picker]
• Gender                       [Boy | Girl | Prefer not to say]
• Grade Applying For           [dropdown — show seat availability pill instantly]
• Academic Year                [auto-filled: 2026–27]
• Current / Previous School    [optional text]
• Any special needs / support  [optional checkbox: Learning Support, Physical Accessibility, Other]
• Sibling already enrolled?    [Yes / No toggle]
  └─ If Yes: Sibling's Name + Class [auto-complete from student DB]
     → System auto-applies sibling discount preview

STEP 3 — PREFERENCES & ASSIGNMENT
─────────────────────────────────────────────
• How did you hear about us?   [Word of Mouth | Instagram | Facebook | Google | 
                                Newspaper | Banner/Hoarding | Phone Enquiry | Other]
  └─ If Word of Mouth: "Referred by (name)" text field
• Preferred Visit Date         [date picker, min = tomorrow]
• Preferred Visit Time         [Morning 9–11 AM | Afternoon 1–3 PM | Flexible]
• Parent's Message / Notes     [textarea, shown to parent in portal]
• Internal Note                [textarea, NOT shown to parent]
• Assigned Counsellor          [staff dropdown, default = current user]
• Query Date                   [auto = today, read-only]
• Next Follow-up Date          [auto = today+2, editable]
• Status                       [Active — pre-set, read-only on creation]

─────────────────────────────────────────────
ON SAVE → AI CONVERSION TIP PANEL appears (see Module below)
```

### AI Conversion Tip Panel (Post-Save)
After saving the inquiry, show a non-blocking slide-in card:

```
🤖 AI Insight for this inquiry

"Kavya's family came via Instagram. Our data shows Instagram leads 
 convert best when contacted within 2 hours. Grade 5 has only 4 seats left.
 
 Suggested first message:
 'Hi [Parent Name], thank you for your inquiry! We'd love to show you 
  around — Grade 5 has limited seats this year. Can we schedule a visit 
  this week? 😊 — [Counsellor Name], [School Name]'
 
 ⚡ Best next action: Call within 2 hours · Send WhatsApp template · 
    Book visit for [Preferred Date]"

[Send WhatsApp Now]  [Schedule Call]  [Dismiss]
```

---

## PART 2 — ANALYTICS PAGE (/admissions/analytics)

### Page Layout
```
┌─────────────────────────────────────────────────────────────────────┐
│  📊 Admissions Analytics          [This Month ▾]  [Export CSV PDF]  │
├───────────────┬─────────────┬─────────────┬───────────────────────┤
│ 45 Inquiries  │ 84% Contact │ 49% Visit   │ 31% Enrol             │
│ ↑12 vs last   │ rate        │ rate        │ rate ↑3%              │
├───────────────┴─────────────┴─────────────┴───────────────────────┤
│  CONVERSION FUNNEL (visual horizontal funnel with drop-off %)      │
│  Inquiry ──► Contacted ──► Visited ──► Enrolled                    │
│  45         38 (-16%)     22 (-42%)   14 (-36%)                   │
├──────────────────────────────┬─────────────────────────────────────┤
│  SOURCE PERFORMANCE          │  GRADE DEMAND                       │
│  Bar chart: inquiries +      │  Horizontal bars: Grade vs seats    │
│  conversion per source       │  filled + pipeline + available      │
├──────────────────────────────┼─────────────────────────────────────┤
│  MONTHLY TREND (line chart)  │  COUNSELLOR LEADERBOARD             │
│  Inquiries + Enrolments      │  Name | Inquiries | Converted | %   │
│  last 6 months               │  Ramya: 18 | 10 | 56% 🏆           │
├──────────────────────────────┴─────────────────────────────────────┤
│  RESPONSE TIME ANALYSIS                                            │
│  Avg time to first contact: 4.2 hrs  |  Best: 0.5 hrs | Worst: 3d │
│  "Fast response (<2 hrs) converts at 2.4x the rate of slow response"│
├─────────────────────────────────────────────────────────────────────┤
│  DROPOUT REASONS (pie chart)                                       │
│  Fee too high 40% | Other school 28% | Location 18% | No response  │
└─────────────────────────────────────────────────────────────────────┘
```

### Charts & KPIs to Build
1. **Conversion Funnel** — Horizontal funnel, each stage bar = % of total inquiries, drop-off between stages in red
2. **Monthly Trend Line** — 6-month line chart: Inquiries (blue) + Enrolments (green) — spot seasonality
3. **Source Performance Bar** — Grouped bar: inquiries vs enrolled per source. Best source badge.
4. **Grade Demand Meter** — Horizontal progress bars per grade (enrolled/total), colour-coded
5. **Avg Response Time Gauge** — Shows avg hours to first contact. Target: <2 hrs. Industry benchmark shown.
6. **Counsellor Leaderboard** — Table: name, inquiries handled, converted, %, avg response time
7. **Dropout Reason Pie** — Only for declined inquiries. Shows why families didn't enrol.
8. **Day-of-Week Heatmap** — Grid: Mon–Sun × time slots, colour = number of inquiries received. Tells you when to run ads.

### Export Options
- **CSV** — raw data table of all inquiries in period
- **PDF** — formatted analytics report with all charts (for principal/management)
- **Excel** — pivot-ready data with source, stage, grade, counsellor breakdown

---

## PART 3 — MARKETING CAMPAIGN PAGE (/admissions/marketing)

### Why This Page Exists
School admissions marketing is time-critical. October–March is peak season in India. This page lets the admin plan, execute, and measure all campaigns from one place — without touching WhatsApp manually or hiring a separate marketing team.

### Page Layout
```
┌─────────────────────────────────────────────────────────────────────┐
│  📣 Admissions Marketing           [+ New Campaign]  [+ New Event]  │
├────────────────────┬────────────────────────────────────────────────┤
│  CAMPAIGN CALENDAR │  ACTIVE CAMPAIGNS                              │
│  (Month view)      │  ┌─ Open House — 15 May ────────────────────┐  │
│  [May 2026]        │  │ Audience: All active inquiries Grade 1-5  │  │
│  ● Open House      │  │ Channel: WhatsApp + Email                 │  │
│  ● Seat Alert      │  │ Scheduled: 12 May 9 AM → 487 parents      │  │
│  ● Sibling Drive   │  │ Status: ● Scheduled    [Edit] [Cancel]    │  │
│                    │  └───────────────────────────────────────────┘  │
│                    │  ┌─ Grade 5 Seat Alert ──────────────────────┐  │
│                    │  │ Sent: 3 May · 89 parents · 94% delivered  │  │
│                    │  │ Replies: 12 · Visit bookings from this: 4 │  │
│                    │  └───────────────────────────────────────────┘  │
├────────────────────┴────────────────────────────────────────────────┤
│  CAMPAIGN PERFORMANCE                                               │
│  Total Sent: 1,240 | Delivered: 1,187 (96%) | Replies: 89 (7.5%)  │
│  Visit bookings from campaigns: 31 | Enrolments attributed: 11     │
├─────────────────────────────────────────────────────────────────────┤
│  MESSAGE TEMPLATES LIBRARY        [+ New Template] [Import]        │
│  [Tab: WhatsApp] [Tab: SMS] [Tab: Email]                           │
│  ● Thank You for Inquiry         ● Visit Reminder                  │
│  ● Seat Filling Fast             ● Open House Invite               │
│  ● Sibling Discount Offer        ● Re-engagement (Cold Leads)      │
│  ● Enrollment Confirmed          ● Fee Reminder                    │
├─────────────────────────────────────────────────────────────────────┤
│  EVENTS MANAGER                   [+ New Event]                    │
│  Open House — 15 May 2026         [Manage RSVPs] [Send Reminder]   │
│  Campus Tour — 22 May 2026        [Manage RSVPs] [Send Reminder]   │
└─────────────────────────────────────────────────────────────────────┘
```

### Campaign Types to Support
| Campaign Type | Trigger | Audience | Channel |
|---|---|---|---|
| Open House Invite | Manual (event created) | All active inquiries, opted-in past students | WhatsApp + Email |
| Seat Filling Fast | Auto (grade >80% full) | All inquiries for that grade | WhatsApp |
| Re-engagement | Auto (cold lead >10 days) | All cold-scored inquiries | WhatsApp + SMS |
| Sibling Drive | Manual (Dec–Feb each year) | All enrolled families | WhatsApp |
| Fee Offer / Scholarship | Manual | Selected grade inquiries | Email + WhatsApp |
| Result Season Push | Manual (board result dates) | Grade 9–10 inquiries | SMS + WhatsApp |
| Referral Ask | Auto (post-enrollment) | Enrolled families | WhatsApp |

### Events Manager Features
- Create Open House / Campus Tour events with date, time, capacity
- Auto-generate RSVP link for parent portal
- Bulk-invite all active inquiries with one click
- RSVP tracking: confirmed / maybe / no response
- Auto-send reminder 24 hrs before event
- Post-event: auto-follow-up to all attendees within 2 hrs

---

## PART 4 — PROFESSIONAL & PERSONALISED MESSAGE TEMPLATES

### Design Principles
- **Warm, not corporate** — use first names, school name, child name
- **Action-oriented** — every message ends with exactly ONE clear next step
- **Short** — WhatsApp messages max 3 sentences on mobile
- **Variables** in {curly_braces} — auto-filled from inquiry record

### Complete Template Library (15 templates)

#### WhatsApp Templates

**T1 — Thank You for Inquiry (auto-sent on form creation)**
```
Hi {parent_name} 👋 Thank you for your interest in {school_name}! 
We've received your inquiry for {child_name}'s admission to {grade}. 
Our team will reach out within 24 hours. In the meantime, you can 
track your inquiry status here: {portal_link}

— {counsellor_name}, {school_name} Admissions
```

**T2 — First Follow-up Call Confirmation**
```
Hi {parent_name}, this is {counsellor_name} from {school_name}. 
I'm reaching out regarding {child_name}'s admission inquiry for {grade}. 
Would you be available for a quick 5-minute call today? 
Please reply with a convenient time 🙏
```

**T3 — Visit Invitation**
```
Hi {parent_name} 😊 We'd love to show you {school_name}! 
{grade} has limited seats this year — a campus visit will help 
{child_name} see why families love us. 
Can you visit on {preferred_visit_date}? Reply YES to confirm ✅
```

**T4 — Visit Reminder (auto-sent 24 hrs before)**
```
Hi {parent_name}, just a reminder — {child_name}'s school visit 
at {school_name} is tomorrow ({visit_date}) at {visit_time}. 
Please use the main entrance. Looking forward to meeting you! 🏫
— {school_name} Team
```

**T5 — Post-Visit Thank You**
```
Hi {parent_name}, it was wonderful meeting you and {child_name} today! 
We hope you loved the campus. If you have any questions, 
I'm here to help: {counsellor_phone}
To complete {child_name}'s enrollment: {portal_link} 🎒
```

**T6 — Seat Filling Fast (urgency)**
```
Hi {parent_name}, a quick update — {grade} at {school_name} 
has only {seats_left} seats remaining for 2026-27. 
We'd hate for {child_name} to miss out! 
Should we reserve a spot? Reply YES and I'll guide you 🙏
— {counsellor_name}
```

**T7 — Re-engagement (cold lead, 10+ days)**
```
Hi {parent_name} 👋 We noticed {child_name}'s admission inquiry 
is still open at {school_name}. We completely understand 
if you're still deciding — we're happy to answer any questions.
Would a quick campus visit help? {portal_link}
```

**T8 — Sibling Discount Offer**
```
Hi {parent_name} 🎉 Since {sibling_name} is already part of the 
{school_name} family, {child_name} is eligible for our 
{sibling_discount}% sibling discount for {grade} admission. 
This offer is valid till {offer_expiry}. Shall we proceed? 
Call us: {school_phone}
```

**T9 — Enrollment Confirmed**
```
🎊 Congratulations {parent_name}! {child_name} is officially 
enrolled at {school_name} for {grade}, Academic Year 2026-27. 
Welcome to our school family! 
Please visit the office to submit documents. See you soon! 📚
```

**T10 — Open House Invite**
```
Hi {parent_name} 🏫 You're invited to {school_name}'s Open House 
on {event_date} at {event_time}! Meet our teachers, tour the 
campus, and see why 95% of visiting families choose us. 
RSVP here: {rsvp_link} — Limited seats. Bring {child_name}! 🌟
```

#### Email Templates

**T11 — Detailed Inquiry Acknowledgment (Email)**
```
Subject: Your admission inquiry for {child_name} — {school_name}

Dear {parent_name},

Thank you for your interest in {school_name}! We've received your 
admission inquiry for {child_name} applying to {grade} for the 
2026-27 academic year.

Here's what happens next:
1. Our counsellor {counsellor_name} will call you within 24 hours
2. We'll invite you for a campus visit — the best way to experience our school
3. We'll guide you through the enrollment process step by step

Track your inquiry status anytime: {portal_link}

Any questions? Reply to this email or call {school_phone}.

Warm regards,
{counsellor_name}
{school_name} Admissions Team
```

**T12 — Visit Booking Confirmation (Email)**
```
Subject: Your campus visit is confirmed — {school_name}

Dear {parent_name},

Great news! Your campus visit for {child_name} has been confirmed:
📅 Date: {visit_date}
⏰ Time: {visit_time}
📍 Venue: {school_address}
👤 Your counsellor: {counsellor_name} ({counsellor_phone})

Please arrive 5 minutes early. Parking is available at the main gate.

What to bring: Any school records or transfer certificate (optional)

Looking forward to meeting you!

Warm regards,
{school_name} Admissions Team
```

**T13 — Monthly Newsletter to Inquiry List**
```
Subject: Updates from {school_name} — {month_year}

Dear {parent_name},

Here's a quick update for families considering {school_name}:

🏆 This month's highlights:
• [Achievement 1 — e.g., "Our students won the District Science Fair"]
• [Achievement 2]
• [Achievement 3]

📅 Upcoming:
• Open House: {event_date}
• Admission deadline for {grade}: {deadline_date}

💺 Seats remaining in {grade}: {seats_left}

Questions? Reply to this email or call {school_phone}.

{school_name} Admissions Team | {school_website}
[Unsubscribe]
```

**T14 — Post-Decline Save Attempt**
```
Subject: We understand — and we're here if you change your mind

Dear {parent_name},

Thank you for considering {school_name} for {child_name}.
We understand you've chosen a different path for now, 
and we completely respect your decision.

If circumstances change or you'd like to reconsider, 
we'd be honoured to welcome {child_name} to our school family. 
Our doors are always open.

Wishing {child_name} all the very best 🌟

Warm regards,
{school_name} Admissions Team
```

**T15 — Referral Ask (post-enrollment)**
```
Subject: Could you help another family find the right school?

Dear {parent_name},

It's been wonderful having {child_name} at {school_name}!

We'd love to welcome more great families like yours. 
If you know of any families looking for a school, 
please share our details — we offer a referral benefit for you: 
{referral_benefit}.

Simply ask them to mention your name when they enquire!

With gratitude,
{school_name} Team
```

---

## PART 5 — DAY ORGANISER (/organiser/day)

### What It Does
A single-screen daily command centre for counsellors. Replaces checking multiple tabs, WhatsApp, and sticky notes. Opens at login or from a "My Day" widget on the home screen.

### Layout
```
┌──────────────────────────────────────────────────────────────────┐
│  📅 My Day — Wednesday, 6 May 2026      [← Yesterday] [Tomorrow→]│
├─────────────────────────┬────────────────────────────────────────┤
│  TODAY'S PRIORITIES (6) │  MY SCHEDULE                          │
│  ─────────────────────  │  09:00 ─ Call Kavya's parent ☎        │
│  🔥 Kavya (Grade 5)     │  10:30 ─ Campus visit: Rina's family  │
│  Score 82 · Overdue 2d  │  12:00 ─ Lunch                        │
│  [Call] [WhatsApp] [Log]│  14:00 ─ Open House prep meeting      │
│                         │  15:30 ─ Call Ravi · last attempt     │
│  🟡 Rina (Grade 10)     │  ────────────────────────────────────  │
│  Score 61 · Visit today │  + Add task                           │
│  [Prepare visit notes]  │                                        │
│                         │  MESSAGES TO SEND TODAY (3)           │
│  🔵 Ravi (Grade 10)     │  ● T3 Visit Invite → Priya (Grade 2) │
│  Score 34 · Cold        │  ● T4 Visit Reminder → Arvind (Gr 1) │
│  [Send re-engage msg]   │  ● T6 Seat Alert → Grade 5 leads (8) │
│                         │  [Send All] or send individually       │
├─────────────────────────┼────────────────────────────────────────┤
│  TODAY'S STATS           │  QUICK ACTIONS                        │
│  Calls made: 2/6        │  [+ New Inquiry]                      │
│  Messages sent: 4       │  [Log a Call]                         │
│  Visits: 1 scheduled    │  [Book a Visit]                       │
│  Enrollments today: 0   │  [Send Bulk Message]                  │
└─────────────────────────┴────────────────────────────────────────┘
```

### Auto-Generated Daily Task List (Zero Manual Entry)
The system builds this list automatically every morning at 8:00 AM:
- All inquiries where `next_follow_up = today`
- All visits scheduled for today
- All messages that need to be sent (overdue templates)
- Any escalations from the previous day
- Sorted by lead score (hot first)

Counsellor opens the app → sees exactly what to do → executes → day done.

---

## PART 6 — WEEK ORGANISER (/organiser/week)

### What It Does
A weekly view that helps counsellors and admissions head plan the week ahead — not just react to today. Also useful for the principal to review admission momentum.

### Layout
```
┌───────────────────────────────────────────────────────────────┐
│  📆 Week of 6–10 May 2026         [← Prev] [Next →]  [Print] │
├────────┬──────┬──────┬──────┬──────┬──────┬──────────────────┤
│        │ Mon  │ Tue  │ Wed  │ Thu  │ Fri  │ WEEK SUMMARY      │
│        │  6   │  7   │  8   │  9   │ 10   │ ─────────────────│
│ Calls  │  4   │  3   │  6   │  -   │  -   │ Target: 20 calls │
│ Visits │  1   │  0   │  1   │  -   │  -   │ Booked: 5        │
│ Msgs   │  8   │  5   │  4   │  -   │  -   │ Overdue: 3       │
│ Enrols │  0   │  1   │  0   │  -   │  -   │ Enrolled: 1      │
├────────┴──────┴──────┴──────┴──────┴──────┤                  │
│  UPCOMING ACTIONS THIS WEEK               │ HOT LEADS (5)    │
│  Thu 9: 3 follow-ups overdue by 4d ⚠️     │ Kavya 82 🔥      │
│  Fri 10: Open House — 14 RSVPs confirmed  │ Mehta 74 🔥      │
│  Fri 10: Grade 5 fully booked after today │ Rina 61 🟡       │
│                                           │ Sharma 58 🟡     │
├───────────────────────────────────────────┤ Ravi 34 🔵       │
│  WEEKLY GOALS (set by admin)              │                  │
│  ✅ Inquiries target: 15   → Current: 12  │ [View All]       │
│  ⬜ Visits target: 8      → Current: 5   │                  │
│  ⬜ Enrollments target: 3 → Current: 1   │                  │
└───────────────────────────────────────────┴──────────────────┘
```

### Auto Alerts in Week View
- "3 inquiries haven't been contacted in 7+ days — act before they go cold"
- "Open House this Friday — only 2 of your 6 leads have been invited"
- "Grade 1 is 95% full — pause Grade 1 campaigns or create waitlist"

---

## PART 7 — HOME SCREEN NOTIFICATION WIDGET

### Location
Main ERP dashboard (`/dashboard`) — top-right or dedicated widget panel visible to all roles (filtered by role).

### Widget Design
```
┌─────────────────────────────────────────────────────────────┐
│  🔔 Admissions Alerts                     [View All]  [×]   │
├─────────────────────────────────────────────────────────────┤
│  🚨 URGENT (2)                                              │
│  • Kavya's inquiry is 2 days overdue — last contact 4 days  │
│    ago. [Call Now] [Send WhatsApp]                           │
│  • Grade 5 is 90% full. Consider pausing new campaigns.     │
│    [View Grade 5] [Pause Campaign]                           │
├─────────────────────────────────────────────────────────────┤
│  ⚡ TODAY (4)                                                │
│  • 3 follow-ups due today — [Open Day Organiser]            │
│  • Rina's campus visit is at 10:30 AM — [View Details]      │
│  • Open House this Friday — 14 RSVPs confirmed              │
│  • Bulk campaign "Seat Alert" scheduled for 9 AM            │
├─────────────────────────────────────────────────────────────┤
│  📊 THIS WEEK (snapshot)                                    │
│  Inquiries: 12 | Visits: 5 | Enrolled: 1 | Conversion: 31% │
└─────────────────────────────────────────────────────────────┘
```

### Notification Rules (Auto-generated, no manual input needed)
| Trigger | Alert Type | Who Sees It |
|---|---|---|
| Follow-up overdue >1 day | ⚡ Today | Assigned counsellor |
| Follow-up overdue >3 days | 🚨 Urgent | Counsellor + Admin |
| Grade >90% full | 🚨 Urgent | Admin + Principal |
| New inquiry received | 🔔 Info | Assigned counsellor |
| Visit confirmed by parent | ⚡ Today | Assigned counsellor |
| Campaign sent successfully | ✅ Done | Campaign creator |
| New RSVP for event | 🔔 Info | Event organiser |
| Enrollment completed | 🎉 Celebrate | Admin + Counsellor |
| Cold lead gone 10 days with no contact | ⚡ Today | Assigned counsellor |

### Widget Behaviour
- Refreshes every 5 minutes (or on page focus)
- Click any alert → navigates directly to that inquiry/campaign/event
- Urgent alerts also trigger in-browser push notification (with user permission)
- Counsellors only see their own leads; admin sees all
- Can be collapsed/expanded; position is user-customisable

---

## PART 8 — FIVE ADDITIONAL STEPS (Steps 9–13)

### Step 9 — Waitlist Manager
When a grade is full:
- Inquiries automatically move to "Waitlist" stage
- Parents receive: "Grade 5 is currently full. {child_name} has been added to the waitlist. You'll be notified immediately if a seat opens."
- When a seat opens (enrollment cancelled), the #1 waitlisted family gets auto-WhatsApp within 5 minutes
- Admin sees waitlist count on grade capacity meter

### Step 10 — Document Checklist per Inquiry
Each inquiry gets a document checklist:
- Birth Certificate ☐
- Transfer Certificate ☐  
- Previous Year Report Card ☐
- Passport Photo (2 copies) ☐
- Aadhar Card (Parent) ☐
- Address Proof ☐

Parent uploads via portal link. Admin sees % complete on inquiry card.
Auto-reminder sent: "Your documents are 60% complete. Please upload: Transfer Certificate, Aadhar Card" — sent every 3 days until complete.

### Step 11 — Open House / Event RSVP Tracker
- Create events with capacity limits
- Send invites to filtered inquiry lists in one click
- Track: invited / RSVP Yes / RSVP Maybe / RSVP No / Attended / Not Attended
- Auto follow-up 2 hrs after event to all attendees: "It was great meeting you! Here's the next step..."
- Analytics: event → visit → enrollment conversion rate

### Step 12 — Admission Goal Tracker (for Principal/Admin)
- Set yearly enrollment goals per grade in settings
- Dashboard shows progress: "Grade 5: 28/40 enrolled (70% of annual target)"
- Projected enrollment by March based on current pipeline
- Alert when a grade is trending below target with 60 days to go

### Step 13 — Post-Enrollment Onboarding Checklist
When enrollment is confirmed, auto-trigger an onboarding flow:
1. Send welcome WhatsApp + email with school app download link
2. Share school calendar, uniform list, supply list
3. Assign to class teacher (link to academics module)
4. Schedule "First Day" reminder for parent 2 days before school starts
5. Auto-create student profile in Students module (pre-fill from inquiry data — zero re-entry)

---

## PART 9 — ALL COPILOT PROMPTS (16 Total)

---

### PROMPT 1 — Improved Multi-Step Admission Form (Frontend: Next.js)

```
You are working on Eskoolia School ERP — a Next.js 14 app.
Theme: #1a56db primary blue, white backgrounds, Inter font, Tailwind CSS.
Existing UI components are in /components/ui (Button, Input, Select, DatePicker, Textarea, Toggle).
The current "New Admission Inquiry" is a flat right-side panel. Replace it entirely.

TASK: Build a production-ready, 3-step multi-step admission form as a right-side slide-over panel.

STEP 1 — Parent / Guardian Info:
Fields: Parent Full Name (required, min 3 chars), Relationship (dropdown: Father/Mother/Guardian/Other), Mobile (required, +91 prefix auto-applied, 10-digit live validation, show WhatsApp icon when valid), Alternate Number (optional), Email (optional, real-time format check), Home Area/Locality (optional text)

STEP 2 — Child Details:
Fields: Child Full Name (required), Date of Birth (required, date picker, age auto-calculated and shown: "Age: 5 years 3 months"), Gender (radio: Boy/Girl/Prefer not to say), Grade Applying For (dropdown — on select, call GET /api/admissions/grade-capacity/{grade}/ and show pill: "4 seats available" green / "2 seats left" orange / "Full — Waitlist" red), Academic Year (auto-filled: 2026–27, read-only), Current/Previous School (optional text), Special Needs toggle (if Yes: show checkbox list: Learning Support / Physical Accessibility / Other), Sibling Enrolled toggle (if Yes: show autocomplete field "Sibling's Name" that searches /api/students/search/?q={query} and shows matching students; on select, show: "Sibling discount: 10% — ₹2,400 saved" in a green card)

STEP 3 — Preferences & Assignment:
Fields: How did you hear about us? (dropdown: Word of Mouth/Instagram/Facebook/Google/Newspaper/Banner/Phone Enquiry/Other — if Word of Mouth: show "Referred by (name)" text input), Preferred Visit Date (date picker, min = tomorrow), Preferred Visit Time (radio: Morning 9–11 AM / Afternoon 1–3 PM / Flexible), Parent's Message (textarea, label: "Parent's Message / Notes"), Internal Note (textarea, label: "Internal Note — not visible to parent", show lock icon), Assigned Counsellor (dropdown fetched from GET /api/staff/?role=counsellor), Query Date (auto = today, read-only), Next Follow-up (date picker, default = today+2)

Form Behaviour:
- Progress bar at top: 3 labelled steps with % fill
- Back/Next buttons; Step 3 shows "Save Inquiry" button
- On blur validation: red border + inline error below field + role="alert" aria attribute
- Auto-save draft to sessionStorage every 20 seconds; show "Draft saved at 10:42 AM" indicator
- Duplicate detection: when mobile number is entered in Step 1, call GET /api/admissions/check-duplicate/?phone={phone}. If match: show yellow banner "A family with this number already has an inquiry. Sibling? [Yes, link records] [No, create separately]"
- On "Save Inquiry" button click: POST /api/admissions/inquiry/create/ with all form data. On success: close panel, show green toast "Inquiry saved! Auto follow-up scheduled for {next_follow_up_date}", then immediately show AI Conversion Tip side-card (described below)

AI Conversion Tip Card (post-save, non-blocking):
Call GET /api/admissions/{new_id}/ai-tip/ which returns: {tip_text, suggested_template_id, urgency_label, best_action}
Display as a slide-in card at bottom-right with: tip text, a pre-filled WhatsApp message (from template), [Send WhatsApp Now] button, [Schedule Call] button, [Dismiss] button
Auto-dismiss after 30 seconds if not interacted with.

Write complete TypeScript component using Tailwind only. No new libraries. Handle all loading and error states.
```

---

### PROMPT 2 — AI Conversion Tip Engine (Backend: Django)

```
You are working on Eskoolia School ERP (Django 4.x + DRF).

TASK: Build a rule-based AI Conversion Tip engine that gives counsellors specific, actionable guidance immediately after a new inquiry is saved.

1. Create endpoint: GET /api/admissions/{id}/ai-tip/
   Returns a tip object:
   {
     "tip_text": string,          // 2–3 sentence human-readable insight
     "urgency_label": string,     // "Act within 2 hours" | "Today" | "This week"
     "suggested_actions": [       // ordered list
       {"action": "call", "label": "Call now", "detail": "Best time: before 12 PM"},
       {"action": "whatsapp", "template_id": 3, "label": "Send visit invite"},
       {"action": "book_visit", "label": "Book visit for preferred date"}
     ],
     "pre_filled_message": string // rendered WhatsApp template T3 with inquiry vars
   }

2. Logic rules for tip_text (rule-based, no LLM required):
   - Source == Instagram OR Facebook → "Instagram/Facebook leads convert 2.4x better when contacted within 2 hours. {child_name}'s family is most likely browsing multiple schools right now."
   - Source == Word of Mouth → "Word of Mouth is your highest-converting source (avg 52%). {child_name}'s family was referred — they already trust you. Move fast to confirm the visit."
   - Grade seats < 5 → Append: "Only {seats_left} seats left in {grade} — mention this to create urgency."
   - Sibling enrolled → "Sibling discount detected. Lead this with the sibling offer — families with siblings convert at 78%."
   - Preferred visit date is set → "Parent already picked a visit date — 80% of families who visit enroll. Confirm it immediately."
   - No preferred date → "Suggest a specific date — open-ended invites reduce visit conversions by 40%."

3. urgency_label rules:
   - Source in [Instagram, Facebook, Google] OR seats < 5 → "Act within 2 hours"
   - Source in [Word of Mouth, Referral] → "Today"
   - All others → "This week"

4. suggested_actions order:
   - If urgency = "Act within 2 hours" → [call, whatsapp_T3, book_visit]
   - If sibling detected → [whatsapp_T8_sibling_offer, call, book_visit]
   - If preferred date set → [book_visit, whatsapp_T4_confirmation, call]
   - Default → [whatsapp_T1_thankyou, call, book_visit]

5. pre_filled_message: render the highest-priority template substituting all {variables} from the inquiry record.

Show full Django view, URL config, and all helper functions. Add unit tests for each tip rule.
```

---

### PROMPT 3 — Analytics Page (Full Stack)

```
You are working on Eskoolia School ERP (Next.js 14 frontend + Django backend).
Add a new page at /admissions/analytics as a tab in the Admissions nav ("Analytics" tab, chart icon).

BACKEND (Django):

Add these 5 analytics endpoints to the admissions app:

GET /api/admissions/analytics/summary/?period=month|quarter|year
Returns: {total_inquiries, contacted_count, visited_count, enrolled_count, contact_rate, visit_rate, enrol_rate, vs_last_period: {inquiries_delta, enrolled_delta}}

GET /api/admissions/analytics/funnel/?period=...
Returns: [{stage, count, percent_of_total, drop_off_percent}] for all stages

GET /api/admissions/analytics/monthly-trend/?months=6
Returns: [{month: "Jan 2026", inquiries: 32, enrolled: 9}] for last N months

GET /api/admissions/analytics/sources/?period=...
Returns: [{source, inquiries, enrolled, conversion_rate, trend: "up|down|stable"}]

GET /api/admissions/analytics/counsellor-performance/?period=...
Returns: [{counsellor_name, inquiries_assigned, contacted, enrolled, conversion_rate, avg_first_response_hours}]

GET /api/admissions/analytics/dropout-reasons/
Returns: [{reason, count, percent}] for all declined inquiries

GET /api/admissions/analytics/day-heatmap/
Returns: [{day_of_week: 0-6, hour: 0-23, inquiry_count}] for last 90 days

GET /api/admissions/analytics/response-time/
Returns: {avg_hours, median_hours, under_2hr_percent, over_24hr_percent, best_counsellor, worst_counsellor}

All endpoints support ?grade= filter to scope to one grade.

FRONTEND (Next.js):

Build /admissions/analytics page with:

1. Filter bar: [This Month | Last Month | This Quarter | This Year | Custom] + [All Grades | Grade dropdown]
   All charts respond to this filter via query params on the APIs.

2. KPI Row (4 cards):
   Inquiries count | Contact Rate % | Visit Rate % | Enrol Rate %
   Each shows delta vs previous period (green arrow up / red arrow down)

3. Conversion Funnel (Recharts BarChart horizontal):
   Each stage = one bar, width proportional to % of total
   Drop-off % shown in red between bars
   Click a bar → opens a modal listing all inquiries at that stage (filtered pipeline view)

4. Monthly Trend (Recharts LineChart):
   Two lines: Inquiries (blue) + Enrolled (green)
   X-axis: last 6 months. Hover tooltip shows values.

5. Source Performance Table:
   Columns: Source | Inquiries | Enrolled | Conversion % | Trend (up/down arrow)
   Sorted by Conversion % desc. Best row has green left border. Worst has red.
   Below table: callout card "🏆 {best_source} is your best channel this month ({rate}% conversion)"

6. Avg Response Time Gauge:
   Large number: avg hours to first contact
   Sub-text: "Industry benchmark: <2 hrs converts 2.4x better"
   Colour: green if <2 hrs, yellow 2–8 hrs, red >8 hrs

7. Counsellor Leaderboard (table):
   Columns: Counsellor | Assigned | Contacted | Enrolled | Rate % | Avg Response
   Best row gets 🏆 badge. Friendly framing — "Top performers this month"

8. Dropout Reason Pie Chart (Recharts PieChart):
   Only for declined inquiries. Click slice → shows list of those inquiries.

9. Day/Time Heatmap:
   7×24 grid (days × hours). Cell colour = inquiry count.
   Label: "Most inquiries arrive on {best_day} between {best_time_range}"

10. Export buttons:
    [Export CSV] → download all inquiry data in current filter period
    [Export PDF] → call server-side PDF generation endpoint, download report
    [Export Excel] → download pivot-ready Excel with source, stage, grade breakdown

Use Recharts (already in project). Show loading skeletons while fetching. All charts empty-state gracefully.
Write complete page component, API calls, and loading/error states in TypeScript.
```

---

### PROMPT 4 — Marketing Campaign Page (Full Stack)

```
You are working on Eskoolia School ERP. 
Add a new page at /admissions/marketing as a tab in Admissions nav ("Marketing" tab, megaphone icon).

BACKEND (Django):

1. Models (add to admissions app):
   Campaign: name, campaign_type (choices: open_house_invite/seat_alert/re_engagement/sibling_drive/fee_offer/custom), template FK, channel (whatsapp/sms/email/all), audience_filters (JSONField), scheduled_at (nullable DateTimeField), status (draft/scheduled/running/completed/failed), sent_count, delivered_count, reply_count, visit_bookings_from_campaign, enrollments_attributed, created_by, created_at

   Event: name, event_type (open_house/campus_tour/info_session), date, time, capacity, venue, description, rsvp_link_token (UUID auto-generated)
   EventRSVP: event FK, inquiry FK, status (invited/yes/maybe/no/attended/no_show), responded_at

2. Audience filter logic for campaigns:
   filters JSON supports: grade[], source[], stage[], assigned_to[], lead_score_min, lead_score_max, days_since_inquiry_min, days_since_inquiry_max
   Endpoint: POST /api/admissions/campaigns/preview-audience/ → returns {count, sample_names: [first 5]}

3. Campaign API:
   POST /api/admissions/campaigns/create/
   GET /api/admissions/campaigns/ (paginated, with status filter)
   GET /api/admissions/campaigns/{id}/report/
   DELETE /api/admissions/campaigns/{id}/ (only if draft/scheduled, not running/completed)
   POST /api/admissions/campaigns/{id}/cancel/ (if scheduled)

4. Event API:
   POST /api/admissions/events/create/
   GET /api/admissions/events/
   POST /api/admissions/events/{id}/invite-all/ → sends invite to all active inquiries (or filtered)
   GET /api/admissions/events/{id}/rsvps/
   POST /api/admissions/events/{id}/send-reminder/ → sends reminder to all RSVP Yes/Maybe
   POST /api/admissions/events/{id}/mark-attended/?inquiry_id=X
   GET /api/parent-portal/rsvp/{token}/?response=yes|no|maybe → public RSVP endpoint

5. Auto-campaigns (Celery tasks):
   - Daily: check if any grade is >80% full → create+send "Seat Filling Fast" campaign draft, notify admin to approve before sending (don't auto-send)
   - Daily: find inquiries with lead_score <40 and days_since_inquiry >10 → create re-engagement campaign draft, notify admin
   - Post-event (2 hrs after event.date): send T5 post-visit follow-up to all "attended" RSVPs

FRONTEND (Next.js):

Build /admissions/marketing page with 4 sections:

Section 1 — Campaign List + Calendar:
Left: Month calendar view with campaign dots on scheduled dates (click date → show campaigns)
Right: Campaign cards — name, status badge, audience count, channel icons, scheduled date, [View Report]/[Edit]/[Cancel] buttons
[+ New Campaign] button at top right

Section 2 — New Campaign Modal (3-step wizard):
Step 1 Audience: multi-select filters (grade, source, stage, assigned_to, lead score range, days since inquiry). Live preview: "This campaign will reach 34 parents" (calls /preview-audience/ on filter change)
Step 2 Message: template dropdown with preview (renders template with sample vars), channel selector (WhatsApp/SMS/Email/All), custom footer text field
Step 3 Schedule: "Send Now" vs "Schedule" (date+time picker). Summary: "Sending to 34 parents via WhatsApp on 10 May at 9:00 AM". [Confirm Campaign] button. Guardrails shown: "Max 500 recipients. Min 6hr gap enforced."

Section 3 — Template Library:
Tabs: WhatsApp | SMS | Email
Template cards: name, channel icon, trigger type, preview of first 100 chars, [Edit] [Use in Campaign] [Preview Full]
[+ New Template] opens editor modal with: name, channel, trigger, subject (email), body (with variable chips you can click to insert: {parent_name} {child_name} {grade} etc.), character count for SMS, [Send Test to Myself] button

Section 4 — Events Manager:
Event cards: name, date/time, RSVP count (Yes/Maybe/No), capacity fill bar, [Manage RSVPs] [Send Reminder] [Edit]
[+ New Event] form: name, type, date, time, capacity, venue, description
RSVP management modal: table of all invitees with RSVP status, [Mark Attended] buttons, [Export RSVP List] button

Write complete TypeScript pages and components. Match existing Eskoolia blue/white theme.
```

---

### PROMPT 5 — Professional Message Templates Backend (Django)

```
You are working on Eskoolia School ERP (Django).

TASK: Build the complete communication templates system with all 15 professional templates pre-loaded.

1. CommunicationTemplate model (if not already created):
   name, channel (whatsapp/sms/email), trigger (on_inquiry_created/on_visit_scheduled/on_visit_reminder/on_post_visit/on_enrolled/on_declined/on_overdue/manual), subject (email only), body (TextField with {variable} placeholders), is_active (bool), created_at

2. Write a Django data migration (0002_seed_templates.py) that creates all 15 templates as listed in the plan document (T1 through T15). Each template body must use exactly these variable names: {parent_name}, {child_name}, {grade}, {school_name}, {school_phone}, {counsellor_name}, {counsellor_phone}, {portal_link}, {visit_date}, {visit_time}, {seats_left}, {sibling_name}, {sibling_discount}, {offer_expiry}, {rsvp_link}, {event_date}, {event_time}, {referral_benefit}, {month_year}

3. Template rendering function render_template(template_id, inquiry_id):
   - Fetch template and inquiry
   - Build context dict from inquiry + related objects
   - Substitute all {variables} in body and subject
   - Return {subject, body, channel} ready to send
   - Raise clear error if a required variable is missing from context

4. API endpoints:
   GET /api/admissions/templates/ → list all, filterable by channel, trigger, is_active
   POST /api/admissions/templates/ → create new template
   PUT /api/admissions/templates/{id}/ → update (body, name, is_active)
   DELETE /api/admissions/templates/{id}/ → only if no campaigns reference it
   POST /api/admissions/templates/{id}/preview/ → body: {inquiry_id} → returns rendered template with real inquiry data, no sending
   POST /api/admissions/templates/{id}/send-test/ → body: {to_phone, to_email} → sends rendered template to test number

5. Django signal: on AdmissionInquiry save, if stage changes to 'enrolled' → auto-send T9 Enrollment Confirmed. On creation → auto-send T1 Thank You. Use celery task for actual sending to avoid blocking the request.

6. WhatsApp sending: integrate with Meta WhatsApp Cloud API (or Gupshup as fallback).
   Sending function send_whatsapp(to_phone, message_body):
   - POST to https://graph.facebook.com/v18.0/{PHONE_NUMBER_ID}/messages
   - Auth: Bearer {WHATSAPP_TOKEN} (from Django settings)
   - On success: log to AdmissionCommunicationLog (status=sent)
   - On failure: retry once after 60s, then log status=failed + admin email alert

Show all models, migration file, signal code, celery tasks, and API viewset with permissions.
```

---

### PROMPT 6 — Day Organiser (Full Stack)

```
You are working on Eskoolia School ERP (Next.js + Django).

TASK: Build a "My Day" organiser that auto-generates each counsellor's daily action list. No manual task entry required.

BACKEND (Django):

1. Endpoint: GET /api/organiser/day/?date=2026-05-06&user_id=X
   Returns:
   {
     "date": "2026-05-06",
     "counsellor": {name, avatar_initials},
     "priorities": [  // inquiries with follow-up today, sorted by lead_score desc
       {inquiry_id, parent_name, child_name, grade, lead_score, lead_label, stage, days_overdue, suggested_action, suggested_template_id}
     ],
     "scheduled_visits": [  // visits booked for today
       {inquiry_id, parent_name, child_name, grade, visit_time, visit_notes}
     ],
     "messages_to_send": [  // pending auto-send templates
       {inquiry_id, parent_name, template_name, template_id, channel}
     ],
     "todays_stats": {
       "follow_ups_due": 6, "calls_made": 2, "messages_sent": 4, "visits_today": 1, "enrollments_today": 0
     },
     "ai_daily_brief": string  // 2-sentence summary: "You have 6 follow-ups today. Kavya is your hottest lead — call before noon."
   }

2. ai_daily_brief is rule-based (no LLM):
   - If any inquiry with lead_score >70 is overdue → "🔥 {name} is your hottest lead and is overdue — call first."
   - If a visit is scheduled → "📅 You have a campus visit with {name} at {time} — prepare notes."
   - Count follow-ups and messages and summarise: "You have {n} follow-ups and {m} messages to send today."

3. Endpoint: POST /api/organiser/day/log-action/
   Body: {inquiry_id, action_type: call|whatsapp|visit|note, note_text, outcome: reached|no_answer|scheduled_callback}
   → Logs to AdmissionActivityLog, updates follow-up date based on outcome:
   reached → +2 days; no_answer → +1 day (try tomorrow); scheduled_callback → set specific date from body

4. Endpoint: POST /api/organiser/day/send-message-batch/
   Body: {message_ids: []}  // send all pending messages at once
   → Triggers send for each, returns {sent: n, failed: m}

FRONTEND (Next.js — page at /organiser/day):

Build a 2-column layout:

Left column — Priority List:
- "My Day — {date}" heading with yesterday/tomorrow nav arrows
- AI Daily Brief card (blue tinted background, 2 sentences)
- Priority cards (sorted by lead score): each card shows: coloured score badge (🔥/🟡/🔵), parent name + child name + grade, lead score, days overdue in red if >0, stage pill, suggested action chip, [Call] [WhatsApp ▾] [Log] action buttons
  - Call button: tel:{phone} link
  - WhatsApp button: opens dropdown of 3 most relevant templates — one click to send
  - Log button: opens inline log form (outcome radio + note text + next follow-up date)
- "Messages to Send Today" section: list of pending template sends with [Send] per item + [Send All] button at top

Right column — Schedule + Stats:
- Today's Schedule: timeline list (09:00 / 10:30 / etc.) with action items. [+ Add Task] button adds a custom task
- Quick Stats card: calls made / messages sent / visits / enrollments — live updating
- Quick Actions: [+ New Inquiry] [Log a Call] [Book a Visit] [Bulk Message]

Page auto-refreshes priorities every 10 minutes. Show "Live" green dot when connected.
Write complete TypeScript. Match Eskoolia theme.
```

---

### PROMPT 7 — Week Organiser (Full Stack)

```
You are working on Eskoolia School ERP (Next.js + Django).

TASK: Build a weekly planning view at /organiser/week.

BACKEND:
GET /api/organiser/week/?week_start=2026-05-06&user_id=X
Returns:
{
  "week": [{
    "date": "2026-05-06", "day_name": "Wednesday",
    "calls_made": 4, "messages_sent": 8, "visits": 1, "enrollments": 0,
    "follow_ups_due": 6, "overdue_count": 2
  }] × 5 (Mon–Fri),
  "week_summary": {target_calls, actual_calls, target_visits, actual_visits, target_enrollments, actual_enrollments},
  "upcoming_actions": [  // auto-generated alerts for the week
    {"type": "urgent|info", "message": "3 follow-ups overdue by 4+ days", "date": "2026-05-09", "action_url": "/organiser/day?date=2026-05-09"}
  ],
  "hot_leads": [{inquiry_id, name, grade, lead_score, lead_label}],  // top 5 by score
  "weekly_goals": {set by admin in settings}
}

GET /api/organiser/week/goals/?user_id=X → returns current goals
PUT /api/organiser/week/goals/ → admin sets weekly targets per counsellor

FRONTEND (/organiser/week):

Layout:
- Header: "Week of {Mon}–{Fri} {Month Year}" with prev/next week arrows + [Print] button
- 5-column grid (Mon–Fri): each column shows day metrics cards (calls, messages, visits, enrollments). Past days show actual data, future days show planned follow-ups count. Click any day → navigate to /organiser/day?date=that_date
- Right panel: Week Summary (targets vs actuals with progress bars), Upcoming Alerts (colour-coded cards), Hot Leads list (top 5 by score with action buttons)
- Weekly Goals row at bottom: 3 goal bars (calls / visits / enrollments) with % progress. Admin can click "Set Goals" to edit targets.
- Auto-alerts displayed as coloured cards: red = urgent (overdue), yellow = warning (below target), green = on-track, blue = info (upcoming event)

Add this as a tab in /organiser alongside /organiser/day. 
Navigation: top tab bar "📅 My Day | 📆 My Week" above both pages.
```

---

### PROMPT 8 — Home Screen Notification Widget (Full Stack)

```
You are working on Eskoolia School ERP (Next.js + Django).
The main ERP dashboard is at /dashboard. 

TASK: Add a persistent "Admissions Alerts" widget to the home screen dashboard that shows real-time admission priorities and notifications.

BACKEND:
GET /api/notifications/admissions/?user_id=X
Returns:
{
  "urgent": [  // show red — requires immediate action
    {"id", "type": "overdue_followup|grade_full|escalation", "title", "body", "inquiry_id", "action_url", "created_at"}
  ],
  "today": [   // show yellow — should act today
    {"id", "type": "followup_due|visit_scheduled|campaign_sending|new_inquiry", "title", "body", "action_url", "created_at"}
  ],
  "info": [    // show blue — informational
    {"id", "type": "rsvp_received|campaign_done|enrollment_done", "title", "body", "action_url", "created_at"}
  ],
  "week_snapshot": {inquiries, visits, enrolled, conversion_rate}
}

Notification generation rules:
- overdue_followup: next_follow_up < today AND status not in [enrolled, declined, lost] → urgent if >3 days, today if 0–3 days
- grade_full: grade >90% seat fill → urgent
- escalation: next_follow_up < today - 7 days → urgent (also email admin)
- visit_scheduled: visit date == today → today
- campaign_sending: campaign scheduled for today → today
- new_inquiry: created in last 2 hours, not yet contacted → today
- enrollment_done: enrollment completed today → info + 🎉

Endpoint respects role: counsellors see only their inquiries; admin/principal sees all.

POST /api/notifications/{id}/dismiss/ → marks as dismissed (don't show again today)
POST /api/notifications/dismiss-all-today/ → dismisses all "today" and "info" (not urgent)

FRONTEND:

Build AdmissionsAlertWidget component for /dashboard:

Widget structure (collapsible card, default expanded):
- Header: "🔔 Admissions Alerts" + [View All →] link + [×] collapse
- Urgent section (red left border): icon + title + body + action button (e.g., [Call Now] links to tel: / [View] links to inquiry)
- Today section (yellow left border): list of today items with action links
- Info section (blue, collapsed by default): shows count badge, expand to see list
- Bottom bar: week snapshot (4 numbers in a row)

Behaviour:
- Fetches on page load + polls every 5 minutes
- Urgent count shown as badge on the Admissions nav menu item (red circle with number)
- Also show urgent count in browser tab title: "(2) Eskoolia ERP" when urgent alerts exist
- Push notification: if browser Notification API permission granted, show push for new urgent alerts
- Urgent alerts persist until manually dismissed; today/info auto-clear at midnight
- Admin sees all alerts; counsellors see only their own

Widget positioning: top-right of dashboard, can be moved if dashboard is drag-drop customisable. Otherwise always top-right below the main header bar.

Write complete TypeScript widget + polling hook + notification permission request on first load.
```

---

### PROMPT 9 — Auto Follow-Up Engine (Backend: Django + Celery)

```
You are working on Eskoolia School ERP (Django 4.x + Celery + Redis).

TASK: Build a fully automated follow-up engine that runs every morning at 8:00 AM IST — zero manual triggering.

AdmissionInquiry model additions needed:
- last_auto_followup_sent (DateTimeField, null=True)
- portal_token (UUIDField, default=uuid.uuid4, unique=True)
- waitlisted (BooleanField, default=False)

1. Celery task: send_daily_followups() — scheduled daily at 08:00 IST via celery beat:
   Query: next_follow_up <= today AND status not in [enrolled, declined, lost] AND last_auto_followup_sent < 48 hrs ago (or null)
   For each inquiry:
   a. Render and send WhatsApp using the appropriate template (T2 for first contact, T7 for re-engagement if >7 days)
   b. Log to AdmissionCommunicationLog
   c. Set last_auto_followup_sent = now
   d. Set next_follow_up = today + 2 days
   e. If no response to previous message (last_auto_followup_sent was >48 hrs ago and stage unchanged): increment a follow_up_attempts counter

2. Celery task: run_escalations() — scheduled every 6 hours:
   a. next_follow_up < today - 3 days → email to assigned_to: "⚠️ Overdue: {parent_name} ({grade}) — 3+ days without contact"
   b. next_follow_up < today - 7 days → email to all admin users: "🚨 At Risk: {parent_name} — 7+ days. Consider marking lost."
   c. next_follow_up < today - 14 days → auto-update status to 'lost', send final T14 save-attempt email to parent, notify admin

3. Celery task: check_grade_capacity() — scheduled daily at 07:00 IST:
   For each grade, compare enrolled count to total_seats
   >90% full → create urgent notification for admin, pause any running campaigns targeting that grade
   100% full → set waitlisted=True for all new inquiries in that grade, auto-respond with waitlist message

4. Celery task: recalculate_lead_scores() — scheduled every 6 hours:
   For all active inquiries, call calculate_lead_score(inquiry) and update LeadScore record

5. Celery beat schedule config (in settings.py):
   Show complete CELERY_BEAT_SCHEDULE dict with all 4 tasks, correct crontabs in IST (UTC+5:30)

6. celery.py setup, requirements additions, and error handling:
   All tasks must: catch exceptions per-inquiry (don't let one failure stop the batch), log errors with logging module, send admin email on batch failure, return summary dict {processed, sent, failed}

Show complete tasks.py, celery.py config, settings additions, and example test for each task.
```

---

### PROMPT 10 — Drag-Drop Pipeline + Stage Rules (Frontend: Next.js)

```
You are working on Eskoolia School ERP (Next.js 14).
The Active Admission Pipelines view shows inquiry cards in stage columns.

TASK: Add full drag-and-drop with stage rules, activity logging, and auto-triggers.

1. Install: @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities (add to package.json)

2. Stage columns (in order): Inquiry Received → Phone Call → Visit Scheduled → Visited → Enrolled → Declined
   Add a "Waitlisted" column that appears only when at least one inquiry is waitlisted.

3. Each column: header with stage name + count badge + collapse toggle
   Each card shows: lead score badge (🔥/🟡/🔵 + number), parent name, child name, grade, source, days since inquiry, assigned counsellor avatar, action buttons [Call] [WhatsApp ▾] [Log]

4. Drag behaviour:
   - Drag card from one column to another
   - On drop: validate stage transition (see rules below)
   - If valid: optimistic UI update + PATCH /api/admissions/{id}/update-stage/ {stage, changed_by}
   - If API fails: revert card + red error toast "Stage update failed — please try again"
   - If validation fails: revert card + show modal explaining the rule

5. Stage transition rules (enforce on frontend, validate on backend):
   - Cannot jump from "Inquiry Received" directly to "Visited" or "Enrolled" → modal: "Please move to 'Phone Call' first to ensure no steps are missed."
   - Moving to "Enrolled": show confirmation modal with fee amount preview + [Confirm Enrollment] [Cancel] → on confirm: trigger T9 WhatsApp template + create student pre-profile via POST /api/students/pre-enroll/
   - Moving to "Declined": show modal with reason dropdown (Fee too high / Other school chosen / Location / No response / Not eligible / Other) + optional note field → save reason to inquiry record
   - Moving to "Waitlisted": only allowed when grade is 100% full (otherwise show: "Grade still has seats — use standard stages")

6. Auto-actions on stage change (called from backend via signal):
   - → Phone Call: set next_follow_up = today+2
   - → Visit Scheduled: trigger visit confirmation WhatsApp (T3)
   - → Visited: set next_follow_up = today+3, trigger T5 post-visit WhatsApp
   - → Enrolled: trigger T9, set next_follow_up = null, notify admin
   - → Declined: trigger T14 email, log reason, set status = declined

7. Mobile fallback (<768px): hide DnD. Replace with "Move to Stage →" button on each card that opens a bottom sheet with stage options.

8. Backend: PATCH /api/admissions/{id}/update-stage/
   Validates transition, updates stage, logs to AdmissionActivityLog, returns updated inquiry object.
   AdmissionActivityLog model: inquiry FK, from_stage, to_stage, changed_by FK, changed_at, note

Write complete DnD component, validation logic, backend view, and AdmissionActivityLog model.
```

---

### PROMPT 11 — Waitlist Manager (Full Stack)

```
You are working on Eskoolia School ERP (Next.js + Django).

TASK: Build a waitlist system that activates automatically when a grade is full.

BACKEND:
1. When enrolled count for a grade reaches total_seats:
   - All new inquiries for that grade: set waitlisted=True, stage="waitlisted"
   - Auto-send: "Grade {grade} is currently full. {child_name} has been added to the waitlist. You will be notified immediately if a seat opens. — {school_name}"
   - Admin notification: "{grade} is now full. Waitlist activated."

2. When an enrolled student withdraws (enrollment cancelled):
   - Signal: on AdmissionInquiry status → enrolled deleted or on student withdrawal
   - Find next waitlisted inquiry for that grade (ordered by waitlist_position — first come, first served)
   - Auto-send WhatsApp to that family within 5 minutes: "Great news! A seat has opened in {grade} at {school_name}. {child_name} is next on the waitlist. Please call {school_phone} within 48 hours to confirm. — {school_name} Admissions"
   - Create urgent notification for admin: "Seat opened in {grade} — {parent_name} notified. 48hr window to confirm."

3. Waitlist API:
   GET /api/admissions/waitlist/?grade=5 → list all waitlisted inquiries for grade, ordered by position
   POST /api/admissions/waitlist/{id}/move-up/ → swap position with previous
   POST /api/admissions/waitlist/{id}/offer-seat/ → manually offer seat, trigger WhatsApp

4. Auto-expire waitlist offer: if family doesn't respond in 48 hrs after seat offer → move to next on list, send "We're sorry, we couldn't reach you in time. Your child remains on the waitlist." message

FRONTEND:
5. In the pipeline, add "Waitlisted" column (only visible when grade has waitlisted inquiries)
6. In grade capacity meters: show "Waitlist: 3" below "Full" when applicable
7. In analytics: show waitlist count per grade + avg wait time + conversion rate from waitlist
8. Admin can view/manage the waitlist via a modal: see all waitlisted families in order, drag to reorder priority, [Offer Seat] button per row
```

---

### PROMPT 12 — Document Checklist (Full Stack)

```
You are working on Eskoolia School ERP.

TASK: Add a document collection system to each inquiry, with parent upload via portal and admin tracking.

BACKEND:
1. InquiryDocument model: inquiry FK, doc_type (choices: birth_certificate/transfer_certificate/report_card/photo/aadhar_parent/address_proof/other), file (FileField), uploaded_by (choices: admin/parent), uploaded_at, is_verified (bool), verified_by (FK User, null)

2. Standard checklist: [birth_certificate, transfer_certificate, report_card, photo, aadhar_parent, address_proof]
   On inquiry creation, auto-create 6 InquiryDocument records (one per type, file=null, verified=False)

3. API:
   GET /api/admissions/{id}/documents/ → list checklist with completion status, download URLs
   POST /api/admissions/{id}/documents/upload/ → admin uploads a doc (multipart)
   POST /api/parent-portal/{token}/documents/upload/ → parent uploads (no auth, token only, max 5MB, PDF/JPG/PNG only)
   PATCH /api/admissions/{id}/documents/{doc_id}/verify/ → admin marks as verified
   GET /api/admissions/{id}/documents/completion/ → returns {complete: 4, total: 6, percent: 67, missing: ["aadhar_parent", "address_proof"]}

4. Auto-reminder Celery task (runs every 3 days):
   Find all active inquiries where document completion < 100%
   Send WhatsApp: "Hi {parent_name}, your documents are {percent}% complete for {child_name}'s admission. Still needed: {missing_docs_list}. Upload here: {portal_link}"
   Stop once documents are 100% complete.

FRONTEND:
5. On each inquiry card: show document completion ring (e.g., "4/6 docs") — click to expand checklist
6. In inquiry detail view: Document tab with checklist items, upload buttons, verified badges, download links
7. In parent portal: "Documents" section with clear list, file upload (drag-drop or file picker), progress bar
8. In analytics: "Avg document completion at enrollment" KPI
```

---

### PROMPT 13 — Post-Enrollment Onboarding Auto-Flow (Django)

```
You are working on Eskoolia School ERP (Django + Celery).

TASK: When an inquiry moves to "Enrolled", automatically trigger a complete onboarding sequence with zero manual work.

1. Django signal: post_save on AdmissionInquiry where stage changes to 'enrolled':
   Trigger Celery task: run_enrollment_onboarding(inquiry_id)

2. run_enrollment_onboarding(inquiry_id) Celery task:
   Step 1 (immediate): Send T9 WhatsApp + T12 email (enrollment confirmed)
   Step 2 (immediate): Call POST /api/students/create-from-inquiry/ to pre-create student profile
     → copies: child_name, dob, gender, grade, parent_name, phone, email, home_area, sibling_id from inquiry to Student model
     → returns student_id, links inquiry to student (inquiry.student_id = student_id)
   Step 3 (immediate): Send WhatsApp with school app download link + school calendar PDF
   Step 4 (schedule for +1 day): Send "Document checklist" WhatsApp (T_doc_checklist template)
   Step 5 (schedule for school_start_date - 2 days): Send "First day reminder" WhatsApp: "Exciting news — {child_name}'s first day at {school_name} is in 2 days! Here's what to bring..."
   Step 6 (schedule for +7 days): If document completion < 100%: send document reminder

3. POST /api/students/create-from-inquiry/:
   Body: {inquiry_id}
   Creates Student record with status "pre-enrolled" and all available fields from inquiry
   Returns: {student_id, student_url}
   If student already exists (sibling case): link inquiry to existing family record

4. POST /api/organiser/tasks/create/ — create task for assigned counsellor:
   "Call {parent_name} to welcome {child_name} and confirm document submission" due in 2 days

5. Notify principal via email + in-app notification: "🎉 New enrollment: {child_name} — {grade}"

Show complete signal code, Celery task chain, eta scheduling, and /api/students/create-from-inquiry/ view.
```

---

### PROMPT 14 — Admission Goal Tracker (Full Stack)

```
You are working on Eskoolia School ERP.

TASK: Add an Admission Goal Tracker so the principal can set yearly enrollment targets per grade and track progress in real time.

BACKEND:
1. AdmissionGoal model: academic_year, grade, target_inquiries, target_enrolled, created_by, updated_at

2. APIs:
   GET /api/admissions/goals/?year=2026-27 → list goals per grade with actual counts
   PUT /api/admissions/goals/{grade}/?year=2026-27 → set/update targets (admin only)
   GET /api/admissions/goals/projection/?year=2026-27 → ML-lite projection:
     current_rate = enrolled / days_elapsed_in_year
     projected_by_march = current_rate × remaining_days + enrolled
     returns: [{grade, target, current_enrolled, projected_by_march, on_track: bool, delta}]

3. Alert: Celery task monthly:
   If projected_by_march < target × 0.80 → email principal: "⚠️ {grade} is trending 20%+ below target. Currently {enrolled}/{target}. Projected by March: {projected}."

FRONTEND:
4. Add "Goal Tracker" section to /admissions/analytics page:
   Table: Grade | Annual Target | Enrolled | Pipeline | Projected by March | Status
   Status column: 🟢 On Track / 🟡 Slightly Behind / 🔴 At Risk
   Admin can click any "Target" cell to edit inline (PUT to API on blur)
   Bar chart: compare target vs enrolled vs projected across all grades
   Summary card: "Overall: {total_enrolled}/{total_target} — {percent}% of annual goal"
```

---

### PROMPT 15 — Event RSVP Public Page (Frontend: Next.js)

```
You are working on Eskoolia School ERP.

TASK: Build a public RSVP landing page for school events (Open House, Campus Tour, etc.) that parents can open from a WhatsApp link — no login required.

Page route: /events/rsvp/[token]/page.tsx

BACKEND (if not done in Prompt 4):
GET /api/events/rsvp/{token}/ → returns {event_name, event_type, date, time, venue, school_name, school_logo, capacity_remaining, parent_name (from inquiry linked to token), child_name, current_rsvp_status}
POST /api/events/rsvp/{token}/ → body: {response: yes|no|maybe} → updates RSVP, returns confirmation

FRONTEND:
- Mobile-first design (parents open on phone)
- School logo + school name
- Event card: name, date (formatted nicely), time, venue, a Google Maps link for the address
- "You're invited, {parent_name}!" personalised heading
- Current RSVP status shown if already responded
- 3 big buttons: [✅ Yes, we'll be there] [🤔 Maybe] [❌ Cannot attend]
- On YES click: show "🎉 See you on {date}! We've added your visit to our calendar. A reminder will be sent the day before." + calendar add buttons (Google Calendar, Apple Calendar)
- On NO click: show "No worries! We'll keep you posted about future events." + "Know a friend who might be interested? Share this event: [WhatsApp Share]"
- On MAYBE click: show "Understood! We'll send you a reminder — feel free to update your RSVP anytime."
- After RSVP: show: school address map embed, contact number, "Questions? WhatsApp us: {school_whatsapp}"
- Handle invalid/expired token gracefully: "This link has expired or is invalid. Contact {school_phone}."
```

---

### PROMPT 16 — Referral System (Full Stack)

```
You are working on Eskoolia School ERP.

TASK: Build a simple referral tracking system. When an enrolled family refers someone, track who referred who, auto-apply referral benefit, and reward the referring family.

BACKEND:
1. Add to AdmissionInquiry: referred_by_student (FK to Student model, null=True)
   In the admission form Step 3: if Source == "Word of Mouth", show "Referred by enrolled student?" toggle. If Yes: autocomplete field searches /api/students/search/?q=. On select: sets referred_by_student.

2. When referred inquiry is enrolled: create ReferralReward record:
   referring_student, referee_inquiry, benefit_type (fee_discount/gift/recognition), benefit_value, awarded_at, status (pending/awarded)

3. Auto-notify referring family: "🎉 {friend_child_name}'s family has joined {school_name} — thanks to your referral! Your {benefit} will be applied to the next fee cycle."

4. API:
   GET /api/admissions/referrals/ → list all referrals this year with status
   GET /api/admissions/referrals/stats/ → {total_referrals, converted, conversion_rate, referral_enrolled_rate (vs overall)}
   POST /api/admissions/referrals/{id}/award/ → mark reward as awarded

FRONTEND:
5. In Analytics page: "Referral Impact" card: referrals received / enrolled from referrals / referral conversion rate vs overall
6. In Marketing page: "Referral Campaign" button → generates shareable WhatsApp message for current families to forward
7. In inquiry detail: if referred, show "Referred by: [Student Name, Class]" chip
8. In student profile (academic module): "Referrals made: 2 (1 enrolled)" stat
```

---

## PART 10 — IMPLEMENTATION SEQUENCE (Full 16 Steps)

```
Phase 1 — Foundation (Week 1)
  PROMPT 9   → Auto Follow-up Engine (Celery + WhatsApp base)
  PROMPT 5   → Message Templates (needed by everything)
  PROMPT 1   → Improved Admission Form (replaces existing form)
  PROMPT 2   → AI Conversion Tip Engine

Phase 2 — Pipeline & Intelligence (Week 2)
  PROMPT 10  → Drag-Drop Pipeline
  PROMPT 11  → Waitlist Manager
  PROMPT 12  → Document Checklist
  PROMPT 13  → Post-Enrollment Onboarding

Phase 3 — Analytics & Marketing (Week 3)
  PROMPT 3   → Analytics Page (full dashboard)
  PROMPT 4   → Marketing Campaign Page
  PROMPT 14  → Goal Tracker
  PROMPT 15  → Event RSVP Page

Phase 4 — Organiser & Notifications (Week 4)
  PROMPT 6   → Day Organiser
  PROMPT 7   → Week Organiser
  PROMPT 8   → Home Screen Notification Widget
  PROMPT 16  → Referral System
```

---

## PART 11 — HUMAN WORKLOAD REDUCTION SCORECARD

| Daily Task | Before | After | Time Saved |
|---|---|---|---|
| Morning follow-up review | 30 min (check notes/calendar) | 0 — Day Organiser auto-builds | 30 min/day |
| Deciding who to call first | 15 min mental effort | 0 — Lead Score sorts automatically | 15 min/day |
| Sending follow-up WhatsApps | 20 min manual typing | 0 — Auto-sent + 1-click templates | 20 min/day |
| "What's my status?" parent calls | 20 min/day (10 calls × 2 min) | ~4 min — 80% self-serve via portal | 16 min/day |
| Logging calls/visits | 10 min across day | Inline log in Day Organiser — 30 sec each | ~7 min/day |
| Checking which grade is filling | 10 min (manual count) | 0 — Live capacity meter + auto-alert | 10 min/day |
| Writing campaign messages | 45 min per campaign | 0 — Templates + bulk tool | 45 min per campaign |
| Post-enrollment student creation | 15 min re-entering data | 0 — Auto-created from inquiry | 15 min per enrollment |
| Document collection follow-up | 20 min/day (calls/WhatsApps) | 0 — Auto-reminder every 3 days | 20 min/day |
| Weekly reporting to principal | 60 min manual report | 0 — Analytics page + PDF export | 60 min/week |

**Estimated total saved: ~2 hrs/day per counsellor + 1 hr/week admin reporting**

---

*Eskoolia ERP — Admissions Improvement Plan v2 — May 2026*
*16 Copilot Prompts · 13 Modules · 4 Implementation Phases*
