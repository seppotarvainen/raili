import {generateSchemaOutput} from '../../src/cli/schema-formatter';
import * as schemasModule from '../../src/workflow/schemas';

describe('schema-formatter', () => {
  describe('generateSchemaOutput', () => {
    it('should return a string', () => {
      const output = generateSchemaOutput();
      expect(typeof output).toBe('string');
    });

    it('should include the title', () => {
      const output = generateSchemaOutput();
      expect(output).toContain('RAILI WORKFLOW YAML SCHEMA');
    });

    it('should include all top-level schema sections', () => {
      const output = generateSchemaOutput();
      expect(output).toContain('Workflow Top-Level');
      expect(output).toContain('State Configuration');
      expect(output).toContain('Output Configuration');
      expect(output).toContain('Approval Configuration');
    });

    it('should include routing rules section', () => {
      const output = generateSchemaOutput();
      expect(output).toContain('ROUTING RULES');
      expect(output).toContain('on:');
      expect(output).toContain('transitions:');
      expect(output).toContain('approval:');
    });

    it('should include special notes', () => {
      const output = generateSchemaOutput();
      expect(output).toContain('SPECIAL NOTES');
      expect(output).toContain('Agents always exit code 0');
    });

    it('should format WorkflowConfig fields', () => {
      const output = generateSchemaOutput();
      expect(output).toContain('initial');
      expect(output).toContain('(REQUIRED)');
      expect(output).toContain('error');
      expect(output).toContain('(OPTIONAL)');
    });

    it('should format StateConfig fields', () => {
      const output = generateSchemaOutput();
      expect(output).toContain('type: string');
      expect(output).toContain('agent');
      expect(output).toContain('script');
      expect(output).toContain('command');
    });

    it('should include field descriptions', () => {
      const output = generateSchemaOutput();
      expect(output).toContain('ID of the initial state');
      expect(output).toContain('Type of state handler');
    });

    it('should indicate required vs optional fields', () => {
      const output = generateSchemaOutput();
      // Some required fields
      const requiredMatches = output.match(/\(REQUIRED\)/g);
      expect(requiredMatches && requiredMatches.length).toBeGreaterThan(0);
      // Some optional fields
      const optionalMatches = output.match(/\(OPTIONAL\)/g);
      expect(optionalMatches && optionalMatches.length).toBeGreaterThan(0);
    });

    it('should format enum values', () => {
      const output = generateSchemaOutput();
      expect(output).toContain('one of: agent, script, command, engine');
    });

    it('should include type information', () => {
      const output = generateSchemaOutput();
      expect(output).toContain('string');
      expect(output).toContain('object');
      expect(output).toContain('number');
      expect(output).toContain('array');
    });

    it('should not have duplicate sections', () => {
      const output = generateSchemaOutput();
      const titleCount = (output.match(/RAILI WORKFLOW YAML SCHEMA/g) || []).length;
      expect(titleCount).toBe(1);
    });

    it('should have proper line breaks and spacing', () => {
      const output = generateSchemaOutput();
      const lines = output.split('\n');
      expect(lines.length).toBeGreaterThan(10);
      // Should have empty lines for formatting
      expect(lines.some(line => line.trim() === '')).toBe(true);
    });
  });

  describe('Schema structure validation', () => {
    it('WorkflowConfigSchema should exist and be an object', () => {
      expect(schemasModule.WorkflowConfigSchema).toBeDefined();
      expect(typeof schemasModule.WorkflowConfigSchema).toBe('object');
    });

    it('StateConfigSchema should exist and be an object', () => {
      expect(schemasModule.StateConfigSchema).toBeDefined();
      expect(typeof schemasModule.StateConfigSchema).toBe('object');
    });

    it('OutputConfigSchema should exist and be an object', () => {
      expect(schemasModule.OutputConfigSchema).toBeDefined();
      expect(typeof schemasModule.OutputConfigSchema).toBe('object');
    });

    it('ApprovalConfigSchema should exist and be an object', () => {
      expect(schemasModule.ApprovalConfigSchema).toBeDefined();
      expect(typeof schemasModule.ApprovalConfigSchema).toBe('object');
    });

    it('WorkflowConfigSchema should have initial field', () => {
      expect(schemasModule.WorkflowConfigSchema.initial).toBeDefined();
      expect(schemasModule.WorkflowConfigSchema.initial.required).toBe(true);
    });

    it('WorkflowConfigSchema should have states field', () => {
      expect(schemasModule.WorkflowConfigSchema.states).toBeDefined();
      expect(schemasModule.WorkflowConfigSchema.states.required).toBe(true);
    });

    it('StateConfigSchema should have type field', () => {
      expect(schemasModule.StateConfigSchema.type).toBeDefined();
      expect(schemasModule.StateConfigSchema.type.required).toBe(true);
      expect(schemasModule.StateConfigSchema.type.enum).toContain('agent');
      expect(schemasModule.StateConfigSchema.type.enum).toContain('script');
      expect(schemasModule.StateConfigSchema.type.enum).toContain('command');
      expect(schemasModule.StateConfigSchema.type.enum).toContain('engine');
    });

    it('OutputConfigSchema should have store field as required', () => {
      expect(schemasModule.OutputConfigSchema.store).toBeDefined();
      expect(schemasModule.OutputConfigSchema.store.required).toBe(true);
    });

    it('OutputConfigSchema tail should be optional', () => {
      expect(schemasModule.OutputConfigSchema.tail).toBeDefined();
      expect(schemasModule.OutputConfigSchema.tail.required).toBe(false);
    });

    it('ApprovalConfigSchema should have question field as required', () => {
      expect(schemasModule.ApprovalConfigSchema.question).toBeDefined();
      expect(schemasModule.ApprovalConfigSchema.question.required).toBe(true);
    });

    it('ApprovalConfigSchema should have PASSED and FAILED routing', () => {
      expect(schemasModule.ApprovalConfigSchema.PASSED).toBeDefined();
      expect(schemasModule.ApprovalConfigSchema.FAILED).toBeDefined();
      expect(schemasModule.ApprovalConfigSchema.PASSED.required).toBe(true);
      expect(schemasModule.ApprovalConfigSchema.FAILED.required).toBe(true);
    });

    it('StateConfigSchema agent field should be valid only for agent type', () => {
      expect(schemasModule.StateConfigSchema.agent.validForTypes).toContain('agent');
      expect(schemasModule.StateConfigSchema.agent.validForTypes).not.toContain('script');
    });

    it('StateConfigSchema script field should be valid only for script type', () => {
      expect(schemasModule.StateConfigSchema.script.validForTypes).toContain('script');
      expect(schemasModule.StateConfigSchema.script.validForTypes).not.toContain('agent');
    });

    it('StateConfigSchema command field should be valid only for command type', () => {
      expect(schemasModule.StateConfigSchema.command.validForTypes).toContain('command');
      expect(schemasModule.StateConfigSchema.command.validForTypes).not.toContain('agent');
    });
  });

  describe('Generated output content', () => {
    let output: string;

    beforeAll(() => {
      output = generateSchemaOutput();
    });

    it('should mention all state types', () => {
      expect(output).toContain('agent');
      expect(output).toContain('script');
      expect(output).toContain('command');
      expect(output).toContain('engine');
    });

    it('should mention routing mechanisms', () => {
      expect(output).toContain('Binary routing');
      expect(output).toContain('Named routing');
      expect(output).toContain('Manual approval');
      // Terminal state is mentioned as "No routing defined → terminal state"
      expect(output).toContain('terminal state');
    });

    it('should explain exit codes', () => {
      expect(output).toContain('exit code 0');
      expect(output).toContain('PASSED');
      expect(output).toContain('FAILED');
    });

    it('should explain that agents exit 0', () => {
      expect(output).toContain('Agents always exit code 0');
    });

    it('should mention transitions for agents', () => {
      expect(output).toContain('transitions:');
      expect(output).toContain('agents');
    });

    it('should mention approval is optional', () => {
      expect(output).toContain('approval');
      expect(output).toContain('(OPTIONAL)');
    });

    it('should have organized sections with headers', () => {
      const sections = [
        'Workflow Top-Level',
        'State Configuration',
        'Output Configuration',
        'Approval Configuration',
        'ROUTING RULES',
        'SPECIAL NOTES'
      ];
      sections.forEach(section => {
        expect(output).toContain(section);
      });
    });
  });

  describe('Field formatting', () => {
    it('should format fields with proper indentation', () => {
      const output = generateSchemaOutput();
      // Should have indented fields (start with spaces)
      const hasIndentedContent = output.split('\n').some(line => /^  [a-z]/.test(line));
      expect(hasIndentedContent).toBe(true);
    });

    it('should show field types', () => {
      const output = generateSchemaOutput();
      expect(output).toContain('string');
      expect(output).toContain('number');
      expect(output).toContain('object');
      expect(output).toContain('array');
    });

    it('should show field descriptions', () => {
      const output = generateSchemaOutput();
      // Fields are formatted with their descriptions on the next line
      // Spot check some specific descriptions that are included
      expect(output).toContain('ID of the initial state');
      expect(output).toContain('State definitions');
      expect(output).toContain('Type of state handler');
      expect(output).toContain('Optional shell command');
    });
  });

  describe('Enum handling', () => {
    it('should show enum values when present', () => {
      const output = generateSchemaOutput();
      // State type enum should be visible
      expect(output).toContain('one of:');
      expect(output).toContain('agent');
      expect(output).toContain('script');
      expect(output).toContain('command');
      expect(output).toContain('engine');
    });
  });
});

