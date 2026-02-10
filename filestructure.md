picolab-emulator/
│
├── frontend/                         # UI Layer
│   ├── index.html
│   ├── css/
│   ├── js/
│   │   ├── wasm_loader.js
│   │   ├── ui_controller.js
│   │   ├── debugger_panel.js
│   │   ├── memory_viewer.js
│   │   └── waveform_viewer.js
│   └── assets/
│
├── emulator-core/                    # Full SoC Emulation Engine
│   │
│   ├── cpu/                          # ARM Cortex-M0+ emulation
│   │   ├── cortex_m0plus.cpp
│   │   ├── instruction_decoder.cpp
│   │   ├── register_file.cpp
│   │   ├── pipeline.cpp
│   │   └── exception_handler.cpp
│   │
│   ├── multicore/                    # Dual-core RP2040
│   │   ├── core0.cpp
│   │   ├── core1.cpp
│   │   ├── intercore_fifo.cpp
│   │   └── spinlock_controller.cpp
│   │
│   ├── memory/
│   │   ├── sram.cpp
│   │   ├── flash.cpp
│   │   ├── bootrom.cpp
│   │   ├── memory_map.cpp
│   │   └── dma_controller.cpp
│   │
│   ├── interrupts/
│   │   ├── nvic.cpp
│   │   ├── irq_router.cpp
│   │   └── timer_interrupts.cpp
│   │
│   ├── peripherals/
│   │   ├── gpio.cpp
│   │   ├── pwm.cpp
│   │   ├── uart.cpp
│   │   ├── spi.cpp
│   │   ├── i2c.cpp
│   │   ├── adc.cpp
│   │   └── rtc.cpp
│   │
│   ├── pio/                          # PIO State Machine Engine
│   │   ├── pio_decoder.cpp
│   │   ├── pio_state_machine.cpp
│   │   ├── pio_fifo.cpp
│   │   └── pio_clocking.cpp
│   │
│   ├── clocks/
│   │   ├── pll.cpp
│   │   ├── clock_tree.cpp
│   │   └── timing_model.cpp
│   │
│   └── soc/
│       ├── rp2040_soc.cpp
│       └── soc_reset.cpp
│
├── wifi-chip/                        # CYW43439 emulation
│   ├── cyw43439_core.cpp
│   ├── sdio_interface.cpp
│   ├── wifi_firmware_stub.cpp
│   ├── lwip_bridge.cpp
│   └── network_adapter.cpp
│
├── firmware-loader/
│   ├── elf_parser.cpp
│   ├── uf2_parser.cpp
│   ├── binary_loader.cpp
│   └── symbol_table.cpp
│
├── debug-engine/
│   ├── gdb_server.cpp
│   ├── breakpoint_manager.cpp
│   ├── trace_logger.cpp
│   └── performance_profiler.cpp
│
├── timing-engine/
│   ├── cycle_scheduler.cpp
│   ├── event_queue.cpp
│   └── deterministic_replay.cpp
│
├── wasm-build/                       # Compile emulator to WebAssembly
│   ├── CMakeLists.txt
│   ├── build_wasm.sh
│   └── emscripten_config.cmake
│
├── backend-services/
│   ├── compiler-server/
│   ├── export-server/
│   └── classroom-server/
│
├── docs/
│   ├── architecture.md
│   ├── rp2040_memory_map.md
│   ├── pio_design.md
│   └── wifi_emulation.md
│
└── README.md
