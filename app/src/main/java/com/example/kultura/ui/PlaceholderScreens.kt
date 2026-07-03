package com.example.kultura.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.*
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.kultura.data.SupabaseRepository
import com.example.kultura.ui.components.*
import com.example.kultura.ui.theme.*

// Use the data models from com.example.kultura.data
typealias DomainCar = com.example.kultura.data.Car
typealias DomainTask = com.example.kultura.data.Task

@Composable
fun CarsScreen() {
    val repository = remember { SupabaseRepository() }
    val allCars by repository.getCarsFlow().collectAsState(initial = emptyList())
    
    var selectedFilter by remember { mutableStateOf("Toate") }
    
    val filteredCars = when (selectedFilter) {
        "Toate" -> allCars
        "Confirmate" -> allCars.filter { it.status == "Confirmat" }
        "În așteptare" -> allCars.filter { it.status == "În așteptare" }
        "VIP" -> allCars.filter { it.isVip }
        else -> allCars
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(BackgroundDark)
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            // Stats Row
            Row(modifier = Modifier.fillMaxWidth()) {
                CarStatCard(icon = Icons.Default.DirectionsCar, label = "Mașini înregistrate", value = "124", iconColor = PrimaryBlue, modifier = Modifier.weight(1f))
                Spacer(modifier = Modifier.width(8.dp))
                CarStatCard(icon = Icons.Default.CheckCircle, label = "Confirmate", value = "86", iconColor = StatusGreen, modifier = Modifier.weight(1f))
                Spacer(modifier = Modifier.width(8.dp))
                CarStatCard(icon = Icons.Default.WorkspacePremium, label = "VIP", value = "12", iconColor = Color(0xFFBB86FC), modifier = Modifier.weight(1f))
            }

            Spacer(modifier = Modifier.height(16.dp))

            // Search and Filter
            Row(verticalAlignment = Alignment.CenterVertically) {
                Surface(modifier = Modifier.weight(1f).height(48.dp), color = CardBackground, shape = RoundedCornerShape(12.dp)) {
                    Row(modifier = Modifier.padding(horizontal = 12.dp), verticalAlignment = Alignment.CenterVertically) {
                        Icon(Icons.Default.Search, contentDescription = null, tint = TextSecondary, modifier = Modifier.size(20.dp))
                        Spacer(modifier = Modifier.width(8.dp))
                        Text("Caută după model, proprietar, număr...", color = TextSecondary, fontSize = 13.sp)
                    }
                }
                Spacer(modifier = Modifier.width(12.dp))
                Surface(modifier = Modifier.size(48.dp), color = CardBackground, shape = RoundedCornerShape(12.dp)) {
                    Box(contentAlignment = Alignment.Center) { Icon(Icons.Default.Tune, contentDescription = null, tint = TextPrimary) }
                }
            }

            Spacer(modifier = Modifier.height(16.dp))

            // Filter Chips
            LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                item { CarFilterChip(label = "Toate", isSelected = selectedFilter == "Toate", onClick = { selectedFilter = "Toate" }) }
                item { CarFilterChip(label = "Confirmate", isSelected = selectedFilter == "Confirmate", selectedColor = StatusGreen, onClick = { selectedFilter = "Confirmate" }) }
                item { CarFilterChip(label = "În așteptare", isSelected = selectedFilter == "În așteptare", selectedColor = StatusOrange, onClick = { selectedFilter = "În așteptare" }) }
                item { CarFilterChip(label = "VIP", icon = Icons.Default.Star, isSelected = selectedFilter == "VIP", selectedColor = Color(0xFF6200EE), onClick = { selectedFilter = "VIP" }) }
            }

            Spacer(modifier = Modifier.height(20.dp))

            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                Text("Mașini invitate", color = TextPrimary, fontSize = 16.sp, fontWeight = FontWeight.Bold)
                Text("${filteredCars.size} mașini", color = PrimaryBlue, fontSize = 12.sp)
            }
        }

        // Car List
        Box(modifier = Modifier.weight(1f)) {
            LazyColumn(modifier = Modifier.fillMaxSize(), contentPadding = PaddingValues(horizontal = 16.dp, vertical = 8.dp)) {
                items(filteredCars) { car ->
                    DetailedCarItem(car.model, car.owner, car.plate, car.zone, car.status, car.statusColor, car.isVip)
                }
            }

            // Bottom Add Button
            Box(modifier = Modifier.align(Alignment.BottomCenter).padding(16.dp)) {
                Surface(
                    modifier = Modifier.fillMaxWidth().height(56.dp).clip(RoundedCornerShape(16.dp)).background(Brush.horizontalGradient(listOf(PrimaryBlue, AccentBlue))).clickable { },
                    color = Color.Transparent
                ) {
                    Row(modifier = Modifier.fillMaxSize(), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.Center) {
                        Icon(Icons.Default.Add, contentDescription = null, tint = Color.White)
                        Spacer(modifier = Modifier.width(8.dp))
                        Text("Adaugă mașină", color = Color.White, fontWeight = FontWeight.Bold, fontSize = 16.sp)
                    }
                }
            }
        }
    }
}

@Composable
fun TasksScreen() {
    val repository = remember { SupabaseRepository() }
    val allTasks by repository.getTasksFlow().collectAsState(initial = emptyList())
    
    var selectedFilter by remember { mutableStateOf("Toate") }
    
    val filteredTasks = when (selectedFilter) {
        "Toate" -> allTasks
        "Urgente" -> allTasks.filter { it.status == "Urgent" }
        "În progres" -> allTasks.filter { it.status == "În progres" }
        "Finalizate" -> allTasks.filter { it.isCompleted }
        else -> allTasks
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(BackgroundDark)
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            // Stats Row
            Row(modifier = Modifier.fillMaxWidth()) {
                TaskStatCard(icon = Icons.Default.Assignment, label = "Taskuri active", value = "18", subtext = "Din 65 taskuri", iconColor = PrimaryBlue, modifier = Modifier.weight(1f))
                Spacer(modifier = Modifier.width(8.dp))
                TaskStatCard(icon = Icons.Default.CheckCircle, label = "Finalizate", value = "42", subtext = "64% completate", iconColor = StatusGreen, modifier = Modifier.weight(1f))
                Spacer(modifier = Modifier.width(8.dp))
                TaskStatCard(icon = Icons.Default.Report, label = "Urgente", value = "5", subtext = "Necesită atenție", iconColor = StatusRed, modifier = Modifier.weight(1f))
            }

            Spacer(modifier = Modifier.height(16.dp))

            // Filter Chips
            LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                item { CarFilterChip(label = "Toate", isSelected = selectedFilter == "Toate", onClick = { selectedFilter = "Toate" }) }
                item { CarFilterChip(label = "Urgente", isSelected = selectedFilter == "Urgente", selectedColor = StatusRed, onClick = { selectedFilter = "Urgente" }) }
                item { CarFilterChip(label = "În progres", isSelected = selectedFilter == "În progres", selectedColor = StatusOrange, onClick = { selectedFilter = "În progres" }) }
                item { CarFilterChip(label = "Finalizate", isSelected = selectedFilter == "Finalizate", selectedColor = StatusGreen, onClick = { selectedFilter = "Finalizate" }) }
            }
        }

        // Task List
        Box(modifier = Modifier.weight(1f)) {
            LazyColumn(modifier = Modifier.fillMaxSize(), contentPadding = PaddingValues(horizontal = 16.dp, vertical = 8.dp)) {
                items(filteredTasks) { task ->
                    DetailedTaskItem(task.title, task.event, task.date, task.status, task.statusColor, task.isCompleted)
                }
            }

            // Bottom Add Button
            Box(modifier = Modifier.align(Alignment.BottomCenter).padding(16.dp)) {
                Surface(
                    modifier = Modifier.fillMaxWidth().height(56.dp).clip(RoundedCornerShape(16.dp)).background(Brush.horizontalGradient(listOf(PrimaryBlue, Color(0xFF6200EE)))).clickable { },
                    color = Color.Transparent
                ) {
                    Row(modifier = Modifier.fillMaxSize(), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.Center) {
                        Icon(Icons.Default.Add, contentDescription = null, tint = Color.White)
                        Spacer(modifier = Modifier.width(8.dp))
                        Text("Adaugă task", color = Color.White, fontWeight = FontWeight.Bold, fontSize = 16.sp)
                    }
                }
            }
        }
    }
}

@Composable
fun SettingsScreen() {
    var notificationsExpanded by remember { mutableStateOf(false) }
    var pushEnabled by remember { mutableStateOf(true) }
    var emailEnabled by remember { mutableStateOf(true) }
    var darkThemeEnabled by remember { mutableStateOf(true) }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(BackgroundDark)
            .verticalScroll(rememberScrollState())
            .padding(16.dp)
    ) {
        ProfileHeader(name = "Andrei Popescu", role = "Administrator")
        
        Spacer(modifier = Modifier.height(24.dp))
        
        // PREFERINȚE
        Text("PREFERINȚE", color = TextSecondary, fontSize = 12.sp, fontWeight = FontWeight.Bold)
        Spacer(modifier = Modifier.height(8.dp))
        Card(
            modifier = Modifier.fillMaxWidth(),
            colors = CardDefaults.cardColors(containerColor = CardBackground),
            shape = RoundedCornerShape(12.dp)
        ) {
            Column(modifier = Modifier.padding(horizontal = 16.dp)) {
                SettingsItem(icon = Icons.Default.Person, iconColor = PrimaryBlue, title = "Cont", subtitle = "Gestionează informațiile contului tău")
                HorizontalDivider(color = DividerColor)
                
                Column {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clickable { notificationsExpanded = !notificationsExpanded }
                            .padding(vertical = 12.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Surface(modifier = Modifier.size(36.dp), shape = RoundedCornerShape(8.dp), color = Color(0xFF6200EE).copy(alpha = 0.15f)) {
                            Box(contentAlignment = Alignment.Center) { Icon(Icons.Default.Notifications, contentDescription = null, tint = Color(0xFFBB86FC), modifier = Modifier.size(18.dp)) }
                        }
                        Spacer(modifier = Modifier.width(16.dp))
                        Text(text = "Notificări", color = TextPrimary, fontSize = 15.sp, fontWeight = FontWeight.Medium, modifier = Modifier.weight(1f))
                        Icon(if (notificationsExpanded) Icons.Default.ExpandLess else Icons.Default.ExpandMore, contentDescription = null, tint = TextSecondary)
                    }
                    
                    if (notificationsExpanded) {
                        Column(modifier = Modifier.padding(start = 52.dp, bottom = 8.dp)) {
                            SettingsSwitchItem(icon = Icons.Default.NotificationsActive, iconColor = StatusBlue, title = "Notificări push", checked = pushEnabled, onCheckedChange = { pushEnabled = it })
                            SettingsSwitchItem(icon = Icons.Default.Email, iconColor = StatusOrange, title = "Notificări pe email", checked = emailEnabled, onCheckedChange = { emailEnabled = it })
                        }
                    }
                }
                
                HorizontalDivider(color = DividerColor)
                SettingsItem(icon = Icons.Default.Group, iconColor = Color(0xFF9C27B0), title = "Echipă & permisiuni", subtitle = "Invită membri și gestionează rolurile")
            }
        }
        
        Spacer(modifier = Modifier.height(24.dp))
        
        // APLICAȚIE
        Text("APLICAȚIE", color = TextSecondary, fontSize = 12.sp, fontWeight = FontWeight.Bold)
        Spacer(modifier = Modifier.height(8.dp))
        Card(
            modifier = Modifier.fillMaxWidth(),
            colors = CardDefaults.cardColors(containerColor = CardBackground),
            shape = RoundedCornerShape(12.dp)
        ) {
            Column(modifier = Modifier.padding(horizontal = 16.dp)) {
                SettingsItem(icon = Icons.Default.Language, iconColor = PrimaryBlue, title = "Limbă", trailingText = "Română")
                HorizontalDivider(color = DividerColor)
                SettingsSwitchItem(icon = Icons.Default.DarkMode, iconColor = Color(0xFFBB86FC), title = "Temă", checked = darkThemeEnabled, onCheckedChange = { darkThemeEnabled = it })
                HorizontalDivider(color = DividerColor)
                SettingsItem(icon = Icons.Default.ConfirmationNumber, iconColor = StatusGreen, title = "Integrare bilete", subtitle = "Conectează furnizori de bilete")
            }
        }
        
        Spacer(modifier = Modifier.height(24.dp))
        
        // SECURITATE & CONFIDENȚIALITATE
        Text("SECURITATE & CONFIDENȚIALITATE", color = TextSecondary, fontSize = 12.sp, fontWeight = FontWeight.Bold)
        Spacer(modifier = Modifier.height(8.dp))
        Card(
            modifier = Modifier.fillMaxWidth(),
            colors = CardDefaults.cardColors(containerColor = CardBackground),
            shape = RoundedCornerShape(12.dp)
        ) {
            Column(modifier = Modifier.padding(horizontal = 16.dp)) {
                SettingsItem(icon = Icons.Default.Security, iconColor = StatusRed, title = "Securitate", subtitle = "Parolă, autentificare în doi pași")
                HorizontalDivider(color = DividerColor)
                SettingsItem(icon = Icons.Default.Lock, iconColor = StatusBlue, title = "Confidențialitate", subtitle = "Date și setări de confidențialitate")
                HorizontalDivider(color = DividerColor)
                SettingsItem(icon = Icons.AutoMirrored.Filled.Help, iconColor = StatusOrange, title = "Ajutor", subtitle = "FAQ și suport")
            }
        }
        
        Spacer(modifier = Modifier.height(16.dp))
        
        // App Version
        Row(modifier = Modifier.fillMaxWidth().clip(RoundedCornerShape(12.dp)).background(CardBackground).padding(16.dp), verticalAlignment = Alignment.CenterVertically) {
            Surface(modifier = Modifier.size(36.dp), shape = RoundedCornerShape(8.dp), color = PrimaryBlue.copy(alpha = 0.15f)) {
                Box(contentAlignment = Alignment.Center) { Icon(Icons.Default.Info, contentDescription = null, tint = PrimaryBlue, modifier = Modifier.size(18.dp)) }
            }
            Spacer(modifier = Modifier.width(16.dp))
            Column {
                Text("Versiune aplicație", color = TextPrimary, fontSize = 14.sp)
                Text("1.0.0", color = TextSecondary, fontSize = 12.sp)
            }
        }
        
        Spacer(modifier = Modifier.height(16.dp))
        
        // Logout Button
        Surface(modifier = Modifier.fillMaxWidth().height(56.dp).clip(RoundedCornerShape(12.dp)).background(StatusRed.copy(alpha = 0.1f)).clickable { }, color = Color.Transparent) {
            Row(modifier = Modifier.fillMaxSize(), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.Center) {
                Icon(Icons.AutoMirrored.Filled.Logout, contentDescription = null, tint = StatusRed)
                Spacer(modifier = Modifier.width(12.dp))
                Text("Deconectare", color = StatusRed, fontWeight = FontWeight.Bold, fontSize = 16.sp)
            }
        }
        
        Spacer(modifier = Modifier.height(24.dp))
    }
}

@Composable
fun EventsScreen() {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(16.dp)
    ) {
        Text(
            text = "Evenimente Viitoare",
            color = TextPrimary,
            fontSize = 28.sp,
            fontWeight = FontWeight.Black
        )
        Text(
            text = "Descoperă cele mai tari festivaluri și expoziții auto.",
            color = TextSecondary,
            fontSize = 14.sp,
            modifier = Modifier.padding(top = 8.dp, bottom = 24.dp)
        )

        LazyColumn(
            verticalArrangement = Arrangement.spacedBy(16.dp),
            contentPadding = PaddingValues(bottom = 80.dp)
        ) {
            item {
                EventCardDetailed(
                    title = "KULTURA Auto Festival",
                    date = "29 - 30 Iunie 2025",
                    location = "Romexpo, București",
                    status = "În curând",
                    statusColor = StatusBlue
                )
            }
            item {
                EventCardDetailed(
                    title = "Drift Night 2025",
                    date = "12 Iulie 2025",
                    location = "MotorPark România",
                    status = "În curând",
                    statusColor = StatusOrange
                )
            }
            item {
                EventCardDetailed(
                    title = "Retro Car Expo",
                    date = "23 - 24 August 2025",
                    location = "Hala Laminor, București",
                    status = "Planificat",
                    statusColor = StatusGreen
                )
            }
        }
    }
}

@Composable
fun EventCardDetailed(
    title: String,
    date: String,
    location: String,
    status: String,
    statusColor: Color
) {
    GlassCard(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(24.dp)
    ) {
        Column {
            Surface(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(160.dp)
                    .clip(RoundedCornerShape(16.dp)),
                color = Color.DarkGray.copy(alpha = 0.3f)
            ) {
                Box(contentAlignment = Alignment.Center) {
                    Icon(Icons.Default.Image, contentDescription = null, tint = TextSecondary, modifier = Modifier.size(48.dp))
                }
            }
            
            Spacer(modifier = Modifier.height(16.dp))
            
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.Top
            ) {
                Column(modifier = Modifier.weight(1f)) {
                    Text(text = title, color = TextPrimary, fontSize = 18.sp, fontWeight = FontWeight.ExtraBold)
                    Spacer(modifier = Modifier.height(4.dp))
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(Icons.Default.CalendarToday, contentDescription = null, tint = PrimaryBlue, modifier = Modifier.size(14.dp))
                        Spacer(modifier = Modifier.width(6.dp))
                        Text(text = date, color = TextSecondary, fontSize = 12.sp)
                    }
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(Icons.Default.LocationOn, contentDescription = null, tint = PrimaryBlue, modifier = Modifier.size(14.dp))
                        Spacer(modifier = Modifier.width(6.dp))
                        Text(text = location, color = TextSecondary, fontSize = 12.sp)
                    }
                }
                
                Surface(
                    color = statusColor.copy(alpha = 0.2f),
                    shape = RoundedCornerShape(8.dp),
                    border = androidx.compose.foundation.BorderStroke(1.dp, statusColor.copy(alpha = 0.3f))
                ) {
                    Text(
                        text = status,
                        color = statusColor,
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Black,
                        modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp)
                    )
                }
            }
            
            Spacer(modifier = Modifier.height(16.dp))
            
            Button(
                onClick = { },
                modifier = Modifier.fillMaxWidth(),
                colors = ButtonDefaults.buttonColors(containerColor = PrimaryBlue),
                shape = RoundedCornerShape(12.dp)
            ) {
                Text("Rezervă Bilet", fontWeight = FontWeight.Bold)
                Spacer(modifier = Modifier.width(8.dp))
                Icon(Icons.AutoMirrored.Filled.ArrowForward, contentDescription = null, modifier = Modifier.size(16.dp))
            }
        }
    }
}
