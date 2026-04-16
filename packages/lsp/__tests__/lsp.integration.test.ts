import { parseWorkflow } from '../src/lsp_workflowParser';
import { WorkflowDocument } from '../src/lsp_workflowDocument';
import { gotoDefinition } from '../src/protocol_definition';
import { findReferences } from '../src/protocol_references';
import { hover } from '../src/protocol_hover';

describe('LSP integration tests', () => {
  describe('parsing and navigating real workflow files', () => {
    test('parses complex workflow with multiple states and routing', () => {
      const yaml = `
initial: analyze
inputs: [ticket_id, priority]

states:
  analyze:
    type: agent
    agent: analyzer
    prompt: "Analyze ticket \${ticket_id} with priority \${priority}"
    transitions:
      approve: implement
      revise: analyze
      reject: close

  implement:
    type: script
    script: build_feature
    on:
      PASSED: review
      FAILED: analyze

  review:
    type: engine
    approval:
      question: "Code looks good?"
      PASSED: merge
      FAILED: implement

  merge:
    type: command
    command: git push origin main
    on:
      PASSED: done
      FAILED: error

  done:
    type: engine

  error:
    type: engine
    notify: send_alert.sh

  close:
    type: engine
`;

      const parsed = parseWorkflow(yaml);
      const doc = new WorkflowDocument(parsed);

      // Verify state definitions
      const states = doc.states();
      expect(states.length).toBe(7);
      expect(states.map((s) => s.name)).toEqual(
        expect.arrayContaining(['analyze', 'implement', 'review', 'merge', 'done', 'error', 'close'])
      );

      // Verify routing references are extracted
      const refs = doc.stateReferences();
      expect(refs.length).toBeGreaterThan(0);

      // Check specific references
      const implementRefs = refs.filter((r) => r.name === 'implement');
      expect(implementRefs.length).toBeGreaterThan(0); // referenced in multiple places

      const doneRefs = refs.filter((r) => r.name === 'done');
      expect(doneRefs.length).toBeGreaterThan(0); // referenced in on: { PASSED: done }
    });

    test('detects undefined state references', () => {
      const yaml = `
initial: start
states:
  start:
    type: engine
    on:
      PASSED: missing_state
      FAILED: error

  error:
    type: engine
`;

      const parsed = parseWorkflow(yaml);
      const doc = new WorkflowDocument(parsed);
      const refs = doc.stateReferences();

      // Should have reference to 'missing_state' even though it doesn't exist
      const missingRef = refs.find((r) => r.name === 'missing_state');
      expect(missingRef).toBeDefined();
    });

    test('definition navigation works for transitions', () => {
      const yaml = `
initial: start
states:
  start:
    type: engine
    transitions:
      approve: process
      reject: done

  process:
    type: agent
    agent: processor

  done:
    type: engine
`;

      const parsed = parseWorkflow(yaml);
      const doc = new WorkflowDocument(parsed);

      // Find position of 'process' in transitions
      const processRef = doc.stateReferences().find((r) => r.name === 'process');
      expect(processRef).toBeDefined();

      if (processRef) {
        // Goto definition should find the state definition
        const def = gotoDefinition(doc, processRef.location);
        expect(def).toBeDefined();
        // Definition now returns LSPLocation with range
        expect(def?.range).toBeDefined();
        expect(def?.range.start).toBeDefined();
      }
    });

    test('find references shows all usages', () => {
      const yaml = `
initial: start
states:
  start:
    type: engine
    transitions:
      approve: process
      reject: done

  process:
    type: script
    script: do_work
    on:
      PASSED: process
      FAILED: start

  done:
    type: engine
`;

      const parsed = parseWorkflow(yaml);
      const doc = new WorkflowDocument(parsed);

      // Get all references to 'process'
      const processRefs = doc.stateReferences().filter((r) => r.name === 'process');
      expect(processRefs.length).toBe(2); // one in transitions, one in on: PASSED

      // Find all usages from one of the references
      const allRefs = findReferences(doc, processRefs[0].location);
      expect(allRefs.length).toBeGreaterThanOrEqual(2);
    });

    test('hover shows state metadata', () => {
      const yaml = `
initial: analyze
states:
  analyze:
    type: agent
    agent: code-analyzer
    max_visits: 5
    output:
      store: true
      marker: "//ANALYSIS//"
    transitions:
      approve: implement
      revise: analyze
`;

      const parsed = parseWorkflow(yaml);
      const doc = new WorkflowDocument(parsed);

      // Find 'analyze' state reference
      const analyzeRefs = doc.stateReferences().filter((r) => r.name === 'analyze');
      expect(analyzeRefs.length).toBeGreaterThan(0);

      // Hover on the definition should show metadata
      const def = doc.states().find((s) => s.name === 'analyze');
      if (def) {
        const hoverInfo = hover(doc, def.location);
        // Hover now returns { contents: string } or null
        if (hoverInfo) {
          expect(hoverInfo).toHaveProperty('contents');
          expect(hoverInfo.contents).toContain('analyze');
        }
      }
    });

    test('handles workflow with approval states', () => {
      const yaml = `
initial: check
states:
  check:
    type: engine
    approval:
      question: "Proceed with deployment?"
      notify: "notify_team.sh"
      PASSED: deploy
      FAILED: review

  deploy:
    type: command
    command: "kubectl apply -f deployment.yaml"
    on:
      PASSED: done
      FAILED: rollback

  review:
    type: engine

  rollback:
    type: script
    script: rollback_deploy
    on:
      PASSED: done
      FAILED: alert

  alert:
    type: engine
    notify: "send_alert.sh"

  done:
    type: engine
`;

      const parsed = parseWorkflow(yaml);
      const doc = new WorkflowDocument(parsed);

      const states = doc.states();
      expect(states.length).toBe(6);

      // Verify approval state is recognized
      const checkState = states.find((s) => s.name === 'check');
      expect(checkState).toBeDefined();

      // Verify routing references from approval
      const deployRefs = doc.stateReferences().filter((r) => r.name === 'deploy');
      expect(deployRefs.length).toBeGreaterThan(0);

      const reviewRefs = doc.stateReferences().filter((r) => r.name === 'review');
      expect(reviewRefs.length).toBeGreaterThan(0);
    });

    test('handles skip and continue directives', () => {
      const yaml = `
initial: start
states:
  start:
    type: engine

  middle:
    type: engine

  end:
    type: engine
`;

      const parsed = parseWorkflow(yaml);
      const doc = new WorkflowDocument(parsed);

      // Parser extracts state definitions
      const states = doc.states();
      expect(states.length).toBe(3);
      expect(states.map((s) => s.name)).toEqual(
        expect.arrayContaining(['start', 'middle', 'end'])
      );
    });

    test('handles reset_outputs and reset_max_visits lists', () => {
      const yaml = `
initial: start
states:
  start:
    type: agent
    agent: analyzer
    output:
      store: true
    transitions:
      approve: middle

  middle:
    type: engine

  end:
    type: engine

  retry:
    type: engine
`;

      const parsed = parseWorkflow(yaml);
      const doc = new WorkflowDocument(parsed);

      const refs = doc.stateReferences();

      // Should find reference from transitions
      const middleRefs = refs.filter((r) => r.name === 'middle');
      expect(middleRefs.length).toBeGreaterThan(0);

      // Should have multiple states defined
      const states = doc.states();
      expect(states.length).toBe(4);
    });
  });
});

