import dotenv from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { RESUME, JOB_DESCRIPTION } from './inputs.js';
import { tailorResumeForJob } from './core.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, '..', '.env') });

async function main() {
  console.log('='.repeat(60));
  console.log('RESUME TAILOR - PMF Edition');
  console.log('='.repeat(60));

  const startTime = Date.now();

  const result = await tailorResumeForJob(RESUME, JOB_DESCRIPTION);

  const duration = ((Date.now() - startTime) / 1000).toFixed(1);

  console.log('\n=== MATCH SCORE ===');
  console.log(result.matchScore ?? 'N/A');

  console.log('\n=== KEY CHANGES ===');
  if (result.keyChanges.length > 0) {
    result.keyChanges.forEach((c) => console.log(`- ${c}`));
  } else {
    console.log('No changes reported');
  }

  if (result.issues && result.issues.length > 0) {
    console.log('\n=== ISSUES ===');
    result.issues.forEach((i) =>
      console.log(`[${i.type}] ${i.description}`)
    );
  }

  console.log('\n=== FINAL TAILORED RESUME JSON ===');
  console.log(JSON.stringify(result.finalResume, null, 2));

  console.log('\n' + '='.repeat(60));
  console.log(`Completed in ${duration}s (2 API calls)`);
  console.log('='.repeat(60));
}

main().catch(console.error);
