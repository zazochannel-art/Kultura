package com.example.kultura.ui

import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
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
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.DialogProperties
import com.example.kultura.data.AiRepository
import com.example.kultura.data.AuthRepository
import com.example.kultura.data.SupabaseRepository
import com.example.kultura.ui.components.*
import com.example.kultura.ui.theme.*
import kotlinx.coroutines.launch
import java.io.InputStream
import java.io.OutputStreamWriter

// Use the data models from com.example.kultura.data
typealias DomainCar = com.example.kultura.data.Car
typealias DomainTask = com.example.kultura.data.Task

@Composable
fun CarsScreen() {
    val repository = remember { SupabaseRepository() }
    val aiRepository = remember { AiRepository() }
    val allCars by repository.getCarsFlow().collectAsState(initial = emptyList())
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    
    var selectedFilter by remember { mutableStateOf("Toate") }
    var showAddCarDialog by remember { mutableStateOf(false) }
    var showAiImportDialog by remember { mutableStateOf(false) }
    
    val filteredCars = when (selectedFilter) {
        "Toate" -> allCars
        "Înscrise" -> allCars.filter { it.status == "Înscris" }
        "Aprobate" -> allCars.filter { it.status == "Confirmat" || it.status == "Aprobat" }
        "NeAprobate" -> allCars.filter { it.status == "În așteptare" || it.status == "Respins" }
        else -> allCars
    }

    // Export Launcher
    val exportLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.CreateDocument("text/csv")
    ) { uri ->
        uri?.let {
            try {
                context.contentResolver.openOutputStream(it)?.use { outputStream ->
                    val csvData = repository.exportCarsToCsv(allCars)
                    OutputStreamWriter(outputStream).use { writer ->
                        writer.write(csvData)
                    }
                }
            } catch (e: Exception) {
                e.printStackTrace()
            }
        }
    }

    // Import Launcher
    val importLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.GetContent()
    ) { uri ->
        uri?.let {
            scope.launch {
                try {
                    context.contentResolver.openInputStream(it)?.use { inputStream ->
                        val csvContent = inputStream.bufferedReader().readText()
                        repository.importCarsFromCsv(csvContent)
                    }
                } catch (e: Exception) {
                    e.printStackTrace()
                }
            }
        }
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
                Surface(
                    modifier = Modifier
                        .weight(1f)
                        .height(48.dp),
                    color = CardBackground,
                    shape = RoundedCornerShape(12.dp),
                    border = androidx.compose.foundation.BorderStroke(1.dp, GlassBorder)
                ) {
                    Row(
                        modifier = Modifier.padding(horizontal = 12.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Icon(Icons.Default.Search, contentDescription = null, tint = TextSecondary, modifier = Modifier.size(20.dp))
                        Spacer(modifier = Modifier.width(8.dp))
                        Text("Caută după model, proprietar...", color = TextSecondary, fontSize = 13.sp)
                    }
                }
                Spacer(modifier = Modifier.width(10.dp))
                
                // Export Button
                Surface(
                    modifier = Modifier.size(48.dp).clip(RoundedCornerShape(12.dp)).clickable { exportLauncher.launch("cars_export.csv") },
                    color = CardBackground,
                    shape = RoundedCornerShape(12.dp),
                    border = androidx.compose.foundation.BorderStroke(1.dp, GlassBorder)
                ) {
                    Box(contentAlignment = Alignment.Center) {
                        Icon(Icons.Default.Download, contentDescription = "Export", tint = TextPrimary, modifier = Modifier.size(20.dp))
                    }
                }
                
                Spacer(modifier = Modifier.width(8.dp))
                
                // Import Button
                Surface(
                    modifier = Modifier.size(48.dp).clip(RoundedCornerShape(12.dp)).clickable { importLauncher.launch("text/csv") },
                    color = CardBackground,
                    shape = RoundedCornerShape(12.dp),
                    border = androidx.compose.foundation.BorderStroke(1.dp, GlassBorder)
                ) {
                    Box(contentAlignment = Alignment.Center) {
                        Icon(Icons.Default.Upload, contentDescription = "Import", tint = TextPrimary, modifier = Modifier.size(20.dp))
                    }
                }
                
                Spacer(modifier = Modifier.width(8.dp))

                // AI Smart Import Button
                Surface(
                    modifier = Modifier.size(48.dp).clip(RoundedCornerShape(12.dp)).clickable { showAiImportDialog = true },
                    color = PrimaryBlue.copy(alpha = 0.2f),
                    shape = RoundedCornerShape(12.dp),
                    border = androidx.compose.foundation.BorderStroke(1.dp, PrimaryBlue.copy(alpha = 0.5f))
                ) {
                    Box(contentAlignment = Alignment.Center) {
                        Icon(Icons.Default.AutoAwesome, contentDescription = "AI Import", tint = PrimaryBlue, modifier = Modifier.size(20.dp))
                    }
                }
                
                Spacer(modifier = Modifier.width(8.dp))
                
                Surface(
                    modifier = Modifier.size(48.dp),
                    color = CardBackground,
                    shape = RoundedCornerShape(12.dp),
                    border = androidx.compose.foundation.BorderStroke(1.dp, GlassBorder)
                ) {
                    Box(contentAlignment = Alignment.Center) {
                        Icon(Icons.Default.Tune, contentDescription = null, tint = TextPrimary)
                    }
                }
            }

            Spacer(modifier = Modifier.height(16.dp))

            // Filter Chips
            LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                item { CarFilterChip(label = "Toate", isSelected = selectedFilter == "Toate", onClick = { selectedFilter = "Toate" }) }
                item { CarFilterChip(label = "Înscrise", isSelected = selectedFilter == "Înscrise", selectedColor = PrimaryBlue, onClick = { selectedFilter = "Înscrise" }) }
                item { CarFilterChip(label = "Aprobate", isSelected = selectedFilter == "Aprobate", selectedColor = StatusGreen, onClick = { selectedFilter = "Aprobate" }) }
                item { CarFilterChip(label = "NeAprobate", isSelected = selectedFilter == "NeAprobate", selectedColor = StatusRed, onClick = { selectedFilter = "NeAprobate" }) }
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
                    modifier = Modifier.fillMaxWidth().height(56.dp).clip(RoundedCornerShape(16.dp)).background(Brush.horizontalGradient(listOf(PrimaryBlue, AccentBlue))).clickable { showAddCarDialog = true },
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

        if (showAddCarDialog) {
            AddCarDialog(
                onDismiss = { showAddCarDialog = false },
                onSave = { car ->
                    scope.launch {
                        try {
                            repository.addCar(car)
                            showAddCarDialog = false
                        } catch (e: Exception) {
                            e.printStackTrace()
                        }
                    }
                }
            )
        }

        if (showAiImportDialog) {
            AiImportDialog(
                onDismiss = { showAiImportDialog = false },
                onImport = { cars ->
                    scope.launch {
                        try {
                            cars.forEach { repository.addCar(it) }
                            showAiImportDialog = false
                        } catch (e: Exception) {
                            e.printStackTrace()
                        }
                    }
                },
                aiRepository = aiRepository
            )
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AiImportDialog(
    onDismiss: () -> Unit,
    onImport: (List<com.example.kultura.data.Car>) -> Unit,
    aiRepository: AiRepository
) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    var aiStatus by remember { mutableStateOf("Așteptare fișier...") }
    var isProcessing by remember { mutableStateOf(false) }
    var parsedCars by remember { mutableStateOf<List<com.example.kultura.data.Car>>(emptyList()) }

    val excelPickerLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.GetContent()
    ) { uri ->
        uri?.let {
            scope.launch {
                isProcessing = true
                aiStatus = "Se citește fișierul..."
                try {
                    context.contentResolver.openInputStream(it)?.use { inputStream ->
                        val text = aiRepository.extractTextFromExcel(inputStream)
                        if (text.isBlank()) {
                            aiStatus = "Eroare: fișierul e gol sau nu poate fi citit ca Excel."
                            return@use
                        }
                        aiStatus = "AI analizează datele..."
                        aiRepository.parseCarsFromText(text)
                            .onSuccess { cars ->
                                parsedCars = cars
                                aiStatus = if (cars.isNotEmpty())
                                    "Am găsit ${cars.size} mașini!"
                                else "Nu am reușit să extrag date."
                            }
                            .onFailure { e ->
                                aiStatus = "Eroare: ${e.message}"
                            }
                    }
                } catch (e: Exception) {
                    aiStatus = "Eroare: ${e.message}"
                } finally {
                    isProcessing = false
                }
            }
        }
    }

    AlertDialog(
        onDismissRequest = onDismiss,
        properties = DialogProperties(usePlatformDefaultWidth = false),
        modifier = Modifier.fillMaxWidth().padding(24.dp),
        content = {
            GlassCard(shape = RoundedCornerShape(28.dp)) {
                Column(modifier = Modifier.padding(16.dp)) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(Icons.Default.AutoAwesome, contentDescription = null, tint = PrimaryBlue)
                        Spacer(modifier = Modifier.width(12.dp))
                        Text("AI Magic Import", color = TextPrimary, fontSize = 22.sp, fontWeight = FontWeight.Black)
                    }
                    
                    Spacer(modifier = Modifier.height(16.dp))
                    
                    Text(
                        text = "Încarcă un fișier Excel (.xlsx) sau CSV și AI-ul va extrage automat datele mașinilor.",
                        color = TextSecondary,
                        fontSize = 14.sp
                    )

                    if (!aiRepository.isConfigured) {
                        Spacer(modifier = Modifier.height(16.dp))
                        Surface(
                            color = StatusOrange.copy(alpha = 0.15f),
                            shape = RoundedCornerShape(12.dp),
                            border = androidx.compose.foundation.BorderStroke(1.dp, StatusOrange.copy(alpha = 0.4f))
                        ) {
                            Row(
                                modifier = Modifier.padding(12.dp),
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Icon(Icons.Default.Warning, contentDescription = null, tint = StatusOrange, modifier = Modifier.size(20.dp))
                                Spacer(modifier = Modifier.width(10.dp))
                                Text(
                                    text = "Cheie Gemini lipsă. Adaug-o în local.properties: gemini.api.key=... și repornește build-ul.",
                                    color = TextPrimary,
                                    fontSize = 12.sp
                                )
                            }
                        }
                    }

                    Spacer(modifier = Modifier.height(24.dp))

                    if (parsedCars.isEmpty()) {
                        Button(
                            onClick = { excelPickerLauncher.launch("*/*") },
                            modifier = Modifier.fillMaxWidth().height(56.dp),
                            colors = ButtonDefaults.buttonColors(containerColor = PrimaryBlue),
                            shape = RoundedCornerShape(14.dp),
                            enabled = !isProcessing && aiRepository.isConfigured
                        ) {
                            if (isProcessing) {
                                CircularProgressIndicator(modifier = Modifier.size(20.dp), color = Color.White)
                            } else {
                                Icon(Icons.Default.FileUpload, contentDescription = null)
                                Spacer(modifier = Modifier.width(8.dp))
                                Text("Selectează Fișier")
                            }
                        }
                    } else {
                        // Preview List
                        Text("PREVIZUALIZARE (${parsedCars.size} mașini)", color = TextTertiary, fontSize = 11.sp, fontWeight = FontWeight.Bold)
                        Spacer(modifier = Modifier.height(8.dp))
                        Box(modifier = Modifier.heightIn(max = 300.dp)) {
                            LazyColumn {
                                items(parsedCars) { car ->
                                    Row(modifier = Modifier.padding(vertical = 4.dp).fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                                        Box(modifier = Modifier.size(8.dp).clip(CircleShape).background(PrimaryBlue))
                                        Spacer(modifier = Modifier.width(8.dp))
                                        Column {
                                            Text(car.model, color = TextPrimary, fontSize = 14.sp, fontWeight = FontWeight.Bold)
                                            Text("${car.owner} • ${car.plate}", color = TextSecondary, fontSize = 11.sp)
                                        }
                                    }
                                }
                            }
                        }
                    }
                    
                    Spacer(modifier = Modifier.height(12.dp))
                    Text(aiStatus, color = if (aiStatus.startsWith("Eroare")) StatusRed else PrimaryBlue, fontSize = 12.sp, fontWeight = FontWeight.Medium)
                    
                    Spacer(modifier = Modifier.height(24.dp))
                    
                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.End) {
                        TextButton(onClick = onDismiss) { Text("Anulează", color = TextSecondary) }
                        if (parsedCars.isNotEmpty()) {
                            Spacer(modifier = Modifier.width(16.dp))
                            Button(
                                onClick = { onImport(parsedCars) },
                                colors = ButtonDefaults.buttonColors(containerColor = StatusGreen),
                                shape = RoundedCornerShape(12.dp)
                            ) {
                                Text("Importă Tot", fontWeight = FontWeight.Bold)
                            }
                        }
                    }
                }
            }
        }
    )
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AddCarDialog(onDismiss: () -> Unit, onSave: (com.example.kultura.data.Car) -> Unit) {
    var model by remember { mutableStateOf("") }
    var owner by remember { mutableStateOf("") }
    var plate by remember { mutableStateOf("") }
    var zone by remember { mutableStateOf("") }
    var contact by remember { mutableStateOf("") }
    var status by remember { mutableStateOf("Înscris") }
    var errorMessage by remember { mutableStateOf<String?>(null) }

    AlertDialog(
        onDismissRequest = onDismiss,
        properties = DialogProperties(usePlatformDefaultWidth = false),
        modifier = Modifier.fillMaxWidth().padding(24.dp),
        content = {
            GlassCard(shape = RoundedCornerShape(28.dp)) {
                Column(modifier = Modifier.padding(16.dp).verticalScroll(rememberScrollState())) {
                    Text("Adaugă Mașină Nouă", color = TextPrimary, fontSize = 22.sp, fontWeight = FontWeight.Black)
                    Spacer(modifier = Modifier.height(24.dp))
                    
                    if (errorMessage != null) {
                        Text(errorMessage!!, color = StatusRed, fontSize = 12.sp, modifier = Modifier.padding(bottom = 8.dp))
                    }

                    OutlinedTextField(
                        value = model, onValueChange = { model = it; errorMessage = null },
                        label = { Text("Model Mașină") },
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(12.dp),
                        colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = PrimaryBlue, unfocusedBorderColor = GlassBorder, focusedTextColor = TextPrimary, unfocusedTextColor = TextPrimary)
                    )
                    Spacer(modifier = Modifier.height(12.dp))
                    
                    OutlinedTextField(
                        value = owner, onValueChange = { owner = it },
                        label = { Text("Nume Proprietar") },
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(12.dp),
                        colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = PrimaryBlue, unfocusedBorderColor = GlassBorder, focusedTextColor = TextPrimary, unfocusedTextColor = TextPrimary)
                    )
                    Spacer(modifier = Modifier.height(12.dp))

                    OutlinedTextField(
                        value = plate, onValueChange = { plate = it },
                        label = { Text("Număr Înmatriculare") },
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(12.dp),
                        colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = PrimaryBlue, unfocusedBorderColor = GlassBorder, focusedTextColor = TextPrimary, unfocusedTextColor = TextPrimary)
                    )
                    Spacer(modifier = Modifier.height(12.dp))

                    OutlinedTextField(
                        value = zone, onValueChange = { zone = it },
                        label = { Text("Zonă") },
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(12.dp),
                        colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = PrimaryBlue, unfocusedBorderColor = GlassBorder, focusedTextColor = TextPrimary, unfocusedTextColor = TextPrimary)
                    )
                    Spacer(modifier = Modifier.height(12.dp))

                    OutlinedTextField(
                        value = contact, onValueChange = { contact = it },
                        label = { Text("Nr de contact") },
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(12.dp),
                        colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = PrimaryBlue, unfocusedBorderColor = GlassBorder, focusedTextColor = TextPrimary, unfocusedTextColor = TextPrimary),
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Phone)
                    )
                    Spacer(modifier = Modifier.height(24.dp))
                    
                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.End) {
                        TextButton(onClick = onDismiss) { Text("Anulează", color = TextSecondary) }
                        Spacer(modifier = Modifier.width(16.dp))
                        
                        var isSaving by remember { mutableStateOf(false) }
                        
                        Button(
                            onClick = { 
                                when {
                                    model.isBlank() -> errorMessage = "Modelul este obligatoriu"
                                    owner.isBlank() -> errorMessage = "Numele proprietarului este obligatoriu"
                                    plate.isBlank() -> errorMessage = "Numărul de înmatriculare este obligatoriu"
                                    else -> {
                                        isSaving = true
                                        onSave(com.example.kultura.data.Car(
                                            model = model, 
                                            owner = owner, 
                                            plate = plate, 
                                            zone = zone, 
                                            contact = contact,
                                            status = status, 
                                            statusColor = "#1E69FF"
                                        ))
                                    }
                                }
                            },
                            enabled = !isSaving,
                            colors = ButtonDefaults.buttonColors(containerColor = PrimaryBlue),
                            shape = RoundedCornerShape(12.dp)
                        ) {
                            if (isSaving) {
                                CircularProgressIndicator(modifier = Modifier.size(20.dp), color = Color.White, strokeWidth = 2.dp)
                            } else {
                                Text("Salvează", fontWeight = FontWeight.Bold)
                            }
                        }
                    }
                }
            }
        }
    )
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

    val repository = remember { SupabaseRepository() }
    val authRepository = remember { AuthRepository() }
    val allCars by repository.getCarsFlow().collectAsState(initial = emptyList())
    val scope = rememberCoroutineScope()
    var showDeleteAllDialog by remember { mutableStateOf(false) }
    var isDeleting by remember { mutableStateOf(false) }
    var deleteError by remember { mutableStateOf<String?>(null) }
    val currentEmail = authRepository.currentUserEmail ?: "—"

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(BackgroundDark)
            .verticalScroll(rememberScrollState())
            .padding(16.dp)
    ) {
        ProfileHeader(name = currentEmail, role = "Administrator")
        
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
        
        Spacer(modifier = Modifier.height(24.dp))

        // ZONĂ PERICULOASĂ
        Text("ZONĂ PERICULOASĂ", color = StatusRed, fontSize = 12.sp, fontWeight = FontWeight.Bold)
        Spacer(modifier = Modifier.height(8.dp))
        Card(
            modifier = Modifier.fillMaxWidth(),
            colors = CardDefaults.cardColors(containerColor = CardBackground),
            shape = RoundedCornerShape(12.dp),
            border = androidx.compose.foundation.BorderStroke(1.dp, StatusRed.copy(alpha = 0.3f))
        ) {
            Column(modifier = Modifier.padding(horizontal = 16.dp, vertical = 12.dp)) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clickable(enabled = !isDeleting) { showDeleteAllDialog = true }
                        .padding(vertical = 8.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Surface(modifier = Modifier.size(36.dp), shape = RoundedCornerShape(8.dp), color = StatusRed.copy(alpha = 0.15f)) {
                        Box(contentAlignment = Alignment.Center) {
                            Icon(Icons.Default.DeleteForever, contentDescription = null, tint = StatusRed, modifier = Modifier.size(20.dp))
                        }
                    }
                    Spacer(modifier = Modifier.width(16.dp))
                    Column(modifier = Modifier.weight(1f)) {
                        Text("Șterge toate mașinile", color = TextPrimary, fontSize = 15.sp, fontWeight = FontWeight.Bold)
                        Text(
                            if (isDeleting) "Se șterge..."
                            else "${allCars.size} mașini în bază · acțiune ireversibilă",
                            color = TextSecondary,
                            fontSize = 11.sp
                        )
                    }
                    if (isDeleting) {
                        CircularProgressIndicator(color = StatusRed, strokeWidth = 2.dp, modifier = Modifier.size(20.dp))
                    } else {
                        Icon(Icons.Default.ChevronRight, contentDescription = null, tint = StatusRed, modifier = Modifier.size(18.dp))
                    }
                }
                deleteError?.let {
                    Spacer(modifier = Modifier.height(4.dp))
                    Text("Eroare: $it", color = StatusRed, fontSize = 11.sp)
                }
            }
        }

        Spacer(modifier = Modifier.height(16.dp))

        // Logout Button
        Surface(
            modifier = Modifier.fillMaxWidth().height(56.dp).clip(RoundedCornerShape(12.dp))
                .background(StatusRed.copy(alpha = 0.1f))
                .clickable { scope.launch { authRepository.signOut() } },
            color = Color.Transparent
        ) {
            Row(modifier = Modifier.fillMaxSize(), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.Center) {
                Icon(Icons.AutoMirrored.Filled.Logout, contentDescription = null, tint = StatusRed)
                Spacer(modifier = Modifier.width(12.dp))
                Text("Deconectare", color = StatusRed, fontWeight = FontWeight.Bold, fontSize = 16.sp)
            }
        }

        Spacer(modifier = Modifier.height(24.dp))
    }

    if (showDeleteAllDialog) {
        DeleteAllCarsDialog(
            carCount = allCars.size,
            onDismiss = { showDeleteAllDialog = false },
            onConfirm = {
                showDeleteAllDialog = false
                isDeleting = true
                deleteError = null
                scope.launch {
                    repository.deleteAllCars()
                        .onFailure { deleteError = it.message ?: "Ștergerea a eșuat" }
                    isDeleting = false
                }
            }
        )
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun DeleteAllCarsDialog(
    carCount: Int,
    onDismiss: () -> Unit,
    onConfirm: () -> Unit
) {
    AlertDialog(
        onDismissRequest = onDismiss,
        properties = DialogProperties(usePlatformDefaultWidth = false),
        modifier = Modifier.fillMaxWidth().padding(24.dp),
        content = {
            GlassCard(shape = RoundedCornerShape(28.dp)) {
                Column(modifier = Modifier.padding(16.dp)) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Box(
                            modifier = Modifier
                                .size(44.dp)
                                .clip(RoundedCornerShape(12.dp))
                                .background(StatusRed.copy(alpha = 0.15f)),
                            contentAlignment = Alignment.Center
                        ) {
                            Icon(Icons.Default.Warning, contentDescription = null, tint = StatusRed, modifier = Modifier.size(24.dp))
                        }
                        Spacer(modifier = Modifier.width(14.dp))
                        Text("Ești sigur?", color = TextPrimary, fontSize = 20.sp, fontWeight = FontWeight.Black)
                    }

                    Spacer(modifier = Modifier.height(16.dp))

                    Text(
                        text = "Toate cele $carCount mașini din bază vor fi șterse definitiv. Această acțiune nu poate fi anulată.",
                        color = TextSecondary,
                        fontSize = 14.sp,
                        lineHeight = 20.sp
                    )

                    Spacer(modifier = Modifier.height(24.dp))

                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.End) {
                        TextButton(onClick = onDismiss) { Text("Anulează", color = TextSecondary, fontWeight = FontWeight.SemiBold) }
                        Spacer(modifier = Modifier.width(8.dp))
                        Button(
                            onClick = onConfirm,
                            colors = ButtonDefaults.buttonColors(containerColor = StatusRed),
                            shape = RoundedCornerShape(12.dp)
                        ) {
                            Icon(Icons.Default.DeleteForever, contentDescription = null, modifier = Modifier.size(18.dp))
                            Spacer(modifier = Modifier.width(6.dp))
                            Text("Șterge tot", fontWeight = FontWeight.Bold)
                        }
                    }
                }
            }
        }
    )
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
