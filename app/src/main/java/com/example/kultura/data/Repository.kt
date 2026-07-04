package com.example.kultura.data

import io.github.jan.supabase.annotations.SupabaseExperimental
import io.github.jan.supabase.postgrest.from
import io.github.jan.supabase.realtime.realtime
import io.github.jan.supabase.realtime.selectAsFlow
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.flow.flowOf

class SupabaseRepository {
    
    @OptIn(SupabaseExperimental::class)
    fun getCarsFlow(): Flow<List<Car>> {
        return try {
            supabase.from("cars").selectAsFlow(Car::id)
                .catch { e -> 
                    println("Supabase Flow Error (Cars): ${e.message}")
                    emit(emptyList()) 
                }
        } catch (e: Exception) {
            println("Supabase Repository Error (Cars): ${e.message}")
            flowOf(emptyList())
        }
    }

    @OptIn(SupabaseExperimental::class)
    fun getTasksFlow(): Flow<List<Task>> {
        return try {
            supabase.from("tasks").selectAsFlow(Task::id)
                .catch { e -> 
                    println("Supabase Flow Error (Tasks): ${e.message}")
                    emit(emptyList()) 
                }
        } catch (e: Exception) {
            println("Supabase Repository Error (Tasks): ${e.message}")
            flowOf(emptyList())
        }
    }

    @OptIn(SupabaseExperimental::class)
    fun getEventsFlow(): Flow<List<Event>> {
        return try {
            supabase.from("events").selectAsFlow(Event::id)
                .catch { e ->
                    println("Supabase Flow Error (Events): ${e.message}")
                    emit(emptyList())
                }
        } catch (e: Exception) {
            println("Supabase Repository Error (Events): ${e.message}")
            flowOf(emptyList())
        }
    }

    suspend fun addCar(car: Car) {
        try {
            println("Supabase: Inserting car: $car")
            supabase.from("cars").insert(car)
            println("Supabase: Car inserted successfully")
        } catch (e: Exception) {
            println("Supabase ERROR: Failed to insert car")
            e.printStackTrace()
        }
    }

    suspend fun addTask(task: Task) {
        supabase.from("tasks").insert(task)
    }

    suspend fun addEvent(event: Event) {
        supabase.from("events").insert(event)
    }

    suspend fun importCarsFromCsv(csvContent: String) {
        try {
            println("Supabase: Parsing CSV content...")
            val lines = csvContent.lines()
            if (lines.isEmpty()) return
            
            // Skip header if it exists
            val startindex = if (lines[0].contains("Model", ignoreCase = true)) 1 else 0
            
            val carsToInsert = lines.drop(startindex).filter { it.isNotBlank() }.mapNotNull { line ->
                val parts = line.split(",")
                if (parts.size >= 5) {
                    Car(
                        model = parts[0].trim(),
                        owner = parts[1].trim(),
                        plate = parts[2].trim(),
                        zone = parts[3].trim(),
                        status = parts[4].trim(),
                        statusColor = if (parts.size > 5) parts[5].trim() else "#1E69FF",
                        isVip = if (parts.size > 6) parts[6].trim().lowercase() == "true" else false,
                        contact = if (parts.size > 7) parts[7].trim() else ""
                    )
                } else {
                    println("Supabase Warning: Skipping invalid CSV line: $line")
                    null
                }
            }
            
            if (carsToInsert.isNotEmpty()) {
                println("Supabase: Inserting ${carsToInsert.size} cars from CSV...")
                supabase.from("cars").insert(carsToInsert)
                println("Supabase: CSV Import successful")
            } else {
                println("Supabase Info: No valid cars found in CSV")
            }
        } catch (e: Exception) {
            println("Supabase ERROR: CSV Import failed")
            e.printStackTrace()
        }
    }

    fun exportCarsToCsv(cars: List<Car>): String {
        val builder = StringBuilder()
        builder.append("Model,Owner,Plate,Zone,Status,StatusColor,VIP,Contact\n")
        cars.forEach { car ->
            builder.append("${car.model},${car.owner},${car.plate},${car.zone},${car.status},${car.statusColor},${car.isVip},${car.contact ?: ""}\n")
        }
        return builder.toString()
    }
}
