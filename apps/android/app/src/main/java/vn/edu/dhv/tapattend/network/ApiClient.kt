package vn.edu.dhv.tapattend.network

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject
import java.util.UUID

class ApiClient {
    private val client = OkHttpClient()
    private val JSON = "application/json; charset=utf-8".toMediaType()

    suspend fun submitNfcScan(
        baseUrl: String,
        sessionId: String,
        cardUidHex: String
    ): Result<String> = withContext(Dispatchers.IO) {
        try {
            // Trim trailing slashes from baseUrl
            val cleanBaseUrl = baseUrl.trimEnd('/')
            val endpoint = "$cleanBaseUrl/api/nfc/scans"

            val jsonBody = JSONObject().apply {
                put("sessionId", sessionId)
                put("cardUid", cardUidHex)
                put("deviceId", "ANDROID_SCANNER_01")
                put("requestId", UUID.randomUUID().toString())
                put("source", "ANDROID_NFC")
            }

            val request = Request.Builder()
                .url(endpoint)
                .post(jsonBody.toString().toRequestBody(JSON))
                .build()

            client.newCall(request).execute().use { response ->
                val responseBody = response.body?.string() ?: ""
                
                if (response.isSuccessful) {
                    val jsonResponse = JSONObject(responseBody)
                    if (jsonResponse.optBoolean("success", false)) {
                        Result.success(jsonResponse.optString("message", "Thành công"))
                    } else {
                        Result.failure(Exception(jsonResponse.optString("message", "Lỗi từ server")))
                    }
                } else {
                    Result.failure(Exception("HTTP ${response.code}: $responseBody"))
                }
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
}
