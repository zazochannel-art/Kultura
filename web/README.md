# Kultura web module (Compose Multiplatform)

This module is a minimal Kotlin Multiplatform/JS (IR) project that uses Compose Web to run a small demo UI in the browser.

How to run (PowerShell on Windows):

1. From project root, download dependencies and build the web development server:

```powershell
.\gradlew.bat :web:browserDevelopmentRun
```

2. Open the URL shown in the Gradle output (usually http://localhost:8080).

Notes:
- If `:web:browserDevelopmentRun` task name differs for your Compose plugin version, try `:web:jsBrowserDevelopmentRun` or check available tasks with `.\gradlew.bat :web:tasks`.
- First run will download Kotlin and Compose plugin/dependencies.

If you want, I can run the Gradle task here to verify the dev server starts (requires network to fetch dependencies). Tell me if you want me to attempt that now.

