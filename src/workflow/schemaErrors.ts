export class SchemaValidationError extends Error {
  constructor(
    message: string,
    public context?: string,
  ) {
    const fullMessage = context ? `${message} (in ${context})` : message;
    super(fullMessage);
    this.name = 'SchemaValidationError';
  }
}
