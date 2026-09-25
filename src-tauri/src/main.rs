// REFORGE Tauri app entry point.

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use reforge_app_lib::{invoke_python, launch_sidecar, SidecarState};

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .manage(SidecarState(std::sync::Mutex::new(None)))
        .setup(|app| {
            launch_sidecar(app.handle());
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![invoke_python])
        .run(tauri::generate_context!())
        .expect("error while running REFORGE");
}
