// jobStore.js — persistence + atomic claiming + DLQ + retry scheduling
const db = require('./db');
const cfg = require('./config.json');
const { v4: uuidv4 } = require('uuid');

const nowIso = () => new Date().toISOString();

module.exports = {
  enqueue(job) {
    const id = job.id || uuidv4();
    const cmd = job.command;
    const created_at = job.created_at || nowIso();
    const max_retries = job.max_retries != null ? job.max_retries : cfg.default_max_retries || 3;
    const priority = job.priority != null ? job.priority : 0;
    const timeout_seconds = job.timeout_seconds != null ? job.timeout_seconds : cfg.default_timeout_seconds;
    const run_at = job.run_at || created_at;
    const output_log = job.output_log || null;
    db.prepare(`INSERT OR REPLACE INTO jobs
      (id, command, state, attempts, max_retries, priority, timeout_seconds, created_at, updated_at, run_at, output_log)
      VALUES (?,?,?,?,?,?,?,?,?,?,?)`)
      .run(id, cmd, 'pending', 0, max_retries, priority, timeout_seconds, created_at, created_at, run_at, output_log);
    return id;
  },

  listByState(state) {
    if (!state) return db.prepare(`SELECT * FROM jobs ORDER BY priority DESC, created_at DESC`).all();
    return db.prepare(`SELECT * FROM jobs WHERE state = ? ORDER BY priority DESC, created_at DESC`).all(state);
  },

  statusSummary() {
    const rows = db.prepare(`SELECT state, COUNT(*) as count FROM jobs GROUP BY state`).all();
    const counts = rows.reduce((acc, r) => { acc[r.state] = r.count; return acc; }, {});
    const workersCount = db.prepare(`SELECT COUNT(*) as count FROM workers`).get().count || 0;
    return { counts, active_workers: workersCount };
  },

  claimJob(workerId) {
    const now = nowIso();
    // Claim highest-priority pending job whose run_at <= now
    const tx = db.transaction(() => {
      const job = db.prepare(
        `SELECT * FROM jobs WHERE state = 'pending' AND (run_at IS NULL OR run_at <= ?) ORDER BY priority DESC, created_at ASC LIMIT 1`
      ).get(now);
      if (!job) return null;
      const res = db.prepare(
        `UPDATE jobs SET state = 'processing', worker_id = ?, locked_at = ?, updated_at = ? WHERE id = ? AND state = 'pending'`
      ).run(workerId, now, now, job.id);
      if (res.changes === 1) {
        return db.prepare(`SELECT * FROM jobs WHERE id = ?`).get(job.id);
      }
      return null;
    });
    return tx();
  },

  incrementAttempts(id) {
    const res = db.prepare(`UPDATE jobs SET attempts = attempts + 1 WHERE id = ?`).run(id);
    if (res.changes) {
      return db.prepare(`SELECT attempts, max_retries FROM jobs WHERE id = ?`).get(id);
    }
    return null;
  },

  markCompleted(id, outputLogPath) {
    const t = nowIso();
    db.prepare(`UPDATE jobs SET state = 'completed', updated_at = ?, output_log = ? WHERE id = ?`).run(t, outputLogPath, id);
  },

  markFailed(id, errMsg, attempts, maxRetries, base_backoff, outputLogPath) {
    const t = nowIso();
    attempts = attempts || 0;
    maxRetries = maxRetries || 0;
    if (attempts >= maxRetries) {
      db.prepare(`INSERT OR REPLACE INTO dead_jobs (id, command, last_error, attempts, max_retries, priority, created_at, moved_at, output_log)
                  SELECT id, command, ?, attempts, max_retries, priority, created_at, ?, output_log FROM jobs WHERE id = ?`)
        .run(errMsg, t, id);
      db.prepare(`DELETE FROM jobs WHERE id = ?`).run(id);
      return { movedToDLQ: true };
    } else {
      const delaySeconds = Math.pow(base_backoff || cfg.base_backoff || 2, attempts);
      const runAt = new Date(Date.now() + delaySeconds * 1000).toISOString();
      db.prepare(`UPDATE jobs SET state = 'pending', attempts = ?, updated_at = ?, worker_id = NULL, locked_at = NULL, run_at = ?, output_log = ? WHERE id = ?`)
        .run(attempts, t, runAt, outputLogPath, id);
      return { scheduledAt: runAt };
    }
  },

  getJob(id) {
    return db.prepare(`SELECT * FROM jobs WHERE id = ?`).get(id) || db.prepare(`SELECT * FROM dead_jobs WHERE id = ?`).get(id);
  },

  dlqList() {
    return db.prepare(`SELECT * FROM dead_jobs ORDER BY moved_at DESC`).all();
  },

  retryDLQ(id) {
    const dj = db.prepare(`SELECT * FROM dead_jobs WHERE id = ?`).get(id);
    if (!dj) return null;
    const now = nowIso();
    db.prepare(`INSERT OR REPLACE INTO jobs (id, command, state, attempts, max_retries, priority, timeout_seconds, created_at, updated_at, run_at, output_log)
      VALUES (?,?,?,?,?,?,?,?,?,?,?)`)
      .run(dj.id, dj.command, 'pending', 0, dj.max_retries, dj.priority || 0, null, dj.created_at || now, now, now, dj.output_log);
    db.prepare(`DELETE FROM dead_jobs WHERE id = ?`).run(id);
    return dj.id;
  },

  registerWorker(id, pid) {
    const now = nowIso();
    db.prepare(`INSERT OR REPLACE INTO workers (id, pid, started_at) VALUES (?,?,?)`).run(id, pid, now);
  },

  unregisterWorker(id) {
    db.prepare(`DELETE FROM workers WHERE id = ?`).run(id);
  },

  listWorkers() {
    return db.prepare(`SELECT * FROM workers`).all();
  }
};
