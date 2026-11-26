import PQueue from 'p-queue';

const queues = {
  media: new PQueue({ concurrency: 2 }),
  upload: new PQueue({ concurrency: 3 }),
  backup: new PQueue({ concurrency: 1 })
};

const history = [];

export function enqueue(queueName, fn, label = 'job') {
  const q = queues[queueName] ?? queues.media;
  const job = { label, queueName, addedAt: new Date(), status: 'pending', error: null };
  history.unshift(job);
  if (history.length > 200) history.pop();

  q.add(async () => {
    job.status = 'running';
    job.startedAt = new Date();
    try {
      await fn();
      job.status = 'done';
    } catch (e) {
      job.status = 'failed';
      job.error = e.message;
      console.error(`[queue:${queueName}] Job "${label}" failed:`, e.message);
    } finally {
      job.finishedAt = new Date();
    }
  });

  return job;
}

export function getStats() {
  return Object.entries(queues).map(([name, q]) => ({
    name,
    pending: q.size,
    running: q.pending
  }));
}

export function getHistory(limit = 50) {
  return history.slice(0, limit);
}
