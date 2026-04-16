import { Position } from './lsp_types';

export type ValidatorError = {
  message: string;
  severity: 'error' | 'warning' | 'info';
  location: Position;
};

export type Diagnostic = {
  message: string;
  severity: number; // 1 = Error, 2 = Warning, 3 = Information
  location: Position;
};

function mapSeverity(s: ValidatorError['severity']): number {
  switch (s) {
    case 'error':
      return 1;
    case 'warning':
      return 2;
    case 'info':
    default:
      return 3;
  }
}

export function mapDiagnostics(errors: ValidatorError[]): Diagnostic[] {
  return errors.map((e) => ({ message: e.message, severity: mapSeverity(e.severity), location: e.location }));
}
