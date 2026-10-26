package com.billscanner.app.ui.screens

import android.app.DatePickerDialog
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.rememberAsyncImagePainter
import com.billscanner.app.data.model.BillCategory
import com.billscanner.app.data.model.BillRecord
import java.util.Calendar

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun BillReviewScreen(
    bill: BillRecord,
    onBillChange: (BillRecord) -> Unit,
    onSaveClick: () -> Unit,
    onDiscardClick: () -> Unit
) {
    val context = LocalContext.current
    val scrollState = rememberScrollState()

    var merchant by remember(bill) { mutableStateOf(bill.merchant) }
    var date by remember(bill) { mutableStateOf(bill.date) }
    var invoiceNumber by remember(bill) { mutableStateOf(bill.invoiceNumber) }
    var category by remember(bill) { mutableStateOf(bill.category) }
    var totalAmountStr by remember(bill) { mutableStateOf(if (bill.totalAmount > 0) bill.totalAmount.toString() else "") }
    var taxStr by remember(bill) { mutableStateOf(if (bill.tax > 0) bill.tax.toString() else "") }
    var subtotalStr by remember(bill) { mutableStateOf(if (bill.subtotal > 0) bill.subtotal.toString() else "") }
    var paymentMethod by remember(bill) { mutableStateOf(bill.paymentMethod) }
    var notes by remember(bill) { mutableStateOf(bill.notes) }

    var categoryDropdownExpanded by remember { mutableStateOf(false) }
    val paymentMethods = listOf("Card", "UPI", "Cash", "Bank Transfer", "Other")

    fun updateParent() {
        val total = totalAmountStr.toDoubleOrNull() ?: 0.0
        val tax = taxStr.toDoubleOrNull() ?: 0.0
        val sub = subtotalStr.toDoubleOrNull() ?: 0.0
        onBillChange(
            bill.copy(
                merchant = merchant,
                date = date,
                invoiceNumber = invoiceNumber,
                category = category,
                totalAmount = total,
                tax = tax,
                subtotal = sub,
                paymentMethod = paymentMethod,
                notes = notes
            )
        )
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Review Scanned Bill", fontWeight = FontWeight.Bold) },
                navigationIcon = {
                    IconButton(onClick = onDiscardClick) {
                        Icon(Icons.Default.ArrowBack, contentDescription = "Back")
                    }
                },
                actions = {
                    TextButton(onClick = onDiscardClick) {
                        Text("Discard", color = MaterialTheme.colorScheme.error)
                    }
                }
            )
        },
        bottomBar = {
            Surface(
                shadowElevation = 8.dp,
                color = MaterialTheme.colorScheme.surface
            ) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(16.dp),
                    horizontalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    OutlinedButton(
                        onClick = onDiscardClick,
                        shape = RoundedCornerShape(12.dp),
                        modifier = Modifier.weight(1f)
                    ) {
                        Text("Cancel")
                    }
                    Button(
                        onClick = {
                            updateParent()
                            onSaveClick()
                        },
                        shape = RoundedCornerShape(12.dp),
                        colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.primary),
                        modifier = Modifier.weight(1.5f)
                    ) {
                        Icon(Icons.Default.Save, contentDescription = null, modifier = Modifier.size(18.dp))
                        Spacer(modifier = Modifier.width(8.dp))
                        Text("Save to Excel / Sheets")
                    }
                }
            }
        }
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .padding(horizontal = 16.dp)
                .verticalScroll(scrollState),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            // Receipt Thumbnail preview
            if (bill.imageUri != null) {
                Card(
                    shape = RoundedCornerShape(16.dp),
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(180.dp)
                ) {
                    Image(
                        painter = rememberAsyncImagePainter(bill.imageUri),
                        contentDescription = "Scanned Bill Preview",
                        contentScale = ContentScale.Crop,
                        modifier = Modifier.fillMaxSize()
                    )
                }
            }

            Text(
                text = "Verify & Edit Details",
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold
            )

            // Merchant / Store
            OutlinedTextField(
                value = merchant,
                onValueChange = {
                    merchant = it
                    updateParent()
                },
                label = { Text("Store / Merchant Name *") },
                leadingIcon = { Icon(Icons.Default.Storefront, contentDescription = null) },
                singleLine = true,
                modifier = Modifier.fillMaxWidth()
            )

            // Date Picker Row
            OutlinedTextField(
                value = date,
                onValueChange = {
                    date = it
                    updateParent()
                },
                label = { Text("Date (YYYY-MM-DD) *") },
                leadingIcon = { Icon(Icons.Default.CalendarToday, contentDescription = null) },
                trailingIcon = {
                    IconButton(onClick = {
                        val cal = Calendar.getInstance()
                        DatePickerDialog(
                            context,
                            { _, y, m, d ->
                                date = String.format(java.util.Locale.US, "%04d-%02d-%02d", y, m + 1, d)
                                updateParent()
                            },
                            cal.get(Calendar.YEAR),
                            cal.get(Calendar.MONTH),
                            cal.get(Calendar.DAY_OF_MONTH)
                        ).show()
                    }) {
                        Icon(Icons.Default.EditCalendar, contentDescription = "Pick Date")
                    }
                },
                singleLine = true,
                modifier = Modifier.fillMaxWidth()
            )

            // Total Amount & Tax Row
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                OutlinedTextField(
                    value = totalAmountStr,
                    onValueChange = {
                        totalAmountStr = it
                        updateParent()
                    },
                    label = { Text("Total Amount *") },
                    leadingIcon = { Text("$", fontWeight = FontWeight.Bold, modifier = Modifier.padding(start = 12.dp)) },
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                    singleLine = true,
                    modifier = Modifier.weight(1.2f)
                )

                OutlinedTextField(
                    value = taxStr,
                    onValueChange = {
                        taxStr = it
                        updateParent()
                    },
                    label = { Text("Tax / GST") },
                    leadingIcon = { Text("$", modifier = Modifier.padding(start = 12.dp)) },
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                    singleLine = true,
                    modifier = Modifier.weight(1f)
                )
            }

            // Category Dropdown
            ExposedDropdownMenuBox(
                expanded = categoryDropdownExpanded,
                onExpandedChange = { categoryDropdownExpanded = it }
            ) {
                OutlinedTextField(
                    value = category,
                    onValueChange = {},
                    readOnly = true,
                    label = { Text("Category") },
                    leadingIcon = { Icon(Icons.Default.Category, contentDescription = null) },
                    trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = categoryDropdownExpanded) },
                    modifier = Modifier
                        .menuAnchor()
                        .fillMaxWidth()
                )

                ExposedDropdownMenu(
                    expanded = categoryDropdownExpanded,
                    onDismissRequest = { categoryDropdownExpanded = false }
                ) {
                    BillCategory.entries.forEach { cat ->
                        DropdownMenuItem(
                            text = { Text(cat.title) },
                            onClick = {
                                category = cat.title
                                categoryDropdownExpanded = false
                                updateParent()
                            }
                        )
                    }
                }
            }

            // Invoice / Bill Number
            OutlinedTextField(
                value = invoiceNumber,
                onValueChange = {
                    invoiceNumber = it
                    updateParent()
                },
                label = { Text("Invoice / Receipt Number") },
                leadingIcon = { Icon(Icons.Default.Tag, contentDescription = null) },
                singleLine = true,
                modifier = Modifier.fillMaxWidth()
            )

            // Payment Method Chips
            Column {
                Text(
                    text = "Payment Method",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
                Spacer(modifier = Modifier.height(6.dp))
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    paymentMethods.forEach { method ->
                        FilterChip(
                            selected = paymentMethod == method,
                            onClick = {
                                paymentMethod = method
                                updateParent()
                            },
                            label = { Text(method, fontSize = 12.sp) }
                        )
                    }
                }
            }

            // Notes
            OutlinedTextField(
                value = notes,
                onValueChange = {
                    notes = it
                    updateParent()
                },
                label = { Text("Notes / Item Summary") },
                leadingIcon = { Icon(Icons.Default.Notes, contentDescription = null) },
                maxLines = 3,
                modifier = Modifier.fillMaxWidth()
            )

            Spacer(modifier = Modifier.height(32.dp))
        }
    }
}
