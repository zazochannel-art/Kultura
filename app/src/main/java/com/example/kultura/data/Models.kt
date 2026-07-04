package com.example.kultura.data

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

@Serializable
data class Car(
    val id: Int? = null,
    val model: String,
    val owner: String,
    val plate: String,
    val zone: String,
    val contact: String? = null,
    val status: String,
    @SerialName("status_color")
    val statusColor: String, // Hex string
    @SerialName("is_vip")
    val isVip: Boolean = false
)

@Serializable
data class Task(
    val id: Int? = null,
    val title: String,
    val event: String,
    val date: String,
    val status: String,
    @SerialName("status_color")
    val statusColor: String, // Hex string
    @SerialName("is_completed")
    val isCompleted: Boolean = false
)

@Serializable
data class Event(
    val id: Int? = null,
    val title: String,
    val subtitle: String? = null,
    val date: String,
    val location: String? = null,
    val status: String = "Planificat",
    @SerialName("status_color")
    val statusColor: String = "#3B82F6",
    @SerialName("days_left")
    val daysLeft: Int? = null
)
