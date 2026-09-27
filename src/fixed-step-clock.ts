/** Fixed simulation steps with bounded catch-up, without modulo time loss. */
export class FixedStepClock {
  readonly stepMs = 1000 / 60;
  private previous: number | null = null;
  private accumulated = 0;
  simulatedMs = 0;
  droppedMs = 0;

  reset(): void {
    this.previous = null;
    this.accumulated = 0;
    this.simulatedMs = 0;
    this.droppedMs = 0;
  }

  advance(now: number, speed: number, step: (milliseconds: number) => void): number {
    if (this.previous === null) this.previous = now;
    const elapsed = Math.max(0, now - this.previous);
    this.previous = now;
    const requested = this.accumulated + elapsed * speed;
    this.accumulated = Math.min(requested, 250);
    this.droppedMs += Math.max(0, requested - this.accumulated);
    let count = 0;
    // Bound work in a frame. Under sustained overload, real speed can be below the selected speed.
    while (this.accumulated + 1e-7 >= this.stepMs && count < 12) {
      step(this.stepMs);
      this.accumulated = Math.max(0, this.accumulated - this.stepMs);
      this.simulatedMs += this.stepMs;
      count++;
    }
    return count;
  }

  get interpolation(): number {
    return Math.min(1, this.accumulated / this.stepMs);
  }
}
