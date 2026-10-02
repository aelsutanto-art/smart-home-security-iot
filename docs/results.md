# Recorded experiment summary

These are the completed submission measurements, not new runs performed for this repository.

## Distinction

One 200-event trial per configuration:

| Workers | Mean latency ms | p95 ms | Maximum ms |
| --- | ---: | ---: | ---: |
| 1 | 12716.09 | 24366.1552 | 26454 |
| 3 | 813.44 | 1131 | 1786 |

Mean measured latency fell 93.60%. The worker counts were changed manually. Local/AWS clock differences and only one trial per configuration limit conclusions.

## High Distinction

Each trial recorded 1,260 unique completion IDs. Latency is measured from SQS SentTimestamp to processedAt.

| Configuration | Trial | Mean ms | Maximum ms | Sampled running task seconds |
| --- | --- | ---: | ---: | ---: |
| Fixed one | r1 | 67841.800 | 161476 | 540.000 |
| Fixed one | r2 | 70022.958 | 152697 | 540.000 |
| Fixed three | r1 | 351.425 | 1325 | 1620.000 |
| Fixed three | r2 | 372.492 | 923 | 1620.000 |
| Adaptive | r1 | 27927.228 | 54032 | 891.502 |
| Adaptive | r2 | 38839.815 | 69847 | 953.446 |

Adaptive scaling reduced two-run mean latency by 51.6% against one worker and used 43.1% fewer sampled task-seconds than three workers over a common 540-second window. The window was selected during analysis and includes idle recovery. Task-seconds are a capacity proxy, not a bill or monetary saving. Fixed three workers had lower latency than adaptive scaling. Two repetitions do not establish statistical significance.

The D and HD experiments use different workloads and latency definitions; do not directly compare their latency values as a before/after improvement.
