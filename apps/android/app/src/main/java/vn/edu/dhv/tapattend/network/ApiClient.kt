package vn.edu.dhv.tapattend.network

import android.os.Build
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject
import vn.edu.dhv.tapattend.security.KeystoreHelper
import java.security.MessageDigest
import java.time.Instant
import java.util.UUID
import java.util.concurrent.TimeUnit

class ApiClient {
    private val client = OkHttpClient.Builder()
        .connectTimeout(10, TimeUnit.SECONDS)
        .readTimeout(20, TimeUnit.SECONDS)
        .build()
    private val jsonMediaType = "application/json; charset=utf-8".toMediaType()

    suspend fun pairDevice(
        baseUrl: String,
        pairingCode: String,
        deviceUuid: String
    ): Result<JSONObject> {
        val body = JSONObject().apply {
            put("pairingCode", pairingCode.trim().uppercase())
            put("deviceUuid", deviceUuid)
            put("publicKey", KeystoreHelper.getPublicKeyPem())
            put("deviceName", "${Build.MANUFACTURER} ${Build.MODEL}")
            put("androidVersion", "Android ${Build.VERSION.RELEASE}")
        }.toString()
        return executeJson("${baseUrl.trimEnd('/')}/api/devices/pair", body, null, null)
    }

    suspend fun submitNfcScan(
        baseUrl: String,
        sessionId: String,
        cardUidHex: String,
        deviceUuid: String
    ): Result<JSONObject> {
        val requestId = UUID.randomUUID().toString()
        val body = JSONObject().apply {
            put("sessionId", sessionId)
            put("cardUid", cardUidHex)
            put("deviceId", deviceUuid)
            put("requestId", requestId)
            put("source", "ANDROID_NFC")
            put("clientScannedAt", Instant.now().toString())
        }.toString()
        return executeJson("${baseUrl.trimEnd('/')}/api/nfc/scans", body, deviceUuid, requestId)
    }

    suspend fun fetchActiveSession(
        baseUrl: String,
        deviceUuid: String
    ): Result<JSONObject> {
        val requestId = UUID.randomUUID().toString()
        val body = JSONObject().apply {
            put("deviceUuid", deviceUuid)
            put("requestedAt", Instant.now().toString())
        }.toString()
        return executeJson(
            "${baseUrl.trimEnd('/')}/api/devices/active-session",
            body,
            deviceUuid,
            requestId
        )
    }

    suspend fun submitFaceVerification(
        baseUrl: String,
        challengeId: String,
        imageDataUrl: String,
        livenessAction: String,
        livenessDurationMs: Long,
        deviceUuid: String
    ): Result<JSONObject> {
        val requestId = UUID.randomUUID().toString()
        val body = JSONObject().apply {
            put("challengeId", challengeId)
            put("image", imageDataUrl)
            put("liveness", JSONObject().apply {
                put("action", livenessAction)
                put("passed", true)
                put("durationMs", livenessDurationMs)
            })
        }.toString()
        return executeJson("${baseUrl.trimEnd('/')}/api/face/verify", body, deviceUuid, requestId)
    }

    private suspend fun executeJson(
        endpoint: String,
        body: String,
        deviceUuid: String?,
        requestId: String?
    ): Result<JSONObject> = withContext(Dispatchers.IO) {
        try {
            val builder = Request.Builder()
                .url(endpoint)
                .post(body.toRequestBody(jsonMediaType))
            if (deviceUuid != null && requestId != null) {
                val timestamp = Instant.now().toString()
                val canonical = "$timestamp\n$requestId\n${sha256(body)}"
                builder.header("x-device-id", deviceUuid)
                    .header("x-device-timestamp", timestamp)
                    .header("x-request-id", requestId)
                    .header("x-device-signature", KeystoreHelper.signData(canonical))
            }
            client.newCall(builder.build()).execute().use { response ->
                val responseBody = response.body?.string().orEmpty()
                val json = try {
                    JSONObject(responseBody)
                } catch (_: Exception) {
                    return@withContext Result.failure(Exception("HTTP ${response.code}: phản hồi không hợp lệ"))
                }
                Result.success(json)
            }
        } catch (error: Exception) {
            Result.failure(error)
        }
    }

    companion object {
        fun sha256(value: String): String {
            return MessageDigest.getInstance("SHA-256")
                .digest(value.toByteArray(Charsets.UTF_8))
                .joinToString("") { "%02x".format(it) }
        }
    }
}
