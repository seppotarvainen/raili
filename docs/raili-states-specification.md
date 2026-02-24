# Raili Workflow States Specification

This document defines all workflow states for the Raili MVP, including a reusable manual approval state.

---

## State Overview

```mermaid
stateDiagram-v2
    [*] --> init

    init --> analyze

    analyze --> approve_analysis
    approve_analysis --> plan : PASSED
    approve_analysis --> analyze : FAILED

    plan --> approve_plan
    approve_plan --> execute : PASSED
    approve_plan --> plan : FAILED

    execute --> test

    test --> verify : tests passed
    test --> execute : tests failed

    verify --> commit : commit required
    verify --> execute : progress incomplete
    verify --> approve_archive : ready for archive

    commit --> verify

    approve_archive --> archive : PASSED
    approve_archive --> execute : FAILED

    archive --> analyze : more parts
    archive --> done : no more parts

    done --> [*]
```

approve_* states are instances of the reusable manual approval state, with context determining the question and next states.

---

# 1. Init

type: engine  
run: manual  

Collects ticket ID and description.

Inputs:
- CLI input (ticket ID and description)

Outputs:
- `.raili/prompt.md` (user input)
- `.raili/context.json` (state history entry)

Success Criteria:
- Output files created

On success:
- analyze

On fail:
- retry init

---

# 2. Analyze

type: agent  
run: automatic  

Splits ticket into ptN work files.

Inputs:
- `.raili/context.json` (state history entry)

Outputs:
- `llm/<TICKET>-ptN-*.md` files

Success Criteria:
- ptN files created
- No agent error

On success:
- manual-approve (analysis approval)

On fail:
- init

---

3. Manual-Approve (Reusable)

type: engine  
run: manual

Generic human approval gate used after states that require explicit confirmation (e.g., analyze, plan, archive).

The engine:

1. Reads the **previous state** from `stateHistory` (the state that led to manual-approve).
2. Loads that state's definition from `workflow.yaml`.
3. Reads:
- `approval.question`
- `approval.PASSED`
- `approval.FAILED`

4. Prompts the user (CLI).
5. Transitions according to the workflow definition.

No approval routing is stored in context.

### Inputs

- `context.stateHistory` (last state before manual-approve)

- `workflow.yaml` state definition for that state


Example workflow.yaml snippet:

```yaml
plan:
  type: agent
  approval:
    question: "Is the implementation plan correct?"
    PASSED: execute
    FAILED: plan
```

### Outputs

- User decision (PASSED / FAILED)

- New state appended to `stateHistory`

  ```
  {
    "state": "execute",
    "enteredAt": "2026-02-20T12:45:00Z"
  }
  ```


### Success Criteria

- User explicitly PASSED the approval.

### On success

- Transition to `approval.PASSED` (from workflow.yaml)

### On fail

- Transition to `approval.FAILED` (from workflow.yaml)

---

# 4. Plan

type: agent  
run: automatic  

Creates implementation plan and progress file.

Inputs:
- ptN work file
- specifications
- project source tree (read-only)

Outputs:
- `implementation_plan.md`
- `implementation_plan_progress.md`

Success Criteria:
- Plan file exists
- Progress file exists

On success:
- manual-approve (plan approval)

On fail:
- analyze

---

# 5. Execute

type: agent  
run: automatic  

Implements next unchecked step from progress file.

Inputs:
- implementation plan
- progress file
- optional structured test feedback

Outputs:
- Modified source files
- Updated progress file
- Optional `.raili/commit-msg-*.txt`

Success Criteria:
- Step marked complete in progress file
- No agent crash

On success:
- test

On fail:
- execute (retry or abort)

---

# 6. Test

type: script  
run: automatic  

Runs project tests deterministically.

Inputs:
- Source code
- Test command from script registry

Outputs:
- `.raili/test-output.txt`
- `.raili/test-summary.json`

Success Criteria:
- Test command completes

On success:
- verify

On fail:
- execute

---

# 7. Verify

type: engine  
run: automatic  

Determines next state based on workflow status.

Inputs:
- `.raili/test-summary.json`
- `implementation_plan_progress.md`
- commit message files (if any)

Decision Logic:
- If tests failed → execute
- If progress indicates commit required → commit
- If progress incomplete → execute
- If progress complete → manual-approve (archive approval)

Outputs:
- Internal routing decision

On success:
- execute
- commit
- manual-approve (archive)
- archive (if no approval required)

On fail:
- execute

---

# 8. Commit

type: script  
run: automatic  

Creates a Git commit using next available commit message file.

Inputs:
- `.raili/commit-msg-*.txt`
- Working tree changes

Outputs:
- Git commit created
- Commit message file removed

Success Criteria:
- Commit succeeds
- Commit message file deleted

On success:
- verify

On fail:
- retry commit or abort

---

# 9. Archive

type: script  
run: automatic  

Archives completed ptN and prepares next part.

Inputs:
- `archive.sh <part-number>`
- Current ptN files

Outputs:
- Archived ptN files
- Updated workflow context

Success Criteria:
- Archive script succeeds

On success:
- analyze (if more ptN remain)
- done (if no more parts)

On fail:
- retry archive

---

# 10. Done

type: engine  
run: automatic  

Workflow completed successfully.

Inputs:
- None

Outputs:
- Final completion message

On success:
- end

On fail:
- N/A

---

# Architectural Principles

- Only agents perform cognitive tasks.
- Only scripts perform shell operations.
- Manual approval is centralized in a single reusable state.
- Progress file is the single source of truth.
- Engine controls all transitions deterministically.
