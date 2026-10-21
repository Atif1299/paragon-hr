"""Domain constants taken from the client's recruitment templates."""


class Role:
    ADMIN = "admin"
    HR = "hr"
    VIEWER = "viewer"
    ALL = (ADMIN, HR, VIEWER)


class Pipeline:
    APPLIED = "Applied"
    SCREENED = "Screened"
    QUESTIONNAIRE_SENT = "Questionnaire Sent"
    PRE_SELECTED = "Pre-Selected (Benched)"
    INTERVIEW_INVITED = "Interview Invited"
    INTERVIEW_SCHEDULED = "Interview Scheduled"
    INTERVIEWED = "Interviewed"
    SELECTED = "Selected"
    ONBOARDING_INVITED = "Onboarding Invited"
    ONBOARDING_SCHEDULED = "Onboarding Scheduled"
    ONBOARDING = "Assignment Interview Done"
    TRIAL = "Trial (Manual)"
    CONTRACTED = "Contracted (Manual)"
    ON_HOLD = "On Hold"
    REJECTED = "Rejected"

    ORDER = [
        APPLIED,
        SCREENED,
        QUESTIONNAIRE_SENT,
        PRE_SELECTED,
        INTERVIEW_INVITED,
        INTERVIEW_SCHEDULED,
        INTERVIEWED,
        SELECTED,
        ONBOARDING_INVITED,
        ONBOARDING_SCHEDULED,
        ONBOARDING,
        TRIAL,
        CONTRACTED,
        ON_HOLD,
        REJECTED,
    ]


class Vetting:
    RIGHT_FIT = "Right Fit"
    NOT_A_FIT = "Not a Fit"


EMPLOYMENT_STATUSES = ["Employed", "Unemployed", "Self-Employed", "Student", "Other"]


# Master Recruitment Sheet columns (Master_Template_Recuritment.xlsx, row 3).
MASTER_SHEET_HEADERS = [
    "Sr. No.",
    "Date",
    "Full name",
    "Email",
    "Phone Number",
    "Position Applied For",
    "Previous Employment \n[Designation | Company]",
    "Current Employment Status",
    "Experience",
    "Notice Period / Availability",
    "Source Platform",
    "Profile URL",
    "Vetting Status ",
    "Pipeline Status",
    "Interview Session \n[Meeting Link]",
    "Onboarding Session\n[Meeting Link]",
    "Candidate Folder \n[Shared Drive Link]",
    "Notes / HR Remarks",
    "Recruiter Name",
]

# Recruitment Event log columns (Event participation.xlsx).
EVENT_LOG_HEADERS = [
    "Sr.",
    "Event",
    "Event Date",
    "Status",
    "Full Name",
    "Area",
    "Email ID",
    "Phone No",
    "Note",
    "QCA",
]

# QCA Form fields (Copy of QCA Form.docx). Office-use fields are stored on the candidate.
QCA_FIELDS = [
    {"key": "total_years_experience", "label": "Total Years of Experience", "type": "number"},
    {"key": "sales_training_years", "label": "Sales Training Experience (Years)", "type": "number"},
    {"key": "accounts_years", "label": "Accounts (Years)", "type": "number"},
    {"key": "digital_marketing_years", "label": "Digital Marketing (Years)", "type": "number"},
    {"key": "ai_years", "label": "Artificial Intelligence (AI) Years", "type": "number"},
    {"key": "recruitment_training_years", "label": "Recruitment Training Experience (Years)", "type": "number"},
    {"key": "project_management_years", "label": "Project Management (Years)", "type": "number"},
    {"key": "team_management_years", "label": "Team Management Experience (Years)", "type": "number"},
    {"key": "checklists_scorecards", "label": "Experience with Checklists & Scorecards", "type": "text"},
    {"key": "excel_reporting_pct", "label": "Excel / Reporting Skills (%)", "type": "number"},
    {"key": "communication_presentation_pct", "label": "Communication & Presentation Skills (%)", "type": "number"},
]

# Recruitment Evaluation Scorecard (Copy of Recruitment_Evaluation_Scorecard.xlsx).
SCORECARD_SECTIONS = [
    {
        "key": "norms",
        "label": "Norms & Values",
        "criteria": [
            ("intellectual_honesty", "Intellectual Honesty"),
            ("integrity", "Integrity"),
            ("trustworthiness", "Trustworthiness"),
            ("innovation", "Innovation"),
            ("continuous_improvement", "Continuous Improvement (Strategy, Process & Outcome)"),
        ],
    },
    {
        "key": "attitude",
        "label": "Attitudinal Traits",
        "criteria": [
            ("positivity", "Positivity (Can-Do Attitude)"),
            ("proactiveness", "Proactiveness"),
            ("commitment", "Commitment (Adapt to Company's Needs)"),
            ("reliable", "Reliable (Dependable)"),
            ("team_player", "Team Player (Process Acceleration, Mentoring & Training)"),
        ],
    },
    {
        "key": "competency",
        "label": "Competency",
        "criteria": [
            ("years_of_experience", "Years of Experience"),
            ("expertise", "Expertise"),
            ("achievements", "Achievements"),
            ("strengths", "Strengths (Can-Do Attitude)"),
            ("method", "Method (Consistency in Area of Specialization)"),
        ],
    },
]

CRITERIA = {key: label for section in SCORECARD_SECTIONS for key, label in section["criteria"]}
CORE_TRAITS = ["intellectual_honesty", "integrity", "trustworthiness"]
SCORE_VALUES = [0, 0.5, 1]
SCORECARD_MAX = float(len(CRITERIA))

# Short situational questions on the application form; feed pre-selection trait scoring.
TRAIT_QUESTIONS = [
    {
        "key": "mistake",
        "question": "Tell us about a time you made a mistake at work. What happened and what did you do about it?",
    },
    {
        "key": "improvement",
        "question": "Describe a situation where you improved a process or a result without being asked.",
    },
    {
        "key": "adaptability",
        "question": "Why do you want this role, and how do you handle changing priorities or requirements?",
    },
    {
        "key": "teamwork",
        "question": "Describe how you have helped a teammate succeed (mentoring, training or support).",
    },
]

# Below-threshold fallback questionnaire: one question per weak criterion.
QUESTION_BANK = {
    "intellectual_honesty": "Describe a time you realised your own idea or opinion was wrong. How did you handle it with your team?",
    "integrity": "Tell us about a situation where doing the right thing was harder than taking a shortcut. What did you do?",
    "trustworthiness": "How have you handled confidential information or a commitment you could no longer keep?",
    "innovation": "Share an example of a new idea, tool or approach you introduced. What was the outcome?",
    "continuous_improvement": "Describe how you measured and improved a process or outcome over time.",
    "positivity": "Tell us about a difficult project and how you kept yourself and others motivated.",
    "proactiveness": "Give an example of a problem you spotted and solved before anyone asked you to.",
    "commitment": "Describe a time your role or priorities changed suddenly. How did you adapt?",
    "reliable": "How do you make sure you meet deadlines? Give a recent example.",
    "team_player": "Describe a time you trained, mentored or helped a colleague speed up their work.",
    "years_of_experience": "Summarise your experience that is most relevant to this role, with years and companies.",
    "expertise": "Walk us through the tools and methods you use most in this field and how you apply them.",
    "achievements": "What is the professional achievement you are most proud of? Include measurable results.",
    "strengths": "What are your two strongest skills for this role, and how have they helped you deliver results?",
    "method": "Describe the step-by-step method you follow to deliver consistent results in your specialisation.",
}

DEFAULT_SETTINGS = {
    "screening_threshold": 50,
    "keyword_weight": 0.4,
    "preselection_pass_pct": 70,
    "preselection_borderline_pct": 50,
    "core_trait_min": 2.0,
    "referral_threshold": 60,
    "auto_invite_on_pass": True,
    "auto_referral": True,
    "default_recruiter_name": "Usama Malik",
    "business_areas": [
        "Sales (Higher Education)",
        "Digital Marketing",
        "Recruitment",
        "Instructional Design & Training",
        "Fundraising & Corporate Finance",
        "Content & Ghostwriting",
        "Administration & Operations",
        "AI & Automation",
        "Event Management",
        "Project Management",
    ],
    "tools": [
        "GoHighLevel",
        "Google Workspace",
        "Claude / AI tools",
        "Articulate 360",
        "Camtasia",
        "Canva",
        "LMS platforms",
        "CRM",
        "Excel / Reporting",
        "No-code / Low-code automation",
    ],
}
