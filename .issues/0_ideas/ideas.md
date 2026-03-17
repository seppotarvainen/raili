# Ideas

```yaml
title: GUI to follow the state machine execution
intent: |
    It would be great to have a simple GUI that shows the state machine execution in real time
    This would allow users to see the current state, the transitions, and the outputs of each state in a more visual way. It would also allow users to interact with the state machine, for example by triggering manual transitions or by providing input for approval states.

    Usage: `raili run --dashboard` would start the workflow execution and open the dashboard in the browser. The dashboard would show the current state, the history of transitions, and the outputs of each state.
```

```
title: Context definition leaking from main workflow 
intent: |
    If user runs raili with another worklow file, `raili run --workflow workflow-dev.yaml`, the inputs + descriptions 
    are still read from workflow.yaml instead of workflow-dev.yaml. No matter what inputs are defined in workflow-dev.yaml, the engine will still prompt for the inputs defined in workflow.yaml. This is a bug that needs to be fixed. The engine should read the inputs from the workflow file that is being executed, not from a hardcoded workflow.yaml.
    
    My idea is that workflow files should be named e.g. workflow.test.yaml. Then vars file would be vars.test.yaml. This way, when user runs `raili run --workflow test`, the engine would automatically look for vars.test.yaml for the inputs. This would also allow users to have multiple workflow files and vars files in the same repository, and easily switch between them.
    
    Default workflow is still workflow.yaml and the variable file vars.yaml. If my idea makes sense, work on it but if not, abort with error.
```