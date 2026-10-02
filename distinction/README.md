# Distinction implementation

Run `npm ci` and configure `.env` using `.env.example` as described in the root README.

1. Start `node mqtt_to_sqs.js` in one terminal.
2. Deploy the processor on Fargate, or run `node processor.js` locally for functional development. Do not use both as consumers during a benchmark.
3. Run `node door_sensor.js`, `node motion_sensor.js` or `node smoke_sensor.js` for individual simulated sensors.
4. For a benchmark, stop those publishers and allow the input queue to drain. Set the ECS service to one worker and wait until it is running, then execute `node load_test.js`.
5. Allow the queue to drain, manually set three workers, wait until all are running, then run the same load test again.
6. Use the queries in `queries.txt` with separate time ranges for each run. Stop the bridge and scale the service to zero after evidence collection.

Each load test sends 200 motion events at a configured 100 ms interval. The processor includes a 200 ms simulated delay. Events are random rather than identical across runs. No automated D unit-test suite was supplied; validation used the deployed pipeline.

Latency is local bridge `queuedAt` to worker `processedAt` and can be affected by clock differences. This definition differs from the corrected HD metric. Counts describe processing log entries and do not prove exactly-once delivery.
