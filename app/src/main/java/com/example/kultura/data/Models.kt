package com.example.kultura.data

import kotlinx.serialization.Serializable

@Serializable
data class Car(
    val id: Int? = null,
    val model: String,
    val owner: String,
    val plate: String,
    val zone: String,
    val status: String,
    val statusColor: String, // Hex string
    val isVip: Boolean = false
)

@Serializable
data class Task(
    val id: Int? = null,
    val title: String,
    val event: String,
    val date: String,
    val status: String,
    val statusColor: String, // Hex string
    val isCompleted: Boolean = false
)
