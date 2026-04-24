export class VisitTracker {
  private visitCounts: Map<string, number> = new Map();
  private countedStates: Set<string> = new Set();
  private stepsExecuted: number = 0;
  private readonly maxSteps: number;

  constructor(maxSteps = 1000) {
    if (!Number.isInteger(maxSteps) || maxSteps < 0) {
      throw new Error('maxSteps must be a non-negative integer');
    }
    this.maxSteps = maxSteps;
  }

  incrementVisit(stateId: string): number {
    const prev = this.visitCounts.get(stateId) ?? 0;
    const next = prev + 1;
    this.visitCounts.set(stateId, next);
    return next;
  }

  getVisitCount(stateId: string): number {
    return this.visitCounts.get(stateId) ?? 0;
  }

  /**
   * Record that the engine executed a logical step for the given stateId.
   * Returns true when the step was counted (first time for that stateId),
   * false when the state was already counted.
   */
  recordStep(stateId: string): boolean {
    if (this.countedStates.has(stateId)) return false;
    this.countedStates.add(stateId);
    this.stepsExecuted += 1;
    return true;
  }

  /**
   * Reset visit counts and counted-state tracking for provided states.
   * This does not mutate stepsExecuted except that subsequent recordStep
   * calls for those states will be counted again.
   */
  resetVisits(stateIds: string[]): void {
    for (const id of stateIds) {
      this.visitCounts.delete(id);
      this.countedStates.delete(id);
    }
  }

  /**
   * Returns true if executing nextSteps more steps would exceed the configured maxSteps.
   */
  hasReachedLimit(nextSteps: number): boolean {
    if (!Number.isInteger(nextSteps) || nextSteps < 0) {
      throw new Error('nextSteps must be a non-negative integer');
    }
    return this.stepsExecuted + nextSteps > this.maxSteps;
  }

  // Helper getter used by tests and callers that need the current executed count.
  getStepsExecuted(): number {
    return this.stepsExecuted;
  }
}
