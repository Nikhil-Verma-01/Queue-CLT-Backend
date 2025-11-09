# 🚀 QueueCTL — Node.js Job Queue CLI with Dashboard

QueueCTL is a powerful and extensible **job queue management CLI** built in **Node.js**, designed to simulate real-world distributed queue systems like BullMQ or Celery. It supports **retries, backoff strategies, priorities, dead-letter queues, scheduled jobs, and timeout handling** — all accessible from an intuitive **command-line interface** and an optional **web dashboard**.

---

## 🧠 Overview

This project demonstrates how to implement a **robust asynchronous job management system** in Node.js, complete with CLI controls, background workers, and a monitoring dashboard.

QueueCTL is ideal for developers and teams who want to:
- Learn about message queues and job scheduling concepts  
- Experiment with worker systems and concurrency  
- Manage background tasks locally or on servers  
- Monitor queue health visually through a simple dashboard  

---

## ⚙️ Features

| Feature | Description |
|----------|--------------|
| 🧩 **CLI Tooling** | Interact with your queues and jobs using an easy-to-use command-line interface |
| 🔁 **Retries & Backoff** | Automatic retries with exponential backoff for failed jobs |
| 🧮 **Priorities** | Execute high-priority jobs before lower ones |
| ⏰ **Scheduled Jobs** | Schedule jobs for future execution using timestamps or delays |
| ⛔ **Timeout Handling** | Automatically mark jobs as failed if they exceed their max runtime |
| 🪣 **Dead Letter Queue (DLQ)** | Capture permanently failed jobs for later inspection |
| 📊 **Dashboard** | Visualize active, pending, failed, and completed jobs through a browser-based dashboard |
| 🔧 **Configuration Driven** | Fully configurable through JSON or environment variables |
| 🧪 **Automated Tests** | Jest-based test suite for validating core features |

---

## 🧱 Folder Structure

queuectl/
├── cli.js # Entry point for CLI commands
├── dashboard.js # Express server for dashboard UI
|
│── queue.js # Core queue management logic
│── worker.js # Worker process handling job execution
│── job.js # Job class with status, priority, and metadata
│── utils.js # Helpers and utilities
│ 
├── tests/
|── queueclt.test.js
│ 
├── package.json
├── README.md
└── design.md


---

## 🛠️ Installation

```bash
# Clone the repository
git clone https://github.com/Nikhil-Verma-01/Queue-CLT-Backend.git
cd queuectl

# Install dependencies
npm install

# Make CLI executable globally (optional)
npm link

# 1. Enqueue a job
queuectl enqueue '{"command": "send-email", "priority": "high", "max_retries": 2, "timeout_seconds": 30}'

# 2. Start worker(s)
queuectl worker:start --count 2

# 3. View job list
queuectl list

# 4. Check summary
queuectl status

# 5. View dashboard
queuectl dashboard:start

```
## 🧪 Testing
```bash
npm test

npm --coverage
```

## Desgin Overview
For a detailed architecture breakdown, check design.md

That document covers:
--Queue architecture and lifecycle
--Retry/backoff logic
--DLQ and timeout handling
--Dashboard data flow
--CLI and worker interaction diagram


## 🧑‍💼 Author

Nikhil Verma
Final-year B.Tech, NIT Jaipur
Email: [nik.h0ill907gmail.com]
LinkedIn: [linkedin.com/in/yourprofile](https://www.linkedin.com/in/nikhil-verma-b38800263/)
