package com.billscanner.app.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import com.billscanner.app.data.model.DestinationType
import com.billscanner.app.data.model.SpreadsheetTarget
import com.billscanner.app.ui.theme.ExcelGreen
import com.billscanner.app.ui.theme.GoogleSheetsGreen
import java.text.SimpleDateFormat
import java.util.*

sealed interface DestinationChoice {
    data class AppendToExisting(val target: SpreadsheetTarget) : DestinationChoice
    data class CreateNewExcel(val fileName: String, val setAsDefault: Boolean) : DestinationChoice
    data class CreateNewGoogleSheet(val title: String, val setAsDefault: Boolean) : DestinationChoice
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun DestinationSelectionDialog(
    activeTarget: SpreadsheetTarget?,
    existingTargets: List<SpreadsheetTarget>,
    defaultSuggestedName: String = "Bills_${SimpleDateFormat("yyyy_MM", Locale.getDefault()).format(Date())}",
    onConfirm: (DestinationChoice) -> Unit,
    onDismiss: () -> Unit
) {
    var selectedMode by remember {
        mutableStateOf(
            if (activeTarget != null) "APPEND" else "NEW_EXCEL"
        )
    }
    val computedSuggestedName = remember(existingTargets) {
        val base = "Bills_${SimpleDateFormat("yyyy_MM", Locale.getDefault()).format(Date())}"
        val existingNames = existingTargets.map { it.name.lowercase() }
        var candidate = base
        var counter = 1
        while (existingNames.contains("$candidate.xlsx".lowercase()) || existingNames.contains(candidate.lowercase())) {
            candidate = "${base}_$counter"
            counter++
        }
        candidate
    }

    var newExcelName by remember(computedSuggestedName) { mutableStateOf(computedSuggestedName) }
    var newGoogleSheetTitle by remember(computedSuggestedName) { mutableStateOf(computedSuggestedName) }
    var setAsDefault by remember { mutableStateOf(true) }
    var selectedExistingTarget by remember { mutableStateOf(activeTarget) }

    Dialog(onDismissRequest = onDismiss) {
        Surface(
            shape = RoundedCornerShape(24.dp),
            color = MaterialTheme.colorScheme.surface,
            tonalElevation = 6.dp,
            modifier = Modifier
                .fillMaxWidth()
                .wrapContentHeight()
                .padding(vertical = 16.dp)
        ) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(24.dp)
            ) {
                // Title
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    modifier = Modifier.padding(bottom = 16.dp)
                ) {
                    Icon(
                        imageVector = Icons.Default.Save,
                        contentDescription = null,
                        tint = MaterialTheme.colorScheme.primary,
                        modifier = Modifier.size(28.dp)
                    )
                    Spacer(modifier = Modifier.width(12.dp))
                    Text(
                        text = "Choose Spreadsheet Destination",
                        style = MaterialTheme.typography.titleLarge,
                        fontWeight = FontWeight.Bold
                    )
                }

                Text(
                    text = "Where would you like to store this scanned bill?",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.padding(bottom = 16.dp)
                )

                // Option 1: Continue adding into current active file
                if (activeTarget != null) {
                    val isSelected = selectedMode == "APPEND"
                    Card(
                        colors = CardDefaults.cardColors(
                            containerColor = if (isSelected) MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.6f)
                            else MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.4f)
                        ),
                        shape = RoundedCornerShape(16.dp),
                        modifier = Modifier
                            .fillMaxWidth()
                            .border(
                                width = if (isSelected) 2.dp else 1.dp,
                                color = if (isSelected) MaterialTheme.colorScheme.primary else Color.Transparent,
                                shape = RoundedCornerShape(16.dp)
                            )
                            .clickable { selectedMode = "APPEND" }
                    ) {
                        Column(modifier = Modifier.padding(16.dp)) {
                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.SpaceBetween,
                                modifier = Modifier.fillMaxWidth()
                            ) {
                                Row(verticalAlignment = Alignment.CenterVertically) {
                                    Icon(
                                        imageVector = if (activeTarget.type == DestinationType.LOCAL_EXCEL) Icons.Default.Description else Icons.Default.Cloud,
                                        contentDescription = null,
                                        tint = if (activeTarget.type == DestinationType.LOCAL_EXCEL) ExcelGreen else GoogleSheetsGreen,
                                        modifier = Modifier.size(22.dp)
                                    )
                                    Spacer(modifier = Modifier.width(8.dp))
                                    Text(
                                        text = "Add to Current File",
                                        fontWeight = FontWeight.Bold,
                                        style = MaterialTheme.typography.titleMedium
                                    )
                                }
                                RadioButton(
                                    selected = isSelected,
                                    onClick = { selectedMode = "APPEND" }
                                )
                            }
                            Spacer(modifier = Modifier.height(4.dp))
                            Text(
                                text = activeTarget.name,
                                fontWeight = FontWeight.SemiBold,
                                style = MaterialTheme.typography.bodyLarge,
                                color = MaterialTheme.colorScheme.primary
                            )
                            Text(
                                text = "${activeTarget.type.displayName} • Currently has ${activeTarget.billCount} bills • Appending as row #${activeTarget.billCount + 1}",
                                style = MaterialTheme.typography.bodyMedium,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                        }
                    }

                    Spacer(modifier = Modifier.height(12.dp))
                }

                // Option 2: Create a New Excel File (.xlsx)
                val isNewExcel = selectedMode == "NEW_EXCEL"
                Card(
                    colors = CardDefaults.cardColors(
                        containerColor = if (isNewExcel) MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.6f)
                        else MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.4f)
                    ),
                    shape = RoundedCornerShape(16.dp),
                    modifier = Modifier
                        .fillMaxWidth()
                        .border(
                            width = if (isNewExcel) 2.dp else 1.dp,
                            color = if (isNewExcel) MaterialTheme.colorScheme.primary else Color.Transparent,
                            shape = RoundedCornerShape(16.dp)
                        )
                        .clickable { selectedMode = "NEW_EXCEL" }
                ) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.SpaceBetween,
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Icon(
                                    imageVector = Icons.Default.AddCircleOutline,
                                    contentDescription = null,
                                    tint = ExcelGreen,
                                    modifier = Modifier.size(22.dp)
                                )
                                Spacer(modifier = Modifier.width(8.dp))
                                Text(
                                    text = "Make a New Excel File (.xlsx)",
                                    fontWeight = FontWeight.Bold,
                                    style = MaterialTheme.typography.titleMedium
                                )
                            }
                            RadioButton(
                                selected = isNewExcel,
                                onClick = { selectedMode = "NEW_EXCEL" }
                            )
                        }

                        if (isNewExcel) {
                            Spacer(modifier = Modifier.height(10.dp))
                            OutlinedTextField(
                                value = newExcelName,
                                onValueChange = { newExcelName = it },
                                label = { Text("Excel File Name") },
                                singleLine = true,
                                trailingIcon = { Text(".xlsx", modifier = Modifier.padding(end = 12.dp), color = Color.Gray) },
                                modifier = Modifier.fillMaxWidth()
                            )
                        }
                    }
                }

                Spacer(modifier = Modifier.height(12.dp))

                // Option 3: Create a New Google Sheet
                val isNewGoogleSheet = selectedMode == "NEW_GOOGLE_SHEET"
                Card(
                    colors = CardDefaults.cardColors(
                        containerColor = if (isNewGoogleSheet) MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.6f)
                        else MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.4f)
                    ),
                    shape = RoundedCornerShape(16.dp),
                    modifier = Modifier
                        .fillMaxWidth()
                        .border(
                            width = if (isNewGoogleSheet) 2.dp else 1.dp,
                            color = if (isNewGoogleSheet) MaterialTheme.colorScheme.primary else Color.Transparent,
                            shape = RoundedCornerShape(16.dp)
                        )
                        .clickable { selectedMode = "NEW_GOOGLE_SHEET" }
                ) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.SpaceBetween,
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Icon(
                                    imageVector = Icons.Default.CloudQueue,
                                    contentDescription = null,
                                    tint = GoogleSheetsGreen,
                                    modifier = Modifier.size(22.dp)
                                )
                                Spacer(modifier = Modifier.width(8.dp))
                                Text(
                                    text = "Make a New Google Sheet",
                                    fontWeight = FontWeight.Bold,
                                    style = MaterialTheme.typography.titleMedium
                                )
                            }
                            RadioButton(
                                selected = isNewGoogleSheet,
                                onClick = { selectedMode = "NEW_GOOGLE_SHEET" }
                            )
                        }

                        if (isNewGoogleSheet) {
                            Spacer(modifier = Modifier.height(10.dp))
                            OutlinedTextField(
                                value = newGoogleSheetTitle,
                                onValueChange = { newGoogleSheetTitle = it },
                                label = { Text("Google Sheet Title") },
                                singleLine = true,
                                modifier = Modifier.fillMaxWidth()
                            )
                        }
                    }
                }

                // Checkbox: Keep as default for future scans
                if (isNewExcel || isNewGoogleSheet) {
                    Spacer(modifier = Modifier.height(8.dp))
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        modifier = Modifier.clickable { setAsDefault = !setAsDefault }
                    ) {
                        Checkbox(
                            checked = setAsDefault,
                            onCheckedChange = { setAsDefault = it }
                        )
                        Spacer(modifier = Modifier.width(4.dp))
                        Text(
                            text = "Set as active destination for subsequent scans",
                            style = MaterialTheme.typography.bodyMedium
                        )
                    }
                }

                Spacer(modifier = Modifier.height(20.dp))

                // Action Buttons
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.End
                ) {
                    TextButton(onClick = onDismiss) {
                        Text("Cancel")
                    }
                    Spacer(modifier = Modifier.width(8.dp))
                    Button(
                        onClick = {
                            when (selectedMode) {
                                "APPEND" -> {
                                    if (activeTarget != null) {
                                        onConfirm(DestinationChoice.AppendToExisting(activeTarget))
                                    }
                                }
                                "NEW_EXCEL" -> {
                                    val name = newExcelName.trim().ifEmpty { defaultSuggestedName }
                                    onConfirm(DestinationChoice.CreateNewExcel(name, setAsDefault))
                                }
                                "NEW_GOOGLE_SHEET" -> {
                                    val title = newGoogleSheetTitle.trim().ifEmpty { defaultSuggestedName }
                                    onConfirm(DestinationChoice.CreateNewGoogleSheet(title, setAsDefault))
                                }
                            }
                        },
                        colors = ButtonDefaults.buttonColors(
                            containerColor = MaterialTheme.colorScheme.primary
                        )
                    ) {
                        Text("Confirm & Save")
                    }
                }
            }
        }
    }
}
