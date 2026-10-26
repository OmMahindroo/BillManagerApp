package com.billscanner.app.ocr

import com.billscanner.app.data.model.BillCategory

data class ParsedBillData(
    val merchant: String = "",
    val date: String = "",
    val invoiceNumber: String = "",
    val subtotal: Double = 0.0,
    val tax: Double = 0.0,
    val totalAmount: Double = 0.0,
    val category: BillCategory = BillCategory.OTHER,
    val rawText: String = "",
    val confidenceNotes: List<String> = emptyList()
)
