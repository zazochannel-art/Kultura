package com.example.kultura.data

import com.google.ai.client.generativeai.GenerativeModel
import com.google.ai.client.generativeai.type.content
import com.google.ai.client.generativeai.type.generationConfig
import kotlinx.serialization.json.Json
import org.apache.poi.ss.usermodel.WorkbookFactory
import java.io.InputStream

class AiRepository {

    // Placeholder for API Key - user should provide this
    private val apiKey = "YOUR_GEMINI_API_KEY"
    
    private val model = GenerativeModel(
        modelName = "gemini-1.5-flash",
        apiKey = apiKey,
        generationConfig = generationConfig {
            responseMimeType = "application/json"
        }
    )

    private val json = Json { 
        ignoreUnknownKeys = true
        coerceInputValues = true
    }

    suspend fun parseCarsFromText(text: String): List<Car> {
        if (apiKey == "YOUR_GEMINI_API_KEY") {
            println("AI ERROR: Gemini API Key is missing!")
            return emptyList()
        }

        val prompt = """
            Extract car details from the following data. 
            Return a JSON array of objects with these fields:
            - model (String, e.g. "BMW M4")
            - owner (String, e.g. "Ion Popescu")
            - plate (String, e.g. "B 123 ABC")
            - zone (String, e.g. "Zonă A")
            - status (String, e.g. "Confirmat" or "În așteptare")
            - status_color (String, HEX color e.g. "#1E69FF")
            - is_vip (Boolean)
            - contact (String, optional)

            Data:
            $text
        """.trimIndent()

        return try {
            val response = model.generateContent(prompt)
            val jsonString = response.text ?: "[]"
            json.decodeFromString<List<Car>>(jsonString)
        } catch (e: Exception) {
            println("AI ERROR: Parsing failed: ${e.message}")
            e.printStackTrace()
            emptyList()
        }
    }

    fun extractTextFromExcel(inputStream: InputStream): String {
        return try {
            val workbook = WorkbookFactory.create(inputStream)
            val sheet = workbook.getSheetAt(0)
            val builder = StringBuilder()
            
            for (row in sheet) {
                for (cell in row) {
                    builder.append(cell.toString()).append(" | ")
                }
                builder.append("\n")
            }
            workbook.close()
            builder.toString()
        } catch (e: Exception) {
            println("EXCEL ERROR: ${e.message}")
            ""
        }
    }
}
