# stats

> Show run statistics for a workflow. Compares the most recent run against a previous window to surface performance trends.

## Usage

```bash
raili stats                          # Stats for the main workflow (last 10 runs)
raili stats --workflow <name>        # Stats for a named workflow
raili stats --latest <n>             # Consider the last N runs (default: 10)
```

## Output

When there are two or more runs in the window, `raili stats` shows a **comparison view** — the latest run vs. the average of all previous runs in the window:

```
$ raili stats
Runs considered (prev window): 9
Runs considered (current): 1
Average loops/run: 0.00 (2.11 ↓ improving)
Average states/run: 5.00 (12.89 ↓ improving)
Average duration (ms): 14 (261850 ↓ improving)
Approval failure rate: 0.0% (22.2% ↓ improving)
Success rate: 0.0% (100.0% ↓ regressing)
```

When there is only one run, a bare metrics summary is shown instead:

```
$ raili stats
Runs considered: 1
Average loops/run: 0.00
Average states/run: 5.00
Average duration (ms): 14
Approval failure rate: 0.0%
Success rate: 100.0%
```

## Metrics

| Metric | Meaning | Better when |
|--------|---------|-------------|
| **Average loops/run** | How many times states were re-entered (retries/loops) on average | Lower ↓ |
| **Average states/run** | Total state entries per run (including revisits) | Lower ↓ |
| **Average duration (ms)** | Wall-clock time from run start to terminal state | Lower ↓ |
| **Approval failure rate** | Average number of manual approval rejections per run | Lower ↓ |
| **Success rate** | Fraction of runs that reached a `success: true` terminal state | Higher ↑ |

## Trend arrows

Each metric shows the **current value** followed by the **previous window average** and a direction indicator:

| Arrow | Meaning |
|-------|---------|
| `↓ improving` | Value decreased — good for loops, states, duration, approval failures |
| `↑ improving` | Value increased — good for success rate |
| `↑ regressing` | Value increased — bad for loops, states, duration, approval failures |
| `↓ regressing` | Value decreased — bad for success rate |
| `-  no-change` | No meaningful difference |
| `-  n/a` | Not enough data to compare (e.g. no success information recorded) |

## Data source

Stats are read from `.raili/<workflow>/run-log.jsonl`. Each line is a JSON record appended automatically after every `raili run` completes. The file is never truncated — `--latest N` slices the last N entries from the log.

## Examples

### Check the last 5 runs

```bash
raili stats --latest 5
```

### Check stats for a named workflow

```bash
raili stats --workflow dev
```

## Notes

- **Success rate** is only computed for runs where the terminal state had `success: true` set. Runs that ended in a terminal state without that flag are excluded from the rate calculation, which shows as `n/a` if no runs have recorded a success value.
- Approval wait time is excluded from `duration` so idle human review time doesn't skew the comparison.

