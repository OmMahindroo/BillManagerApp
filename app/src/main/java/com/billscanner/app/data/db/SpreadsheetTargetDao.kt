package com.billscanner.app.data.db

import androidx.room.*
import com.billscanner.app.data.model.DestinationType
import com.billscanner.app.data.model.SpreadsheetTarget
import kotlinx.coroutines.flow.Flow

@Dao
interface SpreadsheetTargetDao {
    @Query("SELECT * FROM spreadsheet_targets ORDER BY updatedAt DESC")
    fun getAllTargetsFlow(): Flow<List<SpreadsheetTarget>>

    @Query("SELECT * FROM spreadsheet_targets ORDER BY updatedAt DESC")
    suspend fun getAllTargets(): List<SpreadsheetTarget>

    @Query("SELECT * FROM spreadsheet_targets WHERE type = :type ORDER BY updatedAt DESC")
    fun getTargetsByTypeFlow(type: DestinationType): Flow<List<SpreadsheetTarget>>

    @Query("SELECT * FROM spreadsheet_targets WHERE isActiveDefault = 1 LIMIT 1")
    fun getActiveDefaultTargetFlow(): Flow<SpreadsheetTarget?>

    @Query("SELECT * FROM spreadsheet_targets WHERE isActiveDefault = 1 LIMIT 1")
    suspend fun getActiveDefaultTarget(): SpreadsheetTarget?

    @Query("SELECT * FROM spreadsheet_targets WHERE id = :id")
    suspend fun getTargetById(id: Long): SpreadsheetTarget?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertTarget(target: SpreadsheetTarget): Long

    @Update
    suspend fun updateTarget(target: SpreadsheetTarget)

    @Query("UPDATE spreadsheet_targets SET isActiveDefault = 0")
    suspend fun clearActiveDefaults()

    @Transaction
    suspend fun setActiveTarget(targetId: Long) {
        clearActiveDefaults()
        setActiveTargetById(targetId)
    }

    @Query("UPDATE spreadsheet_targets SET isActiveDefault = 1 WHERE id = :targetId")
    suspend fun setActiveTargetById(targetId: Long)

    @Query("UPDATE spreadsheet_targets SET billCount = billCount + 1, totalAmountSum = totalAmountSum + :amount, updatedAt = :updatedAt WHERE id = :targetId")
    suspend fun incrementBillCountAndSum(targetId: Long, amount: Double, updatedAt: Long = System.currentTimeMillis())

    @Delete
    suspend fun deleteTarget(target: SpreadsheetTarget)
}
