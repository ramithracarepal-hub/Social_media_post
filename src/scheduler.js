// Local testing only: keeps running and does what GitHub Actions does in the cloud.
import cron from 'node-cron';
import { publishDue } from './publish.js';
import { spawn } from 'node:child_process';

console.log('Scheduler running. Ctrl+C to stop.');

cron.schedule('* * * * *', () => publishDue().catch((e) => console.error(e)));

cron.schedule('5 0 * * *', () => {
  spawn('node', ['src/generate.js'], { stdio: 'inherit' });
});
