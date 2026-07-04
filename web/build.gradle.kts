plugins {
    id("org.jetbrains.kotlin.multiplatform")
    // Enable Compose Multiplatform plugin so `compose` dependency accessors are available
    id("org.jetbrains.compose")
    // Kotlin plugin for Compose to ensure the compiler plugin is applied
    id("org.jetbrains.kotlin.plugin.compose")
}


kotlin {
    js(IR) {
        browser {
            commonWebpackConfig {
                cssSupport {
                    enabled = true
                }
            }
        }
        binaries.executable()
    }

    sourceSets {
        val jsMain by getting {
            dependencies {
                // Use the plugin-provided accessors to add Compose for Web artifacts
                // The Compose Gradle plugin now exposes `compose.html` accessors for Web artifacts
                implementation(compose.html.core)
            }
        }
        val jsTest by getting
    }
}
