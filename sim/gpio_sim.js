/* sim/gpio_sim.js */
export const PicoGPIO = {
  pins: Array(30).fill().map(() => ({
    dir: 0,
    value: null,
    pull: 0,   // 1 = pull-up, -1 = pull-down, 0 = none
    irqMask: 0,
    irqEnabled: false
  })),

  /* SDK Hooks */
  gpio_init(pin) { },

  gpio_set_dir(pin, dir) {
    this.pins[pin].dir = dir;
  },

  gpio_put(pin, value) {
    this.pins[pin].value = value;
    // Visualization hook (if UI exists)
    if (typeof window !== 'undefined' && typeof window.updateLED === 'function') {
      window.updateLED(pin, value);
    }
  },

  gpio_get(pin) {
    const p = this.pins[pin];

    if (p.dir === 1) return p.value ?? 0;

    // INPUT logic
    if (p.value !== null) return p.value;
    if (p.pull === 1) return 1;
    if (p.pull === -1) return 0;

    return 0; // Floating default
  },

  gpio_pull(pin, mode) {
    this.pins[pin].pull = mode;
  },

  /* IRQ Configuration */
  gpio_irq_config(pin, mask, enabled) {
    this.pins[pin].irqMask = mask;
    this.pins[pin].irqEnabled = enabled;
  },

  irqFire(pin, event) {
    if (typeof Module !== 'undefined' && Module.ccall) {
      Module.ccall(
        "sim_gpio_irq_fire",
        null,
        ["number", "number"],
        [pin, event]
      );
    }
  },

  /* User/UI Interaction */
  setInput(pin, newValue) {
    const p = this.pins[pin];
    const oldValue = this.gpio_get(pin); // Get logical state before change

    p.value = newValue; // Update physical input state

    // Check IRQ
    if (!p.irqEnabled) return;

    const currentValue = this.gpio_get(pin); // Get new logical state

    // Rising Edge (0 -> 1)
    if (oldValue === 0 && currentValue === 1 && (p.irqMask & 1)) {
      this.irqFire(pin, 1);
    }

    // Falling Edge (1 -> 0)
    if (oldValue === 1 && currentValue === 0 && (p.irqMask & 2)) {
      this.irqFire(pin, 2);
    }
  },

  // Method to expose logic to global scope if needed for UI testing without Module
  reset() {
    this.pins.forEach(p => {
      p.value = null;
      p.dir = 0;
      p.pull = 0;
      p.irqEnabled = false;
    });
  }
};

// Expose to Module if environment ready
if (typeof Module !== 'undefined') {
  // Extend Module.imports safely
  Module.imports = Object.assign(Module.imports || {}, {
    sim_gpio_init: p => PicoGPIO.gpio_init(p),
    sim_gpio_set_dir: (p, d) => PicoGPIO.gpio_set_dir(p, d),
    sim_gpio_put: (p, v) => PicoGPIO.gpio_put(p, v),
    sim_gpio_get: p => PicoGPIO.gpio_get(p),
    sim_gpio_pull: (p, m) => PicoGPIO.gpio_pull(p, m),
    sim_gpio_irq_config: (p, m, e) => PicoGPIO.gpio_irq_config(p, m, e)
  });
}

// Global Export for UI
window.PicoGPIO = PicoGPIO;
