> Listen for external events and trigger workflow runs.

## Usage

```bash
raili listen                 # Polls .raili/<workflow>/trigger.js and runs workflow on events
raili listen --workflow dev  # Listen for events for the named workflow
```

## What `raili listen` does

- Requires a workflow directory under `.raili/` (e.g. `.raili/main/`).
- Looks for `.raili/<workflow>/trigger.js` and loads it early (fail-fast).
- The trigger module **must export an async function** with signature `async () => (Record<string,string>|null)`.
  - Return `null` to indicate no event (normal poll).
  - Return an object of key/value pairs to be used as inputs for a clean run: Raili invokes `raili run --clean` semantics programmatically.

## Trigger file location & contract

Place a file at `.raili/<workflow>/trigger.js` exporting an async function. Example:

```js
// .raili/main/trigger.js
module.exports = async function() {
  // return null when no event, or an object with event variables
  const evt = await fetchSomeEvent();
  if (!evt) return null;
  return { ticket_id: evt.id, title: evt.title };
};
```

Constraints and validation:
- Raili **fails fast** if `.raili/` is missing, or `agent-registry.json` / `script-registry.json` are absent.
- If `trigger.js` is missing, `raili listen` throws `Trigger not found for workflow at <path>`.
- The trigger module **must** export a function; Raili throws `Trigger module does not export a function` or `Trigger function must be async` for invalid exports.
- If the trigger returns a non-object (e.g., an array) it is treated as an error: `Trigger returned invalid event: must be an object or null`.

## Runtime behavior

- Poll interval: 60 seconds between polls (configurable in future).
- On valid event object, Raili starts a clean run with the event map as inputs and resumes polling after the run completes.
- Trigger errors are retried with backoff; after 10 minutes of continuous failures, the listener aborts with `Trigger failing continuously: aborting after timeout`.

## Examples

- Quick test: write a trigger that returns an event once and then `null`. Run `raili listen` to observe a single run being invoked.

## Notes

- Trigger modules are loaded with Node `require` and must be CommonJS exports.
- `raili listen` is intended for lightweight event-driven automation; long-running tasks should still be orchestrated via external schedulers.

See also: `documentation/usage/run.md` and `documentation/usage/init.md` for workflow and initialization details.
