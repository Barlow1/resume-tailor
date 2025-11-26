# Resume Tailoring Experiment

Test harness to validate if enhanced resume tailoring produces better results.

## Setup

```bash
npm install
```

## Usage

1. Edit `inputs.ts` - paste your real resume and job description
2. Run baseline: `npm run baseline`
3. Run experimental: `npm run experimental`
4. Compare the outputs

## Modify Prompts

- **Baseline prompt:** `baseline.ts` lines 35-70
- **Role analysis prompt:** `experimental.ts` lines 55-95
- **Tailoring prompt:** `experimental.ts` lines 115-170

## What It Tests

### Baseline
Current single-pass approach:
- One API call that does everything at once
- Generic analysis without role-specific context

### Experimental
Three-step pipeline:

1. **Step 1: Role Analysis** - Analyze job description to identify:
   - Primary dimensions (what the role REALLY needs)
   - Required framing (how to present experience)
   - Critical gaps (deal-breakers)

2. **Step 2: Tailoring** - Enhance resume WITH role context:
   - Context injected at top of prompt
   - Enhancements guided by identified dimensions
   - Language shifts applied

3. **Step 3: Validation** - Check output quality:
   - Word shuffling detection (fluff without substance)
   - Invented metrics detection
   - Weak evidence flagging
   - Gap prioritization check
   - Generic enhancement detection

## Validation Checks

| Check | What it detects | Score penalty |
|-------|----------------|---------------|
| `word_shuffling` | Added length without new meaningful words | -15 |
| `invented_metrics` | New numbers not in original, no placeholder | -20 |
| `weak_evidence` | High confidence + short evidence | -15 |
| `poor_prioritization` | No critical gaps despite role analysis flagging them | -20 |
| `generic_enhancements` | Reasoning doesn't reference role dimensions | -10 |

## Expected Output

```
============================================================
EXPERIMENTAL TAILORING
============================================================

STEP 1: ANALYZING ROLE...
Completed in 3.2s

PRIMARY DIMENSIONS:
  • client-facing technical consulting (40%)
    - "work directly with enterprise clients"
    - "translate technical concepts"
  • scaling distributed systems (35%)
    - "high-throughput data pipelines"

REQUIRED FRAMING:
  Emphasize: stakeholder communication, system design
  Language shifts: 3
    - use 'architected' instead of 'built'
    - emphasize 'scale' when discussing systems
  Critical gaps: Go/Rust experience, Kubernetes

------------------------------------------------------------
STEP 2: TAILORING WITH ROLE CONTEXT...
Completed in 5.1s

ENHANCED BULLETS:
1. Original: Led development of microservices architecture
   Enhanced: Architected and scaled microservices platform...
   Reasoning: Addresses 'scaling distributed systems' dimension...

------------------------------------------------------------
STEP 3: VALIDATION

Quality Score: 85/100

Issues Found:
  ⚠ [weak_evidence] Suggested bullet #2: High confidence with minimal evidence

============================================================
Total time: 8.3s
============================================================
```

## Decision Criteria

If experimental produces noticeably better results:
- More targeted enhancements
- Better gap prioritization
- Fewer quality issues

Then integrate the three-step approach into production code.
