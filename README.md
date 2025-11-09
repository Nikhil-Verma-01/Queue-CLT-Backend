# ⚙️ QueueCTL

**QueueCTL** is a Node.js-based CLI job queue that supports retries, exponential backoff, delayed scheduling, worker concurrency, and dead-letter queue (DLQ) management — all from the command line.

---

## 🚀 Features
- 🧰 Full CLI interface for job and worker management  
- 🔁 Automatic retries with exponential backoff  
- 🕒 Scheduled and delayed job execution  
- ⚡ Concurrent worker pool with graceful shutdown  
- 🗂️ Job prioritization and timeouts  
- 💀 Dead Letter Queue (DLQ) for failed jobs  
- 🧩 Modular architecture (CLI, Queue, Worker, Scheduler)

---

## 🛠️ Installation

```bash
npm install -g queuectl
git clone https://github.com/yourusername/queuectl.git
cd queuectl
npm install

