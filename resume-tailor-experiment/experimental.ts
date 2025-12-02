// experimental.ts

import dotenv from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import * as readline from 'readline';
import { RESUME, JOB_DESCRIPTION } from './inputs.js';
import {
  analyzeResumeAndJob,
  tailorWithHumanInput,
  AnalysisResult,
  HumanReviewInput,
  GapResponse,
  Gap,
  BulletChange,
  ResumeJSON,
  JDLanguagePattern,
} from './core.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, '..', '.env') });

// =============================================================================
// CLI HELPERS
// =============================================================================

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function ask(question: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(question, (answer) => resolve(answer.trim()));
  });
}

function printDivider(title?: string) {
  if (title) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`  ${title}`);
    console.log('='.repeat(60));
  } else {
    console.log('-'.repeat(60));
  }
}

function printResumeSummary(analysis: AnalysisResult) {
  const { parsedResume } = analysis;

  console.log('\n📄 PARSED RESUME:');
  console.log(`   ${parsedResume.experience.length} positions found:`);

  parsedResume.experience.forEach((exp, i) => {
    console.log(`   ${i + 1}. ${exp.role} @ ${exp.company} (${exp.bullets.length} bullets)`);
  });

  if (parsedResume.skills?.technical?.length) {
    console.log(`\n   Skills: ${parsedResume.skills.technical.slice(0, 8).join(', ')}...`);
  }
}

function wordCount(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

// =============================================================================
// GAP REVIEW
// =============================================================================

async function reviewGaps(gaps: Gap[]): Promise<GapResponse[]> {
  const responses: GapResponse[] = [];

  if (gaps.length === 0) {
    console.log('\n   No gaps identified! Your resume already covers the JD well.');
    return responses;
  }

  console.log(`\n   ${gaps.length} gaps identified between the JD and your resume.\n`);

  for (let i = 0; i < gaps.length; i++) {
    const gap = gaps[i];

    console.log(`   [${i + 1}/${gaps.length}] ${gap.skill}`);
    console.log(`       JD wants: ${gap.jdContext}`);
    console.log(`       ${gap.question}`);

    const answer = await ask('       (y/n/c for context): ');

    if (answer.toLowerCase() === 'y') {
      responses.push({
        skill: gap.skill,
        hasExperience: true,
      });
      console.log('       ✓ Got it\n');
    } else if (answer.toLowerCase() === 'c') {
      const context = await ask('       Tell me more: ');
      responses.push({
        skill: gap.skill,
        hasExperience: true,
        context: context,
      });
      console.log('       ✓ Got it\n');
    } else {
      responses.push({
        skill: gap.skill,
        hasExperience: false,
      });
      console.log('       → Will skip this\n');
    }
  }

  return responses;
}

// =============================================================================
// DIFF REVIEW
// =============================================================================

async function reviewBulletChanges(
  bulletChanges: BulletChange[],
  finalResume: ResumeJSON
): Promise<ResumeJSON> {
  if (bulletChanges.length === 0) {
    console.log('\n   No bullet changes to review.');
    return finalResume;
  }

  console.log(`\n   ${bulletChanges.length} bullets were modified. Review each:\n`);

  // Create a mutable copy of the resume
  const reviewedResume: ResumeJSON = JSON.parse(JSON.stringify(finalResume));

  for (let i = 0; i < bulletChanges.length; i++) {
    const change = bulletChanges[i];
    const origWords = wordCount(change.original);
    const newWords = wordCount(change.tailored);

    console.log(`   [${i + 1}/${bulletChanges.length}] ${change.company} - ${change.role}`);
    console.log('');
    console.log(`   ORIGINAL (${origWords} words):`);
    console.log(`   ${change.original}`);
    console.log('');
    console.log(`   TAILORED (${newWords} words)${newWords > 25 ? ' ⚠️  >25 words!' : ''}:`);
    console.log(`   ${change.tailored}`);
    console.log('');

    const answer = await ask('   Accept? (y/n/e to edit): ');

    if (answer.toLowerCase() === 'y') {
      console.log('   ✓ Accepted\n');
      // Already in finalResume, no change needed
    } else if (answer.toLowerCase() === 'e') {
      console.log('   Enter your edited version (press Enter when done):');
      const edited = await ask('   > ');

      // Find and update the bullet in reviewedResume
      const expIndex = reviewedResume.experience.findIndex(
        (e) => e.company === change.company && e.role === change.role
      );
      if (expIndex !== -1 && reviewedResume.experience[expIndex].bullets[change.bulletIndex]) {
        reviewedResume.experience[expIndex].bullets[change.bulletIndex] = edited;
        const editedWords = wordCount(edited);
        console.log(`   ✓ Updated (${editedWords} words)${editedWords > 25 ? ' ⚠️  >25 words!' : ''}\n`);
      }
    } else {
      // Revert to original
      const expIndex = reviewedResume.experience.findIndex(
        (e) => e.company === change.company && e.role === change.role
      );
      if (expIndex !== -1 && reviewedResume.experience[expIndex].bullets[change.bulletIndex]) {
        reviewedResume.experience[expIndex].bullets[change.bulletIndex] = change.original;
        console.log('   ✗ Reverted to original\n');
      }
    }

    printDivider();
  }

  return reviewedResume;
}

// =============================================================================
// FINAL OUTPUT
// =============================================================================

function printFinalResume(resume: ResumeJSON) {
  if (resume.summary) {
    console.log('\n📝 SUMMARY:');
    console.log(`   ${resume.summary}`);
  }

  console.log('\n💼 EXPERIENCE:');
  resume.experience.forEach((exp) => {
    console.log(`\n   ${exp.role} @ ${exp.company}`);
    if (exp.start || exp.end) {
      console.log(`   ${exp.start || ''} - ${exp.end || 'Present'}`);
    }
    exp.bullets.forEach((bullet, i) => {
      const words = wordCount(bullet);
      const flag = words > 25 ? ` [${words}w ⚠️]` : ` [${words}w]`;
      console.log(`   • ${bullet}${flag}`);
    });
  });

  if (resume.skills?.technical?.length) {
    console.log('\n🛠️  SKILLS:');
    console.log(`   Technical: ${resume.skills.technical.join(', ')}`);
  }
  if (resume.skills?.product?.length) {
    console.log(`   Product: ${resume.skills.product.join(', ')}`);
  }

  if (resume.education?.length) {
    console.log('\n🎓 EDUCATION:');
    resume.education.forEach((edu) => {
      console.log(`   ${edu.degree} - ${edu.school}`);
      if (edu.details) console.log(`   ${edu.details}`);
    });
  }

  if (resume.certifications?.length) {
    console.log('\n📜 CERTIFICATIONS:');
    resume.certifications.forEach((cert) => console.log(`   • ${cert}`));
  }
}

// =============================================================================
// MAIN FLOW
// =============================================================================

async function main() {
  console.log('\n');
  printDivider('RESUME TAILOR');

  // ==========================================================================
  // STAGE 1: ANALYZE
  // ==========================================================================

  console.log('\n🔍 Analyzing resume and job description...\n');

  const startAnalysis = Date.now();
  const analysis = await analyzeResumeAndJob(RESUME, JOB_DESCRIPTION);
  const analysisTime = ((Date.now() - startAnalysis) / 1000).toFixed(1);

  console.log(`   ✓ Done in ${analysisTime}s`);

  printResumeSummary(analysis);

  // ==========================================================================
  // STAGE 2: GAP QUESTIONS
  // ==========================================================================

  printDivider('GAP ANALYSIS');

  const gapResponses = await reviewGaps(analysis.gaps);

  // Summary
  const confirmed = gapResponses.filter((g) => g.hasExperience).length;
  const skipped = gapResponses.filter((g) => !g.hasExperience).length;

  if (gapResponses.length > 0) {
    console.log(`\n   Summary: ${confirmed} confirmed, ${skipped} skipped`);
  }

  // Show language patterns found
  if (analysis.languagePatterns.length > 0) {
    printDivider('LANGUAGE ALIGNMENT');
    console.log(`\n   Found ${analysis.languagePatterns.length} places to align your language with the JD:\n`);
    analysis.languagePatterns.slice(0, 8).forEach((p, i) => {
      console.log(`   ${i + 1}. "${p.jdTerm}" ← you have "${p.resumeEquivalent}"`);
    });
    if (analysis.languagePatterns.length > 8) {
      console.log(`   ... and ${analysis.languagePatterns.length - 8} more`);
    }
  }

  // ==========================================================================
  // STAGE 3: TAILOR
  // ==========================================================================

  printDivider('TAILORING');

  const humanInput: HumanReviewInput = {
    gapResponses,
    languagePatterns: analysis.languagePatterns,
  };

  console.log('\n   Generating tailored resume...\n');

  const startTailor = Date.now();
  const result = await tailorWithHumanInput(analysis.parsedResume, JOB_DESCRIPTION, humanInput);
  const tailorTime = ((Date.now() - startTailor) / 1000).toFixed(1);

  console.log(`   ✓ Done in ${tailorTime}s`);
  console.log(`   ${result.bulletChanges.length} bullets modified`);

  // ==========================================================================
  // STAGE 4: DIFF REVIEW
  // ==========================================================================

  printDivider('REVIEW CHANGES');

  const reviewedResume = await reviewBulletChanges(result.bulletChanges, result.finalResume);

  // ==========================================================================
  // STAGE 5: FINAL OUTPUT
  // ==========================================================================

  printDivider('FINAL RESUME');
  printFinalResume(reviewedResume);

  // JSON output option
  printDivider();
  const showJson = await ask('\n   Show JSON? (y/n): ');

  if (showJson.toLowerCase() === 'y') {
    console.log('\n' + JSON.stringify(reviewedResume, null, 2));
  }

  // Done
  const totalTime = ((Date.now() - startAnalysis) / 1000).toFixed(1);
  printDivider('COMPLETE');
  console.log(`\n   Total time: ${totalTime}s`);
  console.log(`   Gaps reviewed: ${gapResponses.length} (${confirmed} confirmed)`);
  console.log(`   Language patterns: ${analysis.languagePatterns.length}`);
  console.log(`   Bullets modified: ${result.bulletChanges.length}`);
  console.log('\n');

  rl.close();
}

main().catch((err) => {
  console.error('Error:', err);
  rl.close();
  process.exit(1);
});
