import { spawn } from 'node:child_process';

const steps = [
  ['목록 크롤링', ['run', 'crawl:suto']],
  ['본문 보강', ['run', 'crawl:suto:body']],
  ['Supabase 확인', ['run', 'verify:supabase']],
];

for (const [label, args] of steps) {
  console.log(`\n== ${label} ==`);
  await runNpm(args);
}

function runNpm(args) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.platform === 'win32' ? 'npm.cmd' : 'npm', args, {
      cwd: process.cwd(),
      env: {
        ...process.env,
        SUTO_BODY_LIMIT: process.env.SUTO_BODY_LIMIT ?? '80',
      },
      stdio: 'inherit',
    });

    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`npm ${args.join(' ')} failed with exit code ${code}`));
    });
  });
}
