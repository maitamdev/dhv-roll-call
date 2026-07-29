package vn.edu.dhv.tapattend.data.local

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query

@Dao
interface OfflineScanDao {

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertScan(scan: OfflineScanEntity)

    @Query("SELECT * FROM offline_scans WHERE syncStatus = 'PENDING' ORDER BY createdAt ASC")
    suspend fun getPendingScans(): List<OfflineScanEntity>

    @Query("UPDATE offline_scans SET syncStatus = 'SYNCED' WHERE requestId IN (:requestIds)")
    suspend fun markAsSynced(requestIds: List<String>)

    @Query("UPDATE offline_scans SET syncStatus = 'FAILED' WHERE requestId IN (:requestIds)")
    suspend fun markAsFailed(requestIds: List<String>)

    @Query("DELETE FROM offline_scans WHERE syncStatus = 'SYNCED'")
    suspend fun clearSyncedScans()
}
