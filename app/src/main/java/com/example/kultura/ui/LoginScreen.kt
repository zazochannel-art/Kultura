package com.example.kultura.ui

import androidx.compose.animation.*
import androidx.compose.animation.core.*
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.kultura.data.AuthRepository
import com.example.kultura.ui.components.GlassCard
import com.example.kultura.ui.components.MeshBackground
import com.example.kultura.ui.theme.*
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlin.random.Random

@Composable
fun LoginScreen(onLoginSuccess: () -> Unit) {
    val authRepository = remember { AuthRepository() }
    val scope = rememberCoroutineScope()

    var isSignUpMode by remember { mutableStateOf(false) }
    var email by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var showPassword by remember { mutableStateOf(false) }
    var isLoading by remember { mutableStateOf(false) }
    var errorMessage by remember { mutableStateOf<String?>(null) }
    var successMessage by remember { mutableStateOf<String?>(null) }

    val isEmailValid = remember(email) {
        val re = android.util.Patterns.EMAIL_ADDRESS
        email.isEmpty() || re.matcher(email).matches()
    }

    fun submit() {
        errorMessage = null
        successMessage = null
        when {
            !isEmailValid -> { errorMessage = "Email invalid"; return }
            email.isBlank() -> { errorMessage = "Introdu emailul"; return }
            password.length < 6 -> { errorMessage = "Parola trebuie să aibă minim 6 caractere"; return }
        }
        isLoading = true
        scope.launch {
            val result = if (isSignUpMode) authRepository.signUp(email, password)
            else authRepository.signIn(email, password)
            isLoading = false
            result.onSuccess {
                if (isSignUpMode) {
                    successMessage = "Cont creat! Verifică emailul pentru confirmare."
                } else {
                    onLoginSuccess()
                }
            }.onFailure { e ->
                errorMessage = e.message?.take(200) ?: "A apărut o eroare"
            }
        }
    }

    Box(modifier = Modifier.fillMaxSize()) {
        MeshBackground()
        ParticleBackground()

        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(24.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center
        ) {
            GlassCard(
                modifier = Modifier.fillMaxWidth().widthIn(max = 480.dp),
                shape = RoundedCornerShape(32.dp)
            ) {
                Column(
                    modifier = Modifier.padding(8.dp),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    Text(
                        text = if (isSignUpMode) "Bine ai venit" else "Bun venit",
                        color = TextPrimary,
                        fontSize = 32.sp,
                        fontWeight = FontWeight.Black,
                        letterSpacing = (-1).sp
                    )
                    Text(
                        text = if (isSignUpMode) "Creează un cont pentru echipa ta"
                        else "Autentifică-te pentru a continua",
                        color = TextSecondary,
                        fontSize = 14.sp,
                        modifier = Modifier.padding(top = 4.dp, bottom = 28.dp)
                    )

                    // Email Field
                    OutlinedTextField(
                        value = email,
                        onValueChange = { email = it; errorMessage = null },
                        label = { Text("Email") },
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(16.dp),
                        colors = TextFieldDefaults.colors(
                            unfocusedContainerColor = Color.Transparent,
                            focusedContainerColor = Color.Transparent,
                            unfocusedIndicatorColor = GlassBorder,
                            focusedIndicatorColor = PrimaryBlue,
                            unfocusedLabelColor = TextSecondary,
                            focusedLabelColor = PrimaryBlue,
                            focusedTextColor = TextPrimary,
                            unfocusedTextColor = TextPrimary
                        ),
                        isError = !isEmailValid && email.isNotEmpty(),
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email),
                        singleLine = true,
                        enabled = !isLoading
                    )

                    Spacer(modifier = Modifier.height(14.dp))

                    // Password Field
                    OutlinedTextField(
                        value = password,
                        onValueChange = { password = it; errorMessage = null },
                        label = { Text("Parolă") },
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(16.dp),
                        visualTransformation = if (showPassword) VisualTransformation.None else PasswordVisualTransformation(),
                        trailingIcon = {
                            IconButton(onClick = { showPassword = !showPassword }) {
                                Icon(
                                    imageVector = if (showPassword) Icons.Default.VisibilityOff else Icons.Default.Visibility,
                                    contentDescription = null,
                                    tint = TextSecondary
                                )
                            }
                        },
                        colors = TextFieldDefaults.colors(
                            unfocusedContainerColor = Color.Transparent,
                            focusedContainerColor = Color.Transparent,
                            unfocusedIndicatorColor = GlassBorder,
                            focusedIndicatorColor = PrimaryBlue,
                            unfocusedLabelColor = TextSecondary,
                            focusedLabelColor = PrimaryBlue,
                            focusedTextColor = TextPrimary,
                            unfocusedTextColor = TextPrimary
                        ),
                        singleLine = true,
                        enabled = !isLoading
                    )

                    // Error / Success
                    errorMessage?.let {
                        Spacer(modifier = Modifier.height(10.dp))
                        Row(
                            modifier = Modifier.fillMaxWidth().clip(RoundedCornerShape(10.dp))
                                .background(StatusRed.copy(alpha = 0.12f)).padding(10.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Icon(Icons.Default.ErrorOutline, contentDescription = null, tint = StatusRed, modifier = Modifier.size(18.dp))
                            Spacer(modifier = Modifier.width(8.dp))
                            Text(it, color = StatusRed, fontSize = 12.sp)
                        }
                    }
                    successMessage?.let {
                        Spacer(modifier = Modifier.height(10.dp))
                        Row(
                            modifier = Modifier.fillMaxWidth().clip(RoundedCornerShape(10.dp))
                                .background(StatusGreen.copy(alpha = 0.12f)).padding(10.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Icon(Icons.Default.CheckCircle, contentDescription = null, tint = StatusGreen, modifier = Modifier.size(18.dp))
                            Spacer(modifier = Modifier.width(8.dp))
                            Text(it, color = StatusGreen, fontSize = 12.sp)
                        }
                    }

                    Spacer(modifier = Modifier.height(24.dp))

                    Button(
                        onClick = { submit() },
                        enabled = !isLoading,
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(56.dp)
                            .clip(RoundedCornerShape(16.dp))
                            .background(Brush.horizontalGradient(listOf(PrimaryBlue, AccentBlue))),
                        colors = ButtonDefaults.buttonColors(containerColor = Color.Transparent, disabledContainerColor = Color.Transparent),
                        shape = RoundedCornerShape(16.dp)
                    ) {
                        if (isLoading) {
                            CircularProgressIndicator(color = Color.White, strokeWidth = 2.dp, modifier = Modifier.size(22.dp))
                        } else {
                            Text(
                                if (isSignUpMode) "Creează cont" else "Autentifică-te",
                                fontSize = 16.sp,
                                fontWeight = FontWeight.ExtraBold
                            )
                        }
                    }

                    Spacer(modifier = Modifier.height(20.dp))

                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text(
                            if (isSignUpMode) "Ai deja un cont? " else "Nu ai cont? ",
                            color = TextSecondary,
                            fontSize = 14.sp
                        )
                        Text(
                            if (isSignUpMode) "Autentifică-te" else "Înregistrează-te",
                            color = PrimaryBlue,
                            fontSize = 14.sp,
                            fontWeight = FontWeight.Bold,
                            modifier = Modifier.clickable(enabled = !isLoading) {
                                isSignUpMode = !isSignUpMode
                                errorMessage = null
                                successMessage = null
                            }
                        )
                    }
                }
            }
        }
    }
}

@Composable
fun ParticleBackground() {
    val particles = remember { List(40) { ParticleState() } }
    val infiniteTransition = rememberInfiniteTransition(label = "particles")

    Canvas(modifier = Modifier.fillMaxSize()) {
        particles.forEach { particle ->
            particle.update(size.width, size.height)
            drawCircle(
                color = Color.White.copy(alpha = particle.alpha),
                radius = particle.size,
                center = Offset(particle.x, particle.y)
            )
        }
    }

    LaunchedEffect(Unit) {
        while (true) {
            delay(16)
        }
    }
}

class ParticleState {
    var x by mutableStateOf(Random.nextFloat() * 1000f)
    var y by mutableStateOf(Random.nextFloat() * 2000f)
    var size = Random.nextFloat() * 3f + 1f
    var speedX = (Random.nextFloat() - 0.5f) * 1.5f
    var speedY = (Random.nextFloat() - 0.5f) * 1.5f
    var alpha = Random.nextFloat() * 0.2f

    fun update(width: Float, height: Float) {
        x += speedX
        y += speedY
        if (x > width) x = 0f
        if (x < 0) x = width
        if (y > height) y = 0f
        if (y < 0) y = height
    }
}
