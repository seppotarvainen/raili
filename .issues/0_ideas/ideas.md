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
