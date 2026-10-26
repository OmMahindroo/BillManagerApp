package com.billscanner.app.ocr

import android.content.Context
import android.graphics.Bitmap
import android.net.Uri
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.text.TextRecognition
import com.google.mlkit.vision.text.latin.TextRecognizerOptions
import kotlinx.coroutines.tasks.await
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

class TextRecognizerHelper(private val context: Context) {

    private val recognizer = TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS)

    suspend fun recognizeFromUri(imageUri: Uri): ParsedBillData = withContext(Dispatchers.IO) {
        try {
            val image = InputImage.fromFilePath(context, imageUri)
            val result = recognizer.process(image).await()
            val rawText = reconstructLinesByPosition(result)
            BillParser.parse(rawText)
        } catch (e: Exception) {
            e.printStackTrace()
            ParsedBillData(rawText = "Failed to recognize text: ${e.localizedMessage}")
        }
    }

    suspend fun recognizeFromBitmap(bitmap: Bitmap): ParsedBillData = withContext(Dispatchers.IO) {
        try {
            val image = InputImage.fromBitmap(bitmap, 0)
            val result = recognizer.process(image).await()
            val rawText = reconstructLinesByPosition(result)
            BillParser.parse(rawText)
        } catch (e: Exception) {
            e.printStackTrace()
            ParsedBillData(rawText = "Failed to recognize text: ${e.localizedMessage}")
        }
    }

    private fun reconstructLinesByPosition(result: com.google.mlkit.vision.text.Text): String {
        val lines = result.textBlocks.flatMap { it.lines }
        if (lines.isEmpty()) return result.text

        val sortedLines = lines.sortedBy { it.boundingBox?.top ?: 0 }
        val rows = mutableListOf<MutableList<com.google.mlkit.vision.text.Text.Line>>()

        for (line in sortedLines) {
            val box = line.boundingBox
            if (box == null) {
                rows.add(mutableListOf(line))
                continue
            }
            val centerY = (box.top + box.bottom) / 2
            val matchingRow = rows.firstOrNull { row ->
                val rowFirstBox = row.firstOrNull()?.boundingBox ?: return@firstOrNull false
                val rowCenterY = (rowFirstBox.top + rowFirstBox.bottom) / 2
                val threshold = (rowFirstBox.height() * 0.75).toInt().coerceAtLeast(15)
                Math.abs(centerY - rowCenterY) <= threshold
            }

            if (matchingRow != null) {
                matchingRow.add(line)
            } else {
                rows.add(mutableListOf(line))
            }
        }

        val reconstructed = rows.joinToString("\n") { row ->
            row.sortedBy { it.boundingBox?.left ?: 0 }
                .joinToString(" ") { it.text.trim() }
        }

        return reconstructed.ifEmpty { result.text }
    }
}
