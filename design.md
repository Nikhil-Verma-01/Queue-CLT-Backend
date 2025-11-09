
---

## 🧠 **design.md**

```markdown
# 🧠 Design Document — QueueCTL

## 1. Overview
QueueCTL is a CLI-driven job queue built in Node.js for managing asynchronous workloads.  
It provides fault-tolerant execution with retry, delay, and priority handling, making it ideal for background job orchestration.

---

## 2. Core Components

### 2.1 CLI (`cli.js`)
- Uses **Commander.js** for argument parsing.
- Commands: `enqueue`, `start`, `list`, `retry`, `status`, `dlq`.
- Interacts directly with the job store and worker pool.

### 2.2 Queue Manager (`queue.js`)
- Central module for job lifecycle management.
- Maintains job states: `pending`, `processing`, `completed`, `failed`, `delayed`.
- Supports:
  - Priority-based insertion
  - Retry tracking
  - Scheduling (timestamp-based delays)
- Exposes methods:
  - `enqueue(job)`
  - `dequeue()`
  - `listByState(state)`
  - `retry(jobId)`

### 2.3 Worker Pool (`worker.js`)
- Executes jobs concurrently with configurable worker count.
- Handles:
  - Job fetching & locking
  - Retry attempts with exponential backoff
  - Timeout handling
  - Graceful shutdowns (SIGINT, SIGTERM)
- Uses Promises to handle job resolution and error capture.

### 2.4 Scheduler (`scheduler.js`)
- Periodically scans for scheduled jobs whose execution time has arrived.
- Moves them from `delayed` → `pending`.
- Runs on an interval (`SCHEDULE_INTERVAL`).

### 2.5 Config (`config.json`)
- Contains tunable parameters like:
  ```json
  {
    "max_retries": 3,
    "backoff_multiplier": 2,
    "worker_count": 4,
    "schedule_interval": 5000
  }


### Components Overview:

| Component | Description |
|------------|-------------|
| **CLI** | User-facing command-line tool built with Commander.js; used to add, list, remove, retry, or inspect jobs |
| **Queue Manager** | Manages job creation, priority queues, retries, and DLQ. Acts as the central in-memory broker |
| **Worker** | Executes jobs concurrently, reports status, and handles backoff/retry logic |
| **Dashboard** | Express-based visualization layer showing job states and queue metrics |

---

## 3. ⚙️ Core Modules

| Module | File | Purpose |
|--------|------|----------|
| `queue.js` | `/src/queue.js` | Defines queue structure, manages job states, handles enqueue/dequeue |
| `job.js` | `/src/job.js` | Defines Job schema (id, name, status, attempts, timestamps, etc.) |
| `worker.js` | `/src/worker.js` | Picks jobs from queue, executes them, updates status, handles failures |
| `scheduler.js` | `/src/scheduler.js` | Handles delayed/scheduled jobs using timers or intervals |
| `dashboard.js` | `/dashboard.js` | Express app serving real-time queue data for monitoring |
| `cli.js` | `/cli.js` | CLI interface built using Commander.js |
| `utils.js` | `/src/utils.js` | Helper functions (logging, delay, retry calculation, etc.) |

---

## 4. 🔄 Job Lifecycle

Each job moves through multiple states, tracked in the queue memory and dashboard.

+-------------+
| Created |
+------+------+
|
v
+------+------+
| Queued |
+------+------+
|
v
+------+------+
| Processing |
+------+------+
|
+------+------+
| Completed |<------+
+-------------+ |
| |
v |
+-------------+ |
| Failed +-------+
+------+------+
|
v
+-------------+
| DLQ (if |
| retries max)|
+-------------+


---

## 5. 🧮 Retry & Backoff Mechanism

- **Retry count:** Configurable per job (default: 3)  
- **Backoff strategy:** Exponential (e.g., delay × 2 per retry)  
- **Failure handling:**  
  - If job fails after all retries → pushed to **DLQ**  
  - If worker crashes mid-process → job re-queued  

Example:

| Attempt | Delay (ms) |
|----------|-------------|
| 1 | 2000 |
| 2 | 4000 |
| 3 | 8000 |

---

## 6. ⚖️ Priority Scheduling

Jobs are inserted into the queue based on **priority level**:
- `high` → processed first  
- `medium` → processed next  
- `low` → last  

Implementation uses a **Min-Heap** or sorted array to maintain priority ordering.

---

## 7. ⏰ Scheduled Jobs

QueueCTL supports scheduling via:
```bash
queuectl add "send-report" --delay 60000
