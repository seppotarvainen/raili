> Print the Raili CLI version and exit.

Prints the installed Raili package version to stdout and exits with status code 0. This is a global flag and may be used instead of a command to quickly inspect the version.

Full usage

```sh
# Print version and exit
raili --version

# Help text shows the flag as a global option
raili [--version] <command> [options]
```

Behavior

- Writes the package version (from `package.json`) followed by a newline to `stdout`.
- Exits with code `0` immediately after printing.
- No side effects (does not run workflows, load `.raili/`, or validate registries).

See also: `documentation/usage/run.md` and `documentation/usage/init.md` for command-specific usage notes.
