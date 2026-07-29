package vn.edu.dhv.tapattend.sync

import android.content.Context
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import vn.edu.dhv.tapattend.data.local.AppDatabase
import vn.edu.dhv.tapattend.network.ApiClient
import vn.edu.dhv.tapattend.security.KeystoreHelper
import java.time.Instant
import java.util.UUID
import java.net.HttpURLConnection
import java.net.URL
import org.json.JSONArray
import org.json.JSONObject

class OfflineScanSyncWorker(
    context: Context,
    workerParams: WorkerParameters
) : CoroutineWorker(context, workerParams) {

    override suspend fun doWork(): Result {
        val dao = AppDatabase.getInstance(applicationContext).offlineScanDao()
        val pendingScans = dao.getPendingScans()

        if (pendingScans.isEmpty()) {
            return Result.success()
        }

        try {
            val jsonArray = JSONArray()
            for (scan in pendingScans) {
                val obj = JSONObject().apply {
                    put("requestId", scan.requestId)
                    put("sessionId", scan.sessionId)
                    put("cardUid", scan.cardUid)
                    put("deviceId", scan.deviceId)
                    put("clientScannedAt", scan.clientScannedAt)
                    put("source", "ANDROID_NFC_OFFLINE")
                    put("offline", true)
                }
                jsonArray.put(obj)
            }

            val payload = JSONObject().apply {
                put("scans", jsonArray)
            }

            val configuredBaseUrl = inputData.getString(BASE_URL_KEY)
                ?.trim()
                ?.trimEnd('/')
                .orEmpty()
            if (configuredBaseUrl.isBlank()) {
                return Result.failure()
            }

            val url = URL("$configuredBaseUrl/api/nfc/scans/batch-sync")
            val conn = (url.openConnection() as HttpURLConnection).apply {
                requestMethod = "POST"
                setRequestProperty("Content-Type", "application/json")
                val timestamp = Instant.now().toString()
                val batchRequestId = UUID.randomUUID().toString()
                val deviceUuid = pendingScans.first().deviceId
                val rawPayload = payload.toString()
                val canonical = "$timestamp\n$batchRequestId\n${ApiClient.sha256(rawPayload)}"
                setRequestProperty("x-device-id", deviceUuid)
                setRequestProperty("x-device-timestamp", timestamp)
                setRequestProperty("x-request-id", batchRequestId)
                setRequestProperty("x-device-signature", KeystoreHelper.signData(canonical))
                doOutput = true
                connectTimeout = 10000
                readTimeout = 10000
            }

            conn.outputStream.use { os ->
                os.write(payload.toString().toByteArray(Charsets.UTF_8))
            }

            if (conn.responseCode in 200..299) {
                val responseBody = conn.inputStream.bufferedReader().use { it.readText() }
                val responseJson = JSONObject(responseBody)
                if (!responseJson.optBoolean("success", false)) {
                    return Result.retry()
                }

                val acceptedIds = mutableListOf<String>()
                val rejectedIds = mutableListOf<String>()
                var hasTransientFailure = false
                val results = responseJson.optJSONArray("results") ?: JSONArray()

                for (index in 0 until results.length()) {
                    val item = results.optJSONObject(index) ?: continue
                    val requestId = item.optString("requestId")
                    when (item.optString("status")) {
                        "SUCCESS", "SKIPPED_DUPLICATE" -> acceptedIds.add(requestId)
                        "CARD_INVALID", "SESSION_NOT_FOUND", "SESSION_CLOSED",
                        "NOT_ENROLLED", "INVALID_PAYLOAD", "FACE_VERIFICATION_REQUIRED",
                        "WRONG_ROOM" -> rejectedIds.add(requestId)
                        else -> hasTransientFailure = true
                    }
                }

                if (acceptedIds.isNotEmpty()) {
                    dao.markAsSynced(acceptedIds)
                    dao.clearSyncedScans()
                }
                if (rejectedIds.isNotEmpty()) {
                    dao.markAsFailed(rejectedIds)
                }

                return if (hasTransientFailure) Result.retry() else Result.success()
            } else {
                return Result.retry()
            }
        } catch (e: Exception) {
            e.printStackTrace()
            return Result.retry()
        }
    }

    companion object {
        const val BASE_URL_KEY = "base_url"
    }
}
