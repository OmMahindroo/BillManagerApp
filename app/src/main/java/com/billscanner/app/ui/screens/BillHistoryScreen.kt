package com.billscanner.app.ui.screens

import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.billscanner.app.data.model.BillCategory
import com.billscanner.app.data.model.BillRecord
import com.billscanner.app.ui.components.BillCard

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun BillHistoryScreen(
    bills: List<BillRecord>,
    onBillClick: (BillRecord) -> Unit,
    onDeleteBill: (BillRecord) -> Unit
) {
    var searchQuery by remember { mutableStateOf("") }
    var selectedCategory by remember { mutableStateOf<String?>("All") }
    var billToDelete by remember { mutableStateOf<BillRecord?>(null) }

    val filteredBills = remember(bills, searchQuery, selectedCategory) {
        bills.filter { bill ->
            val matchesQuery = searchQuery.isEmpty() ||
                    bill.merchant.contains(searchQuery, ignoreCase = true) ||
                    bill.invoiceNumber.contains(searchQuery, ignoreCase = true) ||
                    bill.notes.contains(searchQuery, ignoreCase = true)
            val matchesCategory = selectedCategory == "All" || bill.category.equals(selectedCategory, ignoreCase = true)
            matchesQuery && matchesCategory
        }
    }

    val totalFilteredSum = remember(filteredBills) {
        filteredBills.sumOf { it.totalAmount }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Bill History", fontWeight = FontWeight.Bold) }
            )
        }
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
        ) {
            // Search Input
            OutlinedTextField(
                value = searchQuery,
                onValueChange = { searchQuery = it },
                placeholder = { Text("Search by merchant, invoice #, notes...") },
                leadingIcon = { Icon(Icons.Default.Search, contentDescription = null) },
                trailingIcon = {
                    if (searchQuery.isNotEmpty()) {
                        IconButton(onClick = { searchQuery = "" }) {
                            Icon(Icons.Default.Close, contentDescription = "Clear")
                        }
                    }
                },
                singleLine = true,
                shape = RoundedCornerShape(14.dp),
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp, vertical = 8.dp)
            )

            // Category Filter Chips
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .horizontalScroll(rememberScrollState())
                    .padding(horizontal = 16.dp, vertical = 4.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                FilterChip(
                    selected = selectedCategory == "All",
                    onClick = { selectedCategory = "All" },
                    label = { Text("All (${bills.size})") }
                )
                BillCategory.entries.forEach { cat ->
                    val count = bills.count { it.category.equals(cat.title, ignoreCase = true) }
                    if (count > 0 || cat != BillCategory.OTHER) {
                        FilterChip(
                            selected = selectedCategory == cat.title,
                            onClick = { selectedCategory = cat.title },
                            label = { Text("${cat.title} ($count)") }
                        )
                    }
                }
            }

            // Summary Header
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween,
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp, vertical = 8.dp)
            ) {
                Text(
                    text = "${filteredBills.size} bills found",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
                Text(
                    text = String.format(java.util.Locale.US, "Sum: $%.2f", totalFilteredSum),
                    style = MaterialTheme.typography.bodyMedium,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.primary
                )
            }

            // Bills List
            if (filteredBills.isEmpty()) {
                Box(
                    contentAlignment = Alignment.Center,
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(32.dp)
                ) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Icon(
                            imageVector = Icons.Default.ReceiptLong,
                            contentDescription = null,
                            tint = MaterialTheme.colorScheme.onSurfaceVariant,
                            modifier = Modifier.size(56.dp)
                        )
                        Spacer(modifier = Modifier.height(12.dp))
                        Text(
                            text = "No matching bills found",
                            style = MaterialTheme.typography.titleMedium,
                            fontWeight = FontWeight.Bold
                        )
                    }
                }
            } else {
                LazyColumn(
                    contentPadding = PaddingValues(horizontal = 16.dp, vertical = 8.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp),
                    modifier = Modifier.fillMaxSize()
                ) {
                    items(filteredBills, key = { it.id }) { bill ->
                        BillCard(
                            bill = bill,
                            onClick = { onBillClick(bill) }
                        )
                    }
                }
            }
        }
    }
}
