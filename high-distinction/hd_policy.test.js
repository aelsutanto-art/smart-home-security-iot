'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const {decide} = require('./hd_policy');
const sample = {visible: 0, inflight: 0, delayed: 0, running: 1, desired: 1, pending: 0};
test('brief backlog does not scale; sustained backlog scales to three', () => {
  const high = {...sample, visible: 30};
  const first = decide(high, {}, 0); assert.equal(first.target, 1);
  assert.equal(decide(high, first.state, 10000).target, 3);
});
test('pending startup and cooldown prevent repeated scaling', () => {
  assert.equal(decide({...sample, visible: 100, pending: 1}, {high: 3}, 150000).target, 1);
  assert.equal(decide({...sample, visible: 100}, {high: 3, lastChange: 100000}, 150000).target, 1);
});
test('scale-in requires sustained empty queue with no in-flight or delayed messages', () => {
  const three = {...sample, running: 3, desired: 3};
  let state = decide(three, {}, 0).state;
  assert.equal(decide(three, state, 89000).target, 3);
  assert.equal(decide(three, state, 90000).target, 1);
  assert.equal(decide({...three, inflight: 1}, state, 90000).target, 3);
  assert.equal(decide({...three, delayed: 1}, state, 90000).target, 3);
});
test('interrupted empty interval resets scale-in timer', () => {
  const three = {...sample, running: 3, desired: 3};
  let state = decide(three, {}, 0).state;
  state = decide({...three, visible: 1}, state, 80000).state;
  assert.equal(decide(three, state, 100000).target, 3);
});
test('invalid observations and stopped service cannot trigger adaptive mutations', () => {
  assert.throws(() => decide({...sample, visible: NaN}, {}, 0));
  assert.throws(() => decide({...sample, desired: 0}, {}, 0));
  assert.throws(() => decide({...sample, desired: 4}, {}, 0));
});
