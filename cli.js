#!/usr/bin/env node
const { Command } = require('commander');
const program = new Command();
const jobStore = require('./jobStore');
const fs = require('fs');
const path = require('path');
const cfgPath = path.join(__dirname, 'config.json');
const cfg = require('./config.json');
const { fork } = require('child_process');
const { v4: uuidv4 } = require('uuid');
const { handleError } = require('./errorHandler');

program.name('queuectl').description('queuectl - CLI job queue').version('1.0.0');

program
  .command('enqueue <jobJson>')
  .description('Add a new job to the queue. JSON must include "command". Optional: id, max_retries, priority, timeout_seconds, run_at')
  .action((jobJson) => {
    try {
      const job = JSON.parse(jobJson);
      if (!job.command) throw new Error('job JSON must include "command"');
      const id = jobStore.enqueue(job);
      console.log('Enqueued job id:', id);
    } catch (err) {
      console.error(handleError('enqueue', err).message);
      process.exit(1);
    }
  });

program
  .command('list')
  .option('--state <state>', 'Filter by state (pending | processing | completed)')
  .description('List jobs')
  .action((opts) => {
    try {
      const rows = jobStore.listByState(opts.state);
      if (!rows.length) return console.log('No jobs found.');
      console.table(rows.map(r => ({ id: r.id, command: r.command, state: r.state, attempts: r.attempts, max_retries: r.max_retries, priority: r.priority, run_at: r.run_at, output_log: r.output_log })));
    } catch (err) {
      console.error(handleError('list', err).message);
    }
  });

program
  .command('status')
  .description('Show summary of job counts & active workers')
  .action(() => {
    try {
      const s = jobStore.statusSummary();
      console.log('Job counts:', s.counts);
      console.log('Active workers:', s.active_workers);
      const workers = jobStore.listWorkers();
      if (workers.length) console.table(workers);
    } catch (err) {
      console.error(handleError('status', err).message);
    }
  });

program
  .command('worker:start')
  .option('--count <n>', 'Number of workers to start', '1')
  .description('Start worker processes')
  .action((opts) => {
    try {
      const count = Math.max(1, parseInt(opts.count || '1', 10));
      console.log(`Starting ${count} worker(s)...`);
      for (let i = 0; i < count; i++) {
        const env = Object.assign({}, process.env, { WORKER_ID: uuidv4() });
        const child = fork(path.join(__dirname, 'worker.js'), { env, detached: true, stdio: 'inherit' });
        console.log(`Started worker pid ${child.pid}`);
      }
    } catch (err) {
      console.error(handleError('worker:start', err).message);
    }
  });

program
  .command('worker:stop')
  .description('Stop all workers (graceful)')
  .action(() => {
    try {
      const workers = jobStore.listWorkers();
      if (!workers.length) return console.log('No workers to stop.');
      for (const w of workers) {
        try {
          process.kill(w.pid, 'SIGTERM');
          console.log(`Sent SIGTERM to pid ${w.pid} (worker ${w.id})`);
        } catch (e) {
          console.error(handleError('worker:stop', e).message);
        }
      }
    } catch (err) {
      console.error(handleError('worker:stop', err).message);
    }
  });

const dlq = program.command('dlq').description('Dead Letter Queue');

dlq
  .command('list')
  .description('List DLQ jobs')
  .action(() => {
    try {
      const rows = jobStore.dlqList();
      if (!rows.length) return console.log('DLQ empty.');
      console.table(rows.map(r => ({ id: r.id, command: r.command, attempts: r.attempts, max_retries: r.max_retries, moved_at: r.moved_at, output_log: r.output_log })));
    } catch (err) {
      console.error(handleError('dlq:list', err).message);
    }
  });

dlq
  .command('retry <id>')
  .description('Retry a DLQ job (moves back to pending)')
  .action((id) => {
    try {
      const res = jobStore.retryDLQ(id);
      if (res) console.log('Requeued job id:', res);
      else console.log('DLQ job not found:', id);
    } catch (err) {
      console.error(handleError('dlq:retry', err).message);
    }
  });

const conf = program.command('config').description('Get/set configuration');

conf
  .command('set <key> <value>')
  .description('Set config key to value (numeric if parseable)')
  .action((key, value) => {
    try {
      const config = JSON.parse(fs.readFileSync(cfgPath));
      const num = Number(value);
      config[key] = isNaN(num) ? value : num;
      fs.writeFileSync(cfgPath, JSON.stringify(config, null, 2));
      console.log('Config updated:', key, '=>', config[key]);
    } catch (err) {
      console.error(handleError('config:set', err).message);
    }
  });

conf
  .command('get <key>')
  .action((key) => {
    try {
      const config = JSON.parse(fs.readFileSync(cfgPath));
      console.log(key, '=>', config[key]);
    } catch (err) {
      console.error(handleError('config:get', err).message);
    }
  });

program
  .command('get <id>')
  .description('Get job by id (jobs + DLQ)')
  .action((id) => {
    try {
      const j = jobStore.getJob(id);
      if (!j) return console.log('Job not found:', id);
      console.log(j);
    } catch (err) {
      console.error(handleError('get', err).message);
    }
  });

program
  .command('dashboard:start')
  .description('Start the minimal web dashboard (Express) for monitoring')
  .action(() => {
    try {
      const child = fork(path.join(__dirname, 'dashboard.js'), { detached: false, stdio: 'inherit' });
      console.log('Dashboard started as child process.');
    } catch (err) {
      console.error(handleError('dashboard:start', err).message);
    }
  });

if (!process.argv.slice(2).length) {
  program.outputHelp();
}
program.parse(process.argv);
