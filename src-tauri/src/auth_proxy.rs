use std::sync::Arc;
use reqwest::{Client, cookie::Jar};
use serde::Deserialize;
use tauri::State;
use tokio::sync::Mutex;

/// Holds a reqwest Client with a cookie jar so refresh-token cookies
/// survive across requests (login → refresh → refresh → …).
pub struct AuthHttpClient {
    client: Client,
    _cookie_jar: Arc<Jar>,
}

impl AuthHttpClient {
    pub fn new() -> Self {
        let jar = Arc::new(Jar::default());
        let client = Client::builder()
            .cookie_provider(jar.clone())
            .build()
            .expect("failed to build reqwest client");
        Self {
            client,
            _cookie_jar: jar,
        }
    }
}

pub type AuthHttpClientState = Mutex<AuthHttpClient>;

#[derive(Deserialize)]
struct TokenResponse {
    token: String,
}

#[tauri::command]
pub async fn auth_login_proxy(
    server_url: String,
    email: String,
    password: String,
    state: State<'_, AuthHttpClientState>,
) -> Result<String, String> {
    let state = state.lock().await;
    let url = format!("{}/api/identity/login", server_url);

    let body = serde_json::json!({
        "email": email,
        "password": password,
    });

    let res = state.client.post(&url)
        .json(&body)
        .send()
        .await
        .map_err(|e| e.to_string())?;

    let response_text = res.text().await.map_err(|e| e.to_string())?;
    Ok(response_text)
}

#[tauri::command]
pub async fn refresh_access_token(
    server_url: String,
    state: State<'_, AuthHttpClientState>,
) -> Result<String, String> {
    let state = state.lock().await;
    let url = format!("{}/api/identity/token/refresh", server_url);
    
    let res = state.client.post(&url)
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if !res.status().is_success() {
        return Err(format!("Refresh failed with status: {}", res.status()));
    }

    let token_res: TokenResponse = res.json().await.map_err(|e| e.to_string())?;
    Ok(token_res.token)
}

#[tauri::command]
pub async fn clear_auth_cookies(
    state: State<'_, AuthHttpClientState>,
) -> Result<String, String> {
    let mut state = state.lock().await;
    *state = AuthHttpClient::new();
    Ok("Ok".to_string())
}
