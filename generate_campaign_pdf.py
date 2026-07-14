from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import cm
from reportlab.lib import colors
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    HRFlowable, KeepTogether
)
from reportlab.lib.enums import TA_LEFT, TA_CENTER

OUTPUT = r"C:\Users\srava\Desktop\Eskoolia_SocialMedia_Campaign.pdf"

# --- Colors ---
PURPLE      = colors.HexColor("#6B21A8")
PURPLE_LIGHT= colors.HexColor("#F3E8FF")
DARK        = colors.HexColor("#1E1B4B")
SLATE       = colors.HexColor("#475569")
WHITE       = colors.white
LIGHT_BG    = colors.HexColor("#F8FAFC")
BORDER      = colors.HexColor("#E2E8F0")
ACCENT      = colors.HexColor("#0EA5E9")

doc = SimpleDocTemplate(
    OUTPUT,
    pagesize=A4,
    leftMargin=2*cm, rightMargin=2*cm,
    topMargin=2*cm, bottomMargin=2*cm
)

styles = getSampleStyleSheet()

# Custom styles
def S(name, **kw):
    return ParagraphStyle(name, **kw)

title_style = S("DocTitle",
    fontSize=26, leading=32, textColor=DARK,
    fontName="Helvetica-Bold", alignment=TA_CENTER, spaceAfter=4)

subtitle_style = S("DocSubtitle",
    fontSize=12, leading=16, textColor=SLATE,
    fontName="Helvetica", alignment=TA_CENTER, spaceAfter=20)

section_header = S("SectionHeader",
    fontSize=14, leading=18, textColor=WHITE,
    fontName="Helvetica-Bold", alignment=TA_LEFT,
    spaceBefore=16, spaceAfter=6,
    backColor=PURPLE, borderPadding=(6, 10, 6, 10))

module_title = S("ModuleTitle",
    fontSize=10, leading=14, textColor=DARK,
    fontName="Helvetica-Bold")

body = S("Body",
    fontSize=9, leading=13, textColor=SLATE,
    fontName="Helvetica")

arc_title = S("ArcTitle",
    fontSize=11, leading=15, textColor=PURPLE,
    fontName="Helvetica-Bold", spaceBefore=10, spaceAfter=2)

arc_italic = S("ArcItalic",
    fontSize=9, leading=13, textColor=SLATE,
    fontName="Helvetica-Oblique", spaceAfter=4)

bullet = S("Bullet",
    fontSize=9, leading=14, textColor=SLATE,
    fontName="Helvetica", leftIndent=14, spaceAfter=1)

launch_style = S("Launch",
    fontSize=9, leading=14, textColor=DARK,
    fontName="Helvetica-Bold", spaceAfter=2)

theme_style = S("Theme",
    fontSize=11, leading=16, textColor=DARK,
    fontName="Helvetica-Bold", alignment=TA_CENTER, spaceAfter=4)

theme_sub = S("ThemeSub",
    fontSize=9, leading=13, textColor=SLATE,
    fontName="Helvetica-Oblique", alignment=TA_CENTER, spaceAfter=14)

story = []

# ── Title Block ──────────────────────────────────────────────────────────────
story.append(Spacer(1, 0.3*cm))
story.append(Paragraph("Eskoolia", title_style))
story.append(Paragraph("Social Media Campaign — Live Features & Structure", subtitle_style))
story.append(HRFlowable(width="100%", thickness=2, color=PURPLE, spaceAfter=16))

# ── Helper: module table ──────────────────────────────────────────────────────
def module_table(rows):
    data = [[Paragraph("<b>Module</b>", module_title), Paragraph("<b>Live Features</b>", module_title)]]
    for mod, feats in rows:
        data.append([
            Paragraph(mod, module_title),
            Paragraph(feats, body)
        ])
    t = Table(data, colWidths=[4.2*cm, 12.5*cm])
    t.setStyle(TableStyle([
        ("BACKGROUND",    (0, 0), (-1, 0),  PURPLE_LIGHT),
        ("TEXTCOLOR",     (0, 0), (-1, 0),  PURPLE),
        ("FONTNAME",      (0, 0), (-1, 0),  "Helvetica-Bold"),
        ("FONTSIZE",      (0, 0), (-1, 0),  9),
        ("ROWBACKGROUNDS",(0, 1), (-1, -1), [WHITE, LIGHT_BG]),
        ("GRID",          (0, 0), (-1, -1), 0.4, BORDER),
        ("VALIGN",        (0, 0), (-1, -1), "TOP"),
        ("TOPPADDING",    (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("LEFTPADDING",   (0, 0), (-1, -1), 8),
        ("RIGHTPADDING",  (0, 0), (-1, -1), 8),
    ]))
    return t

# ── SECTION 1: Admin Portal ───────────────────────────────────────────────────
story.append(Paragraph("  Admin Portal", section_header))
story.append(Spacer(1, 0.2*cm))
admin_rows = [
    ("School Setup",
     "School profile, academic year config, classes & sections, departments, designations"),
    ("HR Management",
     "Staff directory, 10-step onboarding wizard, department & designation management, "
     "leave balances, document uploads"),
    ("Student Management",
     "Student enrollment, profiles, guardian linking, documents (Aadhaar, birth cert, medical), "
     "club memberships, group/house assignment, promotion history"),
    ("Attendance",
     "Daily attendance marking, attendance types (Present / Absent / Late / Half-day / Holiday), "
     "per-class reports"),
    ("Fees Management",
     "Fee group & type configuration, per-student fee assignments, payment recording "
     "(cash / bank / online), due fee tracking, append-only ledger audit trail"),
    ("Roles & Permissions",
     "Role creation, tiered module access (None / View / Operate / Manage / Full), "
     "portal-type assignment, login permission control for all portals"),
    ("Academics",
     "Class-subject-teacher assignments, timetable builder, homework creation, "
     "lesson planning, uploaded content (syllabus, study material)"),
    ("Notice Board",
     "Create & publish notices, target parents or all users"),
    ("Communication",
     "1:1 and group chat, holiday calendar"),
]
story.append(module_table(admin_rows))

# ── SECTION 2: Teacher Portal ─────────────────────────────────────────────────
story.append(Spacer(1, 0.4*cm))
story.append(Paragraph("  Teacher Portal", section_header))
story.append(Spacer(1, 0.2*cm))
teacher_rows = [
    ("Dashboard",
     "Today's timetable, class summary, pending items, role-specific widgets"),
    ("My Classes",
     "Class tabs, full student roster with attendance %"),
    ("Attendance",
     "Mark attendance per class/section with 800ms auto-save"),
    ("Timetable",
     "Weekly grid view with KPIs — total periods, teaching days"),
    ("Student Profile",
     "Slide-in drawer: overview, academic marks, attendance, homework, credentials"),
]
story.append(module_table(teacher_rows))

# ── SECTION 3: Parent Portal ──────────────────────────────────────────────────
story.append(Spacer(1, 0.4*cm))
story.append(Paragraph("  Parent Portal", section_header))
story.append(Spacer(1, 0.2*cm))
parent_rows = [
    ("Dashboard",
     "Child summary card, widgets, quick access tiles, notice & fees widgets"),
    ("My Children",
     "Child profile, attendance glance, exam results"),
    ("Attendance",
     "Monthly calendar with day-by-day status, holidays, summary stats"),
    ("Fees",
     "Fee summary (billed / paid / due), grouped fee rows, status badges"),
    ("Notices",
     "Notice board with 'NEW' badge for recent posts"),
]
story.append(module_table(parent_rows))

# ── SECTION 4: Campaign Structure ─────────────────────────────────────────────
story.append(Spacer(1, 0.5*cm))
story.append(Paragraph("  Campaign Structure", section_header))
story.append(Spacer(1, 0.3*cm))
story.append(Paragraph("Theme", theme_style))
story.append(Paragraph('"One School. Three Worlds. Total Clarity."', theme_sub))

arcs = [
    (
        "Arc 1 — Admin / School Management",
        '"Run your entire school from one screen"',
        [
            "School setup in under 5 minutes",
            "HR onboarding — staff profiles, documents, leave balances",
            "Fee collection made transparent — ledger, payment methods, due tracking",
            "Roles & Permissions — precise access control for every staff member",
            "Student records — enrollment to full profile in one place",
        ]
    ),
    (
        "Arc 2 — Teacher Portal",
        '"Your classroom, organized"',
        [
            "See your day at a glance — timetable, today's periods",
            "Mark attendance in seconds — auto-saves, no paperwork",
            "Full student view — marks, attendance, all in one drawer",
            "Know every student before the period starts",
        ]
    ),
    (
        "Arc 3 — Parent Portal",
        '"Always in the loop, wherever you are"',
        [
            "Your child's day on your phone — daily attendance calendar",
            "No fee surprises — billed, paid, and due at a glance",
            "School notices the moment they go out",
            "Full picture in one tap — exam results and attendance together",
        ]
    ),
    (
        "Arc 4 — Platform-level",
        '"Built for Indian schools"',
        [
            "Multi-portal access — same school, tailored for admin / teacher / parent",
            "Permission-driven — school controls who sees what",
            "Works for single schools and school chains",
            "Secure auto-generated logins for students, parents, and staff",
        ]
    ),
]

for arc_name, tagline, posts in arcs:
    block = []
    block.append(Paragraph(arc_name, arc_title))
    block.append(Paragraph(tagline, arc_italic))
    for i, post in enumerate(posts, 1):
        block.append(Paragraph(f"{i}.  {post}", bullet))
    block.append(Spacer(1, 0.2*cm))
    story.append(KeepTogether(block))

# ── Launch Recommendation ──────────────────────────────────────────────────────
story.append(Spacer(1, 0.3*cm))
story.append(HRFlowable(width="100%", thickness=1, color=BORDER, spaceAfter=10))
story.append(Paragraph("Launch Order Recommendation", launch_style))
story.append(Paragraph(
    "Parent Portal  →  Teacher Portal  →  Admin / Management  →  Platform",
    body))
story.append(Spacer(1, 0.1*cm))
story.append(Paragraph(
    "Start with Parent Portal posts for the highest emotional resonance and visual impact, "
    "then build toward platform-level trust posts.",
    body))

# ── Build ──────────────────────────────────────────────────────────────────────
doc.build(story)
print(f"PDF saved to: {OUTPUT}")
