'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('fs');
const path = require('path');
test('processor finishes an accepted event during shutdown, preserves IDs, writes result before deleting input', async () => {
  const actions = [], lines = [], signals = {};
  const event = {runId: 'test-01', eventId: 'test-01-1', sequence: 1, phase: 'low',
    homeId: 'home1', deviceId: 'motion1', deviceType: 'motion', value: 'detected', queuedAt: new Date(Date.now() + 60000).toISOString()};
  const sentTime = Date.now() - 1000;
  class ReceiveMessageCommand {constructor(input) {this.input = input;}}
  class SendMessageCommand {constructor(input) {this.input = input;}}
  class DeleteMessageCommand {constructor(input) {this.input = input;}}
  let finish;
  const done = new Promise(resolve => {finish = resolve;});
  class SQSClient {
    async send(command) {
      actions.push(command);
      if (command instanceof ReceiveMessageCommand) {
        signals.SIGTERM();
        assert.ok(command.input.MessageSystemAttributeNames.includes('SentTimestamp'));
        return {Messages: [{Body: JSON.stringify(event), ReceiptHandle: 'receipt', Attributes: {SentTimestamp: String(sentTime)}}]};
      }
      return {};
    }
    destroy() {finish();}
  }
  const context = {require: name => {
    if (name === 'dotenv') return {config() {}};
    if (name === 'os') return {hostname: () => 'test-worker'};
    if (name === '@aws-sdk/client-sqs') return {SQSClient, ReceiveMessageCommand, SendMessageCommand, DeleteMessageCommand};
    throw Error(name);
  }, process: {env: {AWS_REGION: 'us-east-1', EVENTS_QUEUE_URL: 'events', RESULTS_QUEUE_URL: 'results'},
    on: (name, fn) => {signals[name] = fn;}},
  console: {log: value => lines.push(value), error: error => {throw Error(String(error));}},
  setTimeout: fn => setImmediate(fn)};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, 'processor.js'), 'utf8'), context);
  await done;
  assert.deepEqual(actions.map(action => action.constructor.name), ['ReceiveMessageCommand', 'SendMessageCommand', 'DeleteMessageCommand']);
  const result = JSON.parse(actions[1].input.MessageBody);
  assert.equal(result.eventId, event.eventId);
  assert.equal(result.runId, event.runId);
  assert.equal(result.severity, 'WARNING');
  assert.equal(result.workerId, 'test-worker');
  assert.ok(result.latencyMs >= 0);
  assert.equal(result.metricVersion, 'sqs-sent-to-processed-v2');
  assert.equal(result.latencyMs, new Date(result.processedAt).getTime() - sentTime);
  assert.ok(result.bridgeToProcessedMs < 0, 'Laptop clock skew must not corrupt the cloud metric');
  assert.ok(lines.some(line => typeof line === 'string' && line.includes('"kind":"processed"')));
});
