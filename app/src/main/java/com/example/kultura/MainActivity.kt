package com.example.kultura

import android.Manifest
import android.content.pm.PackageManager
import android.os.Bundle
import android.webkit.PermissionRequest
import android.webkit.WebChromeClient
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.OnBackPressedCallback
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat

class MainActivity : AppCompatActivity() {

    companion object {
        // Production URL — hosted on GitHub Pages. Works on real devices and emulator alike.
        // For local dev, swap to "http://10.0.2.2:8080" (emulator only) after
        // starting `node server.js` and set usesCleartextTraffic="true" in the manifest.
        const val APP_URL = "https://zazochannel-art.github.io/Kultura/"
        const val OFFLINE_URL = "file:///android_asset/offline.html"
    }

    // A WebView camera request (plate scanner) that is waiting on the Android
    // runtime CAMERA permission being granted.
    private var pendingCameraRequest: PermissionRequest? = null

    private val cameraPermissionLauncher =
        registerForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
            val req = pendingCameraRequest
            pendingCameraRequest = null
            if (req != null) {
                if (granted) req.grant(req.resources) else req.deny()
            }
        }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        val webView: WebView = findViewById(R.id.webView)
        val settings: WebSettings = webView.settings
        settings.javaScriptEnabled = true
        settings.domStorageEnabled = true
        settings.databaseEnabled = true
        settings.allowFileAccess = false
        settings.allowContentAccess = false
        settings.allowFileAccessFromFileURLs = false
        settings.allowUniversalAccessFromFileURLs = false
        settings.mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW
        settings.loadWithOverviewMode = true
        settings.useWideViewPort = true
        settings.mediaPlaybackRequiresUserGesture = false

        webView.webViewClient = object : WebViewClient() {
            override fun onReceivedError(
                view: WebView,
                request: WebResourceRequest,
                error: WebResourceError
            ) {
                // Only main-frame failures mean "the app can't load" — a failed
                // image or font must not hijack the whole screen.
                if (request.isForMainFrame) {
                    view.loadUrl(OFFLINE_URL)
                }
            }
        }

        // The plate scanner uses getUserMedia; a bare WebView denies camera by
        // default. Grant the web request, first ensuring the Android runtime
        // CAMERA permission is held.
        webView.webChromeClient = object : WebChromeClient() {
            override fun onPermissionRequest(request: PermissionRequest) {
                val wantsCamera = request.resources.any {
                    it == PermissionRequest.RESOURCE_VIDEO_CAPTURE
                }
                if (!wantsCamera) { request.deny(); return }
                runOnUiThread {
                    val has = ContextCompat.checkSelfPermission(
                        this@MainActivity, Manifest.permission.CAMERA
                    ) == PackageManager.PERMISSION_GRANTED
                    if (has) {
                        request.grant(request.resources)
                    } else {
                        pendingCameraRequest = request
                        cameraPermissionLauncher.launch(Manifest.permission.CAMERA)
                    }
                }
            }
        }

        // Back navigates the WebView history before leaving the activity.
        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                if (webView.canGoBack()) {
                    webView.goBack()
                } else {
                    isEnabled = false
                    onBackPressedDispatcher.onBackPressed()
                }
            }
        })

        webView.loadUrl(APP_URL)
    }
}
