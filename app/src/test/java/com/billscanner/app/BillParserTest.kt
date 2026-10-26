package com.billscanner.app

import com.billscanner.app.data.model.BillCategory
import com.billscanner.app.ocr.BillParser
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class BillParserTest {

    @Test
    fun testParseGroceryReceipt() {
        val receiptText = """
            WHOLE FOODS MARKET
            Store #1024 - 450 Main St
            Tel: (555) 123-4567
            Date: 2026-08-14  15:42
            Receipt #: REC-98762

            Organic Milk 1L       $4.50
            Sourdough Bread       $5.20
            Avocado 3pk           $3.99
            Almond Butter         $8.99

            SUBTOTAL             $22.68
            TAX (8.25%)           $1.87
            TOTAL                $24.55

            Cash Tendered        $30.00
            Change                $5.45
            Thank you for shopping!
        """.trimIndent()

        val parsed = BillParser.parse(receiptText)

        assertEquals("WHOLE FOODS MARKET", parsed.merchant)
        assertEquals("2026-08-14", parsed.date)
        assertEquals("REC-98762", parsed.invoiceNumber)
        assertEquals(24.55, parsed.totalAmount, 0.01)
        assertEquals(1.87, parsed.tax, 0.01)
        assertEquals(BillCategory.GROCERIES, parsed.category)
    }

    @Test
    fun testParseRestaurantBillWithGST() {
        val receiptText = """
            SPICE BISTRO & KITCHEN
            Tax Invoice: INV-2026/0491
            Date: 15/09/2026
            Table 4, Server: Raj

            Paneer Tikka           320.00
            Garlic Naan (3)        180.00
            Dal Makhani            290.00
            Mocktail Pitcher       350.00

            Sub Total             1140.00
            CGST (2.5%)             28.50
            SGST (2.5%)             28.50
            NET PAYABLE          1197.00

            Payment Mode: UPI
            Visit again soon!
        """.trimIndent()

        val parsed = BillParser.parse(receiptText)

        assertTrue(parsed.merchant.contains("SPICE BISTRO", ignoreCase = true))
        assertEquals("2026-09-15", parsed.date)
        assertEquals("INV-2026/0491", parsed.invoiceNumber)
        assertEquals(1197.00, parsed.totalAmount, 0.01)
        assertEquals(57.00, parsed.tax, 0.01) // CGST 28.50 + SGST 28.50
        assertEquals(BillCategory.DINING, parsed.category)
    }

    @Test
    fun testParseFuelInvoice() {
        val receiptText = """
            SHELL AUTO REFUEL STATION
            Bill No: SH-55412
            Date: 04-Jul-2026 09:15
            Pump #02

            Unleaded Petrol (Regular)
            Volume: 18.50 L
            Rate: $3.85 / L

            Total Amount: $71.23
            Card ending in *8892
        """.trimIndent()

        val parsed = BillParser.parse(receiptText)

        assertTrue(parsed.merchant.contains("SHELL", ignoreCase = true))
        assertEquals("2026-07-04", parsed.date)
        assertEquals("SH-55412", parsed.invoiceNumber)
        assertEquals(71.23, parsed.totalAmount, 0.01)
        assertEquals(BillCategory.FUEL_TRAVEL, parsed.category)
    }

    @Test
    fun testParseStationeryReceipt() {
        val receiptText = """
            STATIONERY HUB
            ${'$'}24.75

            Scan Timestamp: 2026-09-22 13:30:00
            Merchant: Stationery Hub
            Date: 15 Sep 2026
            Invoice ID: 8080000097

            Item Name Price
            1 pen pens ${'$'}24.75
            1 pen pens 34.75
            1 notebook ${'$'}34.75
            1 pen, notebook ${'$'}4.75

            Tax ${'$'}34.75
            Total Amount ${'$'}24.75

            Blue printed green receipt
            Date: 15 Sep 2026
            15905060026
        """.trimIndent()

        val parsed = BillParser.parse(receiptText)

        assertEquals("STATIONERY HUB", parsed.merchant)
        assertEquals("2026-09-15", parsed.date)
        assertEquals("8080000097", parsed.invoiceNumber)
        assertEquals(24.75, parsed.totalAmount, 0.01)
        assertEquals(BillCategory.OFFICE, parsed.category)
    }

    @Test
    fun testParseFitnessStudioReceipt() {
        val receiptText = """
            FITNESS STUDIO
            Invoice ID: 2026006
            Date: 20 Sep 2026
            Itemized Price
            Monthly membership fee ${'$'}95.00
            Tax ${'$'}5.00
            Total Amount ${'$'}95.00
        """.trimIndent()

        val parsed = BillParser.parse(receiptText)

        assertEquals("FITNESS STUDIO", parsed.merchant)
        assertEquals("2026-09-20", parsed.date)
        assertEquals("2026006", parsed.invoiceNumber)
        assertEquals(95.00, parsed.totalAmount, 0.01)
        assertEquals(BillCategory.FITNESS, parsed.category)
    }

    @Test
    fun testMultiColumnFitnessStudioReceipt() {
        val receiptText = """
            FITNESS STUDIO
            Invoice ID: 2026006
            Date: 20 Sep 2026
            Itemized
            Monthly membership fee
            Tax
            Total Amount
            Price
            ${'$'}95.00
            ${'$'}5.00
            ${'$'}95.00
        """.trimIndent()

        val parsed = BillParser.parse(receiptText)

        assertEquals("FITNESS STUDIO", parsed.merchant)
        assertEquals("2026-09-20", parsed.date)
        assertEquals("2026006", parsed.invoiceNumber)
        assertEquals(95.00, parsed.totalAmount, 0.01)
    }
}
