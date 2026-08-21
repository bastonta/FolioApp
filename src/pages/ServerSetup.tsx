import {
  AlertCircle,
  ArrowRight,
  BookOpen,
  Loader,
  Server,
} from "lucide-react";
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { fetch } from "@tauri-apps/plugin-http";
import { useAuth } from "../context/AuthContext";

export const ServerSetup: React.FC = () => {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const { setServerUrl } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!url) {
      setError("Server URL is required");
      return;
    }

    try {
      setLoading(true);

      let finalUrl = url.trim();
      if (!finalUrl.startsWith("http://") && !finalUrl.startsWith("https://")) {
        finalUrl = "https://" + finalUrl;
      }

      if (finalUrl.endsWith("/")) {
        finalUrl = finalUrl.slice(0, -1);
      }

      // Simple test request to validate the server URL
      const response = await fetch(`${finalUrl}/api/identity`, {
        method: "GET",
      });

      if (!response.ok && response.status !== 401 && response.status !== 404) {
        throw new Error(`Server responded with status: ${response.status}`);
      }

      setServerUrl(finalUrl);
      navigate("/login");
    } catch (err) {
      setError(
        (err as any)?.message ||
          "Failed to connect to server. Please check the URL.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-header">
          <div className="auth-icon-badge">
            <BookOpen size={24} />
          </div>
          <h1 className="auth-title">Connect to Server</h1>
          <p className="auth-subtitle">Enter your Folio server address</p>
        </div>

        {error && (
          <div className="auth-error">
            <AlertCircle size={20} />
            <span>{error}</span>
          </div>
        )}

        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="auth-field">
            <label className="auth-label" htmlFor="serverUrl">
              Server URL
            </label>
            <div className="auth-input-wrapper">
              <div className="auth-input-icon">
                <Server size={20} />
              </div>
              <input
                id="serverUrl"
                type="url"
                className="auth-input"
                placeholder="https://folio.example.com"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                disabled={loading}
                autoFocus
              />
            </div>
          </div>

          <button
            type="submit"
            className="auth-btn-primary"
            disabled={loading || !url}
          >
            {loading ? (
              <Loader size={20} className="spinner" />
            ) : (
              <ArrowRight size={20} />
            )}
            <span>{loading ? "Connecting..." : "Connect"}</span>
          </button>
        </form>
      </div>
    </div>
  );
};

export default ServerSetup;
