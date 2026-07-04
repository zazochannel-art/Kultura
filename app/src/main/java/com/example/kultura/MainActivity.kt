package com.example.kultura

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import com.example.kultura.data.AuthRepository
import com.example.kultura.ui.DashboardScreen
import com.example.kultura.ui.LoginScreen
import com.example.kultura.ui.theme.BackgroundDark
import com.example.kultura.ui.theme.KulturaTheme
import com.example.kultura.ui.theme.PrimaryBlue
import io.github.jan.supabase.auth.status.SessionStatus

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent {
            KulturaTheme {
                AppRoot()
            }
        }
    }
}

@Composable
private fun AppRoot() {
    val authRepository = remember { AuthRepository() }
    val sessionStatus by authRepository.sessionStatus.collectAsState()

    when (sessionStatus) {
        is SessionStatus.Authenticated -> DashboardScreen()
        is SessionStatus.NotAuthenticated -> LoginScreen(onLoginSuccess = { /* session flow handles it */ })
        is SessionStatus.Initializing, is SessionStatus.RefreshFailure -> {
            Box(
                modifier = Modifier.fillMaxSize().background(BackgroundDark),
                contentAlignment = Alignment.Center
            ) {
                CircularProgressIndicator(color = PrimaryBlue)
            }
        }
    }
}
