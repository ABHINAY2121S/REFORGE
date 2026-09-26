// REFORGE Tauri Rust backend -- sidecar bridge + command layer.
//
// Architecture: every Tauri command here is a thin passthrough to the
// Python sidecar. No business logic lives in this file -- all logic is
// in the Python modules. This layer only:
//   1. Manages the Python sidecar process lifetime.
//   2. Routes JSON-RPC requests from invoke_python() to sidecar stdin.
//   3. Routes sidecar stdout lines back to waiting callers or Tauri events.
//
// Commands live in commands.rs (not lib.rs root) to avoid the Tauri macro
// collision: #[tauri::command] pub fn in lib.rs generates duplicate symbols.

use std::collections::HashMap;
use std::sync::Mutex;
use serde_json::Value;
use tauri::{AppHandle, Emitter, Manager};
use tauri_plugin_shell::ShellExt;
use tauri_plugin_shell::process::{CommandChild, CommandEvent};
use tokio::sync::oneshot;

pub mod commands;
pub use commands::invoke_python;

// -- Sidecar state -------------------------------------------------------------

/// Global handle to the running Python sidecar child process.
pub struct SidecarState(pub Mutex<Option<CommandChild>>);

/// In-flight RPC calls waiting for a response, keyed by request id.
/// ponytail: unbounded map; ceiling is concurrent in-flight RPCs (typically 1).
pub struct PendingRpc(pub Mutex<HashMap<u64, oneshot::Sender<Result<Value, String>>>>);

pub(crate) static RPC_ID: std::sync::atomic::AtomicU64 = std::sync::atomic::AtomicU64::new(1);

// -- Sidecar launch ------------------------------------------------------------

/// Called once at app startup. Spawns the Python sidecar and routes its stdout
/// lines either to waiting RPC callers (by id) or to the Tauri event bus.
pub fn launch_sidecar(app: &AppHandle) {
    let sidecar_cmd = app
        .shell()
        .sidecar("reforge-python")
        .expect("reforge-python sidecar not configured in tauri.conf.json");

    let (mut rx, child) = sidecar_cmd
        .spawn()
        .expect("Failed to spawn Python sidecar");

    // Store the child handle so invoke_python() can write to its stdin.
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
                    if let Ok(v) = serde_json::from_str::<Value>(&text) {
                        // Event-shaped message -> forward to frontend.
                        if v.get("event").is_some() {
                            let event_name = v["event"].as_str().unwrap_or("reforge_event");
                            let _ = app_handle.emit(event_name, v["payload"].clone());
                        // RPC response -> route to waiting invoke_python() call.
                        } else if let Some(id) = v.get("id").and_then(|i| i.as_u64()) {
                            let sender = app_handle
                                .state::<PendingRpc>()
                                .0
                                .lock()
                                .unwrap()
                                .remove(&id);
                            if let Some(tx) = sender {
                                let result = if let Some(err) = v["error"].as_str() {
                                    Err(err.to_owned())
                                } else {
                                    Ok(v["result"].clone())
                                };
                                let _ = tx.send(result);
                            }
                        }
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
