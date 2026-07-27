package vn.edu.dhv.tapattend.data.local

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "offline_scans")
data class OfflineScanEntity(
    @PrimaryKey
    val requestId: String,
    val sessionId: String,
    val cardUid: String,
    val deviceId: String,
    val clientScannedAt: String,
    val syncStatus: String = "PENDING", // PENDING, SYNCED, FAILED
    val createdAt: Long = System.currentTimeMillis()
)
