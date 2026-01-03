# Resume Tailor - Week 1 Codebase Review & Implementation Plan

## Context

I'm fixing critical onboarding issues that are causing 59% of users to cancel during trial, with 75% churning within 1 hour. The median time-to-cancel is 14 minutes.

User feedback consistently mentions:
- "uploading my existing pdf resume doesn't work"
- "Resume upload didn't work in my browser (Brave)"
- "Usability is incredibly frustrating. Things just don't work."
- "The software does not work at all"
- "Website doesn't work. Couldn't read my word or pdf CVs."

## Your Mission

Review this entire codebase to understand the current implementation, then create a detailed implementation plan for these 4 Week 1 fixes. Do NOT implement yet—just analyze and propose.

---

## Task 1: Fix PDF/DOCX Upload

### What's Broken
- PDF upload silently fails across browsers (confirmed: Brave, Safari issues)
- No error feedback when parsing fails
- Partial parses show incomplete resumes without warning
- Users think the product is broken before they start

### Your Analysis Tasks
1. Find all code related to resume upload and parsing
2. Identify the parsing library/service being used (pdf-parse? pdfjs? external API?)
3. Trace the full upload flow: frontend → API → parsing → response
4. Find where errors are being swallowed or not surfaced
5. Check for browser-specific file handling issues
6. Identify what file types are actually supported vs claimed

### Deliverable
```
CURRENT STATE:
- Upload entry point: [file path]
- Parsing logic: [file path]
- Libraries used: [list]
- Error handling: [description of current approach]
- Known failure points: [list with file:line references]

PROPOSED FIX:
- [Specific changes needed with file paths]
- [New error handling approach]
- [Browser compatibility fixes]

EFFORT ESTIMATE: [X hours/days]
RISK AREAS: [What could go wrong]
```

---

## Task 2: Add Paste Fallback

### Requirements
When upload fails OR as an alternative option, users should be able to:
1. Paste raw resume text into a textarea
2. System uses LLM to parse it into structured sections (contact, summary, experience, education, skills)
3. Show verification screen (Task 3) before proceeding

### Your Analysis Tasks
1. Find where resume data structure is defined (what fields exist)
2. Identify existing LLM integration points (are we using OpenAI? Anthropic? Which endpoints?)
3. Find the best insertion point for paste fallback UI
4. Check if there's existing text-to-structured-resume logic anywhere

### Deliverable
```
CURRENT RESUME SCHEMA:
- [Data structure with fields]
- Defined in: [file path]

EXISTING LLM INTEGRATION:
- Provider: [OpenAI/Anthropic/other]
- Current usage: [what it's used for now]
- API integration file: [file path]

PROPOSED IMPLEMENTATION:
- Frontend: [where to add paste UI, component structure]
- Backend: [new endpoint needed? or extend existing?]
- LLM prompt approach: [brief description]
- How parsed result feeds into existing resume schema

EFFORT ESTIMATE: [X hours/days]
```

---

## Task 3: Verification Screen

### Requirements
After upload OR paste, show user what was detected before proceeding:
```
We found:
✓ 3 work experiences
✓ 8 skills  
✓ Education
⚠ No summary detected

[Looks good, continue]   [Let me fix something]
```

### Your Analysis Tasks
1. Find the current post-upload flow (where does user land after upload?)
2. Identify what validation/detection already exists
3. Find the component library being used (if any) for UI consistency
4. Determine where this screen should be inserted in the flow

### Deliverable
```
CURRENT POST-UPLOAD FLOW:
1. [Step 1]
2. [Step 2]
3. [etc]

INSERTION POINT: [where verification screen goes]

DETECTION LOGIC NEEDED:
- How to count experiences: [approach]
- How to count skills: [approach]
- How to detect missing sections: [approach]

UI COMPONENTS TO USE: [existing components that match the design system]

EFFORT ESTIMATE: [X hours/days]
```

---

## Task 4: 3-Step Onboarding Walkthrough

### Requirements
First-time users see a guided flow instead of the full builder UI:
```
STEP 1: "First, let's get your resume"
[Upload existing resume] or [Start from scratch]

STEP 2: "Now, paste the job you're applying for"  
[Textarea for job description]
[Analyze match]

STEP 3: "Here's how you match—let's improve it"
→ Shows match score + goes to tailor view
```

Key principles:
- Each step = ONE action, no competing CTAs
- Only show full builder UI after completing flow
- Add "?" icon to re-trigger walkthrough later

### Your Analysis Tasks
1. Find current first-time user detection (is there any? cookies? user flags?)
2. Map the current landing experience after signup
3. Identify where job description input currently lives
4. Find the "tailor" or "match score" functionality entry point
5. Check for existing onboarding/tour libraries in the codebase

### Deliverable
```
CURRENT FIRST-TIME EXPERIENCE:
- User lands at: [route/component]
- First-time detection: [exists/doesn't exist, how it works]
- Current competing elements on first screen: [list]

JOB DESCRIPTION INPUT:
- Currently located: [file path]
- Data flow: [how it's stored/used]

MATCH/TAILOR ENTRY POINT:
- Function/component: [file path]
- How it's triggered: [description]

PROPOSED IMPLEMENTATION:
- New route or modal? [recommendation with rationale]
- State management for walkthrough progress: [approach]
- How to track completion: [approach]
- Re-trigger mechanism: [approach]

EFFORT ESTIMATE: [X hours/days]
```

---

## How to Proceed

1. **First, explore the codebase structure.** Run tree or similar, identify:
   - Frontend framework (React? Next? Vue?)
   - Backend framework (Node? Python? etc)
   - Database (Postgres? Mongo? etc)
   - File structure patterns

2. **Map the core flows** by reading code, not guessing:
   - Signup → first landing
   - Resume upload → parsing → storage
   - Job input → matching/tailoring

3. **Create the deliverables above** with specific file paths and line numbers.

4. **Identify dependencies and risks:**
   - What needs to change together?
   - What might break?
   - What needs migration?

5. **Propose an implementation sequence** for Week 1 that minimizes risk.

---

## Output Format

Structure your final response as:
```
# CODEBASE OVERVIEW
[Framework, structure, key patterns]

# TASK 1: PDF/DOCX UPLOAD
[Deliverable as specified above]

# TASK 2: PASTE FALLBACK  
[Deliverable as specified above]

# TASK 3: VERIFICATION SCREEN
[Deliverable as specified above]

# TASK 4: ONBOARDING WALKTHROUGH
[Deliverable as specified above]

# IMPLEMENTATION SEQUENCE
[Recommended order, dependencies, total effort]

# QUESTIONS FOR PRODUCT
[Anything you need clarified before implementing]
```

Do not implement any code yet. Analysis and planning only. I will review your findings and then we'll proceed to implementation together.