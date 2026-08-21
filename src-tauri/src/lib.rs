mod auth_proxy;

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
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
