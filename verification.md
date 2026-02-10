# Verification: Steps 1-5 (Manual)

Run these snippets in the Browser Console (F12) to verify the simulator logic.

## Step 1: GPIO Output (LED)
Should turn the LED RED.
```javascript
PicoGPIO.gpio_init(15);
PicoGPIO.gpio_set_dir(15, 1);
PicoGPIO.gpio_put(15, 1);
```
Turn OFF:
```javascript
PicoGPIO.gpio_put(15, 0);
```

## Step 2: Timing (Blinky)
Should blink the LED every 500ms. (Refresh page to stop).
```javascript
PicoGPIO.gpio_init(15);
PicoGPIO.gpio_set_dir(15, 1);
(async function blink() {
    console.log("Starting Blink Loop...");
    while (true) {
        PicoGPIO.gpio_put(15, 1);
        await TimeSim.sleep_ms(500);
        PicoGPIO.gpio_put(15, 0);
        await TimeSim.sleep_ms(500);
    }
})();
```

## Step 3: Serial Output
Should print to the Serial Monitor box on the page.
```javascript
SerialSim.write("Hello from Console!\n");
```

## Step 4: GPIO Input (Button)
1. Run setup:
```javascript
PicoGPIO.gpio_init(14);
PicoGPIO.gpio_set_dir(14, 0);
PicoGPIO.gpio_pull(14, 1); // Pull-up
```
2. Check State (Should be `1`):
```javascript
PicoGPIO.gpio_get(14);
```
3. **Press Button** on screen, then Check State (Should be `0`):
```javascript
PicoGPIO.gpio_get(14);
```

## Step 5: Interrupts (IRQ)
1. Setup IRQ for Falling Edge:
```javascript
PicoGPIO.gpio_irq_config(14, 0x2, true);
```
2. **Press Button** on screen.
3. Check Console. You should see: `"Button Pressed (GPIO 14 -> 0)"` automatically.
