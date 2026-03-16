import {
  validateWorkflowConfig,
  validateStateConfig,
  validateApprovalConfig,
  SchemaValidationError
} from '../../src/schemaValidator';

describe('SchemaValidator', () => {
  describe('validateApprovalConfig', () => {
    it('should accept valid approval config', () => {
      const config = {
        question: 'Is this correct?',
        PASSED: 'next_state',
        FAILED: 'retry_state'
      };
      expect(() => validateApprovalConfig(config)).not.toThrow();
    });

    it('should accept approval config with optional notify', () => {
      const config = {
        question: 'Is this correct?',
        notify: 'echo "Please review"',
        PASSED: 'next_state',
        FAILED: 'retry_state'
      };
      expect(() => validateApprovalConfig(config)).not.toThrow();
    });

    it('should throw if required field "question" is missing', () => {
      const config = {
        PASSED: 'next_state',
        FAILED: 'retry_state'
      };
      expect(() => validateApprovalConfig(config)).toThrow(
        /required field.*question/i
      );
    });

    it('should throw if required field "PASSED" is missing', () => {
      const config = {
        question: 'Is this correct?',
        FAILED: 'retry_state'
      };
      expect(() => validateApprovalConfig(config)).toThrow(
        /required field.*PASSED/i
      );
    });

    it('should throw if required field "FAILED" is missing', () => {
      const config = {
        question: 'Is this correct?',
        PASSED: 'next_state'
      };
      expect(() => validateApprovalConfig(config)).toThrow(
        /required field.*FAILED/i
      );
    });

    it('should throw on unknown fields', () => {
      const config = {
        question: 'Is this correct?',
        PASSED: 'next_state',
        FAILED: 'retry_state',
        unknown_field: 'value'
      };
      expect(() => validateApprovalConfig(config)).toThrow(
        /unknown field.*unknown_field/i
      );
    });

    it('should throw if field has wrong type', () => {
      const config = {
        question: 123, // should be string
        PASSED: 'next_state',
        FAILED: 'retry_state'
      };
      expect(() => validateApprovalConfig(config)).toThrow(
        /field.*question.*expected string/i
      );
    });
  });

  describe('validateStateConfig', () => {
    it('should accept minimal valid agent state', () => {
      const config = {
        type: 'agent',
        agent: 'copilot'
      };
      expect(() => validateStateConfig(config, 'test_state')).not.toThrow();
    });

    it('should accept agent state with all optional fields', () => {
      const config = {
        type: 'agent',
        agent: 'copilot',
        prompt: 'Analyze this',
        output: { store: true },
        notify: 'echo starting',
        max_visits: 5,
        reset_outputs: ['previous_state'],
        on: {
          PASSED: 'next_state',
          FAILED: 'retry_state'
        }
      };
      expect(() => validateStateConfig(config, 'test_state')).not.toThrow();
    });

    it('should accept minimal valid script state', () => {
      const config = {
        type: 'script',
        script: 'scripts/analyze.sh'
      };
      expect(() => validateStateConfig(config, 'test_state')).not.toThrow();
    });

    it('should accept minimal valid command state', () => {
      const config = {
        type: 'command',
        command: 'echo "hello"'
      };
      expect(() => validateStateConfig(config, 'test_state')).not.toThrow();
    });

    it('should accept command state with directory', () => {
      const config = {
        type: 'command',
        command: 'npm test',
        directory: './backend'
      };
      expect(() => validateStateConfig(config, 'test_state')).not.toThrow();
    });

    it('should accept minimal valid engine state', () => {
      const config = {
        type: 'engine'
      };
      expect(() => validateStateConfig(config, 'test_state')).not.toThrow();
    });

    it('should throw if required field "type" is missing', () => {
      const config = {
        agent: 'copilot'
      };
      expect(() => validateStateConfig(config, 'test_state')).toThrow(
        /required field.*type/i
      );
    });

    it('should throw if type has invalid value', () => {
      const config = {
        type: 'invalid_type',
        agent: 'copilot'
      };
      expect(() => validateStateConfig(config, 'test_state')).toThrow(
        /field.*type.*must be one of.*agent.*script.*command.*engine/i
      );
    });

    it('should throw on unknown fields', () => {
      const config = {
        type: 'agent',
        agent: 'copilot',
        unknown_field: 'value'
      };
      expect(() => validateStateConfig(config, 'test_state')).toThrow(
        /unknown field.*unknown_field/i
      );
    });

    describe('Type-dependent field validation', () => {
      it('should throw if "agent" is used with type: script', () => {
        const config = {
          type: 'script',
          agent: 'copilot',
          script: 'scripts/analyze.sh'
        };
        expect(() => validateStateConfig(config, 'test_state')).toThrow(
          /field.*agent.*only valid for.*agent/i
        );
      });

      it('should throw if "script" is used with type: agent', () => {
        const config = {
          type: 'agent',
          agent: 'copilot',
          script: 'scripts/analyze.sh'
        };
        expect(() => validateStateConfig(config, 'test_state')).toThrow(
          /field.*script.*only valid for.*script/i
        );
      });

      it('should throw if "command" is used with type: agent', () => {
        const config = {
          type: 'agent',
          agent: 'copilot',
          command: 'echo hello'
        };
        expect(() => validateStateConfig(config, 'test_state')).toThrow(
          /field.*command.*only valid for.*command/i
        );
      });

      it('should throw if "directory" is used with type: agent', () => {
        const config = {
          type: 'agent',
          agent: 'copilot',
          directory: './backend'
        };
        expect(() => validateStateConfig(config, 'test_state')).toThrow(
          /field.*directory.*only valid for.*command/i
        );
      });

      it('should throw if "prompt" is used with type: script', () => {
        const config = {
          type: 'script',
          script: 'scripts/analyze.sh',
          prompt: 'Some prompt'
        };
        expect(() => validateStateConfig(config, 'test_state')).toThrow(
          /field.*prompt.*only valid for.*agent/i
        );
      });
    });

    describe('on/transitions validation', () => {
      it('should accept state with "on" field', () => {
        const config = {
          type: 'script',
          script: 'scripts/check.sh',
          on: {
            PASSED: 'next_state',
            FAILED: 'retry_state'
          }
        };
        expect(() => validateStateConfig(config, 'test_state')).not.toThrow();
      });

      it('should accept state with "transitions" field', () => {
        const config = {
          type: 'agent',
          agent: 'copilot',
          transitions: {
            success: 'next_state',
            needs_revision: 'retry_state'
          }
        };
        expect(() => validateStateConfig(config, 'test_state')).not.toThrow();
      });

      it('should throw if both "on" and "transitions" are present', () => {
        const config = {
          type: 'agent',
          agent: 'copilot',
          on: {
            PASSED: 'next_state'
          },
          transitions: {
            success: 'other_state'
          }
        };
        expect(() => validateStateConfig(config, 'test_state')).toThrow(
          /cannot have both.*on.*transitions/i
        );
      });

      it('should throw if "on" is missing PASSED key', () => {
        const config = {
          type: 'script',
          script: 'scripts/check.sh',
          on: {
            FAILED: 'retry_state'
          }
        };
        expect(() => validateStateConfig(config, 'test_state')).toThrow(
          /field.*on.*requires.*PASSED/i
        );
      });

      it('should throw if "on" has unknown keys', () => {
        const config = {
          type: 'script',
          script: 'scripts/check.sh',
          on: {
            PASSED: 'next_state',
            PENDING: 'wait_state'
          }
        };
        expect(() => validateStateConfig(config, 'test_state')).toThrow(
          /field.*on.*unknown key.*PENDING/i
        );
      });
    });

    describe('approval validation', () => {
      it('should accept state with valid approval config', () => {
        const config = {
          type: 'agent',
          agent: 'copilot',
          approval: {
            question: 'Is this correct?',
            PASSED: 'approved',
            FAILED: 'rejected'
          }
        };
        expect(() => validateStateConfig(config, 'test_state')).not.toThrow();
      });

      it('should throw if approval config is invalid', () => {
        const config = {
          type: 'agent',
          agent: 'copilot',
          approval: {
            question: 'Is this correct?'
            // Missing PASSED and FAILED
          }
        };
        expect(() => validateStateConfig(config, 'test_state')).toThrow(
          /field.*approval.*required field.*PASSED/i
        );
      });
    });

    describe('Field type validation', () => {
      it('should throw if output is not an object', () => {
        const config = {
          type: 'agent',
          agent: 'copilot',
          output: 'true' // string instead of object
        };
        expect(() => validateStateConfig(config, 'test_state')).toThrow(
          /field.*output.*expected object/i
        );
      });

      it('should throw if max_visits is not number', () => {
        const config = {
          type: 'agent',
          agent: 'copilot',
          max_visits: '5' // string instead of number
        };
        expect(() => validateStateConfig(config, 'test_state')).toThrow(
          /field.*max_visits.*expected number/i
        );
      });

      it('should throw if reset_outputs is not array', () => {
        const config = {
          type: 'agent',
          agent: 'copilot',
          reset_outputs: 'state1' // string instead of array
        };
        expect(() => validateStateConfig(config, 'test_state')).toThrow(
          /field.*reset_outputs.*expected array/i
        );
      });

      it('should throw if transitions is not object/record', () => {
        const config = {
          type: 'agent',
          agent: 'copilot',
          transitions: 'next_state' // string instead of object
        };
        expect(() => validateStateConfig(config, 'test_state')).toThrow(
          /field.*transitions.*expected object/i
        );
      });
    });
  });

  describe('validateWorkflowConfig', () => {
    it('should accept minimal valid workflow', () => {
      const config = {
        initial: 'start',
        states: {
          start: {
            type: 'agent',
            agent: 'copilot'
          }
        }
      };
      expect(() => validateWorkflowConfig(config)).not.toThrow();
    });

    it('should accept workflow with multiple states', () => {
      const config = {
        initial: 'analyze',
        states: {
          analyze: {
            type: 'agent',
            agent: 'copilot',
            on: {
              PASSED: 'implement',
              FAILED: 'analyze'
            }
          },
          implement: {
            type: 'script',
            script: 'scripts/implement.sh',
            on: {
              PASSED: 'test',
              FAILED: 'analyze'
            }
          },
          test: {
            type: 'command',
            command: 'npm test'
          }
        }
      };
      expect(() => validateWorkflowConfig(config)).not.toThrow();
    });

    it('should accept workflow with optional inputs', () => {
      const config = {
        initial: 'start',
        inputs: ['ticket_id', 'description'],
        states: {
          start: {
            type: 'agent',
            agent: 'copilot'
          }
        }
      };
      expect(() => validateWorkflowConfig(config)).not.toThrow();
    });

    it('should accept workflow with optional include', () => {
      const config = {
        initial: 'start',
        include: ['sub-workflows/cleanup.yaml'],
        states: {
          start: {
            type: 'agent',
            agent: 'copilot'
          }
        }
      };
      expect(() => validateWorkflowConfig(config)).not.toThrow();
    });

    it('should throw if required field "initial" is missing', () => {
      const config = {
        states: {
          start: {
            type: 'agent',
            agent: 'copilot'
          }
        }
      };
      expect(() => validateWorkflowConfig(config)).toThrow(
        /required field.*initial/i
      );
    });

    it('should throw if required field "states" is missing', () => {
      const config = {
        initial: 'start'
      };
      expect(() => validateWorkflowConfig(config)).toThrow(
        /required field.*states/i
      );
    });

    it('should throw on unknown top-level fields', () => {
      const config = {
        initial: 'start',
        states: {
          start: {
            type: 'agent',
            agent: 'copilot'
          }
        },
        unknown_field: 'value'
      };
      expect(() => validateWorkflowConfig(config)).toThrow(
        /unknown field.*unknown_field/i
      );
    });

    it('should throw if initial state does not exist in states', () => {
      const config = {
        initial: 'nonexistent',
        states: {
          start: {
            type: 'agent',
            agent: 'copilot'
          }
        }
      };
      expect(() => validateWorkflowConfig(config)).toThrow(
        /initial state.*nonexistent.*does not exist/i
      );
    });

    it('should throw if states is not an object', () => {
      const config = {
        initial: 'start',
        states: ['start', 'next']
      };
      expect(() => validateWorkflowConfig(config)).toThrow(
        /field.*states.*expected object/i
      );
    });

    it('should throw if inputs is not an array', () => {
      const config = {
        initial: 'start',
        inputs: 'ticket_id',
        states: {
          start: {
            type: 'agent',
            agent: 'copilot'
          }
        }
      };
      expect(() => validateWorkflowConfig(config)).toThrow(
        /field.*inputs.*expected array/i
      );
    });

    it('should throw if include is not an array', () => {
      const config = {
        initial: 'start',
        include: 'sub-workflows/cleanup.yaml',
        states: {
          start: {
            type: 'agent',
            agent: 'copilot'
          }
        }
      };
      expect(() => validateWorkflowConfig(config)).toThrow(
        /field.*include.*expected array/i
      );
    });

    it('should validate each state in states', () => {
      const config = {
        initial: 'start',
        states: {
          start: {
            type: 'agent',
            agent: 'copilot',
            unknown_field: 'value'
          }
        }
      };
      expect(() => validateWorkflowConfig(config)).toThrow(
        /unknown field.*unknown_field.*start/i
      );
    });
  });

  describe('Error messages', () => {
    it('SchemaValidationError should include context', () => {
      try {
        validateStateConfig(
          {
            type: 'agent',
            agent: 'copilot',
            unknown_field: 'value'
          },
          'test_state'
        );
      } catch (error) {
        expect(error).toBeInstanceOf(SchemaValidationError);
        expect((error as SchemaValidationError).message).toMatch(/test_state/);
      }
    });

    it('should provide helpful error message for unrecognized config', () => {
      try {
        validateWorkflowConfig({
          initial: 'start',
          states: {
            start: {
              type: 'agent',
              agent: 'copilot'
            }
          },
          invalid_field: 100
        });
      } catch (error) {
        expect((error as SchemaValidationError).message).toContain('invalid_field');
        expect((error as SchemaValidationError).message).toMatch(/unrecognized|unknown/i);
      }
    });
  });
});

