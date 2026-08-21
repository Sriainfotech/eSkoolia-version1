from django.db import migrations

# Unified FAQ topic list — replaces the two disconnected frontend dicts:
# PARENT_FAQ (components/AIBot.tsx) matched raw query substrings, while
# QA_TOPICS (lib/aiBotIntent.ts) classified a topic key that was then
# discarded (AIBot.tsx re-matched the raw query against PARENT_FAQ instead
# of using the classified topic). One topic_key now drives both
# classification (keywords) and the answer.
FAQ_SEED = [
    {
        "topic_key": "fees",
        "keywords": ["fee", "fees due", "fee structure", "payment"],
        "answer": "You can check outstanding fees by going to **Fees → Fees Due**. You can also generate a statement from the Fees Collection page. Fee structure details are under **Fees → Fees Master**. For urgent queries, please contact the accounts office.",
    },
    {
        "topic_key": "attendance",
        "keywords": ["attendance", "present", "absent"],
        "answer": "Your child's attendance can be viewed under **Reports → Student Attendance**. For today's attendance, check with the class teacher or visit the attendance section.",
    },
    {
        "topic_key": "exam-schedule",
        "keywords": ["exam schedule", "when exam", "exam date", "next exam", "exam"],
        "answer": "Upcoming exam schedules are listed under **Examination → Exam Schedule**.",
    },
    {
        "topic_key": "result",
        "keywords": ["result", "marks", "grade"],
        "answer": "Exam results are published under **Examination → Result Publish**. You can also view historical results in **Reports → Exam Result**.",
    },
    {
        "topic_key": "homework",
        "keywords": ["homework"],
        "answer": "Assigned homework is listed under **Academics → Homework List**. Completed homework evaluations are in **Academics → Homework Evaluation**.",
    },
    {
        "topic_key": "school-timing",
        "keywords": ["school timing", "timing", "what time school", "open time", "close time"],
        "answer": "Please visit **Settings → General Settings** for official school timings. You can also contact the school office for the latest schedule.",
    },
    {
        "topic_key": "holidays",
        "keywords": ["holiday", "school closed", "off day", "vacation"],
        "answer": "Holiday lists are published under **Academics → Class Routine**. Please check the school notice board or contact administration for updates.",
    },
    {
        "topic_key": "transport-route",
        "keywords": ["transport", "bus route", "which bus", "route"],
        "answer": "Bus routes and vehicle assignments are in **Transport → Routes** and **Transport → Assign Vehicles**. For live bus tracking, visit **Transport → Live Tracking**.",
    },
    {
        "topic_key": "library",
        "keywords": ["library", "book"],
        "answer": "Library books and issue status can be checked under **Library → Book Issues**. Contact the librarian for book reservations.",
    },
    {
        "topic_key": "certificate",
        "keywords": ["certificate"],
        "answer": "Certificates (bonafide, character, etc.) can be generated from **Administration → Generate Certificate**. Submit a request to the school office.",
    },
    {
        "topic_key": "id-card",
        "keywords": ["id card"],
        "answer": "Student ID cards can be generated from **Administration → Generate ID Card**. Contact administration if your child has lost their ID card.",
    },
    {
        "topic_key": "complaint",
        "keywords": ["complaint"],
        "answer": "Complaints can be registered at **Administration → Complaint**. You can also contact the school principal directly.",
    },
    {
        "topic_key": "admission-process",
        "keywords": ["admission", "how to admit", "admission process", "enroll", "new student admit"],
        "answer": "Admission queries can be submitted at **Admissions → Admission Query**. Our team typically responds within 2 business days.",
    },
    {
        # Previously classified by QA_TOPICS but had no matching PARENT_FAQ
        # entry — "what's the syllabus" fell through to fuzzy-pages with no
        # answer at all. Fixed here.
        "topic_key": "syllabus",
        "keywords": ["syllabus", "curriculum", "chapter"],
        "answer": "Syllabus and curriculum details are available under **Academics → Upload Content** or **Study Material**. Please check with the class teacher for the latest syllabus document.",
    },
]

MESSAGE_TEMPLATE_SEED = [
    {
        "topic_key": "fee",
        "body": "Dear Parent,\n\nThis is a gentle reminder that your child's school fees for the current term are due. Kindly clear the outstanding amount at your earliest convenience to avoid any inconvenience.\n\nFor any queries regarding the fee structure or payment, please contact our accounts office.\n\nThank you for your cooperation.\n\nWarm regards,\n[School Name] Administration",
    },
    {
        "topic_key": "attendance",
        "body": "Dear Parent,\n\nWe wish to inform you that your child's attendance has been below the required 75% threshold. Regular attendance is essential for academic progress.\n\nKindly ensure your child attends school regularly. If there are any concerns, please meet with the class teacher at your earliest convenience.\n\nRegards,\n[School Name] Administration",
    },
    {
        "topic_key": "exam",
        "body": "Dear Parent,\n\nWe are pleased to inform you that the exam results have been published. You can view your child's results by visiting our school portal or contacting the class teacher.\n\nFor result-related queries, please visit the school office during working hours.\n\nBest regards,\n[School Name] Academic Team",
    },
    {
        "topic_key": "meeting",
        "body": "Dear Parent,\n\nYou are cordially invited to attend the Parent-Teacher Meeting scheduled on {date} at {time} in {venue}.\n\nYour presence is important as we will discuss your child's academic progress, attendance, and overall development.\n\nKindly confirm your attendance by {rsvp_date}.\n\nLooking forward to meeting you.\n\nRegards,\n[School Name] Administration",
    },
    {
        "topic_key": "generic",
        "body": "Dear Parent,\n\nWe would like to bring to your attention an important matter regarding {topic}.\n\n[Please add your specific message here]\n\nFor any queries, please contact the school office.\n\nThank you.\n\nRegards,\n[School Name] Administration",
    },
]


def seed_defaults(apps, schema_editor):
    FAQEntry = apps.get_model('assistant', 'FAQEntry')
    MessageTemplate = apps.get_model('assistant', 'MessageTemplate')

    for row in FAQ_SEED:
        FAQEntry.objects.update_or_create(
            school=None, topic_key=row['topic_key'],
            defaults={'keywords': row['keywords'], 'answer': row['answer'], 'is_active': True},
        )
    for row in MESSAGE_TEMPLATE_SEED:
        MessageTemplate.objects.update_or_create(
            school=None, topic_key=row['topic_key'],
            defaults={'body': row['body'], 'is_active': True},
        )


def unseed_defaults(apps, schema_editor):
    FAQEntry = apps.get_model('assistant', 'FAQEntry')
    MessageTemplate = apps.get_model('assistant', 'MessageTemplate')
    FAQEntry.objects.filter(school__isnull=True, topic_key__in=[r['topic_key'] for r in FAQ_SEED]).delete()
    MessageTemplate.objects.filter(school__isnull=True, topic_key__in=[r['topic_key'] for r in MESSAGE_TEMPLATE_SEED]).delete()


class Migration(migrations.Migration):

    dependencies = [
        ('assistant', '0001_initial'),
    ]

    operations = [
        migrations.RunPython(seed_defaults, unseed_defaults),
    ]
