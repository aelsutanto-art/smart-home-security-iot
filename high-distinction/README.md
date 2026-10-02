# High Distinction implementation

## Components

- `hd_policy.js`: pure decision logic; backlog per worker above 20 for two observations requests three workers. Ninety seconds with visible, in-flight and delayed counts zero requests one. Stability checks and a 120-second cooldown guard changes.
- `hd_controller.js`: observes SQS and ECS approximately every ten seconds; monitor mode only observes, adaptive mode can change desired capacity.
- `hd_load_test.js`: 60 events at 1/s followed by 1,200 at 10/s, with deterministic device/value sequence and unique IDs. Optional `smoke` mode sends ten events.
- `hd_bridge.js`: QoS 1 MQTT subscription, SQS forwarding and local evidence records.
- `processor.js`: security decisions, result-before-delete ordering, completion logs and graceful shutdown. Latency uses SQS SentTimestamp to processedAt, excluding MQTT, bridge transmission, result writing and deletion.

## Offline checks

```powershell
node --test hd_policy.test.js hd_processor.test.js
```

## Cloud experiment sequence

First complete the root README setup, deploy the HD image and ensure the input queue is empty. The adaptive controller requires an already-running service with desired count between one and three. Use a new run ID for every trial because evidence files cannot be overwritten.

1. In terminal 1, start `node hd_bridge.js`.
2. For fixed one or fixed three, set the ECS service to the chosen count and wait for it to stabilise. In terminal 2, start `node hd_controller.js YOUR_RUN_ID monitor 600`.
3. For an adaptive trial, start with one stable worker instead, and use `node hd_controller.js YOUR_RUN_ID adaptive 600` in terminal 2.
4. Once observations begin, run `node hd_load_test.js YOUR_RUN_ID` in terminal 3. Keep the same run ID between controller and producer for that trial.
5. Leave the controller running for recovery. Export CloudWatch JSON completion records filtered by runId; compare the 1,260 expected event IDs with producer and bridge records, not just MQTT acknowledgements.
6. Allow the queue to drain before the next run. Run two trials of each configuration with the same image and workload settings.
7. At the end, stop the controller and bridge, then explicitly set the ECS service desired count to zero and verify running/pending counts are zero.

A preliminary smoke trial can use `node hd_load_test.js UNIQUE_RUN_ID smoke`. Cloud commands require prepared resources and may incur charges. Offline tests do not contact AWS.

## Interpretation

SQS queue counts are approximate. The controller depends on the local computer and assumes sufficiently aligned AWS clocks for latency. A public broker, simulated delay, bounded one-to-three scaling and two trials per configuration limit generalisation. There is no persistent deduplication store.

Queue-metric motivation: Gotin et al., ICPE 2018, doi:10.1145/3184407.3184430. The report also discusses Apat et al., SN Computer Science 2026, doi:10.1007/s42979-026-04997-4. The policy thresholds are project choices; this code does not reproduce either paper's full experiment or the fog-cloud analytical model.
