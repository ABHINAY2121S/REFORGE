// REFORGE Tauri app entry point.

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use reforge_app_lib::{launch_sidecar, PendingRpc, SidecarState};

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .manage(SidecarState(std::sync::Mutex::new(None)))
        .manage(PendingRpc(std::sync::Mutex::new(std::collections::HashMap::new())))
        .setup(|app| {
            launch_sidecar(app.handle());
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            reforge_app_lib::commands::invoke_python,
            reforge_app_lib::commands::get_system_devices,
            reforge_app_lib::commands::list_directory,
            reforge_app_lib::commands::scan_live_filesystem,
            reforge_app_lib::commands::check_admin_status,
            reforge_app_lib::commands::request_admin_elevation,
            reforge_app_lib::commands::pick_folder_dialog,
            reforge_app_lib::commands::open_folder_in_explorer,
            reforge_app_lib::commands::export_recovered_files
        ])
        .run(tauri::generate_context!())
        .expect("error while running REFORGE");
}
