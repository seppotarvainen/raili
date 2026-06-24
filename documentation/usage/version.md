# version

> Print the Raili CLI version and exit.

## Usage

```bash
raili --version  # Shows the installed Raili package version
```

**Note:** The short flag `-v` is no longer a shorthand for `--version`. The `-v` short alias is reserved by `raili run` as `--verbose` to print agent debug context. Use `--version` to explicitly print the CLI version.
## Overview

Prints the installed Raili package version to stdout and exits with status code 0. This is a global flag and may be used instead of a command to quickly inspect the version.

Behavior

- Writes the package version (from `package.json`) followed by a newline to `stdout`.
- Exits with code `0` immediately after printing.
- No side effects (does not run workflows, load `.raili/`, or validate registries).
