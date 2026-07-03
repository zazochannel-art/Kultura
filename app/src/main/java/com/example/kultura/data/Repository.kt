package com.example.kultura.data

import io.github.jan.supabase.annotations.SupabaseExperimental
import io.github.jan.supabase.postgrest.from
import io.github.jan.supabase.realtime.realtime
import io.github.jan.supabase.realtime.selectAsFlow
import kotlinx.coroutines.flow.Flow

class SupabaseRepository {
    
    @OptIn(SupabaseExperimental::class)
    fun getCarsFlow(): Flow<List<Car>> {
        return supabase.from("cars").selectAsFlow(Car::id)
    }

    @OptIn(SupabaseExperimental::class)
    fun getTasksFlow(): Flow<List<Task>> {
        return supabase.from("tasks").selectAsFlow(Task::id)
    }

    suspend fun addCar(car: Car) {
        supabase.from("cars").insert(car)
    }

    suspend fun addTask(task: Task) {
        supabase.from("tasks").insert(task)
    }
}
