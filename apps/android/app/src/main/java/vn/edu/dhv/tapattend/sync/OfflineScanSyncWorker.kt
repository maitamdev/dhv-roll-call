package vn.edu.dhv.tapattend.sync

import android.content.Context
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import vn.edu.dhv.tapattend.data.local.AppDatabase
import java.net.HttpURLConnection
import java.net.URL
import org.json.JSONArray
import org.json.JSONObject

class OfflineScanSyncWorker(
    context: Context,
    workerParams: WorkerParameters
) : CoroutineWorker(context, workerParams) {

    override suspend doWork(): Result {
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

            // POST to /api/nfc/scans/batch-sync
            val url = URL("https://dhv-tap-attend.vercel.app/api/nfc/scans/batch-sync")
            val conn = (url.openConnection() as HttpURLConnection).apply {
                requestMethod = "POST"
                setRequestProperty("Content-Type", "application/json")
                doOutput = true
                connectTimeout = 10000
                readTimeout = 10000
            }

            conn.outputStream.use { os ->
                os.write(payload.toString().toByteArray(Charsets.UTF_8))
            }

            if (conn.responseCode in 200..299) {
                val syncedIds = pendingScans.map { it.requestId }
                dao.markAsSynced(syncedIds)
                dao.clearSyncedScans()
                return Result.success()
            } else {
                return Result.retry()
            }
        } catch (e: Exception) {
            e.printStackTrace()
            return Result.retry()
        }
    }
}
