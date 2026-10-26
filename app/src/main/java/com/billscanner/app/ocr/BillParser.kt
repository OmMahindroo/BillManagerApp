package com.billscanner.app.ocr

import com.billscanner.app.data.model.BillCategory
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.regex.Pattern

object BillParser {

    private val DATE_PATTERNS = listOf(
        // YYYY-MM-DD or YYYY/MM/DD
        Pattern.compile("\\b(\\d{4}[-/.]\\d{1,2}[-/.]\\d{1,2})\\b"),
        // DD/MM/YYYY or DD-MM-YYYY or DD.MM.YYYY
        Pattern.compile("\\b(\\d{1,2}[-/.]\\d{1,2}[-/.]\\d{4})\\b"),
        // DD-Mon-YYYY (e.g. 15-Jan-2026, 15 Jan 2026)
        Pattern.compile("\\b(\\d{1,2}[-\\s](?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*[-\\s]\\d{2,4})\\b", Pattern.CASE_INSENSITIVE),
        // Mon DD, YYYY (e.g. Jan 15, 2026)
        Pattern.compile("\\b((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\\s+\\d{1,2},?\\s+\\d{4})\\b", Pattern.CASE_INSENSITIVE)
    )

    private val TOTAL_KEYWORDS = listOf(
        "grand total", "net amount", "amount payable", "total amount",
        "total payable", "net payable", "balance due", "amount due",
        "total due", "final total", "bill total", "total:"
    )

    private val SUBTOTAL_KEYWORDS = listOf(
        "subtotal", "sub total", "sub-total", "item total", "items total", "items subtotal"
    )

    private val TAX_KEYWORDS = listOf(
        "total tax", "tax amount", "cgst", "sgst", "igst", "gst", "vat", "sales tax", "tax:"
    )

    private val INVOICE_PATTERNS = listOf(
        Pattern.compile("(?:invoice|bill|receipt|order|tax\\s*invoice)\\s*(?:no|num|number|id|code|ref|reference|#)?[:.\\s-]*([a-zA-Z0-9/-]+)", Pattern.CASE_INSENSITIVE),
        Pattern.compile("\\b(?:inv|bill|rcpt)[\\s.:#-]*([a-zA-Z0-9/-]{3,})\\b", Pattern.CASE_INSENSITIVE)
    )

    private val AMOUNT_PATTERN = Pattern.compile("(?:[\\$₹€£]|(?:rs\\.?|inr|usd|eur)\\s*)?([0-9]{1,3}(?:,[0-9]{3})*(?:\\s*[.,]\\s*[0-9]{2})|[0-9]+(?:\\s*[.,]\\s*[0-9]{2})?)")

    fun parse(rawText: String): ParsedBillData {
        val lines = rawText.lines()
            .map { it.trim() }
            .filter { it.isNotEmpty() }

        if (lines.isEmpty()) {
            val today = SimpleDateFormat("yyyy-MM-dd", Locale.getDefault()).format(Date())
            return ParsedBillData(date = today, rawText = rawText)
        }

        val notes = mutableListOf<String>()
        val merchant = extractMerchant(lines)
        val date = extractDate(lines) ?: SimpleDateFormat("yyyy-MM-dd", Locale.getDefault()).format(Date())
        val invoiceNumber = extractInvoiceNumber(lines)
        val (totalAmount, totalFoundWithKeyword) = extractTotalAmount(lines)
        val tax = extractTaxAmount(lines, totalAmount)
        val explicitSubtotal = extractSubtotal(lines)
        val subtotal = if (explicitSubtotal > 0.0) {
            explicitSubtotal
        } else if (totalAmount > tax && tax > 0.0) {
            totalAmount - tax
        } else {
            0.0
        }
        val category = BillCategory.detectCategory(rawText)

        if (totalFoundWithKeyword) {
            notes.add("Total detected from label")
        } else if (totalAmount > 0.0) {
            notes.add("Total estimated from prominent figure")
        }

        return ParsedBillData(
            merchant = merchant,
            date = date,
            invoiceNumber = invoiceNumber,
            subtotal = subtotal,
            tax = tax,
            totalAmount = totalAmount,
            category = category,
            rawText = rawText,
            confidenceNotes = notes
        )
    }

    private fun extractMerchant(lines: List<String>): String {
        // Merchant is almost always one of the top 3 non-empty lines
        for (i in 0 until minOf(4, lines.size)) {
            val line = lines[i]
            // Skip lines that look like dates, invoice numbers, or web URLs
            if (line.matches(Regex(".*(http|www\\.|@|tax invoice|cash receipt|welcome).*|^[0-9/.:\\s-]+$"))) {
                continue
            }
            // Clean up unwanted noise
            val cleaned = line.replace(Regex("[^a-zA-Z0-9 &.,'-]"), "").trim()
            if (cleaned.length in 3..40) {
                return cleaned
            }
        }
        return lines.firstOrNull()?.take(30) ?: "Store / Vendor"
    }

    private fun extractDate(lines: List<String>): String? {
        // Priority 1: Lines explicitly marked with 'date:', 'bill date:', 'invoice date:'
        for (line in lines) {
            val lower = line.lowercase()
            if (lower.contains("scan timestamp") || lower.contains("timestamp") || lower.contains("printed")) {
                continue
            }
            if (lower.contains("date") || lower.contains("dated")) {
                for (pattern in DATE_PATTERNS) {
                    val matcher = pattern.matcher(line)
                    if (matcher.find()) {
                        val rawDate = matcher.group(1) ?: continue
                        val normalized = normalizeDate(rawDate)
                        if (normalized != null) return normalized
                    }
                }
            }
        }

        // Priority 2: Any line that is NOT a scan timestamp
        for (line in lines) {
            val lower = line.lowercase()
            if (lower.contains("scan timestamp") || lower.contains("timestamp")) {
                continue
            }
            for (pattern in DATE_PATTERNS) {
                val matcher = pattern.matcher(line)
                if (matcher.find()) {
                    val rawDate = matcher.group(1) ?: continue
                    val normalized = normalizeDate(rawDate)
                    if (normalized != null) return normalized
                }
            }
        }

        // Priority 3: Fallback to any line
        for (line in lines) {
            for (pattern in DATE_PATTERNS) {
                val matcher = pattern.matcher(line)
                if (matcher.find()) {
                    val rawDate = matcher.group(1) ?: continue
                    val normalized = normalizeDate(rawDate)
                    if (normalized != null) return normalized
                }
            }
        }
        return null
    }

    private fun normalizeDate(dateStr: String): String? {
        val formats = listOf(
            "yyyy-MM-dd", "yyyy/MM/dd", "yyyy.MM.dd",
            "dd/MM/yyyy", "dd-MM-yyyy", "dd.MM.yyyy",
            "MM/dd/yyyy", "MM-dd-yyyy",
            "dd MMM yyyy", "dd-MMM-yyyy", "MMM dd, yyyy", "MMMM dd, yyyy"
        )
        val cleaned = dateStr.replace(",", "").trim()
        for (fmt in formats) {
            try {
                val sdf = SimpleDateFormat(fmt, Locale.US)
                sdf.isLenient = false
                val parsed = sdf.parse(cleaned)
                if (parsed != null) {
                    val outSdf = SimpleDateFormat("yyyy-MM-dd", Locale.US)
                    return outSdf.format(parsed)
                }
            } catch (_: Exception) {}
        }
        return dateStr
    }

    private fun extractInvoiceNumber(lines: List<String>): String {
        for (line in lines) {
            for (pattern in INVOICE_PATTERNS) {
                val matcher = pattern.matcher(line)
                if (matcher.find()) {
                    val num = matcher.group(1)?.trim() ?: continue
                    // Skip false matches like "ID", "NO", "NUM"
                    if (num.length in 2..30 &&
                        !num.equals("id", ignoreCase = true) &&
                        !num.equals("no", ignoreCase = true) &&
                        !num.equals("num", ignoreCase = true) &&
                        !num.equals("number", ignoreCase = true)
                    ) {
                        return num
                    }
                }
            }
        }
        return ""
    }

    private fun extractSubtotal(lines: List<String>): Double {
        for (i in lines.indices) {
            val line = lines[i]
            val lower = line.lowercase()
            for (keyword in SUBTOTAL_KEYWORDS) {
                if (lower.contains(keyword)) {
                    val amount = findLargestAmountInLine(line)
                    if (amount != null && amount > 0.0) return amount
                    if (i + 1 < lines.size) {
                        val nextAmount = findLargestAmountInLine(lines[i + 1])
                        if (nextAmount != null && nextAmount > 0.0) return nextAmount
                    }
                }
            }
        }
        return 0.0
    }

    private val CURRENCY_REGEX = Pattern.compile("(?i)(?:[\\$₹€£]|(?:rs\\.?|inr|usd|eur|cad|aud)\\s*)([0-9]{1,3}(?:,[0-9]{3})*(?:\\s*[.,]\\s*[0-9]{2})|[0-9]+(?:\\s*[.,]\\s*[0-9]{2})?|[0-9]+)")
    private val DECIMAL_AMOUNT_REGEX = Pattern.compile("(?<![0-9])([0-9]{1,3}(?:,[0-9]{3})*\\.[0-9]{2}|[0-9]+\\.[0-9]{2})(?![0-9])")

    private fun isNonAmountLine(line: String): Boolean {
        val lower = line.lowercase()
        return lower.contains("invoice") ||
                lower.contains("bill no") ||
                lower.contains("order no") ||
                lower.contains("order id") ||
                lower.contains("receipt no") ||
                lower.contains("receipt id") ||
                lower.contains("date:") ||
                lower.contains("dated:") ||
                lower.contains("scan timestamp") ||
                lower.contains("timestamp") ||
                lower.contains("phone") ||
                lower.contains("tel:") ||
                lower.contains("tel ") ||
                lower.contains("gstin") ||
                lower.contains("pin:") ||
                lower.contains("zip:") ||
                lower.contains("table ") ||
                lower.matches(Regex("^[0-9]{5,}\\s*$"))
    }

    private fun extractTotalAmount(lines: List<String>): Pair<Double, Boolean> {
        // Priority 1: Check lines with explicit keywords (reverse order so final totals take precedence)
        for (i in lines.indices.reversed()) {
            val line = lines[i]
            val lower = line.lowercase()

            // Strict keywords
            for (keyword in TOTAL_KEYWORDS) {
                if (lower.contains(keyword)) {
                    val amount = findLargestAmountInLine(line, preferCurrency = true)
                    if (amount != null && amount > 0.0) {
                        return Pair(amount, true)
                    }
                    // Multi-column OCR: check next line if not a metadata line
                    if (i + 1 < lines.size && !isNonAmountLine(lines[i + 1])) {
                        val nextAmount = findLargestAmountInLine(lines[i + 1], preferCurrency = true)
                        if (nextAmount != null && nextAmount > 0.0) {
                            return Pair(nextAmount, true)
                        }
                    }
                    if (i - 1 >= 0 && !isNonAmountLine(lines[i - 1])) {
                        val prevAmount = findLargestAmountInLine(lines[i - 1], preferCurrency = true)
                        if (prevAmount != null && prevAmount > 0.0) {
                            return Pair(prevAmount, true)
                        }
                    }
                }
            }

            // Word 'total' alone (avoid 'subtotal')
            if (Regex("\\btotal\\b", RegexOption.IGNORE_CASE).containsMatchIn(line) &&
                !line.contains("subtotal", ignoreCase = true)
            ) {
                val amount = findLargestAmountInLine(line, preferCurrency = true)
                if (amount != null && amount > 0.0) {
                    return Pair(amount, true)
                }
                if (i + 1 < lines.size && !isNonAmountLine(lines[i + 1])) {
                    val nextAmount = findLargestAmountInLine(lines[i + 1], preferCurrency = true)
                    if (nextAmount != null && nextAmount > 0.0) {
                        return Pair(nextAmount, true)
                    }
                }
            }
        }

        // Priority 2: Prominent amounts with explicit currency symbol across the entire receipt
        var maxCurrencyAmount = 0.0
        for (line in lines) {
            if (isNonAmountLine(line)) continue
            val currAmount = findCurrencySymbolAmount(line)
            if (currAmount != null && currAmount > maxCurrencyAmount && currAmount < 100000.0) {
                maxCurrencyAmount = currAmount
            }
        }
        if (maxCurrencyAmount > 0.0) {
            return Pair(maxCurrencyAmount, false)
        }

        // Priority 3: Check lines 0..3 near top for any monetary figures with currency symbol
        for (i in 0 until minOf(4, lines.size)) {
            val line = lines[i]
            if (isNonAmountLine(line)) continue
            val amount = findLargestAmountInLine(line, preferCurrency = true)
            if (amount != null && amount > 0.0) {
                return Pair(amount, true)
            }
        }

        // Priority 4: Fallback to numbers with decimals (.XX) under $10,000 on valid non-metadata lines
        var maxDecimalAmount = 0.0
        for (line in lines) {
            if (isNonAmountLine(line)) continue
            val amount = findDecimalAmount(line)
            if (amount != null && amount > maxDecimalAmount && amount < 10000.0) {
                maxDecimalAmount = amount
            }
        }

        return Pair(maxDecimalAmount, false)
    }

    private fun extractTaxAmount(lines: List<String>, totalAmount: Double): Double {
        var totalTax = 0.0
        for (i in lines.indices) {
            val line = lines[i]
            val lower = line.lowercase()
            if (lower.contains("tax invoice") || lower.contains("tax bill") || lower.contains("invoice id")) continue

            val isTaxLine = TAX_KEYWORDS.any { lower.contains(it) } || Regex("\\btax\\b", RegexOption.IGNORE_CASE).containsMatchIn(line)
            if (isTaxLine) {
                var amount = findLargestAmountInLine(line, preferCurrency = true)
                if (amount == null && i + 1 < lines.size && !isNonAmountLine(lines[i + 1])) {
                    amount = findLargestAmountInLine(lines[i + 1], preferCurrency = true)
                }
                if (amount != null && amount > 0.0 && amount < 100000.0) {
                    if (totalAmount > 0.0 && amount >= totalAmount) {
                        continue
                    }
                    if (lower.contains("cgst") || lower.contains("sgst") || lower.contains("igst")) {
                        totalTax += amount
                    } else if (lower.contains("total tax") || lower.contains("tax") || lower.contains("vat") || lower.contains("gst")) {
                        if (totalTax == 0.0) {
                            totalTax = amount
                        }
                    }
                }
            }
        }
        return totalTax
    }

    private fun findCurrencySymbolAmount(line: String): Double? {
        val normalized = line.replace(Regex("([\\$₹€£]|rs\\.?|inr|usd|eur)\\s*(\\d+)\\s*([.,])\\s*(\\d{2})\\b", RegexOption.IGNORE_CASE), "$1$2.$4")
            .replace(Regex("([\\$₹€£]|rs\\.?|inr|usd|eur)\\s*(\\d+)", RegexOption.IGNORE_CASE), "$1$2")
        val sanitized = normalized.replace(Regex("\\(?\\d+(?:\\.\\d+)?%\\)?"), " ")
        val matcher = CURRENCY_REGEX.matcher(sanitized)
        var maxVal: Double? = null
        while (matcher.find()) {
            val numStr = matcher.group(1)?.replace(",", "")?.replace(" ", "") ?: continue
            val value = numStr.toDoubleOrNull() ?: continue
            if (value > 0.0 && value < 1000000.0) {
                if (maxVal == null || value > maxVal) {
                    maxVal = value
                }
            }
        }
        return maxVal
    }

    private fun findDecimalAmount(line: String): Double? {
        val normalized = line.replace(Regex("(\\d+)\\s*([.,])\\s*(\\d{2})\\b"), "$1.$3")
        val sanitized = normalized.replace(Regex("\\(?\\d+(?:\\.\\d+)?%\\)?"), " ")
        val matcher = DECIMAL_AMOUNT_REGEX.matcher(sanitized)
        var maxVal: Double? = null
        while (matcher.find()) {
            val numStr = matcher.group(1)?.replace(",", "") ?: continue
            val value = numStr.toDoubleOrNull() ?: continue
            if (value > 0.0 && value < 100000.0) {
                if (maxVal == null || value > maxVal) {
                    maxVal = value
                }
            }
        }
        return maxVal
    }

    private fun findLargestAmountInLine(line: String, preferCurrency: Boolean = false): Double? {
        // 1. First priority: Numbers explicitly with a currency symbol ($95.00, ₹1200)
        val curr = findCurrencySymbolAmount(line)
        if (curr != null) return curr

        // 2. Second priority: Numbers with explicit 2-decimal formatting (95.00)
        val dec = findDecimalAmount(line)
        if (dec != null) return dec

        // 3. Third priority: If line has financial keywords, allow a plain integer under 5,000
        val lower = line.lowercase()
        val hasKw = TOTAL_KEYWORDS.any { lower.contains(it) } || lower.contains("total") || lower.contains("subtotal") || lower.contains("tax")
        if (hasKw) {
            val matcher = Pattern.compile("\\b(\\d{1,4})\\b").matcher(line)
            var maxInt: Double? = null
            while (matcher.find()) {
                val v = matcher.group(1)?.toDoubleOrNull() ?: continue
                if (v in 1.0..5000.0 && v !in 2020.0..2030.0) { // reject year numbers
                    if (maxInt == null || v > maxInt) maxInt = v
                }
            }
            return maxInt
        }

        return null
    }
}
