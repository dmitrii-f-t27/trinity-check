# One narrow EquivGate pilot (plan)

Status: plan only. I could not find a definition of EquivGate in the files available to this
task, so this document does not describe what it does. The owner or the project that defines it must
fill the placeholders below before anything is scheduled. Nothing here is a claim.

## Fill in first (all UNKNOWN until the owner supplies them)

| Item | Value |
| --- | --- |
| What EquivGate is, in one sentence | UNKNOWN |
| Where its source and spec live | UNKNOWN |
| The one equivalence it checks in this pilot | UNKNOWN |
| Tool or flow it plugs into | UNKNOWN |

## Shape of a narrow pilot (what "narrow" means)

- One input type, one check, one pass/fail output, one reference answer that is known in advance.
- Same fail-closed rule as trinity-check-ci: anything not proven passes nothing; error, empty and
  unknown are never green.
- Evidence is a saved report on a named commit, reproducible by a person who did not write it.

## Steps

1. Write the spec for the one check first (in the repository that owns EquivGate), with the
   accepted and rejected examples and what is out of scope.
2. Prepare a known-good and a known-bad pair of inputs, created by the test code, not taken from
   a customer.
3. Run offline; save the output with the commit SHA and tool versions.
4. Have a second person re-run it from the written steps.
5. Only then decide whether a real partner file is worth trying, with their agreement.

## Exit criteria

Pilot succeeds when the known-good passes, the known-bad fails with the expected code, an error
case fails, and the second person reproduces all three. Anything else is a finding to fix.

## Not in this pilot

Hardware, performance claims, customers, grants, and any broadening of the check.
