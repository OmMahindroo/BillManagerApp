package com.billscanner.app.data.model

import androidx.room.Entity
import androidx.room.ForeignKey
import androidx.room.Index
import androidx.room.PrimaryKey

@Entity(
    tableName = "bills",
    foreignKeys = [
        ForeignKey(
            entity = SpreadsheetTarget::class,
            parentColumns = ["id"],
            childColumns = ["spreadsheetTargetId"],
            onDelete = ForeignKey.SET_NULL
        )
    ],
    indices = [
        Index(value = ["spreadsheetTargetId"]),
        Index(value = ["date"]),
        Index(value = ["category"])
    ]
)
data class BillRecord(
    @PrimaryKey(autoGenerate = true)
    val id: Long = 0,
    val merchant: String,
    val date: String,
    val invoiceNumber: String = "",
    val category: String = BillCategory.OTHER.title,
    val subtotal: Double = 0.0,
    val tax: Double = 0.0,
    val totalAmount: Double = 0.0,
    val paymentMethod: String = "Card",
    val notes: String = "",
    val imageUri: String? = null,
    val rawOcrText: String? = null,
    val spreadsheetTargetId: Long? = null,
    val spreadsheetRowIndex: Int = 0,
    val timestamp: Long = System.currentTimeMillis()
)
