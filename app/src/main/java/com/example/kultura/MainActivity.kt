package com.example.kultura

import android.annotation.SuppressLint
import android.app.Activity
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.view.KeyEvent
import android.webkit.CookieManager
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.ComponentActivity
import androidx.activity.enableEdgeToEdge
import androidx.activity.result.contract.ActivityResultContracts
import androidx.core.graphics.toColorInt
import androidx.core.view.WindowCompat

class MainActivity : ComponentActivity() {

    private lateinit var web: WebView

    private val filePickerLauncher = registerForActivityResult(
        ActivityResultContracts.StartActivityForResult()
    ) { result ->
        val uris = pendingFileCallback ?: return@registerForActivityResult
        pendingFileCallback = null
        val data = if (result.resultCode == Activity.RESULT_OK) result.data else null
        val parsed = WebChromeClient.FileChooserParams.parseResult(result.resultCode, data)
        uris.onReceiveValue(parsed)
    }
    private var pendingFileCallback: android.webkit.ValueCallback<Array<Uri>>? = null

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        WindowCompat.setDecorFitsSystemWindows(window, false)
        window.statusBarColor = "#07080D".toColorInt()
        window.navigationBarColor = "#07080D".toColorInt()

        web = WebView(this).apply {
            setBackgroundColor("#07080D".toColorInt())
            settings.apply {
                javaScriptEnabled = true
                domStorageEnabled = true // Supabase session lives in localStorage
                databaseEnabled = true
                cacheMode = WebSettings.LOAD_DEFAULT
                mediaPlaybackRequiresUserGesture = false
                allowContentAccess = true
                allowFileAccess = false
                mixedContentMode = WebSettings.MIXED_CONTENT_COMPATIBILITY_MODE
                setSupportZoom(false)
                loadWithOverviewMode = true
                useWideViewPort = true
            }
            CookieManager.getInstance().setAcceptCookie(true)
            CookieManager.getInstance().setAcceptThirdPartyCookies(this, true)

            webViewClient = object : WebViewClient() {
                override fun shouldOverrideUrlLoading(view: WebView, req: WebResourceRequest): Boolean {
                    val url = req.url ?: return false
                    val scheme = url.scheme?.lowercase()
                    // Custom schemes and non-http links leave the WebView
                    if (scheme != "http" && scheme != "https" && scheme != "about") {
                        return runCatching {
                            startActivity(Intent(Intent.ACTION_VIEW, url))
                            true
                        }.getOrElse { false }
                    }
                    // Keep everything else inside the WebView
                    return false
                }
            }

            webChromeClient = object : WebChromeClient() {
                override fun onShowFileChooser(
                    webView: WebView,
                    filePathCallback: android.webkit.ValueCallback<Array<Uri>>,
                    fileChooserParams: FileChooserParams
                ): Boolean {
                    pendingFileCallback = filePathCallback
                    val intent = fileChooserParams.createIntent()
                    return runCatching {
                        filePickerLauncher.launch(intent)
                        true
                    }.getOrElse {
                        pendingFileCallback = null
                        false
                    }
                }
            }
        }
        setContentView(web)

        web.loadUrl(TARGET_URL)
    }

    override fun onKeyDown(keyCode: Int, event: KeyEvent?): Boolean {
        if (keyCode == KeyEvent.KEYCODE_BACK && this::web.isInitialized && web.canGoBack()) {
            web.goBack()
            return true
        }
        return super.onKeyDown(keyCode, event)
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        // Reload when a deep link brings us back (e.g. after email confirmation).
        if (this::web.isInitialized) web.loadUrl(TARGET_URL)
    }

    companion object {
        private const val TARGET_URL = "https://zazochannel-art.github.io/Kultura/"
    }
}
