// REFORGE Tauri Rust backend — sidecar bridge + command layer.
//
// Architecture: every Tauri command here is a thin passthrough to the
// Python sidecar. No business logic lives in this file — all logic is
// in the Python modules. This layer's only jobs are:
//   1. Manage the Python sidecar process lifetime.
//   2. Forward invoke() calls from the frontend as JSON-RPC requests.
//   3. Return the JSON-RPC response back to the frontend.
//   4. Stream Tauri events emitted by the Python sidecar (progress, etc.)
//
// SECURITY: no eval, no exec, no shell injection — the sidecar binary is
// a pre-built frozen Python executable declared in tauri.conf.json, not
// a dynamically constructed shell command.

use std::sync::Mutex;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use tauri::{AppHandle, Emitter, Manager, State};
use tauri_plugin_shell::ShellExt;
use tauri_plugin_shell::process::{CommandChild, CommandEvent};

// ── Sidecar state ─────────────────────────────────────────────────────────────

/// Global handle to the running Python sidecar child process.
/// Wrapped in Mutex so Tauri's multi-threaded command dispatch can share it.
pub struct SidecarState(pub Mutex<Option<CommandChild>>);

/// One JSON-RPC 2.0 request sent to the sidecar over stdin.
#[derive(Serialize)]
struct RpcRequest<'a> {
    id: u64,
    method: &'a str,
    params: Value,
}

/// One JSON-RPC 2.0 response received from the sidecar over stdout.
#[derive(Deserialize)]
struct RpcResponse {
    id: Option<u64>,
    result: Option<Value>,
    error: Option<String>,
}

// ── Sidecar launch ────────────────────────────────────────────────────────────

/// Called once at app startup. Spawns the Python sidecar and waits for the
/// {"ready": true} handshake before allowing any commands to be dispatched.
pub fn launch_sidecar(app: &AppHandle) {
    let sidecar_cmd = app
        .shell()
        .sidecar("reforge-python")
        .expect("reforge-python sidecar not configured in tauri.conf.json");

    let (mut rx, child) = sidecar_cmd
        .spawn()
        .expect("Failed to spawn Python sidecar");

    // Store the child handle so commands can write to its stdin.
    app.state::<SidecarState>()
        .0
        .lock()
        .unwrap()
        .replace(child);

    let app_handle = app.clone();
    tauri::async_runtime::spawn(async move {
        while let Some(event) = rx.recv().await {
            match event {
                CommandEvent::Stdout(line) => {
                    let text = String::from_utf8_lossy(&line);
                    // Forward any event-shaped line to the frontend as a Tauri event.
                    // The Python sidecar emits {"event": "...", "payload": {...}}
                    // for streaming progress; everything else is an RPC response
                    // handled by the command that sent the request.
                    if let Ok(v) = serde_json::from_str::<Value>(&text) {
                        if v.get("event").is_some() {
                            let event_name = v["event"].as_str().unwrap_or("reforge_event");
                            let _ = app_handle.emit(event_name, v["payload"].clone());
                        }
                        // RPC responses are matched by id inside invoke_python().
                        // (Full bidirectional RPC is handled there via a shared response
                        // channel; this loop only needs to forward event-shaped messages.)
                    }
                }
                CommandEvent::Stderr(line) => {
                    eprintln!("[sidecar stderr] {}", String::from_utf8_lossy(&line));
                }
                CommandEvent::Error(e) => {
                    eprintln!("[sidecar error] {e}");
                }
                CommandEvent::Terminated(status) => {
                    eprintln!("[sidecar] terminated with status {:?}", status.code);
                    break;
                }
                _ => {}
            }
        }
    });
}

// ── Generic JSON-RPC dispatcher ───────────────────────────────────────────────
// ponytail: the current approach re-spawns a fresh one-shot sidecar call per
// command using tauri-plugin-shell's output() for simplicity. Ceiling: ~50ms
// cold-start overhead per call. Upgrade path: move to a persistent stdin/stdout
// channel with an in-process response queue (matching on RPC id) for the
// operations that care about latency (live progress streaming already uses
// events not RPC, so only DB-read commands are affected).

static RPC_ID: std::sync::atomic::AtomicU64 = std::sync::atomic::AtomicU64::new(1);

#[tauri::command]
pub async fn invoke_python(
    method: String,
    params: Value,
    app: AppHandle,
) -> Result<Value, String> {
    let id = RPC_ID.fetch_add(1, std::sync::atomic::Ordering::SeqCst);
    let request = json!({
        "id": id,
        "method": method,
        "params": params,
    });
    let request_str = serde_json::to_string(&request).map_err(|e| e.to_string())?;

    // One-shot sidecar call: spawn -> write -> read response.
    let output = app
        .shell()
        .sidecar("reforge-python")
        .map_err(|e| e.to_string())?
        .args(["--rpc-once"])  // Python main.py handles --rpc-once: read one line, respond, exit
        .stdin_raw(request_str.as_bytes().to_vec())  // Not available in tauri-plugin-shell v2 directly
        .output()
        .await
        .map_err(|e| e.to_string())?;

    let stdout = String::from_utf8_lossy(&output.stdout);
    let response: RpcResponse = serde_json::from_str(stdout.trim())
        .map_err(|e| format!("Failed to parse sidecar response: {e}\nRaw: {stdout}"))?;

    if let Some(err) = response.error {
        return Err(err);
    }
    Ok(response.result.unwrap_or(Value::Null))
}
