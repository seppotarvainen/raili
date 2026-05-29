# help

> Help you asked, help you get!

## Usage:

```bash
raili help <command>          # Get detailed usage information for a specific command.
raili <command> --help        # Alternative syntax for getting help on a command.

raili create -w <workflow>    # Creates a new workflow scaffold under .raili/<workflow>
raili init                    # Initializes .raili/ with default workflow and registries
raili listen [-w <workflow>]  # Run workflow in listen mode, waiting for external triggers
raili run [-w <workflow>]     # Run workflow in normal mode, executing from the initial state
raili stats [-w <workflow>]   # Print execution statistics for the workflow
raili teach <agentId>         # Append a lesson to the agent's global learning file
raili version                 # Print the Raili CLI version and exit
```

