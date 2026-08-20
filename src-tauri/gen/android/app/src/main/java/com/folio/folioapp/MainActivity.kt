package com.folio.folioapp

import android.graphics.Rect
import android.os.Bundle
import android.view.ActionMode
import android.view.Menu
import android.view.MenuItem
import android.view.View
import android.webkit.JavascriptInterface
import android.webkit.WebView
import androidx.activity.enableEdgeToEdge
import androidx.core.view.ViewCompat
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat

class MainActivity : TauriActivity() {
  private var disableSystemActionMode = false

  override fun onCreate(savedInstanceState: Bundle?) {
    enableEdgeToEdge()
    super.onCreate(savedInstanceState)

    // Ensure status bar icons are dark by default (for light theme background)
    val insetsController = WindowCompat.getInsetsController(window, window.decorView)
    insetsController.isAppearanceLightStatusBars = true
    insetsController.isAppearanceLightNavigationBars = true
  }

  private fun wrapActionModeCallback(callback: ActionMode.Callback?): ActionMode.Callback? {
    if (callback == null) return null
    return object : ActionMode.Callback2() {
      override fun onCreateActionMode(mode: ActionMode?, menu: Menu?): Boolean {
        if (disableSystemActionMode) {
          return false
        }
        return callback.onCreateActionMode(mode, menu)
      }

      override fun onPrepareActionMode(mode: ActionMode?, menu: Menu?): Boolean {
        if (disableSystemActionMode) {
          return false
        }
        return callback.onPrepareActionMode(mode, menu)
      }

      override fun onActionItemClicked(mode: ActionMode?, item: MenuItem?): Boolean {
        return callback.onActionItemClicked(mode, item)
      }

      override fun onDestroyActionMode(mode: ActionMode?) {
        callback.onDestroyActionMode(mode)
      }

      override fun onGetContentRect(
        mode: ActionMode?,
        view: View?,
        outRect: Rect?
      ) {
        if (callback is ActionMode.Callback2) {
          callback.onGetContentRect(mode, view, outRect)
        } else {
          super.onGetContentRect(mode, view, outRect)
        }
      }
    }
  }

  override fun onWindowStartingActionMode(callback: ActionMode.Callback?): ActionMode? {
    val wrapped = wrapActionModeCallback(callback)
    return super.onWindowStartingActionMode(wrapped)
  }

  override fun onWindowStartingActionMode(callback: ActionMode.Callback?, type: Int): ActionMode? {
    val wrapped = wrapActionModeCallback(callback)
    return super.onWindowStartingActionMode(wrapped, type)
  }

  override fun onActionModeStarted(mode: ActionMode?) {
    if (disableSystemActionMode) {
      mode?.finish()
    }
    super.onActionModeStarted(mode)
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
      fun setDisableSystemActionMode(disable: Boolean) {
        runOnUiThread {
          disableSystemActionMode = disable
        }
      }

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
