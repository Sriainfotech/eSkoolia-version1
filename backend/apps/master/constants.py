"""
Master data constants — no migrations required.
Cached in Django's cache backend for 24 h on first request.
"""

LANGUAGES = [
    "Assamese", "Bengali", "Bodo", "Dogri", "English", "Gujarati", "Hindi",
    "Kannada", "Kashmiri", "Khasi", "Konkani", "Maithili", "Malayalam",
    "Manipuri", "Marathi", "Mizo", "Nagamese", "Nepali", "Odia", "Punjabi",
    "Sanskrit", "Santali", "Sindhi", "Tamil", "Telugu", "Urdu",
    "Arabic", "Chinese (Mandarin)", "French", "German", "Hausa", "Igbo",
    "Italian", "Japanese", "Korean", "Portuguese", "Russian", "Spanish",
    "Swahili", "Yoruba", "Zulu", "Amharic", "Other",
]

RELIGIONS = [
    "Hinduism", "Islam", "Christianity", "Sikhism", "Buddhism", "Jainism",
    "Zoroastrianism", "Judaism", "Bahá'í Faith", "Tribal / Indigenous",
    "Atheism / No Religion", "Prefer not to say", "Other",
]

COUNTRIES = [
    "Afghanistan", "Albania", "Algeria", "Angola", "Argentina", "Armenia",
    "Australia", "Austria", "Azerbaijan", "Bahrain", "Bangladesh", "Belarus",
    "Belgium", "Bhutan", "Bolivia", "Bosnia and Herzegovina", "Brazil",
    "Bulgaria", "Cameroon", "Canada", "Chile", "China", "Colombia", "Croatia",
    "Cuba", "Czech Republic", "Denmark", "Egypt", "Ethiopia", "Finland",
    "France", "Germany", "Ghana", "Greece", "Hungary", "India", "Indonesia",
    "Iran", "Iraq", "Ireland", "Israel", "Italy", "Japan", "Jordan",
    "Kazakhstan", "Kenya", "Kuwait", "Lebanon", "Libya", "Malaysia", "Mexico",
    "Morocco", "Mozambique", "Myanmar", "Nepal", "Netherlands", "New Zealand",
    "Nigeria", "Norway", "Oman", "Pakistan", "Peru", "Philippines", "Poland",
    "Portugal", "Qatar", "Romania", "Russia", "Saudi Arabia", "Senegal",
    "Serbia", "Singapore", "South Africa", "South Korea", "Spain", "Sri Lanka",
    "Sudan", "Sweden", "Switzerland", "Syria", "Tanzania", "Thailand",
    "Tunisia", "Turkey", "Uganda", "Ukraine", "United Arab Emirates",
    "United Kingdom", "United States", "Venezuela", "Vietnam", "Yemen",
    "Zambia", "Zimbabwe", "Other",
]

EMPLOYMENT_TYPES = [
    "Full Time",
    "Part Time",
    "Contract",
    "Temporary",
    "Internship",
    "Consultant",
    "Outsourced",
    "Probation",
    "Permanent",
    "Other",
]
