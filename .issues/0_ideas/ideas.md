# Ideas

```yaml
title: workflow as an input to run command
intent: | 
  Currently user can use only singe "workflow.yaml" file as an input for `raili run`. It would be great
  to allow users to specify alternative file as input. This would allow users to have multiple workflow
  configurations in the same project and choose which one to run. For example, they could have
  `workflow-dev.yaml` for simple sanity testing and `workflow.yaml` for full runs.
  
  By default, worfklow.yaml should be used if no alternative file is specified. Alternative file should be specified as an argument to `raili run` command. For example, if user has `workflow-dev.yaml` file, they should be able to run it with command: `raili run --workflow workflow-dev.yaml`
```

```yaml
title: More context info from each state.
intent: |
    Currently system only stores state name and enteredAt. I'd like also to have more about the internals, like "approval" (it's question and user result/reason), "notify" (was it run successfully or not).

    In the future I'm about to build GUI for this, so having more context info about each state would be really helpful for that.
```

```yaml
title: GUI to follow the state machine execution
intent: |
    It would be great to have a simple GUI that shows the state machine execution in real time
    This would allow users to see the current state, the transitions, and the outputs of each state in a more visual way. It would also allow users to interact with the state machine, for example by triggering manual transitions or by providing input for approval states.

    Usage: `raili run --dashboard` would start the workflow execution and open the dashboard in the browser. The dashboard would show the current state, the history of transitions, and the outputs of each state.
```

```yaml
title: Approval reason should be stored in the context
intent: |
    Currently user can provide a reason for their approval decline, but this reason is not stored anywhere. This should be stored as a variable
    that may be used in the future states. For 
```