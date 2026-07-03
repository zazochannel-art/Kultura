package com.example.kultura.ui

import androidx.compose.animation.*
import androidx.compose.animation.core.*
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
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
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.kultura.ui.components.GlassCard
import com.example.kultura.ui.components.MeshBackground
import com.example.kultura.ui.theme.*
import kotlinx.coroutines.delay
import kotlin.random.Random

@Composable
fun LoginScreen(onLoginSuccess: () -> Unit) {
    var email by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var rememberMe by remember { mutableStateOf(false) }
    var showPassword by remember { mutableStateOf(false) }
    var isFormSubmitted by remember { mutableStateOf(false) }
    
    val isEmailValid = remember(email) {
        val re = android.util.Patterns.EMAIL_ADDRESS
        email.isEmpty() || re.matcher(email).matches()
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
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(32.dp)
            ) {
                Column(
                    modifier = Modifier.padding(8.dp),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    Text(
                        text = "Welcome",
                        color = TextPrimary,
                        fontSize = 32.sp,
                        fontWeight = FontWeight.Black,
                        letterSpacing = (-1).sp
                    )
                    Text(
                        text = "Please sign in to continue",
                        color = TextSecondary,
                        fontSize = 14.sp,
                        modifier = Modifier.padding(top = 4.dp, bottom = 32.dp)
                    )

                    // Email Field
                    OutlinedTextField(
                        value = email,
                        onValueChange = { email = it },
                        label = { Text("Email Address") },
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
                        singleLine = true
                    )
                    
                    if (!isEmailValid && email.isNotEmpty()) {
                        Text(
                            text = "Please enter a valid email",
                            color = StatusRed,
                            fontSize = 12.sp,
                            modifier = Modifier.align(Alignment.Start).padding(start = 8.dp, top = 4.dp)
                        )
                    }

                    Spacer(modifier = Modifier.height(16.dp))

                    // Password Field
                    OutlinedTextField(
                        value = password,
                        onValueChange = { password = it },
                        label = { Text("Password") },
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
                        singleLine = true
                    )

                    Spacer(modifier = Modifier.height(12.dp))

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Checkbox(
                                checked = rememberMe,
                                onCheckedChange = { rememberMe = it },
                                colors = CheckboxDefaults.colors(
                                    checkedColor = PrimaryBlue,
                                    uncheckedColor = TextSecondary
                                )
                            )
                            Text("Remember me", color = TextSecondary, fontSize = 13.sp)
                        }
                        Text(
                            "Forgot Password?",
                            color = PrimaryBlue,
                            fontSize = 13.sp,
                            fontWeight = FontWeight.Bold,
                            modifier = Modifier.clickable { }
                        )
                    }

                    Spacer(modifier = Modifier.height(32.dp))

                    Button(
                        onClick = {
                            isFormSubmitted = true
                            if (email.isNotEmpty() && password.isNotEmpty() && isEmailValid) {
                                onLoginSuccess()
                            }
                        },
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(56.dp)
                            .clip(RoundedCornerShape(16.dp))
                            .background(Brush.horizontalGradient(listOf(PrimaryBlue, AccentBlue))),
                        colors = ButtonDefaults.buttonColors(containerColor = Color.Transparent),
                        shape = RoundedCornerShape(16.dp)
                    ) {
                        Text("Sign In", fontSize = 16.sp, fontWeight = FontWeight.ExtraBold)
                    }

                    Spacer(modifier = Modifier.height(24.dp))

                    Row(verticalAlignment = Alignment.CenterVertically) {
                        HorizontalDivider(modifier = Modifier.weight(1f), color = DividerColor)
                        Text("or continue with", color = TextSecondary, fontSize = 12.sp, modifier = Modifier.padding(horizontal = 16.dp))
                        HorizontalDivider(modifier = Modifier.weight(1f), color = DividerColor)
                    }

                    Spacer(modifier = Modifier.height(24.dp))

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(16.dp)
                    ) {
                        SocialButton(icon = Icons.Default.Public, modifier = Modifier.weight(1f)) // Placeholder for GitHub
                        SocialButton(icon = Icons.Default.Share, modifier = Modifier.weight(1f)) // Placeholder for Twitter
                        SocialButton(icon = Icons.Default.Work, modifier = Modifier.weight(1f)) // Placeholder for Linkedin
                    }

                    Spacer(modifier = Modifier.height(32.dp))

                    Row {
                        Text("Don't have an account? ", color = TextSecondary, fontSize = 14.sp)
                        Text("Sign up", color = PrimaryBlue, fontSize = 14.sp, fontWeight = FontWeight.Bold, modifier = Modifier.clickable { })
                    }
                }
            }
        }
    }
}

@Composable
fun SocialButton(icon: ImageVector, modifier: Modifier = Modifier) {
    Surface(
        modifier = modifier
            .height(50.dp)
            .clickable { },
        shape = RoundedCornerShape(14.dp),
        color = CardBackground,
        border = androidx.compose.foundation.BorderStroke(1.dp, GlassBorder)
    ) {
        Box(contentAlignment = Alignment.Center) {
            Icon(imageVector = icon, contentDescription = null, tint = TextPrimary, modifier = Modifier.size(20.dp))
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
    
    // Trigger recomposition for animation
    LaunchedEffect(Unit) {
        while (true) {
            delay(16)
            // This is a simple way to force redraw, normally you'd use Animatable or similar
            // but for many particles, updating state inside a loop or using a specialized shader is better.
            // For this UI, even a slow update feels organic.
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
