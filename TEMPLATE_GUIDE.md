# Resume Template Guide

This guide explains how to add placeholders to your Word document template (`app/utils/resume-template-base.docx`) so it can be filled with dynamic resume data.

## How It Works

The `generateResumeFromTemplate()` function uses `docxtemplater` to replace placeholders in your Word document with actual data. You can edit your template in Microsoft Word, Google Docs, or any word processor.

## Placeholder Syntax

### Simple Variables
Use curly braces to insert a single value:
```
{full_name}
{email}
{phone}
```

### Available Simple Variables

**Personal Information:**
- `{full_name}` - Full name
- `{first_name}` - First name
- `{last_name}` - Last name
- `{email}` - Email address
- `{phone}` - Phone number
- `{location}` - Location/address
- `{linkedin}` - LinkedIn URL
- `{github}` - GitHub URL
- `{portfolio}` - Portfolio URL

**Summary:**
- `{summary}` - Professional summary text

**Skills:**
- `{skills_text}` - All skills as comma-separated string

### Loops (for repeating sections)

Use `{#array_name}...{/array_name}` to repeat content:

**Experiences:**
```
{#experiences}
{company}                    {date_range}
{title}
{#bullet_points}
• {.}
{/bullet_points}

{/experiences}
```

Available experience fields:
- `{company}` - Company name
- `{title}` - Job title
- `{date_start}` - Start date
- `{date_end}` - End date (or "Present")
- `{date_range}` - Formatted as "Jan 2020 – Present"
- `{location}` - Job location
- `{bullet_points}` - Array of bullet points (use `{.}` for each item)

**Education:**
```
{#education}
{school} {degree_major}
{date_range}
{/education}
```

Available education fields:
- `{school}` - School name
- `{degree}` - Degree type
- `{major}` - Major/field of study
- `{degree_major}` - Combined "Degree, Major"
- `{date_range}` - Formatted date range
- `{location}` - School location

**Skills (as list):**
```
{#skills}
{.}
{/skills}
```

**Certifications:**
```
{#certifications}
• {cert_text}
{/certifications}
```

Available certification fields:
- `{name}` - Certification name
- `{issuer}` - Issuing organization
- `{date}` - Date obtained
- `{cert_text}` - Formatted as "Name - Issuer (Date)"

**Projects:**
```
{#projects}
{name} {link}
{description}
Technologies: {technologies_text}

{/projects}
```

Available project fields:
- `{name}` - Project name
- `{description}` - Project description
- `{link}` - Project URL
- `{technologies_text}` - Technologies as comma-separated string
- `{technologies}` - Array of technologies

### Conditionals (show/hide sections)

Show content only if a value exists:
```
{#has_summary}
PROFESSIONAL SUMMARY
{summary}
{/has_summary}
```

Available conditional flags:
- `{#has_summary}...{/has_summary}` - Has professional summary
- `{#has_certifications}...{/has_certifications}` - Has certifications
- `{#has_projects}...{/has_projects}` - Has projects

## Example Template Structure

Here's a complete example of what your Word document could look like:

```
{full_name}
{location} | {phone} | {email} | {linkedin}

{#has_summary}
PROFESSIONAL SUMMARY
{summary}
{/has_summary}

PROFESSIONAL EXPERIENCE
{#experiences}
{company}                                        {date_range}
{title}
{#bullet_points}
• {.}
{/bullet_points}

{/experiences}

EDUCATION
{#education}
{school} {degree_major}
{/education}

SKILLS
{skills_text}

{#has_certifications}
CERTIFICATIONS
{#certifications}
• {cert_text}
{/certifications}
{/has_certifications}

{#has_projects}
PROJECTS
{#projects}
{name}
{description}
{#has_technologies}
Technologies: {technologies_text}
{/has_technologies}

{/projects}
{/has_projects}
```

## Steps to Update Your Template

1. **Open** `app/utils/resume-template-base.docx` in Word
2. **Replace** your actual content with placeholders (e.g., replace "John Doe" with `{full_name}`)
3. **Keep** all your formatting (fonts, sizes, bold, spacing, etc.)
4. **Save** the document
5. **Test** by running your app - the placeholders will be replaced with real data

## Tips

- Keep all your existing formatting - bold, fonts, colors, spacing, etc.
- Placeholders are case-sensitive
- Make sure to close all loops (every `{#name}` needs a `{/name}`)
- Use tabs and spacing in the template to control layout
- The `{.}` placeholder inside a loop represents the current item (useful for simple arrays like bullet points)

## Troubleshooting

If you get an error:
1. Check that all `{#loops}` have matching `{/loops}`
2. Make sure placeholder names match exactly (case-sensitive)
3. Verify the template file is at `app/utils/resume-template-base.docx`
4. Check the error message - it usually tells you which tag has an issue
