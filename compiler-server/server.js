/**
 * compiler-server/server.js — Online C → WASM Compiler
 *
 * Express server that compiles user C code (+ Pico SDK bridge files)
 * into WebAssembly using Emscripten (emcc).
 *
 * ENDPOINT:
 *   POST /compile
 *   Body: { "code": "...user C code..." }
 *   Returns: { "js": "...glue code...", "wasm": "...base64 wasm..." }
 *   On error: { "error": "...compilation errors..." }
 *
 * REQUIRES:
 *   - Emscripten SDK installed and emcc on PATH
 *   - npm install (express, cors)
 */

import express from 'express';
import cors from 'cors';
import { exec } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3001;

// All paths relative to __dirname (compiler-server/)
// This avoids Windows shell quoting issues with spaces in absolute paths
const BUILD_DIR = path.join(__dirname, 'build');
const SDK_DIR = 'sdk';           // relative to cwd
const SIM_DIR = 'sim';           // relative to cwd
const BUILD_REL = 'build';       // relative to cwd

// Middleware
app.use(cors());
app.use(express.json({ limit: '1mb' }));

// ---------- Compilation Endpoint ----------

app.post('/compile', async (req, res) => {
    const { code } = req.body;

    if (!code || typeof code !== 'string') {
        return res.status(400).json({ error: 'Missing or invalid "code" field' });
    }

    try {
        // 1. Ensure build directory exists
        await fs.mkdir(BUILD_DIR, { recursive: true });

        // 2. Write user code to file
        const userFile = path.join(BUILD_DIR, 'user_main.c');
        await fs.writeFile(userFile, code, 'utf-8');

        // 3. Gather all C bridge files (relative paths)
        const simFiles = await getSimFiles();

        // 4. Build emcc command using RELATIVE paths
        //    (avoids Windows quoting issues with spaces in absolute paths)
        const sourceFiles = [`${BUILD_REL}/user_main.c`, ...simFiles].join(' ');

        const emccCmd = [
            'emcc',
            sourceFiles,
            `-I ${SDK_DIR}`,
            `-o ${BUILD_REL}/app.js`,
            '-sEXPORTED_FUNCTIONS=_main',
            '-sEXPORTED_RUNTIME_METHODS=ccall,cwrap,UTF8ToString,stringToUTF8,lengthBytesUTF8',
            '-sASYNCIFY',
            '-sASYNCIFY_IMPORTS=emscripten_sleep',
            '-sMODULARIZE=1',
            '-sEXPORT_ES6=1',
            '-sEXPORT_NAME=createModule',
            '-sSINGLE_FILE=1',
            '-sENVIRONMENT=web',
            '-sALLOW_MEMORY_GROWTH=1',
            '-sINITIAL_MEMORY=16777216',
            '-sNO_EXIT_RUNTIME=1',
            '-O2',
            `--js-library ${SIM_DIR}/js_library.js`,
        ].join(' ');

        console.log(`[Compiler] Compiling...`);
        console.log(`[Compiler] Command: ${emccCmd}`);

        // 5. Execute emcc (cwd = compiler-server directory)
        const { code: exitCode, stdout, stderr } = await runCmd(emccCmd);

        const outputJs = path.join(BUILD_DIR, 'app.js');
        const outputWasm = path.join(BUILD_DIR, 'app.wasm');

        if (exitCode !== 0 || !(await fileExists(outputJs))) {
            console.error(`[Compiler] Build failed (exit ${exitCode}):`);
            if (stderr) console.error(stderr);
            return res.json({ error: formatError(stderr || stdout || 'Unknown compilation error') });
        }

        // 6. Read output file (SINGLE_FILE embeds WASM in JS)
        const jsCode = await fs.readFile(outputJs, 'utf-8');

        console.log(`[Compiler] Build successful (JS: ${jsCode.length} bytes, WASM embedded)`);

        // 7. Return compiled artifact
        res.json({
            js: jsCode,
            size: { js: jsCode.length }
        });

    } catch (err) {
        console.error(`[Compiler] Error:`, err.message);
        res.status(500).json({ error: err.message || 'Internal compiler error' });
    } finally {
        // 8. Clean up build artifacts
        await cleanup();
    }
});

// ---------- Health Check ----------

app.get('/health', (req, res) => {
    res.json({ status: 'ok', service: 'circuitflow-compiler' });
});

// ---------- Helpers ----------

/**
 * Run a shell command from the compiler-server directory.
 * Uses exec() which resolves .bat files on Windows automatically.
 */
function runCmd(cmd) {
    return new Promise((resolve) => {
        exec(cmd, {
            cwd: __dirname,  // compiler-server/
            timeout: 60000,
            maxBuffer: 1024 * 1024 * 10
        }, (err, stdout, stderr) => {
            resolve({
                code: err ? (err.code || 1) : 0,
                stdout: stdout || '',
                stderr: stderr || ''
            });
        });
    });
}

async function getSimFiles() {
    const entries = await fs.readdir(path.join(__dirname, SIM_DIR));
    return entries
        .filter(f => f.endsWith('.c'))
        .map(f => `${SIM_DIR}/${f}`);  // relative paths
}

async function fileExists(filePath) {
    try {
        await fs.access(filePath);
        return true;
    } catch {
        return false;
    }
}

function formatError(stderr) {
    const lines = stderr.split('\n');
    const errorLines = lines.filter(l =>
        l.includes('error:') ||
        l.includes('warning:') ||
        l.includes('undefined symbol') ||
        l.includes('fatal')
    );
    return errorLines.length > 0
        ? errorLines.join('\n')
        : stderr.substring(0, 2000);
}

async function cleanup() {
    try {
        const files = ['user_main.c', 'app.js', 'app.wasm', 'app.worker.js'];
        for (const f of files) {
            const filePath = path.join(BUILD_DIR, f);
            if (await fileExists(filePath)) {
                await fs.unlink(filePath);
            }
        }
    } catch (e) {
        console.warn('[Compiler] Cleanup warning:', e.message);
    }
}

// ---------- Startup ----------

app.listen(PORT, () => {
    console.log(`[Compiler] CircuitFlow C Compiler Server running on http://localhost:${PORT}`);
    console.log(`[Compiler] POST /compile to compile C code`);
    console.log(`[Compiler] SDK headers: ${path.resolve(__dirname, SDK_DIR)}`);
    console.log(`[Compiler] Bridge files: ${path.resolve(__dirname, SIM_DIR)}`);

    // Check emcc availability
    exec('emcc --version', (err, stdout) => {
        if (err) {
            console.error('[Compiler] ⚠️  WARNING: emcc not found! Install Emscripten SDK.');
        } else {
            const version = stdout.split('\n')[0];
            console.log(`[Compiler] ✅ ${version}`);
        }
    });
});
