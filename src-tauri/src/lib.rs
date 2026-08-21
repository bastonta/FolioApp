mod auth_proxy;
mod fs_manager;

use auth_proxy::{AuthHttpClient, AuthHttpClientState};
use tokio::sync::Mutex;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_http::init())
        .manage(Mutex::new(AuthHttpClient::new()) as AuthHttpClientState)
        .invoke_handler(tauri::generate_handler![
            auth_proxy::auth_login_proxy,
            auth_proxy::refresh_access_token,
            auth_proxy::clear_auth_cookies,
            fs_manager::get_default_download_dir,
            fs_manager::pick_folder,
            fs_manager::scan_local_books,
            fs_manager::read_book_file,
            fs_manager::download_book_file,
            fs_manager::delete_book_file,
            fs_manager::check_book_downloaded,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
