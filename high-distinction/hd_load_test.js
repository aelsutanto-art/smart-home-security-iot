'use strict';
const mqtt = require('mqtt');
const {performance} = require('perf_hooks');
const {sleep, runId, evidence} = require('./hd_common');
async function main() {
  const id = runId(process.argv[2]);
  const smoke = process.argv[3] === 'smoke';
  if (process.argv[3] && !smoke) throw Error('Optional third argument must be smoke.');
  const write = evidence(`${id}-producer.jsonl`);
  const phases = smoke ? [{name: 'smoke', count: 10, interval: 1000}] :
    [{name: 'low', count: 60, interval: 1000}, {name: 'burst', count: 1200, interval: 100}];
  const expected = phases.reduce((sum, p) => sum + p.count, 0);
  const topic = process.env.HD_MQTT_TOPIC;
  if (!topic) throw Error('HD_MQTT_TOPIC missing. Run the HD file installer.');
  const client = mqtt.connect('mqtt://broker.hivemq.com:1883', {reconnectPeriod: 0, connectTimeout: 15000});
  let fatal = null; client.on('error', error => {fatal = error;});
  try {
    await new Promise((resolve, reject) => {client.once('connect', resolve); client.once('error', reject);});
    let sequence = 0, acknowledged = 0, phaseOffset = 0;
    const start = performance.now();
    write({kind: 'start', runId: id, timestamp: new Date().toISOString(), phases, expected});
    for (const phase of phases) {
      console.log(`Phase: ${phase.name}`);
      for (let i = 0; i < phase.count; i++) {
        const due = start + phaseOffset + i * phase.interval;
        await sleep(Math.max(0, due - performance.now()));
        if (fatal || !client.connected) throw fatal || Error('MQTT connection lost.');
        sequence++;
        const event = {runId: id, eventId: `${id}-${sequence}`, sequence, phase: phase.name,
          homeId: 'home1', deviceId: `motion${(sequence - 1) % 100 + 1}`, deviceType: 'motion',
          value: sequence % 2 ? 'detected' : 'clear', timestamp: new Date().toISOString()};
        write({kind: 'sent', ...event, scheduleLatenessMs: performance.now() - due});
        // QoS 1 confirms broker receipt, not successful arrival at SQS.
        client.publish(topic, JSON.stringify(event), {qos: 1}, error => {
          if (error) {fatal = error; return;}
          acknowledged++; write({kind: 'broker_ack', eventId: event.eventId, timestamp: new Date().toISOString()});
        });
        if (sequence % 100 === 0 || sequence === expected) console.log(`Sent ${sequence}/${expected}`);
      }
      phaseOffset += phase.count * phase.interval;
    }
    const deadline = Date.now() + 30000;
    while (acknowledged < expected && Date.now() < deadline && !fatal) await sleep(100);
    if (fatal) throw fatal;
    write({kind: 'end', runId: id, timestamp: new Date().toISOString(), sent: sequence, acknowledged, expected});
    if (acknowledged !== expected) throw Error(`Only ${acknowledged}/${expected} broker acknowledgements.`);
    console.log(`LOAD COMPLETE: ${sequence} sent, ${acknowledged} broker acknowledgements. Leave the controller running for the recovery period.`);
  } finally {client.end(true);}
}
main().catch(error => {console.error(error.message); process.exitCode = 1;});
