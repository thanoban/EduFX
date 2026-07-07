"use client";

/**
 * Deterministic session-integrity signals — the layer real proctoring systems
 * trust most, because unlike camera inference these browser events are exact:
 *
 *   - tab switched / window minimised  -> `visibilitychange` (document.hidden)
 *   - clicked into another app/window  -> window `blur` / `focus`
 *
 * The monitor latches "was the tab hidden or window unfocused at any point
 * since the last snapshot?" so even a 2-second WhatsApp check between the 12s
 * snapshots is recorded, and counts total switches for the session.
 */
export class IntegrityMonitor {
  private hiddenLatch = false;
  private switchCount = 0;
  private listening = false;

  private readonly onVisibility = () => {
    if (document.hidden) {
      this.hiddenLatch = true;
      this.switchCount += 1;
    }
  };

  private readonly onBlur = () => {
    this.hiddenLatch = true;
    this.switchCount += 1;
  };

  start() {
    if (this.listening || typeof document === "undefined") {
      return;
    }
    document.addEventListener("visibilitychange", this.onVisibility);
    window.addEventListener("blur", this.onBlur);
    this.listening = true;
  }

  stop() {
    if (!this.listening) {
      return;
    }
    document.removeEventListener("visibilitychange", this.onVisibility);
    window.removeEventListener("blur", this.onBlur);
    this.listening = false;
    this.hiddenLatch = false;
    this.switchCount = 0;
  }

  /** True when the tab/window lost focus since the last call; resets the latch. */
  consumeHiddenSinceLast(): boolean {
    const wasHidden = this.peekHidden();
    this.hiddenLatch = false;
    return wasHidden;
  }

  /** Same as consume, but without resetting — for the live UI indicator. */
  peekHidden(): boolean {
    return this.hiddenLatch || (typeof document !== "undefined" && document.hidden);
  }

  get totalSwitches() {
    return this.switchCount;
  }
}
