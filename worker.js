#!/usr/bin/env node
// worker.js — worker process: claim job, execute, handle timeout, capture stdout/stderr, retry/backoff, DLQ
const jobStore = require('./jobStore');
const { spawn } = require('child_process');
const { v4: uuidv4 } = require('uuid');
const cfg = require('./config.json');
const fs = require('fs');
const path = require('path');
const { handleError } = require('./errorHandler');

const workerId = process.env.WORKER_ID || uuidv4();
const pid = process.pid;
jobStore.registerWorker(workerId, pid);

const logsDir = cfg.logs_dir || './logs';
if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true });

let shuttingDown = false;
process.on('SIGTERM', () => { console.log(`[worker ${workerId}] SIGTERM received — finishing current job`); shuttingDown = true; });
process.on('SIGINT', () => { console.log(`[worker ${workerId}] SIGINT received — finishing current job`); shuttingDown = true; });

async function sleep(ms){ return new Promise(r=>setTimeout(r,ms)); }

async function runLoop(){
  try{
    while(!shuttingDown){
      const job = jobStore.claimJob(workerId);
      if(!job){
        await sleep(1000);
        continue;
      }

      console.log(`[worker ${workerId}] Claimed job ${job.id} (priority=${job.priority}) : ${job.command}`);
      const attemptsRow = jobStore.incrementAttempts(job.id);
      const attempts = attemptsRow ? attemptsRow.attempts : (job.attempts + 1);

      // prepare log file for this run (append)
      const jobLogPath = path.join(logsDir, `job_${job.id}.log`);
      const outStream = fs.createWriteStream(jobLogPath, { flags: 'a' });
      outStream.write(`\n\n===== Run at ${new Date().toISOString()} (attempt ${attempts}) =====\n`);

      // spawn command in shell
      const child = spawn(job.command, { shell: true });

      // pipe stdout/stderr
      child.stdout.on('data', (d) => { outStream.write(`[stdout] ${d.toString()}`); process.stdout.write(d); });
      child.stderr.on('data', (d) => { outStream.write(`[stderr] ${d.toString()}`); process.stderr.write(d); });

      let finished = false;
      let exitCode = null;

      // timeout handling
      const timeoutSeconds = job.timeout_seconds != null ? job.timeout_seconds : cfg.default_timeout_seconds;
      let killTimer = null;
      if (timeoutSeconds && timeoutSeconds > 0) {
        killTimer = setTimeout(() => {
          if (!finished) {
            outStream.write(`\n[timeout] Job exceeded ${timeoutSeconds}s. Killing process.\n`);
            try { process.kill(child.pid, 'SIGTERM'); } catch(e){ /* ignore */ }
          }
        }, timeoutSeconds * 1000);
      }

      child.on('exit', code => { exitCode = code; });
      await new Promise(resolve => child.on('close', resolve));
      finished = true;
      if (killTimer) clearTimeout(killTimer);

      outStream.write(`\n===== Exit code: ${String(exitCode)} =====\n`);
      outStream.end();

      if (exitCode === 0) {
        jobStore.markCompleted(job.id, jobLogPath);
        console.log(`[worker ${workerId}] Job ${job.id} completed.`);
      } else {
        const base = cfg.base_backoff || 2;
        const res = jobStore.markFailed(job.id, `exit_code=${exitCode}`, attempts, job.max_retries, base, jobLogPath);
        if (res.movedToDLQ) {
          console.log(`[worker ${workerId}] Job ${job.id} moved to DLQ after ${attempts} attempts.`);
        } else {
          console.log(`[worker ${workerId}] Job ${job.id} scheduled retry at ${res.scheduledAt} (attempt ${attempts}).`);
        }
      }

      if (shuttingDown) break;
    }
  } catch (err) {
    const e = handleError('worker.runLoop', err);
    console.error(e.message);
  } finally {
    jobStore.unregisterWorker(workerId);
    console.log(`[worker ${workerId}] exiting.`);
    process.exit(0);
  }
}

runLoop();
