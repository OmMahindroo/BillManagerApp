package com.billscanner.app.data.model

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "spreadsheet_targets")
data class SpreadsheetTarget(
    @PrimaryKey(autoGenerate = true)
    val id: Long = 0,
    val name: String,
    val type: DestinationType,
    val localFilePath: String? = null,
    val googleSpreadsheetId: String? = null,
    val googleSpreadsheetUrl: String? = null,
    val billCount: Int = 0,
    val totalAmountSum: Double = 0.0,
    val isActiveDefault: Boolean = false,
    val createdAt: Long = System.currentTimeMillis(),
    val updatedAt: Long = System.currentTimeMillis()
)
