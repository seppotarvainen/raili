# version

> Print the Raili CLI version and exit.

## Usage

```bash
raili --version  # Shows the installed Raili package version
```

## Overview

Prints the installed Raili package version to stdout and exits with status code 0. This is a global flag and may be used instead of a command to quickly inspect the version.

Behavior

- Writes the package version (from `package.json`) followed by a newline to `stdout`.
- Exits with code `0` immediately after printing.
- No side effects (does not run workflows, load `.raili/`, or validate registries).
