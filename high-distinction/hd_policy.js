'use strict';
// Pilot settings: freeze these before collecting the comparison trials.
const settings = Object.freeze({pollSeconds: 10, maxTasks: 3,
  backlogPerWorker: 20, highSamples: 2, emptySeconds: 90, cooldownSeconds: 120});
function decide(sample, state, now) {
  const next = {...state};
  for (const key of ['visible', 'inflight', 'delayed', 'running', 'pending', 'desired']) {
    if (!Number.isInteger(sample[key]) || sample[key] < 0) throw Error(`Invalid ${key}`);
  }
  if (sample.desired < 1 || sample.desired > settings.maxTasks) {
    throw Error('Adaptive mode requires desired count between 1 and 3.');
  }
  const high = sample.visible / Math.max(sample.running, 1) > settings.backlogPerWorker;
  next.high = high ? (state.high || 0) + 1 : 0;
  const empty = sample.visible + sample.inflight + sample.delayed === 0;
  next.emptySince = empty ? (state.emptySince ?? now) : null;
  const stable = sample.pending === 0 && sample.running === sample.desired;
  const cooled = now - (state.lastChange ?? -Infinity) >= settings.cooldownSeconds * 1000;
  let target = sample.desired, reason = 'hold';
  if (stable && cooled && high && next.high >= settings.highSamples && target < settings.maxTasks) {
    target = settings.maxTasks; reason = 'sustained_backlog';
  } else if (stable && cooled && empty && now - next.emptySince >= settings.emptySeconds * 1000 && target > 1) {
    target = 1; reason = 'sustained_empty_queue';
  }
  return {target, reason, state: next};
}
module.exports = {settings, decide};
