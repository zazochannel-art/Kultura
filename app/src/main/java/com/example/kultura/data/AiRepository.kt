package com.example.kultura.data

import com.example.kultura.BuildConfig
import io.ktor.client.HttpClient
import io.ktor.client.call.body
import io.ktor.client.engine.okhttp.OkHttp
import io.ktor.client.plugins.HttpTimeout
import io.ktor.client.plugins.contentnegotiation.ContentNegotiation
import io.ktor.client.request.header
import io.ktor.client.request.post
import io.ktor.client.request.setBody
import io.ktor.client.statement.HttpResponse
import io.ktor.client.statement.bodyAsText
import io.ktor.http.ContentType
import io.ktor.http.contentType
import io.ktor.http.isSuccess
import io.ktor.serialization.kotlinx.json.json
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import org.apache.poi.ss.usermodel.WorkbookFactory
import java.io.InputStream

class AiRepository {

    private val apiKey: String = BuildConfig.GEMINI_API_KEY

    val isConfigured: Boolean get() = apiKey.isNotBlank()

    private val json = Json {
        ignoreUnknownKeys = true
        coerceInputValues = true
        isLenient = true
    }

    private val http by lazy {
        HttpClient(OkHttp) {
            install(ContentNegotiation) { json(json) }
            install(HttpTimeout) {
                // Gemini 2.5-flash with reasoning can take >60s on ~30KB inputs.
                requestTimeoutMillis = 180_000
                connectTimeoutMillis = 15_000
                socketTimeoutMillis = 180_000
            }
        }
    }

    suspend fun parseCarsFromText(text: String): Result<List<Car>> {
        if (!isConfigured) {
            return Result.failure(
                IllegalStateException(
                    "Cheia Gemini lipsește. Adaug-o în local.properties ca gemini.api.key=..."
                )
            )
        }

        val prompt = """
            Extract car details from the following text.
            Return ONLY a raw JSON array (no markdown fences, no prose) whose items have these fields:
            - model         (string)
            - owner         (string)
            - plate         (string)
            - zone          (string)
            - status        (string, one of: "Confirmat", "În așteptare", "Respins", "Înscris")
            - status_color  (string, HEX like "#10B981" green for Confirmat, "#3B82F6" blue for În așteptare, "#EF4444" red for Respins, "#F59E0B" orange otherwise)
            - is_vip        (boolean)
            - contact       (string, optional; empty string if unknown)

            Text:
            $text
        """.trimIndent()

        val requestBody = GeminiRequest(
            contents = listOf(
                GeminiContent(parts = listOf(GeminiPart(text = prompt)))
            ),
            generationConfig = GeminiGenerationConfig(
                responseMimeType = "application/json",
                // Disable reasoning: this is a data-extraction task, not a puzzle.
                // Cuts response time dramatically on 2.5-flash.
                thinkingConfig = GeminiThinkingConfig(thinkingBudget = 0)
            )
        )

        // Key goes into a header so it doesn't leak into ktor's URL log lines.
        val endpoint =
            "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent"

        return try {
            val response: HttpResponse = http.post(endpoint) {
                contentType(ContentType.Application.Json)
                header("x-goog-api-key", apiKey)
                setBody(requestBody)
            }

            if (!response.status.isSuccess()) {
                return Result.failure(
                    RuntimeException("Gemini API ${response.status.value}: ${response.bodyAsText().take(240)}")
                )
            }

            val payload: GeminiResponse = response.body()
            val raw = payload.candidates.firstOrNull()
                ?.content?.parts?.firstOrNull()?.text
                ?: return Result.failure(RuntimeException("Răspuns AI gol"))

            val cleaned = raw.trim()
                .removePrefix("```json").removePrefix("```")
                .removeSuffix("```")
                .trim()

            val cars = json.decodeFromString<List<Car>>(cleaned)
            Result.success(cars)
        } catch (e: Exception) {
            e.printStackTrace()
            Result.failure(e)
        }
    }

    fun extractTextFromExcel(inputStream: InputStream): String {
        return try {
            WorkbookFactory.create(inputStream).use { workbook ->
                val builder = StringBuilder()
                val sheet = workbook.getSheetAt(0)
                for (row in sheet) {
                    for (cell in row) {
                        builder.append(cell.toString()).append(" | ")
                    }
                    builder.append("\n")
                }
                builder.toString()
            }
        } catch (e: Exception) {
            e.printStackTrace()
            ""
        }
    }
}

@Serializable
private data class GeminiRequest(
    val contents: List<GeminiContent>,
    @SerialName("generationConfig") val generationConfig: GeminiGenerationConfig
)

@Serializable
private data class GeminiContent(val parts: List<GeminiPart>)

@Serializable
private data class GeminiPart(val text: String)

@Serializable
private data class GeminiGenerationConfig(
    @SerialName("responseMimeType") val responseMimeType: String,
    @SerialName("thinkingConfig") val thinkingConfig: GeminiThinkingConfig? = null
)

@Serializable
private data class GeminiThinkingConfig(
    @SerialName("thinkingBudget") val thinkingBudget: Int
)

@Serializable
private data class GeminiResponse(val candidates: List<GeminiCandidate> = emptyList())

@Serializable
private data class GeminiCandidate(val content: GeminiContent? = null)
