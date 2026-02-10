/* sim/pwm_sim.js */
export const PicoPWM = {
    slices: Array(8).fill().map(() => ({
        wrap: 0xffff,
        enabled: false
    })),
    // Map GPIO to Slice (simplified 1:1 for now, real hardware is more complex)
    // GPIO 0,1 -> Slice 0
    // GPIO 2,3 -> Slice 1 ...

    set_wrap(slice, wrap) {
        this.slices[slice].wrap = wrap;
        console.log(`[PWM] Slice ${slice} wrap set to ${wrap}`);
    },

    set_gpio_level(pin, level) {
        // Find slice for pin
        const slice = Math.floor(pin / 2);
        const s = this.slices[slice];

        // Calculate duty cycle (0.0 to 1.0)
        let duty = 0;
        if (s.wrap > 0) {
            duty = level / s.wrap;
        }

        // Visual hook (Opacity for LED)
        if (typeof window !== 'undefined' && window.updateLED) {
            // For PWM, we might want a special update or just treat > 50% as ON?
            // Or better: update opacity if the UI supports it.
            // For now, let's just log it and threshold it for the boolean LED
            console.log(`[PWM] GPIO ${pin} Level ${level}/${s.wrap} (${(duty * 100).toFixed(1)}%)`);

            // Simple threshold for digital LED visualization
            window.updateLED(pin, duty > 0.5 ? 1 : 0);

            // If we want real dimming, we'd need to update index.html to handle opacity
        }
    },

    set_enabled(slice, enabled) {
        this.slices[slice].enabled = enabled;
        console.log(`[PWM] Slice ${slice} enabled: ${enabled}`);
    }
};

// Expose to Module
if (typeof Module !== 'undefined') {
    Module.imports = Object.assign(Module.imports || {}, {
        sim_pwm_set_wrap: (s, w) => PicoPWM.set_wrap(s, w),
        sim_pwm_set_gpio_level: (p, l) => PicoPWM.set_gpio_level(p, l),
        sim_pwm_set_enabled: (s, e) => PicoPWM.set_enabled(s, e)
    });
}

// Global Export
if (typeof window !== 'undefined') {
    window.PicoPWM = PicoPWM;
}
