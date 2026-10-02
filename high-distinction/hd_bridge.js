'use strict';
const mqtt = require('mqtt');
const {SQSClient, SendMessageCommand} = require('@aws-sdk/client-sqs');
const {evidence} = require('./hd_common');
if (!process.env.EVENTS_QUEUE_URL || !process.env.HD_MQTT_TOPIC) throw Error('HD environment settings are missing.');
const sqs = new SQSClient({region: 'us-east-1'});
const write = evidence(`bridge-${Date.now()}.jsonl`);
const client = mqtt.connect('mqtt://broker.hivemq.com:1883');
let forwarded = 0, pending = 0;
client.on('connect', () => client.subscribe(process.env.HD_MQTT_TOPIC, {qos: 1}, (error, grants) => {
  if (error || grants.some(g => g.qos === 128)) {console.error('Subscription failed'); client.end(true); process.exitCode = 1; return;}
  console.log('HD BRIDGE READY. Leave this window open.');
}));
client.on('message', async (topic, message) => {
  let event;
  try {event = JSON.parse(message.toString());} catch {return;}
  if (!event.runId || !event.eventId || event.deviceType !== 'motion') return;
  pending++;
  try {
    const queuedAt = new Date().toISOString();
    await sqs.send(new SendMessageCommand({QueueUrl: process.env.EVENTS_QUEUE_URL,
      MessageBody: JSON.stringify({...event, mqttTopic: topic, queuedAt})}));
    forwarded++;
    write({kind: 'forwarded', runId: event.runId, eventId: event.eventId, queuedAt, timestamp: new Date().toISOString()});
    if (forwarded % 50 === 0 || forwarded <= 10) console.log(`Forwarded ${forwarded} to SQS`);
  } catch (error) {
    write({kind: 'forward_error', runId: event.runId, eventId: event.eventId, message: error.message});
    console.error('SQS forwarding failed:', error.message);
  } finally {pending--;}
});
client.on('error', error => console.error('MQTT:', error.message));
process.on('SIGINT', () => {console.log(`Closing bridge; ${pending} sends still pending.`); client.end(false, () => sqs.destroy());});
