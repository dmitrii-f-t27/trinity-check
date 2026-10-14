# Customer-validation plan (plan)

Status: plan only. No customers exist in this document. No outreach is sent from it.
Names, emails and conversation notes are kept privately, outside this repository.

## Hypothesis to test

Teams that publish or consume GGUF models would run a fail-closed header gate in CI, and some
would pay for a manual release audit. Both parts are untested.

## Questions that decide it (ask, do not pitch)

1. Who in your team releases or integrates GGUF models, and how often?
2. What has gone wrong at release time in the last year (unreadable file, wrong runtime, split
   upload, metadata mistake)? Who found it and when?
3. Which runtimes must a release work in?
4. What do you do today to check a file before publishing?
5. If a check failed your pipeline, who would act on it?
6. What would make you not trust this check?

## Targets (to be filled by the owner, real people only)

| Segment | How to find them without spam | Number to interview | Done |
| --- | --- | --- | --- |
| Maintainers who publish GGUF repos on Hugging Face | Public repository issues and discussions where a bad header was reported | UNKNOWN | no |
| Teams shipping an on-device or edge model | Existing contacts, introductions | UNKNOWN | no |
| Runtime maintainers | Public issue trackers | UNKNOWN | no |

## Method

- Short calls or written exchanges, asked one at a time, with a person who agreed to talk.
- Take notes of their words. Do not paraphrase into what we wished they said.
- Offer the tool only after question 4, and only to try it on their own file.
- A "yes, interesting" without a named recent incident or a named owner is not validation.

## Pass and fail criteria (set before the first conversation)

- Validated: at least 5 independent people each describe a real release-time header problem
  from the last year and agree to run the gate on a real file. (The threshold is a proposal;
  the owner sets the final number before starting.)
- Not validated: fewer than that after the planned number of conversations. Then change the
  hypothesis, not the criteria.

## Record

For each conversation: date, role (no name in this repo), the incident they described, runtime,
whether they tried the tool, the result of the report on their file, what they asked for that the
tool cannot do. Aggregate counts only may be copied into the evidence matrix.
