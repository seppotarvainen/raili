# Ideas

```yaml
title: GUI to follow the state machine execution
intent: |
    It would be great to have a simple GUI that shows the state machine execution in real time
    This would allow users to see the current state, the transitions, and the outputs of each state in a more visual way. It would also allow users to interact with the state machine, for example by triggering manual transitions or by providing input for approval states.

    Usage: `raili run --dashboard` would start the workflow execution and open the dashboard in the browser. The dashboard would show the current state, the history of transitions, and the outputs of each state.
```

```yaml
title: If variable is not present, interpolation should produce empty string
intent: |
    Fix interpolation so that it doesn't provide ${MY_STATE_FAILED} into prompt or other places. 
    Also the interpolated variable should be exactly the name of the state + FAILED, no uppercasing.
  
    For cli vars the uppercase is fine, but not for the interpolation in the YAML.

    So this is the intended usage:
    ```yaml
    state: mystate
    type: engine
    approval:
      question: "Last reason you provided '${mystate_FAILED}''"
      PASSED: nextstate
      FAILED: mystate # just ask again, now the reson should be visible. In the first run it's just empty.
    ```
```


```yaml
title: Show description of the input
intent: |
    On start, the system prompts the user to give the specific input. If user has defined the following in the workflow.yaml:
    ```yaml
    inputs:
      - type
    ```
    The system prompts `type` and let the user fill the value.

    It would be better if additionally there would be a short description of the input, for example:
    ```yaml
    inputs:
    - name: type
      description: "Type of the task to perform. For example, 'data analysis' or 'content generation'."
    ```
    The system would then prompt: 
    ```
    Type of the task to perform. For example, 'data analysis' or 'content generation'.
    > type: 
    ```

    It would make the system more user-friendly and easier to understand what kind of input is expected from the user.
    Description is optional, name is mandatory.

    The feature doesn't have to be backwards compatible. If inputs are in wrong format, then the system handles it in 
    its usualway.
```