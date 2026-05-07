# Eskoolia Admissions — Senior Developer Redesign Prompts v3
## "Make Admin Feel: WOW, I Have Everything Right Here"
**Design Philosophy:** Bloomberg Terminal precision · Linear.app clarity · Stripe confidence · Feels built by a team of 50, not an intern  
**Stack:** Next.js 14 · Tailwind CSS · Framer Motion · Recharts · Existing #1a56db theme  
**Updated:** May 2026

---

## FULL DESIGN AUDIT — What's Wrong Right Now

### Command Center Issues
| Element | Current Problem | Senior Dev Fix |
|---|---|---|
| Grade tiles | Tiny flat boxes, 0% text is meaningless | Circular donut rings with animated fill, seat count inside |
| Alert ticker | Blue bar with bullets — feels like a news crawl | Compact pill row with colored icons, subtle pulse animation on urgent items |
| Pipeline cards | White cards with flat progress bar — generic | Cards with left-colored border per stage, score badge, avatars, hover elevation |
| "Today's Priority" sidebar | Text list with small Call/Log buttons | Priority cards with flame/warm/cold visual, countdown timer to follow-up, one-tap action |
| Conversion Heatmap | Plain number list with colored bars | Mini funnel visual with stage percentages, not just a list |
| Follow-up Calendar | Generic calendar widget | Calendar with colored dots for follow-up types + count badge per day |
| Top action bar | Refresh/Today/Filters/Broadcast/New Admission | Grouped, hierarchy clear — primary action stands out, secondary recede |
| Overall layout | Everything same visual weight | Z-pattern reading hierarchy: urgency top-left, pipeline center, metrics right |

### Analytics Page Issues
| Element | Current Problem | Senior Dev Fix |
|---|---|---|
| KPI cards | White boxes, number + label — no context | Large number, trend arrow, sparkline, benchmark comparison, subtle icon |
| Conversion funnel | Horizontal bars — works but boring | True SVG funnel shape with gradient fills, stage labels inside, animated on load |
| 6-Month Trend | Empty state shows "Not enough data" text | Empty state with illustrated placeholder + "Add 5 more inquiries to unlock trends" |
| Source Performance | Same orange bar for all sources — undifferentiated | Each source has unique color + icon (📱 Instagram, 📞 Phone, 👥 Word of Mouth) |
| Grade Demand | Purple bar chart — no urgency signal | Gauge/meter with red zone when seats < 20%, animated fill |
| Counsellor Leaderboard | Plain HTML table, 0% in red looks punitive | Card-based leaderboard with rank, avatar, sparkline mini-chart, trophy for #1 |
| Page header | Small icon + title + description | Full-width hero with animated live counter and period selector |
| No insight text | No AI-generated observations | "💡 Insight" cards that surface the most important finding from each chart |

### Marketing Page Issues
| Element | Current Problem | Senior Dev Fix |
|---|---|---|
| **Edit button broken** | Click → nothing happens | Fix: missing onClick handler, modal not wired to campaign state |
| Campaign cards | Flat white list items | Rich cards with delivery gauge, mini stat row, status color strip on left |
| Template cards | White boxes with tag badges | Category color headers, preview snippet, usage count, "Send Now" quick action |
| No template preview | Eye icon exists but unclear | Click → full-screen preview modal with rendered template + variables highlighted |
| Stats row (576/94%/12) | Plain numbers, no context | Stat cards with trend vs last campaign, mini bar chart |
| Tab bar (WhatsApp/Email/SMS) | Basic underline tabs | Pill tabs with count badges, WhatsApp tab = green icon |
| Events Manager | Not visible in screenshots (cut off) | Full-featured card grid with RSVP gauge, countdown to event, attendee faces |

### Home Screen Issues (from screenshot 6)
| Element | Current Problem | Fix |
|---|---|---|
| Morning Brief | Dark card — actually good! Keep this | Refine: add subtle gradient, better typography, animated bullet appearance |
| Smart To-Do | Filter tabs feel disconnected | Better visual grouping, colored dots per category |
| Quick Access | Icon grid — generic, all same size | Prioritize most-used, show live data badges (e.g., "Admissions: 3 overdue") |
| Today's Pulse | Attendance donut is good | Add mini trend line below the donut |
| Week Ahead calendar | Small dots with 0/1 — unreadable | Colored event chips per day with truncated title |

---

## REDESIGN PROMPTS

---

### PROMPT A — Command Center: Complete Visual Overhaul

```
You are a senior frontend developer (10+ years) redesigning Eskoolia School ERP's Admissions Command Center at /admissions/command-center.
Tech: Next.js 14, Tailwind CSS, Framer Motion, Recharts. Theme: #1a56db primary, white bg, Inter font.
DO NOT change routing, API calls, or data logic. Only redesign the visual layer.
Install: framer-motion (if not installed). Use CSS animations as fallback where Framer isn't set up.

GOAL: When admin opens this page, they should feel "I have complete control of my admissions process."

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SECTION 1: SMART ALERT TICKER (top bar)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Replace the plain blue info banner with a premium alert pill row:

Layout: horizontal row of 3–4 pill chips, each with a colored left dot and icon.
Design each pill:
- "🔴 3 priority calls due" → red dot, pulse animation (CSS keyframe: opacity 0.5→1→0.5, 2s loop)
- "✨ 2 new inquiries today" → blue dot, no pulse
- "📊 0 enrolled so far" → grey dot (neutral)  
- "🏆 Top source: Instagram" → gold dot, no pulse

Pill styling: bg-white border border-gray-200 rounded-full px-3 py-1 text-sm font-medium shadow-sm
Urgent pill (red): border-red-200 bg-red-50 text-red-700 — dot pulses
Overall row: horizontal scroll on mobile, flex-wrap on desktop
Add smooth fade-in on mount: opacity 0→1 over 300ms, staggered 100ms per pill

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SECTION 2: GRADE CAPACITY RINGS (replace flat tiles)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Replace the flat grade stat boxes with circular donut ring tiles.

Each tile (fixed size 110×110px, 11 tiles from Nursery to Grade 10):
- Center: donut SVG ring (radius 36, stroke-width 6)
  - Background ring: #e5e7eb (gray-200)
  - Fill ring: animated stroke-dashoffset from 0% to actual% on page load (600ms ease-out)
  - Color: green (#22c55e) if >60% full, amber (#f59e0b) if 30–60%, blue (#3b82f6) if <30%, red (#ef4444) if 90%+
- Center text: percent value in bold (font-size 14px), grade name below in gray-500 (font-size 10px)
- Below ring: "{n} inquiries" in gray-400, tiny font
- On hover: scale(1.05) transform + box-shadow elevation (shadow-lg)
- On click: opens filtered pipeline view for that grade

Tile container: horizontal scroll row, gap-3, py-3
Add entrance animation: tiles fade+slide up staggered (each 50ms delay), translateY(12px)→0

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SECTION 3: MAIN LAYOUT — 3 COLUMN REDESIGN
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Current: left sidebar (priority) + center pipeline + right heatmap
New grid: CSS grid, `grid-cols-[280px_1fr_300px]`, gap-5, min-h-[calc(100vh-200px)]

LEFT COLUMN — "Command Sidebar" (280px):
Card 1: "Today's Mission" (replaces Today's Priority)
  - Header: "🎯 Today's Mission" + red badge with count
  - Each priority item: a mini card with:
    * LEFT: colored stage bar (4px wide, full height, color = stage color)
    * Name in font-semibold, grade in text-sm text-gray-500
    * Lead score badge: rounded-full, 🔥 bg-red-100 text-red-700 / 🟡 bg-amber-100 / 🔵 bg-blue-100
    * Time chip: "Overdue 2d" in red-600, or "Due today" in amber-600
    * Action row: [📞 Call] [💬 WA] [📝 Log] — compact icon buttons with tooltip on hover
  - Hover on card: bg-gray-50, translate-x-1, shadow-sm (smooth 150ms transition)
  - Empty state: illustrated "🎉 All caught up!" with confetti-like emoji

Card 2: "Pipeline Stats" (keep, redesign)
  - Title "Pipeline Health" + live green dot indicator ("Live")
  - Stat rows: left label, right value in bold, thin colored progress line below each row
  - Total Inquiries: blue line
  - Follow-up Due: amber line — if > 0, animate a subtle pulse on the number
  - Enrolled: green line

RIGHT COLUMN — "Intel Panel" (300px):
Card 1: "Conversion Intelligence" (replaces Conversion Heatmap)
  - Header with mini bar chart icon
  - Instead of a plain list, show a vertical mini funnel:
    4 stages stacked, each row: [stage label] [colored fill bar — width proportional] [count]
    Bars: blue (inquiry) → teal (contacted) → amber (visited) → green (enrolled)
    Drop-off % shown below each bar in red-400, smaller text
  - Bottom: "Overall: X% convert" in green if >20%, amber if 10–20%, red if <10%

Card 2: "Follow-up Calendar" (redesign)
  - Same calendar grid but: 
    * Days with follow-ups get a small colored dot (red if overdue, blue if due, green if done)
    * Today highlighted with #1a56db background, white text
    * Hover on date: tooltip showing "3 follow-ups — click to view"
    * Click date → filters pipeline to show that day's follow-ups

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SECTION 4: PIPELINE CARDS REDESIGN (center column)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Each inquiry card in the pipeline — completely redesign:

Card shell: bg-white rounded-xl shadow-sm border border-gray-100
  Add: hover → shadow-md + translateY(-1px), transition 150ms ease

TOP ROW: 
  Left: Avatar circle (initials, bg = consistent color per name using hash) + name (font-semibold) + grade pill (rounded-full bg-blue-50 text-blue-700 text-xs px-2)
  Right: Lead score badge (🔥/🟡/🔵 + number) + "Overdue Xd" chip in red if overdue

STAGE PROGRESS BAR:
  Replace plain blue bar with segmented stage indicator:
  4 segments: Contacted · Visited · Enrolled · Declined
  Each segment: rounded pill, filled = stage color, unfilled = gray-100
  Current stage pill has a white dot inside it (like a stepper)
  Height: 6px, full width, rounded ends

MIDDLE ROW:
  Left tags: source tag (📱 Instagram / 📞 Phone Call / 👥 Word of Mouth — icon + text), counsellor chip (avatar initial + name)
  Right: stage badge pill with stage color (Contacted=teal, Visited=amber, Enrolled=green, Inquiry=blue)

BOTTOM ROW — Actions:
  Compact icon+text buttons: 
  [📞 Call] — text-gray-600 hover:text-blue-600 hover:bg-blue-50
  [💬 WA] — text-gray-600 hover:text-green-600 hover:bg-green-50  
  [📄 Docs] — text-gray-600 hover:text-purple-600 hover:bg-purple-50
  [✏️ Edit] — text-gray-600 hover:text-gray-900 hover:bg-gray-100
  [Log Update] → PRIMARY button: bg-blue-600 text-white rounded-lg px-3 py-1.5 text-sm font-medium hover:bg-blue-700

Animate cards on load: staggered fade-in-up, 60ms per card delay

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SECTION 5: PAGE HEADER REDESIGN
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Current: plain title + button row
New:
Left: Title "Admissions Command Center" (text-2xl font-bold text-gray-900) + subtitle "Live · Academic Year 2026–27" with a green pulsing dot before "Live"
Right button group — HIERARCHY:
  Secondary: [Refresh] (icon only, text-gray-400 hover:text-gray-700, border border-gray-200 rounded-lg p-2)
  Secondary: [Today 3] (border rounded-lg, badge inside)  
  Secondary: [Filters] (same)
  Secondary: [📢 Broadcast] (border rounded-lg, slightly blue tint)
  PRIMARY: [+ New Admission] (bg-blue-600, rounded-lg, px-4 py-2, shadow-sm, hover:bg-blue-700, hover:shadow-md transition)

Show complete updated JSX for the entire Command Center page layout. Include all Framer Motion imports and animation variants. Tailwind only — no inline styles except for dynamic colors (use style={{}} only for SVG stroke values).
```

---

### PROMPT B — Analytics Page: From Basic Charts to Data Storytelling

```
You are a senior frontend developer redesigning the Eskoolia School ERP Analytics page at /admissions/analytics.
Tech: Next.js 14, Tailwind CSS, Framer Motion, Recharts. DO NOT change API calls or data logic.

GOAL: Transform this from "basic charts a junior built" to "data storytelling that helps admin make decisions in 30 seconds."
Design references: Stripe dashboard, Linear metrics, Vercel analytics.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SECTION 1: PAGE HERO + FILTER BAR
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
New header design:
Left: Icon (bar chart, blue) + Title "Admissions Analytics" (text-2xl font-bold) + subtitle "Conversion insights and pipeline health"
Right: Period selector — NOT plain buttons.
  Make them a toggle pill group:
  Single parent div: flex rounded-xl bg-gray-100 p-1 gap-1
  Each option: rounded-lg px-4 py-1.5 text-sm cursor-pointer transition
  Active: bg-white text-gray-900 shadow-sm font-medium
  Inactive: text-gray-500 hover:text-gray-700
  Options: This Month · Last 90 Days · This Year · All Time
  
  Animate active indicator: use CSS position relative + absolute background that slides (or Framer Motion layoutId for the active pill)

Right of period: [↻ Refresh icon button] [↓ Export CSV ghost button]
Export dropdown on click: [Export CSV] [Export PDF] [Export Excel] — dropdown with icons

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SECTION 2: KPI CARDS — REDESIGN FROM SCRATCH
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Current: 4 white boxes with number + label
New: 4 cards, each is a rich stat card:

Card structure (each):
- Top row: Icon circle (40px, bg = colored per card) + Trend badge (top-right: "+12% vs last month" in green or "-5%" in red)
- Middle: Large metric number (text-4xl font-bold text-gray-900, animate count-up from 0 on mount using useEffect + requestAnimationFrame)
- Label: text-sm text-gray-500
- Bottom: Sparkline mini chart (80×32px Recharts LineChart, no axes, no tooltip, smooth curve, same color as card icon)
- Bottom text: context line in text-xs text-gray-400 (e.g., "0 contacted" → show in orange if 0, gray otherwise)

Card 1 — Total Inquiries: icon bg-blue-100, icon color blue-600, sparkline blue
Card 2 — Contact Rate: icon bg-teal-100, teal-600, sparkline teal. Show "0 contacted" note.
Card 3 — Visit Rate: icon bg-amber-100, amber-600, sparkline amber
Card 4 — Enrol Rate: icon bg-green-100, green-600, sparkline green. If 0%, note in orange: "0 enrolled — focus on visits"

Animate: cards slide up + fade in, staggered 80ms each

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SECTION 3: CONVERSION FUNNEL — MAKE IT BEAUTIFUL
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Replace the plain horizontal bars with a REAL tapering SVG funnel:

Build FunnelChart component using inline SVG (no library needed):
- 4 stages as trapezoid shapes stacked vertically
- Each trapezoid: wider at top, narrows by drop-off percentage
- Fill colors: Inquiry=#3b82f6, Contacted=#14b8a6, Visited=#f59e0b, Enrolled=#22c55e
- On each trapezoid:
  * Left: stage name in white font-medium
  * Right: count in white font-bold + "XX%" in white text-sm
  * Between stages: drop-off indicator: ▼ "-XX% dropped off" in red-400, centered
- Animate on load: each trapezoid clips in from top to bottom, 150ms staggered

Below funnel: green card "Overall conversion: X% of inquiries enroll"
If X > 25%: green bg + "🏆 Above industry average (25%)"
If X 10-25%: amber bg + "⚡ Room to improve — industry avg is 25%"
If X < 10%: red-50 bg + "⚠️ Below average — focus on contact speed"

RIGHT of funnel (same grid row): 6-Month Trend (Recharts AreaChart):
- Use AreaChart with gradient fill (not plain LineChart)
- Define SVG linearGradient: blue top (opacity 0.3) to transparent bottom
- Two areas: Inquiries (blue fill) + Enrolled (green fill, no area — just Line)
- Smooth curve (type="monotone")
- Custom tooltip: dark bg, rounded-lg, shadow-lg — shows month + values
- Empty state: illustrated card with a line chart icon in gray + "Add 5+ inquiries to see trends" — NOT just text

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SECTION 4: SOURCE PERFORMANCE — ADD COLOR + PERSONALITY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Current: all orange bars, same appearance
New: each source has a unique color and icon:

Source colors and icons (hardcoded lookup):
  Instagram: #E1306C (pink) · 📱
  Facebook: #1877F2 (blue) · 👤
  Word of Mouth: #10b981 (green) · 👥
  Phone Call: #6366f1 (indigo) · 📞
  Google: #ea4335 (red) · 🔍
  Newspaper: #78716c (stone) · 📰
  Other: #9ca3af (gray) · ❓

Each row:
  Icon emoji (20px) + Source name (font-medium) | "X inq · Y enrolled" text-gray-500
  Progress bar: full-width, height 6px, rounded-full, source color, animated width on load
  Below bar: conversion % badge — pill, colored per rate (green if >40%, amber 20–40%, red <20%)

After the list: insight card:
  "🏆 {best_source} converts at {rate}% — your highest performing channel. Consider increasing investment here."
  Green tinted card, font-medium, with a small trophy icon

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SECTION 5: GRADE DEMAND — GAUGES NOT BARS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Replace horizontal bars with a grid of mini gauge cards (3 per row):

Each grade card (mini):
  Top: Grade name pill (e.g., "Grade 10") + count badge
  Center: Semi-circular gauge SVG (like a speedometer, 0–100%):
    Arc from 225° to -45°, stroke-width 8, bg arc = gray-200
    Fill arc: color based on demand (green < 50% full, amber 50-80%, red > 80%)
    Animated: stroke-dashoffset animates from empty to filled on load (700ms ease-out)
    Center text: "X inquiries"
  Bottom: "X seats available" or "FULL — Waitlist" in red

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SECTION 6: COUNSELLOR LEADERBOARD — CARDS NOT TABLE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Replace the plain HTML table with a card-based leaderboard:

Each counsellor gets a card:
  Left: Rank badge — #1 gets gold circle, #2 silver, #3 bronze, rest plain gray number
  Avatar: colored circle with initials (consistent color per name)
  Name (font-semibold) + subtitle "X inquiries assigned"
  Stats row: [Contacted: X] [Enrolled: X] — small gray pills
  Conversion % — large colored number (green if >30%, amber 15-30%, red <15%)
  Mini sparkline: 5-point line showing their weekly conversion trend

#1 card: subtle gold border (border-amber-300) + trophy emoji in corner
"Friendly competition — all performance data is private to admin" disclaimer in text-xs text-gray-400 at bottom

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SECTION 7: INSIGHT CARDS (NEW — doesn't exist yet)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
After the main charts, add a "💡 Key Insights" row — 3 cards generated from the data:

Each insight card:
  Left: colored icon circle (lightbulb, 36px)
  Title: short observation (font-semibold)
  Body: 1–2 sentences of plain English
  CTA link: "→ Take action" that deep-links to relevant page

Example insights (generated from rule logic, not LLM):
  Card 1: "⚡ Response speed matters" — "Leads contacted within 2 hours convert 2.4x better. Your avg is {X} hours." → links to Today's Priority
  Card 2: "📱 Instagram is your best channel" — "{rate}% of Instagram leads convert — focus your campaigns there." → links to Marketing
  Card 3: "🪑 Grade 10 is most demanded" — "2 of 3 inquiries are for Grade 10 with limited seats." → links to Grade filter

Cards: border-l-4 colored left border, bg-gray-50, rounded-xl, padding comfortable

Show complete updated JSX for the entire Analytics page with all components. Use TypeScript. All animations via Framer Motion or CSS. Recharts for area and line charts, inline SVG for funnel and gauges.
```

---

### PROMPT C — Marketing Page: Fix Bugs + Premium Visual Upgrade

```
You are a senior frontend developer fixing and redesigning the Eskoolia Marketing page at /admissions/marketing.
Tech: Next.js 14, Tailwind CSS, Framer Motion. DO NOT change API structure.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
BUG FIX 1 (CRITICAL): Edit Button Not Working
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Find the campaign Edit button. The bug is one of these — check and fix all:
a) The onClick handler is not connected: Add onClick={() => handleEditCampaign(campaign.id)} to the Edit button
b) handleEditCampaign function doesn't exist: Create it. It should: setEditingCampaign(campaign), setEditModalOpen(true)
c) Edit modal exists but isn't rendering: Check conditional rendering, make sure it receives the campaign prop
d) Campaign state is stale: Use functional state update, ensure editingCampaign is set BEFORE modal opens

Create/fix the Edit Campaign modal:
- CampaignEditModal component: receives campaign prop, isOpen, onClose, onSave
- Shows current campaign values pre-filled in all fields
- Fields: Name, Template (dropdown), Channel, Audience filters, Scheduled date/time
- [Cancel] [Save Changes] buttons — Save calls PATCH /api/admissions/campaigns/{id}/ with changed fields
- On save success: close modal, refresh campaign list, show success toast
- Wrap with AnimatePresence + motion.div for smooth open/close (scale 0.95→1, opacity 0→1)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
BUG FIX 2: Template Preview (Eye Icon)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
The eye icon on template cards — fix and enhance:
onClick: open a TemplatePreviewModal showing:
  - Template name + channel badge + trigger type
  - Full rendered body text in a mobile WhatsApp-like bubble (dark green header, white body, WhatsApp font)
  - Variables highlighted: {parent_name} shown as blue pill chips inline in the text
  - [Copy Text] [Use in Campaign] [Edit Template] buttons at bottom
  - For email templates: show as email preview with subject line above

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
VISUAL REDESIGN: Campaign Cards
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Replace the flat white list items with rich campaign cards:

Each campaign card:
  - Left colored status stripe (6px wide, full height): Scheduled=blue, Sent=green, Draft=gray, Running=amber (pulse animation), Failed=red
  - Top row: Campaign name (font-bold text-gray-900) + Status badge pill (colored per status, with icon: ✓ Sent / ⏰ Scheduled / ✏️ Draft / ⚡ Running)
  - Channel + Audience row: WhatsApp icon (green) / Email icon (blue) / SMS icon (purple) + audience description
  - Stats row (for sent campaigns): mini 3-stat bar: "89 parents · 94% delivered · 12 replies" — each stat as a colored chip
  - For scheduled: "Scheduled: 12 May 2026, 9:00 AM · 487 recipients" — countdown: "Sends in 5 days"
  - Hover: shadow-md + scale(1.005), transition 150ms
  - Actions: [Edit] [View Report] for sent, [Edit] [Cancel] for scheduled — clear button hierarchy

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
VISUAL REDESIGN: Stats Bar
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Replace the 3 plain numbers (576 / 94% / 12) with 3 stat cards in a row:
  Card 1: 📨 576 Total Sent — icon bg-blue-100
  Card 2: ✅ 94% Avg Delivery — icon bg-green-100 — "Industry avg: 90%" note below
  Card 3: 💬 12 Total Replies — icon bg-purple-100 — "7.5% reply rate" note below

All 3 cards: animate count-up on mount

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
VISUAL REDESIGN: Message Template Library
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Current: plain white cards with gray tags
New: COLOR-CODED category cards with personality:

Define category colors and styles:
  Welcome/Thank You:  bg gradient top-stripe = blue (#3b82f6). Emoji: 👋
  Follow-up:          stripe = teal (#14b8a6). Emoji: 📞
  Visit:              stripe = amber (#f59e0b). Emoji: 🏫
  Urgency/Seats:      stripe = red (#ef4444). Emoji: 🔥
  Offer/Discount:     stripe = purple (#8b5cf6). Emoji: 🎁
  Enrollment:         stripe = green (#22c55e). Emoji: 🎉
  Re-engagement:      stripe = indigo (#6366f1). Emoji: 💙
  Event:              stripe = pink (#ec4899). Emoji: 🌟

Each template card:
  - Top colored stripe (40px height): gradient from category color to slightly darker, with large emoji (28px) right-aligned inside stripe
  - Card body: bg-white, rounded-b-xl
  - Template name: font-semibold text-gray-900
  - Channel badge: WhatsApp=green pill / Email=blue pill / SMS=gray pill
  - Trigger tag: e.g., "Auto · On form creation" in text-xs text-gray-400 with ⚡ prefix
  - Preview snippet: first 80 chars of template body in text-sm text-gray-500 italic, truncated with "..."
  - Bottom action row: [👁 Preview] [📋 Copy] buttons — appear on hover (opacity 0→1, transition)

Tab bar redesign (WhatsApp / Email / SMS):
  Channel tabs as colored pill toggle group:
  WhatsApp tab: active = bg-green-600 text-white, inactive = text-green-600 border border-green-200
  Email tab: active = bg-blue-600 text-white, inactive = text-blue-600 border border-blue-200
  SMS tab: active = bg-gray-600 text-white, inactive = text-gray-600 border border-gray-200
  Each tab shows count badge in the active pill

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
VISUAL REDESIGN: Events Manager
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Add Events Manager section below templates:

Event cards in a 2-col grid:
  Each card: 
    - Top: event type colored header (Open House=blue gradient, Campus Tour=teal, Info Session=purple) + event emoji (🏫 / 🗺️ / ℹ️)
    - Event name (font-bold white text, inside header)
    - Date/time (white text, smaller)
    - Body: RSVP meter (mini progress bar showing Yes/Maybe/No/Not-responded as stacked bar)
    - Stat chips: "14 RSVPs · 8 confirmed · 3 days away"
    - Countdown chip if event < 7 days away: "⏰ 3 days to go" in amber
    - Actions: [Manage RSVPs] [Send Reminder] [Edit] buttons
  
  [+ New Event] button: dashed border card with + icon, hover fill animation

Show complete JSX for entire Marketing page with all fixes and redesigns. TypeScript. Smooth animations on all interactions.
```

---

### PROMPT D — Global Animation & Design System (Apply Across All Pages)

```
You are a senior frontend developer adding a polished animation and micro-interaction system to Eskoolia School ERP.
Tech: Next.js 14, Tailwind CSS, Framer Motion. Apply to: /admissions/command-center, /admissions/analytics, /admissions/marketing.

GOAL: Make the UI feel alive and premium — not flashy, just responsive and refined. Think Linear, Vercel, Notion.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. CREATE: /lib/animations.ts — shared animation variants
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Export these Framer Motion variants:

export const fadeInUp = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.25, 0.1, 0.25, 1] } }
}

export const staggerContainer = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.06 } }
}

export const scaleIn = {
  hidden: { opacity: 0, scale: 0.92 },
  visible: { opacity: 1, scale: 1, transition: { duration: 0.25, ease: 'easeOut' } }
}

export const slideInRight = {
  hidden: { opacity: 0, x: 32 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.35, ease: [0.25, 0.1, 0.25, 1] } }
}

export const pulse = {
  animate: { opacity: [0.5, 1, 0.5], transition: { duration: 2, repeat: Infinity, ease: 'easeInOut' } }
}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
2. CREATE: useCountUp hook — animated number counters
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
File: /hooks/useCountUp.ts

function useCountUp(target: number, duration: number = 1000): number
- Uses requestAnimationFrame
- Starts counting when element enters viewport (use IntersectionObserver)
- Easing: easeOutQuart
- Returns current count value (integer)
- Works for both integers and percentages (pass isPercent=true to format as "XX%")

Use this on: all KPI card numbers, campaign stats, pipeline counts.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
3. CREATE: Shimmer loading skeletons
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
File: /components/ui/Skeleton.tsx

<Skeleton> component:
  bg-gray-100 rounded animate-pulse
  Add CSS shimmer: background: linear-gradient(90deg, #f3f4f6 0%, #e5e7eb 50%, #f3f4f6 100%), background-size: 200% 100%, animation: shimmer 1.5s infinite

<KPICardSkeleton> — matches KPI card dimensions
<PipelineCardSkeleton> — matches pipeline card
<ChartSkeleton height={200}> — rectangle placeholder for charts

Use these on: initial page load while API data fetches. Replace with real content on data arrival (Framer Motion AnimatePresence for smooth swap).

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
4. INTERACTIVE: Card hover system
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Add to all clickable/hoverable cards consistently:
Tailwind classes: "transition-all duration-150 hover:shadow-md hover:-translate-y-0.5 cursor-pointer"

For action buttons inside cards — add hover color fills:
Call: hover:bg-blue-50 hover:text-blue-700
WhatsApp: hover:bg-green-50 hover:text-green-700
Docs: hover:bg-purple-50 hover:text-purple-700

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
5. ICONS: Add Lucide icons throughout
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Replace all text labels on buttons with Icon + Text combinations:
Import from 'lucide-react':
  Phone → PhoneCall icon (18px, strokeWidth 1.5)
  WhatsApp → MessageCircle icon (18px, green)
  Edit → Pencil icon
  Docs → FileText icon  
  Log → ClipboardList icon
  Refresh → RefreshCw icon (add spin animation on click: rotate 360° in 600ms)
  New Admission → Plus icon
  Analytics → BarChart2 icon
  Marketing → Megaphone icon
  Export → Download icon
  Calendar → CalendarDays icon

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
6. TYPOGRAPHY: Improve font hierarchy
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Apply consistently across all admin pages:
  Page title: text-2xl font-bold tracking-tight text-gray-900
  Section heading: text-base font-semibold text-gray-800
  Card label: text-sm font-medium text-gray-600
  Meta/helper text: text-xs text-gray-400
  Stats numbers: text-3xl font-bold tabular-nums text-gray-900
  Status/badge text: text-xs font-semibold uppercase tracking-wide

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
7. TOAST NOTIFICATIONS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Create/upgrade the toast system:
  File: /components/ui/Toast.tsx
  
  Success toast: green left border, ✅ icon, slide in from top-right, auto-dismiss 4s
  Error toast: red left border, ❌ icon, stays until dismissed
  Info toast: blue left border, ℹ️ icon, auto-dismiss 3s
  
  Animation: Framer Motion, slide in from right (x: 100%→0), fade out on dismiss
  Position: fixed top-4 right-4, z-50, max-width 360px
  Stack: multiple toasts stack vertically with 8px gap

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
8. EMPTY STATES — Make them helpful, not depressing
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Current: "Not enough data for trend chart." plain text
Replace ALL empty states with:
  <EmptyState icon={<BarChart2 className="text-gray-300" size={48}/>}
    title="Trends unlock after 5 inquiries"  
    description="Keep adding inquiries — your conversion trend will appear here automatically."
    action={<Button variant="primary" onClick={...}>Add New Inquiry</Button>}
  />
  
  Tailwind: flex-col items-center justify-center py-16 text-center
  Icon: large, gray-300
  Title: text-base font-medium text-gray-500 mt-4
  Description: text-sm text-gray-400 mt-1 max-w-xs
  Action button: mt-6

Show complete /lib/animations.ts, /hooks/useCountUp.ts, /components/ui/Skeleton.tsx, /components/ui/Toast.tsx, /components/ui/EmptyState.tsx with all code.
```

---

### PROMPT E — Home Screen Notification Widget: Premium Redesign

```
You are a senior frontend developer upgrading the Eskoolia School ERP home screen at /home.
Looking at the current design: it has Today's Pulse sidebar, Quick Access, Recently Visited, All Modules grid, and a right panel with Morning Brief + Smart To-Do + Week Ahead.

GOAL: Make the home screen the admin's "mission control" — they land here and know exactly what needs attention in 10 seconds.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
KEEP AS-IS (these work well):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- Morning Brief dark card (top-right) — keep but polish typography
- Smart To-Do section
- Week Ahead calendar
- Today's Pulse structure
- Quick Access pinned grid

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
UPGRADE 1: Morning Brief card — polish
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Current: dark card with bullet points
Enhancements:
  - Add subtle gradient: bg: linear-gradient(135deg, #1e293b 0%, #0f172a 100%)
  - Header: "✨ MORNING BRIEF" label in text-xs tracking-widest text-blue-400 uppercase + time in text-xs text-gray-400
  - Heading "School running smoothly..." → text-lg font-semibold text-white, tighter line height
  - Each bullet: animate in with staggered fade (100ms per item) on page load
  - Color-code bullets: 🔴 for problems (attendance missed), 🟢 for good (fees collected), 🟡 for warnings (exam approaching), 🔵 for info (sick bay)
  - "Generated by AI" footer → style as text-xs text-gray-500 italic + subtle spark emoji
  - Add a [↻ Regenerate] icon button top-right: spins on click, re-fetches brief

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
UPGRADE 2: Admissions Alert Widget (NEW — inject into right panel)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Add below Morning Brief in the right panel:

Component: <AdmissionsAlertWidget />
Design:
  Card: bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden
  Header: "🔔 Admissions" (font-semibold text-gray-800) + badge count (red circle if urgent > 0) + [View All →] link text-blue-600

  Alert items: each is a slim row with colored left bar:
    🚨 Urgent: left bar = red (#ef4444), bg-red-50 on hover
    ⚡ Today: left bar = amber (#f59e0b), bg-amber-50 on hover
    ✅ Done: left bar = green (#22c55e), no hover

  Each row: 
    Left: colored bar (3px) + icon (16px) + message text (text-sm text-gray-700)
    Right: action button (text-xs text-blue-600 font-medium "→ View") on hover only

  Max 4 items shown, [+ 2 more] expandable if more exist

  Empty state: "🎉 All caught up on admissions!" bg-green-50, green text

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
UPGRADE 3: Quick Access cards — live data badges
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Quick Access tiles (the pinned items) — add live data badges:
  "Student Attendance" → show "92.4% today" badge (green if >90%, amber if 75-90%, red if <75%)
  "Admission Query" → show "3 overdue" badge in red if any overdue, else "2 active" in blue
  "Fees Collection" → show "₹2.14L today" in green
  "Live Bus Tracking" → show "All 4 buses on route" in green / "1 delayed" in amber

Badge: absolute top-1 right-1, rounded-full, text-xs font-medium, colored bg + text
Animate: badge appears with scaleIn on page load after 400ms delay (after initial content settles)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
UPGRADE 4: Sick Bay widget — minor polish
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
The sick bay widget already works well. Minor polish:
  - "Contacted ▶" button: change to pill with green bg for contacted, amber for in care
  - Add student photo placeholder (colored initial circle, 32px) for each student
  - Subtle red left border on "In care" cards
  - Add subtle blinking red dot on "SICK BAY" header label if count > 0

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
UPGRADE 5: Week Ahead calendar — richer events
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Current: tiny dots with 0/1 numbers
New:
  Each day column: date number at top (today = blue circle bg)
  Below: colored event chips (truncated title, max 2 visible, "+1 more" overflow)
  Colors: Academic=blue, Ops=orange, Comms=purple, Personal=gray
  Empty day: light gray bg for the cell
  Click day → opens Day Organiser for that date (navigate to /organiser/day?date=...)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
UPGRADE 6: "Good morning" greeting — micro-animation
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
"Good morning" heading:
  - Animate in: Framer Motion, fade+slide up, duration 0.4s
  - After 1 second, add a subtle wave emoji 👋 that appears with scaleIn
  - Date: text-sm text-gray-500, appears 200ms after title

Show complete JSX updates for /home page component: AdmissionsAlertWidget, updated Morning Brief, Quick Access with badges, Sick Bay polish, Week Ahead calendar. TypeScript + Tailwind + Framer Motion.
```

---

### PROMPT F — Navigation & Sub-Tab Bar Redesign

```
You are a senior frontend developer upgrading the Eskoolia ERP admissions sub-navigation.
Current: plain text tabs "Admissions | Command Center | Inquiry List | Analytics | Marketing"
These look like default browser tabs — no visual identity.

GOAL: Tab bar that feels like a proper product navigation.

Redesign the admissions sub-tab bar:
  Container: border-b border-gray-200 bg-white, sticky top at the module header height
  Tabs: flex gap-1 px-4 (NOT gap-0 which makes them crowded)
  
  Each tab:
    py-3 px-4 text-sm font-medium border-b-2 transition-colors duration-150
    Active: border-blue-600 text-blue-600
    Inactive: border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300
    
    Add icon before each tab label:
      Admissions: <LayoutDashboard size={15}/>
      Command Center: <Zap size={15}/> (lightning — indicates live/active)
      Inquiry List: <List size={15}/>
      Analytics: <BarChart2 size={15}/>
      Marketing: <Megaphone size={15}/>

    Add badge on tabs where relevant:
      Command Center: show follow-up-due count in red circle if > 0
      Analytics: no badge
      Marketing: show scheduled campaign count in blue circle if > 0

  Active indicator: animated bottom border (not just CSS — use Framer Motion layoutId="tab-indicator" shared layout animation that slides between active tabs)

  On mobile (<768px): horizontally scrollable tab row, no wrapping

Show updated sub-tab navigation component with Framer Motion shared layout animation for the active indicator.
```

---

## IMPLEMENTATION ORDER

```
Step 1 → PROMPT D  (animation system — foundation for everything)
Step 2 → PROMPT F  (navigation redesign — instant visual upgrade, quick win)
Step 3 → PROMPT C  (marketing page — fix Edit bug immediately, then visual)
Step 4 → PROMPT A  (command center — biggest impact page)
Step 5 → PROMPT B  (analytics — most complex charts)
Step 6 → PROMPT E  (home screen — polish after core pages done)
```

---

## DESIGN PRINCIPLES SUMMARY (print and stick to monitor)

```
1. HIERARCHY — Not everything is the same size. Make one thing BIG per section.
2. COLOR WITH PURPOSE — Every color must mean something. Red=urgent, Green=good, Amber=warning, Blue=info/primary.
3. WHITESPACE — Add 4px more padding than you think you need. Always.
4. ANIMATE ONCE — Load animations run once. Hover animations are subtle. Nothing loops except status indicators.
5. EMPTY STATES ARE UX — Never show just text for empty. Always: icon + message + action.
6. NUMBERS FIRST — KPI numbers should be the largest thing in their container.
7. ONE PRIMARY ACTION — Each card/section has exactly one primary button. Everything else is secondary.
8. LIVE = GREEN DOT — Anything real-time gets a pulsing green dot. Users love knowing it's live.
9. MOBILE THINK — If you're using display:flex, check what happens at 768px. Tables become cards.
10. PROGRESSIVE DISCLOSURE — Show the most important thing. Let user click to see more. Never dump everything at once.
```

---

*Eskoolia ERP — Senior Developer Redesign Prompts v3 — May 2026*
*6 Prompts · Complete visual overhaul · Fix Edit bug · Animation system*
