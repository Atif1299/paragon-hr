"""Open roles seeded from the client's job descriptions and Keywords.xlsx."""


def _kw(*terms: str) -> list[dict]:
    return [{"term": t, "weight": 1} for t in terms]


JOBS = [
    {
        "title": "Digital Marketing Manager (GoHighLevel)",
        "slug": "digital-marketing-ghl",
        "area": "Event Managers / Digital Marketing",
        "min_years": 3,
        "description": (
            "Run simultaneous digital marketing campaigns in GoHighLevel, including email campaigns supporting live "
            "events according to a set schedule.\n\n"
            "Responsibilities:\n"
            "- Build, segment and execute bulk email/SMS campaigns in GoHighLevel (50k+ sends/month, 95%+ deliverability).\n"
            "- Own and manage multiple simultaneous campaigns, each with its own workflow and audience.\n"
            "- Prepare weekly cumulative & progressive reports (open rates, CTAs, conversions).\n"
            "- Write and deploy email sequences, SMS blasts and social media posts; sync with Meta/IG/FB.\n"
            "- Build workflows, triggers, pipelines and landing pages; A/B test subject lines, send times and creatives.\n\n"
            "Requirements:\n"
            "- 3+ years hands-on GoHighLevel (snapshots, workflows, campaigns, reporting).\n"
            "- Proven bulk mailing of 20k+ per week without deliverability issues.\n"
            "- Ability to manage 10+ concurrent campaigns; strong with data and reporting.\n"
            "- Good spoken and written English, project management, works to schedule."
        ),
        "keywords": _kw(
            "GoHighLevel (GHL)",
            "Bulk emailing",
            "SMS blasts",
            "Deliverability",
            "Automation workflows",
            "Funnels",
            "Landing pages",
            "Cumulative & Progressive Reports",
            "Omnichannel marketing",
            "A/B testing",
            "Lead generation",
        ),
    },
    {
        "title": "Instructional Designer",
        "slug": "instructional-designer",
        "area": "Instructional Design",
        "min_years": 3,
        "description": (
            "Design high-impact courses across multiple business functions for internal teams and external eLearning "
            "platforms such as Udemy.\n\n"
            "Responsibilities:\n"
            "- Design courses on business operating cycles for SMEs: Sales, Digital Marketing, Recruitment, "
            "Cybersecurity, Gamification and Project Management.\n"
            "- Convert SME knowledge into clear learning content for live and self-paced delivery.\n"
            "- Build courses for Udemy, Teachable and internal LMS platforms.\n"
            "- Deliver live training; apply scenario-based learning and microlearning.\n"
            "- Script and storyboard recorded training material.\n\n"
            "Requirements:\n"
            "- 3+ years as an Instructional Designer with at least 2 published Udemy courses.\n"
            "- Experience delivering live training.\n"
            "- Proficient in Articulate 360, Camtasia, Canva and LMS platforms.\n"
            "- Strong understanding of adult learning principles; excellent English."
        ),
        "keywords": _kw(
            "Instructional Design",
            "Udemy",
            "Curriculum development",
            "Subject Matter Expert (SME)",
            "Articulate 360",
            "Camtasia",
            "Canva",
            "LMS",
            "Adult learning principles",
            "Scenario-based learning",
            "Storyboarding",
            "Business reporting",
            "Training delivery",
        ),
    },
    {
        "title": "Fundraising & Corporate Finance Manager",
        "slug": "fundraising-corporate-finance",
        "area": "Fundraising & Corporate Finance",
        "min_years": 5,
        "description": (
            "Lead institutional-grade capital raising, prepare investment documentation, build financial models and "
            "engage with PE, VC, Family Offices and institutional investors.\n\n"
            "Responsibilities:\n"
            "- Lead end-to-end fundraising from strategy through investor engagement.\n"
            "- Build audit-ready financial and valuation models.\n"
            "- Prepare IMs, CIMs, teasers, pitch decks and financial prospectuses.\n"
            "- Coordinate investor meetings, due diligence and Virtual Data Rooms (VDRs).\n"
            "- Support IPO, private placements and strategic capital raising.\n\n"
            "Requirements:\n"
            "- 5+ years in Corporate Finance, Transaction Advisory, Investment Banking or Fundraising.\n"
            "- Big 4 (PwC, EY, Deloitte, KPMG) or reputable Investment Bank experience preferred.\n"
            "- Strong understanding of M&A, due diligence and capital markets."
        ),
        "keywords": _kw(
            "Corporate Finance",
            "Capital raising",
            "Financial modeling",
            "Valuation models",
            "Investment Memorandums (IM)",
            "CIM",
            "Pitch decks",
            "Private Equity (PE)",
            "Venture Capital (VC)",
            "Family Offices",
            "M&A",
            "Virtual Data Room (VDR)",
            "Big 4 Advisory",
        ),
    },
    {
        "title": "Ghostwriter – Marketing & Long-Form Content",
        "slug": "ghostwriter",
        "area": "Content & Ghostwriting",
        "min_years": 3,
        "description": (
            "Write materials for different forms of content such as e-books, email content and instructional content.\n\n"
            "Responsibilities:\n"
            "- Website copy, landing pages, blogs, articles and product descriptions that drive conversions.\n"
            "- Newsletters, bulk mailer campaigns, LinkedIn posts, ad copy and social messaging for B2B/B2C.\n"
            "- Research and ghostwrite e-books, handbooks, whitepapers and lead magnets.\n"
            "- Adapt tone and voice to different brands, personas and industries.\n\n"
            "Requirements:\n"
            "- 3+ years professional ghostwriting or copywriting with portfolio.\n"
            "- At least 1 published e-book or handbook on business, education or training.\n"
            "- Exceptional English writing, editing, storytelling and research skills."
        ),
        "keywords": _kw(
            "Ghostwriting",
            "Long-form content",
            "Copywriting",
            "E-books",
            "Whitepapers",
            "Lead magnets",
            "Website copy",
            "Landing pages",
            "Newsletter campaigns",
            "Thought leadership",
            "SEO writing",
            "Brand voice",
        ),
    },
    {
        "title": "Freelance End-to-End Recruiter",
        "slug": "recruiter",
        "area": "Recruitment",
        "min_years": 2,
        "description": (
            "Independently manage the complete recruitment cycle. Performance-based: compensated per successful "
            "interview session.\n\n"
            "Responsibilities:\n"
            "- Source candidates through multiple channels; screen and shortlist against hiring criteria.\n"
            "- Conduct initial interviews; coordinate scheduling and ensure attendance.\n"
            "- Support selected candidates through onboarding; maintain recruitment records.\n\n"
            "Success criteria: 6 qualified candidates attend each scheduled interview session, all meeting the "
            "eligibility criteria, managed from sourcing through onboarding.\n\n"
            "Requirements:\n"
            "- 2+ years full-cycle recruitment; strong sourcing via LinkedIn, job boards and social media.\n"
            "- Excellent communication; meets deadlines; ATS experience is a plus."
        ),
        "keywords": _kw(
            "Full-cycle recruitment",
            "Talent acquisition",
            "Candidate sourcing",
            "ATS",
            "Pre-screening interviews",
            "Talent mapping",
            "Interview scheduling",
            "Onboarding",
            "Performance-based recruitment",
        ),
    },
    {
        "title": "High Volume Sales – Higher Education",
        "slug": "sales-higher-education",
        "area": "Sales",
        "min_years": 3,
        "description": (
            "Create business opportunities with Universities and Higher Education Institutions (HEI) across Europe "
            "for a client with 21 years in business.\n\n"
            "Responsibilities:\n"
            "- Pitch to Higher Education clients and prospects across Europe.\n"
            "- Generate qualified appointments through cold and warm calls.\n"
            "- Present internship and training products and services.\n"
            "- Build a strong pipeline of appointments, engagements and follow-ups; exceed daily targets.\n\n"
            "Requirements:\n"
            "- Minimum 3 years selling Education, Recruitment or Training services.\n"
            "- Comfortable making outbound sales calls every day.\n"
            "- CET morning and early afternoon working hours."
        ),
        "keywords": _kw(
            "High-volume sales",
            "Higher Education Institutions (HEI)",
            "B2B sales",
            "University partnerships",
            "Outbound calling",
            "Appointment setting",
            "Sales pipeline",
            "Consultative selling",
            "International internships",
            "Commission structure",
        ),
    },
    {
        "title": "Virtual Assistant Administrator",
        "slug": "va-administrator",
        "area": "Administration & Operations",
        "min_years": 2,
        "description": (
            "Handle day-to-day admin tasks: scheduling, coordination and back-office support.\n\n"
            "Responsibilities:\n"
            "- Calendar and meeting management across time zones; invites, reminders, agendas.\n"
            "- Data entry and documentation in spreadsheets, CRM and Google Drive.\n"
            "- Liaise with clients and team members; confirm appointments.\n"
            "- Basic research and weekly task reports.\n\n"
            "Requirements:\n"
            "- 2-3+ years as VA, Admin Assistant or Executive Assistant.\n"
            "- Proficient in Google Workspace (Gmail, Calendar, Sheets, Docs, Drive).\n"
            "- Excellent written and spoken English; organised, punctual, detail-oriented.\n"
            "- Available 6-8 hours daily; CET time zone friendly."
        ),
        "keywords": _kw(
            "Virtual Assistant (VA)",
            "Calendar management",
            "Data entry",
            "Google Workspace",
            "CRM",
            "Executive support",
            "Meeting coordination",
            "Task management",
            "Administrative support",
            "Time zone management",
        ),
    },
    {
        "title": "Claude AI Expert",
        "slug": "claude-ai-expert",
        "area": "AI & Automation",
        "min_years": 1,
        "description": (
            "Use Claude's models and features to design, build and improve practical AI-powered tools and workflows.\n\n"
            "Responsibilities:\n"
            "- Build and maintain reusable Claude Skills and project-specific workflows.\n"
            "- Write, test and refine prompts; use Projects, models and Claude features effectively.\n"
            "- Create AI tools, assistants, document generators and automations with no-code/low-code platforms.\n"
            "- Break business requirements into plans, milestones and measurable deliverables.\n"
            "- Test outputs for accuracy, consistency, privacy and quality; document and train users.\n\n"
            "Required skills: hands-on Claude expertise, prompt engineering, context management, AI tool building, "
            "workflow design, no-code/low-code automation, project management and documentation.\n"
            "Preferred: Claude API or integrations, automation platforms, structured data."
        ),
        "keywords": _kw(
            "Claude Expert",
            "Claude Skills",
            "Claude Projects",
            "Claude Models",
            "Claude Prompt Engineering",
            "AI Tool Building",
            "AI Automation",
            "No-Code AI",
            "Low-Code Automation",
            "AI Workflow Automation",
            "Project Management",
            "AI Assistants",
            "Claude API",
            "Workflow Design",
        ),
    },
]
