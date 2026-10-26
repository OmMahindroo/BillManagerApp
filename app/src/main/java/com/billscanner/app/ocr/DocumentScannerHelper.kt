package com.billscanner.app.ocr

import android.app.Activity
import android.content.Context
import android.content.IntentSender
import android.net.Uri
import com.google.mlkit.vision.documentscanner.GmsDocumentScanner
import com.google.mlkit.vision.documentscanner.GmsDocumentScannerOptions
import com.google.mlkit.vision.documentscanner.GmsDocumentScanning
import com.google.mlkit.vision.documentscanner.GmsDocumentScanningResult
import kotlinx.coroutines.tasks.await

class DocumentScannerHelper(private val context: Context) {

    private val scannerOptions: GmsDocumentScannerOptions = GmsDocumentScannerOptions.Builder()
        .setGalleryImportAllowed(true)
        .setPageLimit(1)
        .setResultFormats(GmsDocumentScannerOptions.RESULT_FORMAT_JPEG)
        .setScannerMode(GmsDocumentScannerOptions.SCANNER_MODE_FULL)
        .build()

    private val scanner: GmsDocumentScanner = GmsDocumentScanning.getClient(scannerOptions)

    suspend fun getStartScanIntentSender(activity: Activity): IntentSender {
        return scanner.getStartScanIntent(activity).await()
    }

    fun extractScannedImageUri(result: GmsDocumentScanningResult?): Uri? {
        return result?.pages?.firstOrNull()?.imageUri
    }
}
