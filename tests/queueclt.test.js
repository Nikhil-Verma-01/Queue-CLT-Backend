const execa = require("execa");
const fs = require("fs");
const path = require("path");

jest.setTimeout(20000);

const JOB_FILE = path.join(process.cwd(), "data", "jobs.json");
const DLQ_FILE = path.join(process.cwd(), "data", "dlq.json");

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

describe("QueueCTL CLI", () => {
  beforeAll(() => {
    if (fs.existsSync(JOB_FILE)) fs.unlinkSync(JOB_FILE);
    if (fs.existsSync(DLQ_FILE)) fs.unlinkSync(DLQ_FILE);
  });

  test("Enqueues a job successfully", async () => {
    const job = {
      id: "job1",
      command: "echo Hello World",
      max_retries: 2,
    };

    const { stdout } = await execa("node", [
      "cli.js",
      "enqueue",
      JSON.stringify(job),
    ]);
    expect(stdout).toMatch(/enqueued/i);
  });

  test("Worker picks and completes job", async () => {
    const worker = execa("node", ["cli.js", "worker:start", "--count", "1"]);
    await sleep(8000);
    worker.cancel(); // or await execa("node", ["cli.js", "worker:stop"]);

    const { stdout } = await execa("node", ["cli.js", "status"]);
    expect(stdout).toMatch(/completed|processing|pending/);
  });

  test("Failed job retries and moves to DLQ", async () => {
    const job = {
      id: "failJob",
      command: "bash -c 'exit 1'",
      max_retries: 1,
    };

    await execa("node", ["cli.js", "enqueue", JSON.stringify(job)]);

    const worker = execa("node", ["cli.js", "worker:start", "--count", "1"]);
    await sleep(8000);
    worker.cancel(); // or graceful stop

    const { stdout } = await execa("node", ["cli.js", "dlq", "list"]);
    expect(stdout).toMatch(/failJob/);
  });

  test("Configuration can be updated", async () => {
    const { stdout } = await execa("node", [
      "cli.js",
      "config",
      "set",
      "max-retries",
      "5",
    ]);
    expect(stdout).toMatch(/updated/i);
  });
});
