package com.folio.folioapp

import android.os.Bundle
import android.webkit.JavascriptInterface
import android.webkit.WebView
import androidx.activity.enableEdgeToEdge
import androidx.core.view.ViewCompat
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat

class MainActivity : TauriActivity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    enableEdgeToEdge()
    super.onCreate(savedInstanceState)

    // Ensure status bar icons are dark by default (for light theme background)
    val insetsController = WindowCompat.getInsetsController(window, window.decorView)
    insetsController.isAppearanceLightStatusBars = true
    insetsController.isAppearanceLightNavigationBars = true
  }

  override fun onWebViewCreate(webView: WebView) {
    super.onWebViewCreate(webView)

    // Propagate system bar insets (status bar, navigation bar) directly to CSS variables
    ViewCompat.setOnApplyWindowInsetsListener(window.decorView) { _, insets ->
      val systemBars = insets.getInsets(WindowInsetsCompat.Type.systemBars())
      val density = resources.displayMetrics.density
      val topDp = (systemBars.top / density).toInt()
      val bottomDp = (systemBars.bottom / density).toInt()
      val leftDp = (systemBars.left / density).toInt()
      val rightDp = (systemBars.right / density).toInt()

      webView.post {
        webView.evaluateJavascript(
          """
          document.documentElement.style.setProperty('--safe-area-top', '${topDp}px');
          document.documentElement.style.setProperty('--safe-area-bottom', '${bottomDp}px');
          document.documentElement.style.setProperty('--safe-area-left', '${leftDp}px');
          document.documentElement.style.setProperty('--safe-area-right', '${rightDp}px');
          """.trimIndent(),
          null
        )
      }
      insets
    }

    webView.addJavascriptInterface(object {
      @JavascriptInterface
      fun setStatusBarVisible(visible: Boolean) {
        runOnUiThread {
          val insetsController = WindowCompat.getInsetsController(window, window.decorView)
          insetsController.systemBarsBehavior =
            WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
          if (visible) {
            insetsController.show(WindowInsetsCompat.Type.statusBars())
          } else {
            insetsController.hide(WindowInsetsCompat.Type.statusBars())
          }
        }
      }

      @JavascriptInterface
      fun setStatusBarIconsDark(darkIcons: Boolean) {
        runOnUiThread {
          val insetsController = WindowCompat.getInsetsController(window, window.decorView)
          insetsController.isAppearanceLightStatusBars = darkIcons
          insetsController.isAppearanceLightNavigationBars = darkIcons
        }
      }

      @JavascriptInterface
      fun setStatusBarTheme(theme: String) {
        runOnUiThread {
          val insetsController = WindowCompat.getInsetsController(window, window.decorView)
          val isDarkIcons = when (theme.lowercase()) {
            "dark", "gray", "black" -> false
            else -> true
          }
          insetsController.isAppearanceLightStatusBars = isDarkIcons
          insetsController.isAppearanceLightNavigationBars = isDarkIcons
        }
      }
    }, "AndroidBridge")
  }
}
