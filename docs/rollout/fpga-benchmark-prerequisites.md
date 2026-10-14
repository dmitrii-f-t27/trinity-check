# FPGA benchmark prerequisites (plan)

Status: plan only. No hardware is used, no benchmark has been run, and this document contains no
performance numbers. It lists what must be true before a benchmark is run or quoted. The header
check in this repository is unrelated to FPGA performance and must not be used to support it.

## Prerequisites (each needs a yes with a link before running anything)

1. Question: one sentence stating what is being compared and against what baseline, written
   before the run.
2. Design under test: the source and the exact commit; how it is built; the tool versions.
3. Baseline: a named implementation (for example a software or GPU baseline) with its own
   commit or version and settings.
4. Target hardware: the board or device identified exactly (model, revision, clock, memory), and
   the owner's confirmation of access. Access details are private (`~/Brain/private/`).
5. Workload: the exact input data and sizes, created reproducibly; not a customer's data.
6. Correctness first: the design's output compared with a reference on the same inputs, with
   zero unexplained mismatches, before any timing is taken.
7. Method: what is timed (end to end or kernel only), warm-up, repetitions, how variance is
   reported, how power is measured if power is claimed.
8. Resource report: utilization and timing closure from the tool flow, saved as files.
9. Reproduction: another person can rerun from written steps and gets results within the stated
   variance.
10. Reporting rules: numbers are published only with the configuration above; no claim beyond
    the measured configuration.

## Gate before any hardware step

Hardware runs, deployment and grant submissions require a separate explicit owner decision.
This plan does not authorize them.

## Open items for the owner

- Which board and which design (UNKNOWN here).
- Whether a baseline exists and who owns it (UNKNOWN here).
