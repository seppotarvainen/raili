# RAI-71: Add `raili visual` command

**Type:** feature

## Description
Add a new CLI command that renders a deterministic state graph (initial → states → transitions) as Mermaid diagram syntax. This enables users to visualize their workflow structure, state types, terminal states, transition outcomes, and state-level annotations (max_visits, output.store) before or during execution. The visual representation helps developers understand workflow topology and debug routing logic.

## Documentation References
- documentation/states.md
- documentation/routing.md
- documentation/variables.md

## Code References
- src/cli/railiCommand.ts (RailiCommand class)
- src/cli.ts (main entry point, command dispatch)
- src/cli/schema.ts (similar read-only command pattern)
- src/cli/stats.ts (similar command pattern with file I/O)
- src/workflow/workflowLoader.ts (loadWorkflowConfig function)
- src/types.ts (StateConfig, WorkflowConfig, StateMachine types)

## Implementation Plan

1. **src/cli/railiCommand.ts** — Add `visual: boolean` property to RailiCommand class, initialized from `this.value === 'visual'`

2. **src/cli.ts** — Add visual command dispatch:
   - Add `parseVisualArgs()` function to parse `--workflow`, `--format`, `--out` options using commandLineArgs
   - Add visual command handler in main() that calls `visualCommand()`
   - Support `--help` for the visual command

3. **src/cli/visual.ts** (new file) — Main visual command module:
   - Export `visualCommand(cwd: string, workflowArg?: string, format?: string, outPath?: string): Promise<void>` function
   - Load workflow config using `loadWorkflowConfig(cwd, workflowArg)`
   - Load and validate registries (agentRegistry, scriptRegistry) to ensure all referenced agents/scripts exist
   - Build typed graph from workflow config
   - Call `renderMermaid()` to generate diagram syntax
   - Write output to file (default: `.raili/<workflow>/diagram.html`) or stdout
   - Support `--format mermaid` (currently only format)

4. **src/cli/graphBuilder.ts** (new file) — Graph data structure and builder:
   - Define `GraphNode` interface: `{ id: string; type: StateType; config: StateConfig }`
   - Define `GraphEdge` interface: `{ from: string; to: string; label: string; isDefault?: boolean }`
   - Define `Graph` interface: `{ initial: string; nodes: Map<string, GraphNode>; edges: GraphEdge[]; terminal: Set<string> }`
   - Export `buildGraph(config: WorkflowConfig): Graph` function that:
     - Creates nodes for each state (id, type, config)
     - Identifies terminal states (states with no routing defined, or error state)
     - Extracts edges from `on:` (with PASSED/FAILED labels) and `transitions:` (with outcome key labels)
     - Marks default transitions with `isDefault: true`
     - Validates all transition targets exist as states

5. **src/cli/mermaidRenderer.ts** (new file) — Mermaid diagram generation:
   - Export `renderMermaid(graph: Graph): string` function that generates Mermaid graph syntax
   - Syntax rules:
     - Use `graph TD` (top-down) for direction
     - Node styling by state type:
       - `agent`: blue circle `(("agent_id"))`
       - `script`: green diamond `{script_id}`
       - `command`: orange rectangle `["command"]`
       - `engine`: gray circle `((engine_id))`
     - Terminal states: double-circle `(((terminal_id)))`
     - Edges labeled with outcome keys: `state1 -->|approve| state2`
     - Default transitions: dashed line `state1 -.->|default| error`
     - Initial arrow: special start node `[*] -->|initial| start_state`
     - Annotations: append state notes with max_visits and output.store metadata as `Note over <stateId>,`
   - Return rendered Mermaid syntax as string

6. **src/cli/htmlWrapper.ts** (new file) — HTML output generation:
   - Export `wrapMermaidInHtml(mermaidSyntax: string): string` function
   - Generate minimal HTML that embeds the Mermaid syntax using CDN (e.g., `<script src="https://cdn.jsdelivr.net/npm/mermaid/dist/mermaid.min.js">`)
   - Include inline CSS for responsive display
   - Return complete HTML document string

7. **src/cli/visual.ts** (update) — Add output handling:
   - If `--out` is provided, resolve to that path
   - If `--out` is omitted, default to `.raili/<workflow>/diagram.html`
   - Write mermaid syntax to file (if `.mmd` extension) or wrap in HTML (if `.html`)
   - Print success message with file path
   - If outPath is stdout (e.g., `-`), print mermaid syntax to stdout

## Examples

### Command usage
```bash
# Render default workflow as HTML, save to .raili/main/diagram.html
raili visual

# Specify workflow and format
raili visual --workflow main --format mermaid

# Specify output file
raili visual --out ./workflow-diagram.html

# Save raw Mermaid syntax to file
raili visual --out ./diagram.mmd

# Output to stdout
raili visual --out -
```

### Example workflow YAML
```yaml
initial: analyze

states:
  analyze:
    type: agent
    agent: code_reviewer
    prompt: "Review this PR"
    output:
      store: true
    max_visits:
      count: 2
      continue: "escalate"
    transitions:
      approve: "merge"
      request_changes: "fix"
      default: "done"

  fix:
    type: script
    script: run_tests
    on:
      PASSED: "analyze"
      FAILED: "error_state"

  merge:
    type: engine

  escalate:
    type: command
    command: "notify-manager.sh"

  error_state:
    type: engine
    success: false

  done:
    type: engine
    success: true
```

### Expected Mermaid output
```
graph TD
    [*] -->|initial| analyze
    
    analyze[":robot_unicode_character: code_reviewer<br/>max_visits: 2<br/>output.store: true"]
    analyze -->|approve| merge
    analyze -->|request_changes| fix
    analyze -.->|default| done
    
    fix{script: run_tests}
    fix -->|PASSED| analyze
    fix -->|FAILED| error_state
    
    merge((merge))
    merge --> done
    
    escalate[":cog_unicode_character: Command:<br/>notify-manager.sh"]
    
    error_state(((error_state)))
    error_state --> done
    
    done(((done)))
    
    style analyze fill:#4a90e2
    style fix fill:#7ed321
    style escalate fill:#f5a623
    style error_state fill:#d0021b
```

### Expected HTML output (diagram.html)
When user opens the HTML file in a browser, the Mermaid diagram renders as an interactive SVG with clickable elements.

## Test Plan

### Unit tests (`__tests__/unit/`)

**File:** `__tests__/unit/graphBuilder.test.ts`

- **Test case:** "buildGraph creates nodes for all states"
  - Setup: Create WorkflowConfig with agent, script, command, engine states
  - Act: Call `buildGraph(config)`
  - Assert: Returned graph has nodes for each state with correct type and config

- **Test case:** "buildGraph extracts edges from transitions"
  - Setup: Create WorkflowConfig with agent state having `transitions: {approve: "next", reject: "error"}`
  - Act: Call `buildGraph(config)`
  - Assert: Graph edges include `{from: "agent_state", to: "next", label: "approve"}` and `{from: "agent_state", to: "error", label: "reject"}`

- **Test case:** "buildGraph marks terminal states"
  - Setup: Create WorkflowConfig with states where `done` has no routing and `error` is error state
  - Act: Call `buildGraph(config)`
  - Assert: Graph.terminal contains "done" and "error"

- **Test case:** "buildGraph throws on undefined transition target"
  - Setup: Create WorkflowConfig with agent state routing to non-existent state
  - Act: Call `buildGraph(config)`
  - Assert: Throws error mentioning undefined state

**File:** `__tests__/unit/mermaidRenderer.test.ts`

- **Test case:** "renderMermaid generates graph TD header"
  - Setup: Create minimal Graph with one node
  - Act: Call `renderMermaid(graph)`
  - Assert: Output starts with "graph TD"

- **Test case:** "renderMermaid colors agent states blue"
  - Setup: Create Graph with agent node
  - Act: Call `renderMermaid(graph)`
  - Assert: Output includes color styling for agent node (e.g., `fill:#4a90e2`)

- **Test case:** "renderMermaid marks terminal states with double circle"
  - Setup: Create Graph with terminal node in terminal set
  - Act: Call `renderMermaid(graph)`
  - Assert: Output uses `((( )))` syntax for terminal nodes

- **Test case:** "renderMermaid labels edges with outcome keys"
  - Setup: Create Graph with edge `{from: "start", to: "next", label: "approve"}`
  - Act: Call `renderMermaid(graph)`
  - Assert: Output includes `start -->|approve| next`

- **Test case:** "renderMermaid renders dashed default transitions"
  - Setup: Create Graph with edge marked `isDefault: true`
  - Act: Call `renderMermaid(graph)`
  - Assert: Output includes dashed arrow `-.->` for default edge

**File:** `__tests__/unit/htmlWrapper.test.ts`

- **Test case:** "wrapMermaidInHtml embeds mermaid script"
  - Setup: Create mermaid syntax string
  - Act: Call `wrapMermaidInHtml(syntax)`
  - Assert: Output contains `<script src="https://cdn.jsdelivr.net/npm/mermaid"` and the mermaid syntax in a `<pre class="mermaid">`

### Integration tests (`__tests__/integration/`)

**Test case:** "visual command generates diagram.html in workflow directory"
```typescript
// Setup
const tmp = createTmpWorkspace();
writeWorkflow(tmp, `
initial: start
states:
  start:
    type: agent
    agent: analyzer
    transitions:
      done: end
  end:
    type: engine
`);
writeAgentRegistry(tmp, { analyzer: { path: './agents/analyzer.md' } });
writeScriptRegistry(tmp, {});
writeAgentFile(tmp, 'agents/analyzer.md', 'Agent instructions');

// Act
await visualCommand(tmp, 'main', 'mermaid', undefined);

// Assert
const htmlPath = path.join(tmp, '.raili', 'main', 'diagram.html');
expect(fs.existsSync(htmlPath)).toBe(true);
const content = fs.readFileSync(htmlPath, 'utf8');
expect(content).toContain('graph TD');
expect(content).toContain('start');
expect(content).toContain('end');
```

**Test case:** "visual command with --out saves to custom path"
```typescript
// Setup (same as above)
const tmp = createTmpWorkspace();
// ... workflow, registry setup

const outPath = path.join(tmp, 'custom-diagram.html');

// Act
await visualCommand(tmp, 'main', 'mermaid', outPath);

// Assert
expect(fs.existsSync(outPath)).toBe(true);
const content = fs.readFileSync(outPath, 'utf8');
expect(content).toContain('graph TD');
```

**Test case:** "visual command outputs to stdout when --out is -"
```typescript
// Setup
const tmp = createTmpWorkspace();
// ... workflow, registry setup

const logSpy = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);

// Act
await visualCommand(tmp, 'main', 'mermaid', '-');

// Assert
expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('graph TD'));

logSpy.mockRestore();
```

**Test case:** "visual command fails if agent registry missing"
```typescript
// Setup
const tmp = createTmpWorkspace();
writeWorkflow(tmp, `
initial: start
states:
  start:
    type: agent
    agent: missing_agent
    transitions:
      done: end
  end:
    type: engine
`);
writeScriptRegistry(tmp, {});
// Intentionally NOT writing agent registry

// Act & Assert
await expect(visualCommand(tmp, 'main', 'mermaid', undefined)).rejects.toThrow(/agent-registry.json/);
```

**Test case:** "visual command fails if referenced agent not in registry"
```typescript
// Setup
const tmp = createTmpWorkspace();
writeWorkflow(tmp, `
initial: start
states:
  start:
    type: agent
    agent: missing_agent
    transitions:
      done: end
  end:
    type: engine
`);
writeAgentRegistry(tmp, { other_agent: { path: './agents/other.md' } });
writeScriptRegistry(tmp, {});
writeAgentFile(tmp, 'agents/other.md', 'Other agent');

// Act & Assert
await expect(visualCommand(tmp, 'main', 'mermaid', undefined)).rejects.toThrow(/missing_agent/);
```

## Acceptance Criteria
- [x] `raili visual` command can be invoked from CLI and resolves to `visualCommand()` in main()
- [x] Command supports `--workflow <name>` (defaults to 'main')
- [x] Command supports `--format mermaid` (currently only option; default)
- [x] Command supports `--out <filepath>` (defaults to `.raili/<workflow>/diagram.html`)
- [x] Command supports `--out -` to output to stdout
- [x] Graph builder correctly extracts all states, edges, and terminal states from workflow config
- [x] Graph builder validates all transition targets exist and throws on missing state references
- [x] Mermaid renderer generates valid Mermaid graph syntax with proper node/edge styling
- [x] Agent states render in blue, script states in green, command states in orange, engine states in gray
- [x] Terminal states render with double-circle notation
- [x] Edges are labeled with outcome keys (approve, reject, PASSED, FAILED, etc.)
- [x] Default transitions render as dashed lines
- [x] Initial state has incoming arrow from special `[*]` start node
- [x] max_visits and output.store annotations are included in rendered output
- [x] HTML wrapper embeds Mermaid CDN script and generates valid HTML document
- [x] Command fails fast (throws) if workflow config is invalid
- [x] Command fails fast (throws) if registries (agent or script) are missing or malformed
- [x] Command fails fast (throws) if referenced agents or scripts are not found in registries
- [x] Unit tests cover graph builder, mermaid renderer, and HTML wrapper
- [x] Integration tests verify end-to-end CLI behavior, file I/O, and error cases
- [ ] All tests pass: `npm test`
- [x] Fix: mermaidRenderer uses graph.initial for initial arrow and added unit test
