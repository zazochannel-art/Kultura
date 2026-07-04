pluginManagement {
    repositories {
        google {
            content {
                includeGroupByRegex("com\\.android.*")
                includeGroupByRegex("com\\.google.*")
                includeGroupByRegex("androidx.*")
            }
        }
        mavenCentral()
        gradlePluginPortal()
    }
    plugins {
        // Ensure Kotlin and Compose plugin versions are resolved uniformly for all modules
        id("org.jetbrains.kotlin.multiplatform") version "2.2.10"
        id("org.jetbrains.compose") version "1.11.1"
        // New recommended plugin for Compose Multiplatform integration
        id("org.jetbrains.kotlin.plugin.compose") version "2.2.10"
    }
}
plugins {
    id("org.gradle.toolchains.foojay-resolver-convention") version "1.0.0"
}
dependencyResolutionManagement {
    // Do not force a repositories mode here so plugin and project build scripts
    // can add repositories/distributions they need (e.g. Node downloads).
    repositories {
        google()
        mavenCentral()
        // Kotlin/JS and plugin artifacts may be published to JetBrains package registry
        maven {
            url = uri("https://maven.pkg.jetbrains.space/kotlin/p/kotlin/bootstrap")
        }
    }
}

rootProject.name = "Kultura"
include(":app")
include(":web")
