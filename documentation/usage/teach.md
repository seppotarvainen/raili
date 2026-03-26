# raili teach

> Manually teach an agent by appending markdown lessons to its learning file.
> 
> Usage: raili teach <agentId> [-w <workflow>]

Open a multiline prompt and append the provided content as a manual learning for the given agent.
Terminate input with a line containing only `/q`.

Learnings are stored under `.raili/<workflow>/learnings/<agentId>.md` (defaults to `main` if not specified).

Example:

$ raili teach raili-coding
Write a lesson to the agent 'raili-coding'. (Close with /q)
Remember to handle edge cases in input validation.
/q
Appended manual learning to .raili/main/learnings/raili-coding.md
