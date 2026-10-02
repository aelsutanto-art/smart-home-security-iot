'use strict';
const {sleep, runId, evidence, aws} = require('./hd_common');
const {settings, decide} = require('./hd_policy');
const cluster = 'smart-home-security-cluster', service = 'smart-home-processor-service';
async function main() {
  const id = runId(process.argv[2]);
  const mode = process.argv[3] || 'monitor';
  const seconds = Number(process.argv[4] || 600);
  if (!['monitor', 'adaptive'].includes(mode) || !Number.isInteger(seconds) || seconds < 10 || seconds > 3600) {
    throw Error('Usage: node hd_controller.js RUN_ID monitor|adaptive [seconds:10..3600]');
  }
  if (!process.env.EVENTS_QUEUE_URL) throw Error('EVENTS_QUEUE_URL is missing.');
  const write = evidence(`${id}-controller.jsonl`);
  let stop = false, state = {}, previous = null, taskSeconds = 0, failed = false;
  process.on('SIGINT', () => {stop = true;});
  const start = Date.now();
  write({kind: 'start', runId: id, mode, timestamp: new Date(start).toISOString(), seconds, settings});
  console.log(`${mode.toUpperCase()}: ${id}. ${mode === 'monitor' ? 'Observations only.' : 'Will adjust this service between 1 and 3 tasks.'}`);
  try {
    while (!stop) {
      const tick = Date.now();
      const [queue, ecs] = await Promise.all([
        aws(['sqs', 'get-queue-attributes', '--queue-url', process.env.EVENTS_QUEUE_URL, '--attribute-names',
          'ApproximateNumberOfMessages', 'ApproximateNumberOfMessagesNotVisible', 'ApproximateNumberOfMessagesDelayed']),
        aws(['ecs', 'describe-services', '--cluster', cluster, '--services', service])
      ]);
      const s = ecs.services?.[0];
      if (ecs.failures?.length || !s || s.status !== 'ACTIVE') throw Error('Service not available.');
      const a = queue.Attributes || {}, now = Date.now();
      const sample = {kind: 'sample', runId: id, timestamp: new Date(now).toISOString(),
        visible: Number(a.ApproximateNumberOfMessages), inflight: Number(a.ApproximateNumberOfMessagesNotVisible),
        delayed: Number(a.ApproximateNumberOfMessagesDelayed), desired: s.desiredCount, running: s.runningCount, pending: s.pendingCount};
      for (const field of ['visible', 'inflight', 'delayed', 'desired', 'running', 'pending']) {
        if (!Number.isInteger(sample[field]) || sample[field] < 0) throw Error(`Invalid observation: ${field}`);
      }
      if (previous) taskSeconds += previous.running * (now - previous.time) / 1000;
      previous = {running: sample.running, time: now};
      write(sample);
      console.log(`${sample.timestamp} | queue ${sample.visible} | in-flight ${sample.inflight} | running ${sample.running} | desired ${sample.desired} | pending ${sample.pending}`);
      if (stop || now - start >= seconds * 1000) break;
      if (mode === 'adaptive') {
        const decision = decide(sample, state, now); state = decision.state;
        if (decision.target !== sample.desired) {
          write({kind: 'scale_requested', timestamp: new Date().toISOString(), from: sample.desired, to: decision.target, reason: decision.reason});
          await aws(['ecs', 'update-service', '--cluster', cluster, '--service', service, '--desired-count', String(decision.target)]);
          state.lastChange = Date.now(); state.high = 0; state.emptySince = null;
          write({kind: 'scale_accepted', timestamp: new Date().toISOString(), to: decision.target});
          console.log(`SCALING: desired count -> ${decision.target}`);
        }
      }
      const wait = Math.max(0, settings.pollSeconds * 1000 - (Date.now() - tick));
      for (let remaining = wait; remaining > 0 && !stop; remaining -= 250) await sleep(Math.min(250, remaining));
    }
  } catch (error) {
    failed = true; write({kind: 'error', timestamp: new Date().toISOString(), message: error.message}); throw error;
  } finally {
    write({kind: 'end', timestamp: new Date().toISOString(), approximateRunningTaskSeconds: taskSeconds, interrupted: stop, failed});
    console.log('Controller ended. AWS tasks retain their current desired count; stopping this program does not stop the service.');
  }
}
main().catch(error => {console.error(error.message); process.exitCode = 1;});
