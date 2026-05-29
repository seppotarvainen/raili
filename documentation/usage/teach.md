# teach

> Manually teach an agent by appending markdown lessons to its learning file.

## Usage

```bash
raili teach <agentId>                 # Append a lesson to the agent's global learning file.
raili teach <agentId> -w <workflow>.  # Append a lesson to the agent's workflow-local learning file.
```

Open a multiline prompt and append the provided content as a manual learning for the given agent.
Terminate input with a line containing only `/q`.

The agent must be registered in `agent-registry.json`. If the agent is not found, the command fails immediately with a clear error message.

Learnings are stored globally under `.raili/learnings/<agentId>.md` by default. To store a lesson locally to a specific workflow instead, use:
```
raili teach <agentId> -w <workflow> --scope workflow
```
This will store the lesson at `.raili/<workflow>/learnings/<agentId>.md`.

## Example — Success

```
$ raili teach raili-coding
Write a lesson to the agent 'raili-coding'. (Close with /q)
Remember to handle edge cases in input validation.
/q
Appended manual learning to .raili/learnings/raili-coding.md
```

## Example — Agent Not Found

```
$ raili teach ghost_agent
Error: Agent 'ghost_agent' is not defined in agent-registry.json
```

If you see this error, verify that the agent ID is registered in `.raili/agent-registry.json`.
