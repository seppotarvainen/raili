# Raili CLI Help & Documentation System

## Quick Access Options

When working on the command line, you now have multiple ways to access Raili documentation:

### 1. **`raili help` — Quick topic reference (FASTEST)**

For immediate answers while working:

```bash
# No args — full help overview
raili help

# Topic-specific help
raili help routing        # Binary vs named vs approval routing
raili help variables      # Input variables and interpolation
raili help approval       # Manual approval state syntax
raili help output         # Output storage and filtering
raili help states         # State types (agent, script, command, engine, group)
```

**Best for:** Quick lookup of a concept, syntax, or pattern you forgot

---

### 2. **`raili docs` — Full reference sections (IN-DEPTH)**

For deeper learning and complete examples:

```bash
# No args — list all sections
raili docs

# View a section
raili docs agent          # Complete agent state documentation
raili docs routing        # Full routing rules and examples
raili docs approval       # Approval block detailed reference
raili docs output         # Output filtering deep dive
raili docs inputs         # Variables and input management
raili docs examples       # Full working workflow examples
raili docs error-state    # Error handling patterns
```

**Best for:** Understanding a feature in depth, seeing full examples, learning patterns

---

### 3. **`raili schema` — YAML schema reference (VALIDATION)**

For checking field names and types:

```bash
raili schema
```

Shows:
- All top-level fields with types and examples
- State field reference with all options
- Routing rules summary
- Common patterns
- Complete minimal example

**Best for:** Remembering field names, checking if something is valid, schema validation

---

### 4. **`raili help <command>`** — Command-specific help

```bash
raili help init           # raili init command help
raili help run            # raili run command help
raili help docs           # raili docs command help
```

---

## Recommended Workflow

**Scenario 1: You forgot how to use approval states**

```bash
raili help approval       # 30-second quick reference
# or
raili docs approval       # Full details with examples
```

**Scenario 2: You want to see a full workflow example**

```bash
raili docs examples       # Complete working workflows
```

**Scenario 3: You need to validate your YAML schema**

```bash
raili schema              # Check all field names and types
```

**Scenario 4: You're building something complex**

```bash
raili docs                # See all available sections
raili docs routing        # Read the section you need
raili help variables      # Quick reference for specific concept
```

---

## Using the Raili Helper Agent

For validating workflows and getting AI-assisted help while building:

### Setup

1. Copy the helper agent to your project:
   ```bash
   cp example/raili-helper.md .github/agents/
   ```

2. Register it in `agent-registry.json`:
   ```json
   {
     "raili_helper": {
       "path": ".github/agents/raili-helper.md",
       "model": "gpt-4o"
     }
   }
   ```

3. Use the example workflow validator or add the agent to your workflows:
   ```yaml
   validate:
     type: agent
     agent: raili_helper
     prompt: "Validate my workflow and suggest improvements"
   ```

### What the Helper Agent Can Do

- **Validate workflow.yaml** — Check for syntax errors, routing conflicts, undefined references
- **Explain patterns** — When to use `on:` vs `transitions:` vs `approval:`
- **Suggest improvements** — Better error handling, agent memory strategies, loopback patterns
- **Generate stubs** — Create minimal workflows for common scenarios
- **Comment workflows** — Explain design choices and maintainability

### Example: Validate a Workflow

```bash
# Create a minimal workflow that validates another workflow
cat > .raili/workflow.yaml << 'EOF'
initial: validate

states:
  validate:
    type: agent
    agent: raili_helper
    prompt: "Validate my workflow configuration. Output VALID or INVALID."
    transitions:
      VALID: done
      INVALID: done

  done:
    type: engine
EOF

# Run it
raili run --clean
```

---

## Documentation Hierarchy

### **For instant lookup (< 30 seconds)**
→ `raili help <topic>`

### **For learning a concept (5-10 minutes)**
→ `raili docs <section>`

### **For schema validation**
→ `raili schema`

### **For AI-assisted help**
→ Use `raili-helper` agent in your workflow

---

## Offline Documentation

All documentation is embedded in the CLI binaries. No internet connection required.

**Available offline:**
- `raili help`
- `raili docs`
- `raili schema`
- `AGENTS.md` (in repo)

---

## Examples

### Quick question: "How do I route based on agent output?"

```bash
raili help routing
```

Output: Shows binary vs named routing with agent-specific note about exit codes

### Need full details on variables?

```bash
raili docs inputs
```

Output: Declaration syntax, precedence, env var naming, interpolation examples

### Building an approval flow and forgot the syntax?

```bash
raili help approval
```

Output: Syntax, behavior, variable support, example with explanation

### Want to see production-ready workflow patterns?

```bash
raili docs examples
```

Output: Multiple full workflows with error handling, sub-workflows, agent loops

---

## Integration with AGENTS.md

The generated `AGENTS.md` file in the repo root contains:

- **Architecture overview** — For new contributors
- **Project structure** — File-by-file breakdown
- **Handler patterns** — For extending Raili
- **Key files reference** — For specific modifications
- **Testing policy** — For maintaining quality

Use `AGENTS.md` when:
- Modifying the core engine
- Adding new state types or handlers
- Contributing to Raili itself
- Understanding architectural decisions

Use `raili help/docs/schema` when:
- Building workflows (not modifying Raili)
- Learning how to use features
- Validating YAML syntax

---

## Command Reference

| Command | Best For | Output |
|---------|----------|--------|
| `raili help` | Overview, commands list | General usage |
| `raili help <topic>` | Quick reference | 1-2 minute read |
| `raili help <command>` | Command syntax | Usage and examples |
| `raili docs` | Available sections | List of all docs |
| `raili docs <section>` | Deep learning | 3-5 minute read |
| `raili schema` | Field validation | Complete schema |
| `raili --help` | General help | Same as `raili help` |
| `raili init --help` | Init help | Init command usage |
| `raili run --help` | Run help | Run command usage |


