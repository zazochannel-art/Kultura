package com.example.kultura.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.*
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.blur
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.kultura.ui.theme.*

@Composable
fun GlassCard(
    modifier: Modifier = Modifier,
    shape: RoundedCornerShape = RoundedCornerShape(24.dp),
    content: @Composable ColumnScope.() -> Unit
) {
    Box(
        modifier = modifier
            .clip(shape)
            .background(
                Brush.linearGradient(
                    colors = listOf(
                        Color(0x991A1F35),
                        Color(0x800E1120)
                    )
                )
            )
            .border(1.dp, GlassBorder, shape)
    ) {
        Column(modifier = Modifier.padding(18.dp)) {
            content()
        }
    }
}

@Composable
fun MeshBackground(modifier: Modifier = Modifier) {
    Box(
        modifier = modifier
            .fillMaxSize()
            .background(BackgroundDark)
    ) {
        Box(
            modifier = Modifier
                .size(420.dp)
                .offset(x = (-120).dp, y = (-140).dp)
                .blur(140.dp)
                .background(AccentPurple.copy(alpha = 0.35f), CircleShape)
        )
        Box(
            modifier = Modifier
                .size(360.dp)
                .align(Alignment.TopEnd)
                .offset(x = 140.dp, y = (-80).dp)
                .blur(120.dp)
                .background(PrimaryBlue.copy(alpha = 0.28f), CircleShape)
        )
        Box(
            modifier = Modifier
                .size(320.dp)
                .align(Alignment.BottomEnd)
                .offset(x = 100.dp, y = 100.dp)
                .blur(120.dp)
                .background(AccentPink.copy(alpha = 0.18f), CircleShape)
        )
    }
}

@Composable
fun MobileTopBar() {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 20.dp, vertical = 14.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        // Logo Section
        Row(verticalAlignment = Alignment.CenterVertically) {
            Box(
                modifier = Modifier
                    .size(28.dp)
                    .clip(RoundedCornerShape(8.dp))
                    .background(Brush.linearGradient(listOf(PrimaryBlue, AccentPurple))),
                contentAlignment = Alignment.Center
            ) {
                Icon(Icons.Default.DirectionsCar, contentDescription = null, tint = Color.White, modifier = Modifier.size(16.dp))
            }
            Spacer(modifier = Modifier.width(8.dp))
            Text(text = "Kultura", color = TextPrimary, fontWeight = FontWeight.ExtraBold, fontSize = 19.sp, letterSpacing = (-0.3).sp)
        }

        Spacer(modifier = Modifier.weight(1f))

        Box {
            Surface(
                modifier = Modifier.size(42.dp),
                shape = RoundedCornerShape(14.dp),
                color = CardBackgroundElevated,
                border = androidx.compose.foundation.BorderStroke(1.dp, GlassBorder)
            ) {
                Box(contentAlignment = Alignment.Center) {
                    Icon(Icons.Default.NotificationsNone, contentDescription = "Notificări", tint = TextPrimary, modifier = Modifier.size(20.dp))
                }
            }
            Box(
                modifier = Modifier
                    .size(18.dp)
                    .align(Alignment.TopEnd)
                    .offset(x = 4.dp, y = (-4).dp)
                    .clip(CircleShape)
                    .background(Brush.linearGradient(listOf(AccentPink, StatusRed)))
                    .border(2.dp, BackgroundDark, CircleShape),
                contentAlignment = Alignment.Center
            ) {
                Text("3", color = Color.White, fontSize = 9.sp, fontWeight = FontWeight.Black)
            }
        }
    }
}

@Composable
fun MobileBottomNavigation(selectedItem: Int, onItemSelected: (Int) -> Unit) {
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 20.dp, vertical = 16.dp)
            .height(68.dp)
            .clip(RoundedCornerShape(22.dp))
            .background(CardBackgroundElevated)
            .border(1.dp, GlassBorder, RoundedCornerShape(22.dp)),
        contentAlignment = Alignment.Center
    ) {
        Row(
            modifier = Modifier.fillMaxSize().padding(horizontal = 8.dp),
            horizontalArrangement = Arrangement.SpaceEvenly,
            verticalAlignment = Alignment.CenterVertically
        ) {
            val items = listOf(
                Triple(Icons.Default.GridView, "Acasă", 0),
                Triple(Icons.Default.Event, "Evenimente", 1),
                Triple(Icons.Default.DirectionsCar, "Mașini", 2),
                Triple(Icons.Default.TaskAlt, "Taskuri", 3),
                Triple(Icons.Default.Settings, "Setări", 4)
            )

            items.forEach { (icon, label, index) ->
                val isSelected = selectedItem == index
                Row(
                    modifier = Modifier
                        .clip(RoundedCornerShape(18.dp))
                        .then(
                            if (isSelected) Modifier.background(
                                Brush.linearGradient(listOf(PrimaryBlue, AccentPurple))
                            ) else Modifier
                        )
                        .clickable { onItemSelected(index) }
                        .padding(horizontal = if (isSelected) 14.dp else 12.dp, vertical = 10.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.Center
                ) {
                    Icon(
                        imageVector = icon,
                        contentDescription = label,
                        tint = if (isSelected) Color.White else TextSecondary,
                        modifier = Modifier.size(20.dp)
                    )
                    if (isSelected) {
                        Spacer(modifier = Modifier.width(6.dp))
                        Text(label, color = Color.White, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                    }
                }
            }
        }
    }
}

@Composable
fun StatCardMobile(
    icon: ImageVector,
    iconColor: Color,
    label: String,
    value: String,
    trend: String,
    trendColor: Color,
    modifier: Modifier = Modifier
) {
    GlassCard(modifier = modifier, shape = RoundedCornerShape(22.dp)) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            Box(
                modifier = Modifier
                    .size(40.dp)
                    .clip(RoundedCornerShape(12.dp))
                    .background(
                        Brush.linearGradient(
                            listOf(iconColor.copy(alpha = 0.28f), iconColor.copy(alpha = 0.10f))
                        )
                    )
                    .border(1.dp, iconColor.copy(alpha = 0.25f), RoundedCornerShape(12.dp)),
                contentAlignment = Alignment.Center
            ) {
                Icon(icon, contentDescription = null, tint = iconColor, modifier = Modifier.size(20.dp))
            }
            Surface(
                color = trendColor.copy(alpha = 0.15f),
                shape = RoundedCornerShape(8.dp)
            ) {
                Row(
                    modifier = Modifier.padding(horizontal = 6.dp, vertical = 3.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Icon(
                        if (trend.startsWith("↑") || trend.startsWith("+")) Icons.Default.TrendingUp else Icons.Default.TrendingDown,
                        contentDescription = null,
                        tint = trendColor,
                        modifier = Modifier.size(11.dp)
                    )
                    Spacer(modifier = Modifier.width(3.dp))
                    Text(trend.replace("↑ ", "").replace("↓ ", ""), color = trendColor, fontSize = 10.sp, fontWeight = FontWeight.Bold)
                }
            }
        }

        Spacer(modifier = Modifier.height(14.dp))

        Text(value, color = TextPrimary, fontSize = 26.sp, fontWeight = FontWeight.Black, letterSpacing = (-0.5).sp)
        Spacer(modifier = Modifier.height(2.dp))
        Text(label, color = TextSecondary, fontSize = 12.sp, fontWeight = FontWeight.Medium)
    }
}

@Composable
fun CarStatCard(icon: ImageVector, label: String, value: String, iconColor: Color, modifier: Modifier = Modifier) {
    GlassCard(modifier = modifier, shape = RoundedCornerShape(16.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Surface(modifier = Modifier.size(32.dp), shape = RoundedCornerShape(8.dp), color = iconColor.copy(alpha = 0.2f)) {
                Box(contentAlignment = Alignment.Center) { Icon(icon, contentDescription = null, tint = iconColor, modifier = Modifier.size(16.dp)) }
            }
            Spacer(modifier = Modifier.width(8.dp))
            Column {
                Text(label, color = TextSecondary, fontSize = 9.sp, fontWeight = FontWeight.Bold)
                Text(value, color = TextPrimary, fontSize = 16.sp, fontWeight = FontWeight.ExtraBold)
            }
        }
    }
}

@Composable
fun TaskStatCard(icon: ImageVector, label: String, value: String, subtext: String, iconColor: Color, modifier: Modifier = Modifier) {
    GlassCard(modifier = modifier, shape = RoundedCornerShape(16.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Surface(modifier = Modifier.size(32.dp), shape = RoundedCornerShape(8.dp), color = iconColor.copy(alpha = 0.2f)) {
                Box(contentAlignment = Alignment.Center) { Icon(icon, contentDescription = null, tint = iconColor, modifier = Modifier.size(16.dp)) }
            }
            Spacer(modifier = Modifier.width(8.dp))
            Text(label, color = TextSecondary, fontSize = 10.sp, fontWeight = FontWeight.Bold)
        }
        Spacer(modifier = Modifier.height(8.dp))
        Text(value, color = TextPrimary, fontSize = 20.sp, fontWeight = FontWeight.ExtraBold)
        Text(subtext, color = TextSecondary.copy(alpha = 0.6f), fontSize = 9.sp)
    }
}

@Composable
fun CarFilterChip(label: String, icon: ImageVector? = null, isSelected: Boolean, selectedColor: Color = PrimaryBlue, onClick: () -> Unit) {
    Surface(
        modifier = Modifier
            .clip(RoundedCornerShape(12.dp))
            .clickable { onClick() },
        color = if (isSelected) selectedColor else CardBackground,
        shape = RoundedCornerShape(12.dp),
        border = if (isSelected) null else androidx.compose.foundation.BorderStroke(1.dp, GlassBorder)
    ) {
        Row(modifier = Modifier.padding(horizontal = 16.dp, vertical = 10.dp), verticalAlignment = Alignment.CenterVertically) {
            if (icon != null) {
                Icon(imageVector = icon, contentDescription = null, tint = if (isSelected) Color.White else selectedColor, modifier = Modifier.size(14.dp))
                Spacer(modifier = Modifier.width(6.dp))
            }
            Text(text = label, color = if (isSelected) Color.White else TextPrimary, fontSize = 13.sp, fontWeight = FontWeight.Bold)
        }
    }
}

@Composable
fun DetailedCarItem(
    model: String,
    owner: String,
    plate: String,
    zone: String,
    status: String,
    statusColorHex: String,
    isVip: Boolean = false
) {
    val statusColor = try {
        Color(android.graphics.Color.parseColor(statusColorHex))
    } catch (e: Exception) {
        StatusBlue
    }

    GlassCard(modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp), shape = RoundedCornerShape(20.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Surface(modifier = Modifier.size(90.dp, 60.dp).clip(RoundedCornerShape(12.dp)), color = Color.DarkGray.copy(alpha = 0.5f)) {}
            Spacer(modifier = Modifier.width(16.dp))
            Column(modifier = Modifier.weight(1f)) {
                Text(model, color = TextPrimary, fontSize = 15.sp, fontWeight = FontWeight.ExtraBold)
                Text(owner, color = TextSecondary, fontSize = 12.sp)
                Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.padding(top = 4.dp)) {
                    Text(plate, color = PrimaryBlue, fontSize = 10.sp, fontWeight = FontWeight.Bold)
                    Spacer(modifier = Modifier.width(8.dp))
                    Text(zone, color = TextSecondary.copy(alpha = 0.7f), fontSize = 10.sp)
                }
            }
            Surface(
                color = if (isVip) Color(0xFF6200EE).copy(alpha = 0.2f) else statusColor.copy(alpha = 0.2f),
                shape = RoundedCornerShape(8.dp),
                border = androidx.compose.foundation.BorderStroke(1.dp, if (isVip) Color(0xFFBB86FC).copy(alpha = 0.3f) else statusColor.copy(alpha = 0.3f))
            ) {
                Text(
                    text = if (isVip) "VIP" else status,
                    color = if (isVip) Color(0xFFBB86FC) else statusColor,
                    fontSize = 10.sp,
                    fontWeight = FontWeight.Black,
                    modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp)
                )
            }
        }
    }
}

@Composable
fun DetailedTaskItem(
    title: String,
    event: String,
    date: String,
    status: String,
    statusColorHex: String,
    isCompleted: Boolean = false
) {
    val statusColor = try {
        Color(android.graphics.Color.parseColor(statusColorHex))
    } catch (e: Exception) {
        StatusBlue
    }

    GlassCard(modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp), shape = RoundedCornerShape(20.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Box(
                modifier = Modifier
                    .size(36.dp)
                    .clip(CircleShape)
                    .background(if (isCompleted) statusColor.copy(alpha = 0.2f) else Color.Transparent)
                    .border(2.dp, statusColor.copy(alpha = 0.4f), CircleShape),
                contentAlignment = Alignment.Center
            ) {
                if (isCompleted) Icon(Icons.Default.Check, contentDescription = null, tint = statusColor, modifier = Modifier.size(20.dp))
            }
            Spacer(modifier = Modifier.width(16.dp))
            Column(modifier = Modifier.weight(1f)) {
                Text(text = title, color = if (isCompleted) TextSecondary else TextPrimary, fontSize = 15.sp, fontWeight = FontWeight.Bold)
                Text(event, color = TextSecondary.copy(alpha = 0.7f), fontSize = 11.sp)
            }
            Surface(color = statusColor.copy(alpha = 0.2f), shape = RoundedCornerShape(8.dp)) {
                Text(text = status, color = statusColor, fontSize = 10.sp, fontWeight = FontWeight.Black, modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp))
            }
        }
    }
}

@Composable
fun ProfileHeader(name: String, role: String) {
    GlassCard(modifier = Modifier.fillMaxWidth(), shape = RoundedCornerShape(24.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Surface(
                modifier = Modifier.size(70.dp),
                shape = CircleShape,
                color = Color.Gray.copy(alpha = 0.2f),
                border = androidx.compose.foundation.BorderStroke(2.dp, PrimaryBlue)
            ) {}
            Spacer(modifier = Modifier.width(16.dp))
            Column {
                Text(text = name, color = TextPrimary, fontSize = 18.sp, fontWeight = FontWeight.Black)
                Text(text = role, color = PrimaryBlue, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                Spacer(modifier = Modifier.height(8.dp))
                Surface(
                    modifier = Modifier.height(28.dp).clip(RoundedCornerShape(8.dp)).background(PrimaryBlue).clickable { },
                    color = Color.Transparent
                ) {
                    Text("Edit Profile", color = Color.White, fontSize = 11.sp, fontWeight = FontWeight.Bold, modifier = Modifier.padding(horizontal = 12.dp, vertical = 6.dp))
                }
            }
        }
    }
}

@Composable
fun SettingsItem(icon: ImageVector, iconColor: Color, title: String, subtitle: String? = null, trailingText: String? = null, onClick: () -> Unit = {}) {
    Row(modifier = Modifier.fillMaxWidth().clickable { onClick() }.padding(vertical = 12.dp), verticalAlignment = Alignment.CenterVertically) {
        Surface(modifier = Modifier.size(36.dp), shape = RoundedCornerShape(10.dp), color = iconColor.copy(alpha = 0.2f)) {
            Box(contentAlignment = Alignment.Center) { Icon(icon, contentDescription = null, tint = iconColor, modifier = Modifier.size(18.dp)) }
        }
        Spacer(modifier = Modifier.width(12.dp))
        Column(modifier = Modifier.weight(1f)) {
            Text(text = title, color = TextPrimary, fontSize = 15.sp, fontWeight = FontWeight.Bold)
            if (subtitle != null) { Text(text = subtitle, color = TextSecondary, fontSize = 11.sp) }
        }
        if (trailingText != null) { Text(text = trailingText, color = TextSecondary, fontSize = 14.sp) }
        Icon(Icons.Default.ChevronRight, contentDescription = null, tint = TextSecondary, modifier = Modifier.size(18.dp))
    }
}

@Composable
fun SettingsSwitchItem(icon: ImageVector, iconColor: Color, title: String, checked: Boolean, onCheckedChange: (Boolean) -> Unit) {
    Row(modifier = Modifier.fillMaxWidth().padding(vertical = 12.dp), verticalAlignment = Alignment.CenterVertically) {
        Surface(modifier = Modifier.size(36.dp), shape = RoundedCornerShape(10.dp), color = iconColor.copy(alpha = 0.2f)) {
            Box(contentAlignment = Alignment.Center) { Icon(icon, contentDescription = null, tint = iconColor, modifier = Modifier.size(18.dp)) }
        }
        Spacer(modifier = Modifier.width(12.dp))
        Text(text = title, color = TextPrimary, fontSize = 15.sp, fontWeight = FontWeight.Bold, modifier = Modifier.weight(1f))
        Switch(checked = checked, onCheckedChange = onCheckedChange, colors = SwitchDefaults.colors(checkedThumbColor = Color.White, checkedTrackColor = PrimaryBlue))
    }
}

@Composable
fun EventItem(title: String, date: String, location: String, status: String, statusColor: Color) {
    Row(modifier = Modifier.fillMaxWidth().padding(vertical = 10.dp), verticalAlignment = Alignment.CenterVertically) {
        Box(
            modifier = Modifier
                .size(52.dp)
                .clip(RoundedCornerShape(14.dp))
                .background(
                    Brush.linearGradient(
                        listOf(statusColor.copy(alpha = 0.35f), statusColor.copy(alpha = 0.10f))
                    )
                )
                .border(1.dp, statusColor.copy(alpha = 0.25f), RoundedCornerShape(14.dp)),
            contentAlignment = Alignment.Center
        ) {
            Icon(Icons.Default.CalendarMonth, contentDescription = null, tint = statusColor, modifier = Modifier.size(22.dp))
        }
        Spacer(modifier = Modifier.width(14.dp))
        Column(modifier = Modifier.weight(1f)) {
            Text(title, color = TextPrimary, fontSize = 14.sp, fontWeight = FontWeight.Bold)
            Spacer(modifier = Modifier.height(2.dp))
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(Icons.Default.Schedule, contentDescription = null, tint = TextTertiary, modifier = Modifier.size(11.dp))
                Spacer(modifier = Modifier.width(4.dp))
                Text(date, color = TextSecondary, fontSize = 11.sp)
                if (location.isNotBlank()) {
                    Spacer(modifier = Modifier.width(6.dp))
                    Box(modifier = Modifier.size(3.dp).clip(CircleShape).background(TextTertiary))
                    Spacer(modifier = Modifier.width(6.dp))
                    Text(location, color = TextSecondary, fontSize = 11.sp, maxLines = 1)
                }
            }
        }
        Spacer(modifier = Modifier.width(8.dp))
        Surface(
            color = statusColor.copy(alpha = 0.18f),
            shape = RoundedCornerShape(8.dp),
            border = androidx.compose.foundation.BorderStroke(1.dp, statusColor.copy(alpha = 0.25f))
        ) {
            Text(text = status, color = statusColor, fontSize = 10.sp, fontWeight = FontWeight.Bold, modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp))
        }
    }
}

@Composable
fun TaskItem(status: String, statusColor: Color, title: String, date: String, user: String) {
    Row(modifier = Modifier.fillMaxWidth().padding(vertical = 10.dp), verticalAlignment = Alignment.CenterVertically) {
        Box(
            modifier = Modifier
                .size(8.dp)
                .clip(CircleShape)
                .background(statusColor)
        )
        Spacer(modifier = Modifier.width(12.dp))
        Column(modifier = Modifier.weight(1f)) {
            Text(text = title, color = TextPrimary, fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
            if (date.isNotBlank()) {
                Spacer(modifier = Modifier.height(2.dp))
                Text(text = date, color = TextTertiary, fontSize = 11.sp)
            }
        }
        Spacer(modifier = Modifier.width(8.dp))
        Surface(
            color = statusColor.copy(alpha = 0.15f),
            shape = RoundedCornerShape(8.dp),
            border = androidx.compose.foundation.BorderStroke(1.dp, statusColor.copy(alpha = 0.25f))
        ) {
            Text(text = status, color = statusColor, fontSize = 10.sp, fontWeight = FontWeight.Bold, modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp))
        }
    }
}

@Composable
fun CarTableRow(model: String, owner: String, plate: String, status: String, statusColor: Color, zone: String) {
    Row(modifier = Modifier.fillMaxWidth().padding(vertical = 10.dp), verticalAlignment = Alignment.CenterVertically) {
        Box(
            modifier = Modifier
                .size(40.dp)
                .clip(RoundedCornerShape(10.dp))
                .background(
                    Brush.linearGradient(listOf(PrimaryBlue.copy(alpha = 0.25f), AccentPurple.copy(alpha = 0.10f)))
                ),
            contentAlignment = Alignment.Center
        ) {
            Icon(Icons.Default.DirectionsCar, contentDescription = null, tint = AccentBlue, modifier = Modifier.size(20.dp))
        }
        Spacer(modifier = Modifier.width(12.dp))
        Column(modifier = Modifier.weight(1f)) {
            Text(model, color = TextPrimary, fontSize = 13.sp, fontWeight = FontWeight.SemiBold, maxLines = 1)
            if (plate.isNotBlank()) {
                Spacer(modifier = Modifier.height(2.dp))
                Text(plate, color = TextTertiary, fontSize = 10.sp, fontWeight = FontWeight.Medium)
            }
        }
        Spacer(modifier = Modifier.width(8.dp))
        Surface(
            color = statusColor.copy(alpha = 0.15f),
            shape = RoundedCornerShape(8.dp),
            border = androidx.compose.foundation.BorderStroke(1.dp, statusColor.copy(alpha = 0.25f))
        ) {
            Text(text = status, color = statusColor, fontSize = 10.sp, fontWeight = FontWeight.Bold, modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp))
        }
    }
}

data class NavItem(val title: String, val icon: ImageVector)

@Composable
fun Sidebar(modifier: Modifier = Modifier) {
    Column(modifier = modifier.fillMaxHeight().width(280.dp).background(BackgroundDark).padding(24.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Box(
                modifier = Modifier
                    .size(44.dp)
                    .clip(RoundedCornerShape(14.dp))
                    .background(Brush.linearGradient(listOf(PrimaryBlue, AccentPurple))),
                contentAlignment = Alignment.Center
            ) {
                Icon(Icons.Default.DirectionsCar, contentDescription = null, tint = Color.White, modifier = Modifier.size(22.dp))
            }
            Spacer(modifier = Modifier.width(12.dp))
            Column {
                Text(text = "Kultura", color = TextPrimary, fontSize = 22.sp, fontWeight = FontWeight.Black, letterSpacing = (-0.5).sp)
                Text(text = "Festival Manager", color = TextSecondary, fontSize = 11.sp, fontWeight = FontWeight.Medium)
            }
        }
        Spacer(modifier = Modifier.height(36.dp))
        Text("MENIU", color = TextTertiary, fontSize = 10.sp, fontWeight = FontWeight.Bold, letterSpacing = 1.5.sp)
        Spacer(modifier = Modifier.height(12.dp))
        val navItems = listOf(
            NavItem("Acasă", Icons.Default.GridView),
            NavItem("Evenimente", Icons.Default.Event),
            NavItem("Mașini", Icons.Default.DirectionsCar),
            NavItem("Taskuri", Icons.Default.TaskAlt),
            NavItem("Setări", Icons.Default.Settings)
        )
        navItems.forEachIndexed { index, item ->
            NavItemView(item, index == 0)
            Spacer(modifier = Modifier.height(6.dp))
        }
    }
}

@Composable
fun NavItemView(item: NavItem, isSelected: Boolean) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(14.dp))
            .then(
                if (isSelected) Modifier.background(Brush.linearGradient(listOf(PrimaryBlue, AccentPurple)))
                else Modifier
            )
            .clickable { }
            .padding(horizontal = 14.dp, vertical = 12.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Icon(imageVector = item.icon, contentDescription = null, tint = if (isSelected) Color.White else TextSecondary, modifier = Modifier.size(20.dp))
        Spacer(modifier = Modifier.width(14.dp))
        Text(text = item.title, color = if (isSelected) Color.White else TextSecondary, fontSize = 14.sp, fontWeight = FontWeight.SemiBold)
    }
}

@Composable
fun TopBar() { /* Basic desktop TopBar implementation */ }

@Composable
fun StatCard(icon: ImageVector, iconColor: Color, label: String, value: String, trend: String, trendColor: Color, modifier: Modifier = Modifier) { /* Desktop variant */ }
