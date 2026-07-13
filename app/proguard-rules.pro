# Kultura is a thin WebView shell — no reflection-heavy libraries, so the
# default optimized config is enough. Add -keep rules here if new SDKs
# (analytics, push) start getting stripped.

# Keep the JS bridge surface if one is ever added via addJavascriptInterface.
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}
