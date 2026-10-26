package com.billscanner.app.data.db

import androidx.room.*
import com.billscanner.app.data.model.BillRecord
import kotlinx.coroutines.flow.Flow

@Dao
interface BillDao {
    @Query("SELECT * FROM bills ORDER BY timestamp DESC")
    fun getAllBillsFlow(): Flow<List<BillRecord>>

    @Query("SELECT * FROM bills WHERE spreadsheetTargetId = :targetId ORDER BY timestamp DESC")
    fun getBillsForTargetFlow(targetId: Long): Flow<List<BillRecord>>

    @Query("SELECT * FROM bills ORDER BY timestamp DESC LIMIT :limit")
    fun getRecentBillsFlow(limit: Int = 10): Flow<List<BillRecord>>

    @Query("SELECT * FROM bills WHERE id = :id")
    suspend fun getBillById(id: Long): BillRecord?

    @Query("SELECT COUNT(*) FROM bills")
    fun getTotalBillCountFlow(): Flow<Int>

    @Query("SELECT COALESCE(SUM(totalAmount), 0.0) FROM bills")
    fun getTotalExpenseSumFlow(): Flow<Double>

    @Query("SELECT * FROM bills WHERE merchant LIKE '%' || :query || '%' OR notes LIKE '%' || :query || '%' OR category LIKE '%' || :query || '%' ORDER BY timestamp DESC")
    fun searchBills(query: String): Flow<List<BillRecord>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertBill(bill: BillRecord): Long

    @Update
    suspend fun updateBill(bill: BillRecord)

    @Delete
    suspend fun deleteBill(bill: BillRecord)
}
