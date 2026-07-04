package com.example.kultura.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowForward
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.kultura.data.SupabaseRepository
import com.example.kultura.ui.components.*
import com.example.kultura.ui.theme.*
import kotlinx.coroutines.launch
import android.widget.Toast

@Composable
fun DashboardScreen() {
    var selectedItem by remember { mutableIntStateOf(0) }

    BoxWithConstraints(modifier = Modifier.fillMaxSize()) {
        val isCompact = maxWidth < 720.dp

        MeshBackground()

        if (isCompact) {
            // mobile / narrow screens: keep existing scaffold with bottom navigation
            Scaffold(
                topBar = { MobileTopBar() },
                bottomBar = {
                    MobileBottomNavigation(
                        selectedItem = selectedItem,
                        onItemSelected = { selectedItem = it }
                    )
                },
                containerColor = Color.Transparent
            ) { innerPadding ->
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(innerPadding)
                ) {
                    when (selectedItem) {
                        0 -> {
                            Column(
                                modifier = Modifier
                                    .fillMaxSize()
                                    .verticalScroll(rememberScrollState())
                            ) {
                                DashboardContentMobile()
                            }
                        }
                        1 -> EventsScreen()
                        2 -> CarsScreen()
                        3 -> TasksScreen()
                        4 -> SettingsScreen()
                    }
                }
            }
        } else {
            // desktop / wide screens: show sidebar + top bar and content area
            Row(modifier = Modifier.fillMaxSize()) {
                Sidebar(modifier = Modifier)

                Column(modifier = Modifier
                    .weight(1f)
                    .fillMaxHeight()
                    .verticalScroll(rememberScrollState())
                ) {
                    // reuse mobile top bar for now (could add a dedicated TopBar)
                    MobileTopBar()

                    Spacer(modifier = Modifier.height(12.dp))

                    // main content area
                    Box(modifier = Modifier
                        .fillMaxSize()
                        .padding(horizontal = 24.dp)
                    ) {
                        DashboardContentMobile()
                    }
                }
            }
        }
    }
}

@Composable
fun DashboardContentMobile() {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 20.dp)
    ) {
        // Greeting
        Row(verticalAlignment = Alignment.CenterVertically) {
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = "Bună, Andrei 👋",
                    color = TextSecondary,
                    fontSize = 14.sp,
                    fontWeight = FontWeight.Medium
                )
                Spacer(modifier = Modifier.height(4.dp))
                Text(
                    text = "Panou de control",
                    color = TextPrimary,
                    fontSize = 28.sp,
                    fontWeight = FontWeight.ExtraBold,
                    letterSpacing = (-0.8).sp
                )
            }
            Box(
                modifier = Modifier
                    .size(44.dp)
                    .clip(CircleShape)
                    .background(Brush.linearGradient(listOf(AccentPurple, AccentPink)))
                    .border(2.dp, GlassBorderStrong, CircleShape),
                contentAlignment = Alignment.Center
            ) {
                Text("AP", color = Color.White, fontSize = 14.sp, fontWeight = FontWeight.Black)
            }
        }

        Spacer(modifier = Modifier.height(20.dp))

        // Hero Card
        var bannerIndex by remember { mutableIntStateOf(0) }
        val heroEvents = listOf(
            HeroEvent(
                title = "KULTURA Auto Festival",
                subtitle = "Cel mai mare eveniment al verii",
                date = "29 - 30 Iunie",
                location = "Romexpo, București",
                daysLeft = 12,
                gradient = listOf(Color(0xFF7C3AED), Color(0xFF3B82F6), Color(0xFF06B6D4))
            ),
            HeroEvent(
                title = "Drift Night 2025",
                subtitle = "Adrenalină pură sub reflectoare",
                date = "12 Iulie",
                location = "MotorPark România",
                daysLeft = 25,
                gradient = listOf(Color(0xFFEC4899), Color(0xFFF59E0B), Color(0xFFEF4444))
            ),
            HeroEvent(
                title = "Retro Car Expo",
                subtitle = "Legende pe patru roți",
                date = "23 - 24 August",
                location = "Hala Laminor",
                daysLeft = 67,
                gradient = listOf(Color(0xFF10B981), Color(0xFF14B8A6), Color(0xFF06B6D4))
            )
        )
        val hero = heroEvents[bannerIndex]

        Box(
            modifier = Modifier
                .fillMaxWidth()
                .height(210.dp)
                .clip(RoundedCornerShape(26.dp))
                .background(Brush.linearGradient(hero.gradient))
                .clickable { bannerIndex = (bannerIndex + 1) % heroEvents.size }
        ) {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .background(Brush.verticalGradient(listOf(Color.Transparent, Color.Black.copy(alpha = 0.35f))))
            )

            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(20.dp),
                verticalArrangement = Arrangement.SpaceBetween
            ) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.Top
                ) {
                    Surface(color = Color.White.copy(alpha = 0.18f), shape = RoundedCornerShape(10.dp)) {
                        Row(modifier = Modifier.padding(horizontal = 10.dp, vertical = 6.dp), verticalAlignment = Alignment.CenterVertically) {
                            Box(modifier = Modifier.size(6.dp).clip(CircleShape).background(Color.White))
                            Spacer(modifier = Modifier.width(6.dp))
                            Text(text = "URMĂTORUL EVENIMENT", color = Color.White, fontSize = 10.sp, fontWeight = FontWeight.Black, letterSpacing = 1.sp)
                        }
                    }
                    Column(horizontalAlignment = Alignment.End) {
                        Text(text = hero.daysLeft.toString(), color = Color.White, fontSize = 32.sp, fontWeight = FontWeight.Black, letterSpacing = (-1).sp)
                        Text(text = "zile rămase", color = Color.White.copy(alpha = 0.85f), fontSize = 11.sp, fontWeight = FontWeight.SemiBold)
                    }
                }

                Column {
                    Text(text = hero.title, color = Color.White, fontSize = 22.sp, fontWeight = FontWeight.ExtraBold, letterSpacing = (-0.5).sp)
                    Spacer(modifier = Modifier.height(4.dp))
                    Text(text = hero.subtitle, color = Color.White.copy(alpha = 0.85f), fontSize = 13.sp, fontWeight = FontWeight.Medium)
                    Spacer(modifier = Modifier.height(10.dp))
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(Icons.Default.CalendarMonth, contentDescription = null, tint = Color.White, modifier = Modifier.size(14.dp))
                        Spacer(modifier = Modifier.width(6.dp))
                        Text(hero.date, color = Color.White, fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
                        Spacer(modifier = Modifier.width(12.dp))
                        Icon(Icons.Default.LocationOn, contentDescription = null, tint = Color.White, modifier = Modifier.size(14.dp))
                        Spacer(modifier = Modifier.width(6.dp))
                        Text(hero.location, color = Color.White, fontSize = 12.sp, fontWeight = FontWeight.SemiBold, maxLines = 1)
                    }
                }
            }

            Row(modifier = Modifier.align(Alignment.BottomEnd).padding(16.dp), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                repeat(heroEvents.size) { index ->
                    Box(modifier = Modifier.height(6.dp).width(if (bannerIndex == index) 20.dp else 6.dp).clip(CircleShape).background(Color.White.copy(alpha = if (bannerIndex == index) 1f else 0.4f)))
                }
            }
        }

        Spacer(modifier = Modifier.height(24.dp))

        Text("Statistici", color = TextPrimary, fontSize = 18.sp, fontWeight = FontWeight.ExtraBold, letterSpacing = (-0.3).sp)
        Spacer(modifier = Modifier.height(14.dp))

        Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                StatCardMobile(icon = Icons.Default.DirectionsCar, iconColor = AccentBlue, label = "Mașini înscrise", value = "542", trend = "↑ 12%", trendColor = StatusGreen, modifier = Modifier.weight(1f))
                StatCardMobile(icon = Icons.Default.Groups, iconColor = AccentPurple, label = "Bilete vândute", value = "12.4k", trend = "↑ 15%", trendColor = StatusGreen, modifier = Modifier.weight(1f))
            }
            Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                StatCardMobile(icon = Icons.Default.Handshake, iconColor = AccentPink, label = "Parteneri", value = "28", trend = "↑ 7%", trendColor = StatusGreen, modifier = Modifier.weight(1f))
                StatCardMobile(icon = Icons.Default.PendingActions, iconColor = StatusOrange, label = "Taskuri deschise", value = "17", trend = "↓ 25%", trendColor = StatusGreen, modifier = Modifier.weight(1f))
            }
        }

        Spacer(modifier = Modifier.height(28.dp))

        Text("Acțiuni rapide", color = TextPrimary, fontSize = 18.sp, fontWeight = FontWeight.ExtraBold, letterSpacing = (-0.3).sp)
        Spacer(modifier = Modifier.height(14.dp))

        Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            QuickActionCard(icon = Icons.Default.Add, label = "Adaugă\neveniment", gradient = listOf(PrimaryBlue, AccentPurple), modifier = Modifier.weight(1f))
            QuickActionCard(icon = Icons.Default.QrCodeScanner, label = "Scanează\nbilet", gradient = listOf(AccentTeal, AccentBlue), modifier = Modifier.weight(1f))
            QuickActionCard(icon = Icons.Default.Insights, label = "Vezi\nrapoarte", gradient = listOf(AccentPink, StatusOrange), modifier = Modifier.weight(1f))
        }

        Spacer(modifier = Modifier.height(28.dp))

        GlassCard(modifier = Modifier.fillMaxWidth()) {
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                Column {
                    Text("Evenimente viitoare", color = TextPrimary, fontWeight = FontWeight.ExtraBold, fontSize = 16.sp)
                    Text("Ce urmează pe agendă", color = TextSecondary, fontSize = 11.sp)
                }
                Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.clickable { }) {
                    Text("Toate", color = PrimaryBlue, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                    Spacer(modifier = Modifier.width(4.dp))
                    Icon(Icons.AutoMirrored.Filled.ArrowForward, contentDescription = null, tint = PrimaryBlue, modifier = Modifier.size(14.dp))
                }
            }
            Spacer(modifier = Modifier.height(10.dp))
            EventItem("KULTURA Auto Festival", "29 - 30 Iun", "Romexpo", "În curând", StatusBlue)
            HorizontalDivider(color = DividerColor, modifier = Modifier.padding(vertical = 2.dp))
            EventItem("Drift Night 2025", "12 Iul", "MotorPark", "În curând", StatusOrange)
            HorizontalDivider(color = DividerColor, modifier = Modifier.padding(vertical = 2.dp))
            EventItem("Retro Car Expo", "23 - 24 Aug", "Hala Laminor", "Planificat", StatusGreen)
        }

        Spacer(modifier = Modifier.height(20.dp))

        GlassCard(modifier = Modifier.fillMaxWidth()) {
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                Column {
                    Text("Taskuri prioritare", color = TextPrimary, fontWeight = FontWeight.ExtraBold, fontSize = 16.sp)
                    Text("Rezolvă ce e urgent astăzi", color = TextSecondary, fontSize = 11.sp)
                }
                Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.clickable { }) {
                    Text("Toate", color = PrimaryBlue, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                    Spacer(modifier = Modifier.width(4.dp))
                    Icon(Icons.AutoMirrored.Filled.ArrowForward, contentDescription = null, tint = PrimaryBlue, modifier = Modifier.size(14.dp))
                }
            }
            Spacer(modifier = Modifier.height(6.dp))
            TaskItem("Urgent", StatusRed, "Confirmă parteneri principali", "Termen: 19 Iun", "")
            TaskItem("În progres", StatusOrange, "Finalizează planul de securitate", "Termen: 21 Iun", "")
            TaskItem("În progres", StatusBlue, "Lansează campania pe social media", "Termen: 25 Iun", "")
        }

        Spacer(modifier = Modifier.height(20.dp))

        GlassCard(modifier = Modifier.fillMaxWidth()) {
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                Column {
                    Text("Mașini invitate", color = TextPrimary, fontWeight = FontWeight.ExtraBold, fontSize = 16.sp)
                    Text("Cele mai recente înscrieri", color = TextSecondary, fontSize = 11.sp)
                }
                Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.clickable { }) {
                    Text("Toate", color = PrimaryBlue, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                    Spacer(modifier = Modifier.width(4.dp))
                    Icon(Icons.AutoMirrored.Filled.ArrowForward, contentDescription = null, tint = PrimaryBlue, modifier = Modifier.size(14.dp))
                }
            }
            Spacer(modifier = Modifier.height(6.dp))
            CarTableRow("Porsche 911 GT3 RS", "", "B 911 GT3", "Confirmat", StatusGreen, "")
            CarTableRow("Nissan GT-R R35", "", "B 100 GTR", "În așteptare", StatusBlue, "")
            CarTableRow("Chevrolet Camaro SS", "", "B 69 CAM", "Confirmat", StatusGreen, "")
        }

        Spacer(modifier = Modifier.height(20.dp))

        GlassCard(modifier = Modifier.fillMaxWidth()) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Box(modifier = Modifier.size(44.dp).clip(RoundedCornerShape(12.dp)).background(Brush.linearGradient(listOf(AccentPurple, AccentPink))), contentAlignment = Alignment.Center) {
                    Icon(Icons.Default.AutoAwesome, contentDescription = null, tint = Color.White, modifier = Modifier.size(22.dp))
                }
                Spacer(modifier = Modifier.width(14.dp))
                Column(modifier = Modifier.weight(1f)) {
                    Text("Insight AI", color = TextPrimary, fontSize = 14.sp, fontWeight = FontWeight.ExtraBold)
                    Text("Vânzările cresc cu 32% față de anul trecut", color = TextSecondary, fontSize = 11.sp)
                }
                Icon(Icons.Default.ChevronRight, contentDescription = null, tint = TextSecondary, modifier = Modifier.size(18.dp))
            }
        }

        Spacer(modifier = Modifier.height(32.dp))
    }
}

data class HeroEvent(val title: String, val subtitle: String, val date: String, val location: String, val daysLeft: Int, val gradient: List<Color>)

@Composable
fun QuickActionCard(icon: androidx.compose.ui.graphics.vector.ImageVector, label: String, gradient: List<Color>, modifier: Modifier = Modifier) {
    Column(modifier = modifier.clip(RoundedCornerShape(20.dp)).background(CardBackgroundElevated).border(1.dp, GlassBorder, RoundedCornerShape(20.dp)).clickable { }.padding(14.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
        Box(modifier = Modifier.size(38.dp).clip(RoundedCornerShape(12.dp)).background(Brush.linearGradient(gradient)), contentAlignment = Alignment.Center) {
            Icon(icon, contentDescription = null, tint = Color.White, modifier = Modifier.size(20.dp))
        }
        Text(label, color = TextPrimary, fontSize = 12.sp, fontWeight = FontWeight.Bold, lineHeight = 14.sp)
    }
}

@Preview(widthDp = 360, heightDp = 800)
@Composable
fun DashboardMobilePreview() {
    KulturaTheme {
        DashboardScreen()
    }
}
