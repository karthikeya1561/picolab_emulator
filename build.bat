@echo off
REM Build script for Pico W Simulator (WASM)
REM Requires Emscripten (emcc) in PATH

echo Building PicoW Simulator WASM...

emcc ^
    user/main.c ^
    sim/gpio.c ^
    sim/time.c ^
    sim/pwm.c ^
    -I sdk ^
    -s WASM=1 ^
    -s EXPORTED_FUNCTIONS="['_main', '_gpio_init', '_gpio_set_dir', '_gpio_put', '_gpio_get', '_gpio_set_irq_enabled_with_callback', '_pwm_set_wrap', '_pwm_set_gpio_level', '_pwm_set_enabled']" ^
    -s EXPORTED_RUNTIME_METHODS="['ccall', 'cwrap']" ^
    -o js/pico_sim.js

echo Build Complete. Check js/pico_sim.js
