// dashboard.js — minimal Express dashboard (view jobs, DLQ, workers)
const express = require('express');
const jobStore = require('./jobStore');
const cfg = require('./config.json');
const path = require('path');
const app = express();

app.use(express.json());
app.set('json spaces', 2);

app.get('/', (req, res) => {
  res.send(`<h2>queuectl dashboard</h2>
    <p>Endpoints:</p>
    <ul>
      <li>/api/status</li>
      <li>/api/jobs</li>
      <li>/api/jobs?state=pending</li>
      <li>/api/dlq</li>
      <li>/api/workers</li>
    </ul>`);
});

app.get('/api/status', (req, res) => {
  const st = jobStore.statusSummary();
  res.json(st);
});

app.get('/api/jobs', (req, res) => {
  const state = req.query.state;
  const rows = jobStore.listByState(state);
  res.json(rows);
});

app.get('/api/dlq', (req, res) => {
  const rows = jobStore.dlqList();
  res.json(rows);
});

app.get('/api/workers', (req, res) => {
  const rows = jobStore.listWorkers();
  res.json(rows);
});

// static logs view (basic)
app.get('/logs/:filename', (req, res) => {
  const logsDir = cfg.logs_dir || './logs';
  const p = path.join(logsDir, req.params.filename);
  res.sendFile(path.resolve(p));
});

const port = cfg.dashboard_port || 3000;
app.listen(port, () => {
  console.log(`queuectl dashboard listening on http://localhost:${port}`);
});
