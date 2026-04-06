# CircuitFlow Simulator – Project Structure

## Overview
This project is a web-based circuit and microcontroller simulator.
Users write code and build circuits visually.
The circuit only works after running the code.

---

## Folder Breakdown

### /canvas
Handles the main SVG canvas.
Responsible for placing components and wires.

- **CanvasManager.js**  
  Manages all components and wires on the canvas.

- **WireInteractionManager.js**  
  Handles drawing wires by clicking pins.

---

### /components
Contains all hardware components.

- **LED.js**  
  Draws an LED, shows pins, supports dragging.

- **Resistor.js**  
  Draws a resistor and exposes connection pins.

- **Pico.js**  
  Represents the Raspberry Pi Pico board and its pins.

- **PushButton.js**  
  4-pin tactile push button with press/release interaction.

---

### /wires
Handles how wires look and behave.

- **Wire.js**  
  Draws curved wires and updates them when components move.

---

### /simulation
Handles communication between code and the circuit.

- **SimulatorBridge.js**  
  Connects the user’s code output to the visual components.

---

### app.js
Main entry file.
Initializes the editor, canvas, components, and simulation.
Acts as the glue between all parts.
