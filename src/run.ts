/// <reference types="node" />
import * as fs from 'fs';
import * as path from 'path';
import { FIXED_STATE_MACHINE, validateStateMachine, xstateMachine } from './stateMachine';
import {createActor, interpret} from 'xstate';
import {validateAgentRegistry, validateScriptRegistry} from "./registryValidator";

export async function runCommand(cwd: string) {
  const railiDir = path.join(cwd, '.raili');
  if (!fs.existsSync(railiDir) || !fs.statSync(railiDir).isDirectory()) {
    throw new Error('.raili/ directory not found. Run `raili init` first.');
  }

  validateStateMachine(FIXED_STATE_MACHINE);

  const agentRegistryPath = path.join(railiDir, 'agent-registry.json');
  const scriptRegistryPath = path.join(railiDir, 'script-registry.json');

  if (!fs.existsSync(agentRegistryPath)) {
    throw new Error('agent-registry.json not found in .raili/');
  }
  if (!fs.existsSync(scriptRegistryPath)) {
    throw new Error('script-registry.json not found in .raili/');
  }

  // Validate registries and referenced files using validators
  const agents = validateAgentRegistry(cwd);
  const scripts = validateScriptRegistry(cwd);

  // Start the XState interpreter for the fixed state machine
  const service = createActor(xstateMachine);
  service.start();


  // service.state isn't available on the Actor type; use fixed machine initial state

  // For MVP, return loaded registries and current state for potential consumers
  return { agents, scripts};
}
