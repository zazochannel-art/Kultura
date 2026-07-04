package com.example.kultura.data

import io.github.jan.supabase.auth.auth
import io.github.jan.supabase.auth.providers.builtin.Email
import io.github.jan.supabase.auth.status.SessionStatus
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.StateFlow

class AuthRepository {

    val sessionStatus: StateFlow<SessionStatus>
        get() = supabase.auth.sessionStatus

    suspend fun signIn(email: String, password: String): Result<Unit> = runCatching {
        supabase.auth.signInWith(Email) {
            this.email = email.trim()
            this.password = password
        }
    }

    suspend fun signUp(email: String, password: String): Result<Unit> = runCatching {
        supabase.auth.signUpWith(Email) {
            this.email = email.trim()
            this.password = password
        }
    }

    suspend fun signOut(): Result<Unit> = runCatching {
        supabase.auth.signOut()
    }

    val currentUserEmail: String?
        get() = supabase.auth.currentUserOrNull()?.email
}
