import { ApprovalConfig } from '../types';
import { ApprovalConfigSchema } from './schemas';
import { validateObject } from './objectValidator';

export function validateApprovalConfig(config: any): ApprovalConfig {
  validateObject(config, ApprovalConfigSchema, 'approval config');
  return config as ApprovalConfig;
}
