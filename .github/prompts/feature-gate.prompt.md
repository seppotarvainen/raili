---
name: Feature gate
description: A heuristic to validate feature ideas before building them.
---

# Feature validation heuristic

User must give path to real world project. Replace "PROJECT" with the actual project name in the questions below.

Before building anything, force the feature through all four of these following gates. Ask these from the user, if they're not already answered in a prompt:

1. The dogfooding gate. Has your own PROJECT workflow hit this limitation at least twice in real work? Not hypothetically.
2. The "stays simple?" gate. Can the feature be expressed as a new state type / handler / registry entry without changing runner.ts? If it forces core changes, the bar is 10× higher. Your own architecture doc says "Thin Runner." Enforce it.
3. The removability gate. If this turns out to be wrong in 3 months, can I delete it in one PR? If no, defer.
4. The "would a client pay for it?" gate. You have a concrete client. Ask: would PROJECT (or the next one) adopt Raili faster with this feature, or is it purely aesthetic?

Anything that passes fewer than 3 of these: guide user to write an issue, don't code.