package com.billscanner.app.ui.screens

import android.widget.Toast
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.selection.SelectionContainer
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.billscanner.app.data.model.DestinationType
import com.billscanner.app.data.model.SpreadsheetTarget
import com.billscanner.app.ui.components.SpreadsheetCard
import com.billscanner.app.ui.theme.ExcelGreen
import com.billscanner.app.ui.theme.GoogleSheetsGreen
import com.google.android.gms.auth.api.signin.GoogleSignInAccount

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SpreadsheetsScreen(
    targets: List<SpreadsheetTarget>,
    googleAccount: GoogleSignInAccount?,
    onGoogleSignInClick: () -> Unit,
    onGoogleSignOutClick: () -> Unit,
    onSetDefault: (SpreadsheetTarget) -> Unit,
    onOpen: (SpreadsheetTarget) -> Unit,
    onShare: (SpreadsheetTarget) -> Unit,
    onExport: (SpreadsheetTarget) -> Unit = {},
    onDelete: (SpreadsheetTarget) -> Unit,
    onCreateNewExcel: (String) -> Unit,
    onCreateNewGoogleSheet: (String) -> Unit
) {
    var selectedTab by remember { mutableStateOf(0) }
    val tabTitles = listOf("All", "Excel (.xlsx)", "Google Sheets")

    var showNewExcelDialog by remember { mutableStateOf(false) }
    var showNewSheetDialog by remember { mutableStateOf(false) }
    var showCloudSetupDialog by remember { mutableStateOf(false) }

    var targetToDelete by remember { mutableStateOf<SpreadsheetTarget?>(null) }

    val filteredTargets = when (selectedTab) {
        1 -> targets.filter { it.type == DestinationType.LOCAL_EXCEL }
        2 -> targets.filter { it.type == DestinationType.GOOGLE_SHEETS }
        else -> targets
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Spreadsheets", fontWeight = FontWeight.Bold) },
                actions = {
                    FilledTonalButton(
                        onClick = { showNewExcelDialog = true },
                        shape = RoundedCornerShape(10.dp),
                        contentPadding = PaddingValues(horizontal = 10.dp, vertical = 4.dp)
                    ) {
                        Icon(Icons.Default.Add, contentDescription = null, modifier = Modifier.size(16.dp))
                        Spacer(modifier = Modifier.width(4.dp))
                        Text("New File", fontSize = 12.sp)
                    }
                }
            )
        }
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
        ) {
            // Google Account Integration Banner
            GoogleAccountBanner(
                account = googleAccount,
                onSignInClick = onGoogleSignInClick,
                onSignOutClick = onGoogleSignOutClick,
                onHelpClick = { showCloudSetupDialog = true }
            )

            // Tabs
            TabRow(selectedTabIndex = selectedTab) {
                tabTitles.forEachIndexed { index, title ->
                    Tab(
                        selected = selectedTab == index,
                        onClick = { selectedTab = index },
                        text = {
                            val count = when (index) {
                                1 -> targets.count { it.type == DestinationType.LOCAL_EXCEL }
                                2 -> targets.count { it.type == DestinationType.GOOGLE_SHEETS }
                                else -> targets.size
                            }
                            Text("$title ($count)")
                        }
                    )
                }
            }

            // Target List
            if (filteredTargets.isEmpty()) {
                Box(
                    contentAlignment = Alignment.Center,
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(32.dp)
                ) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Icon(
                            imageVector = Icons.Default.Description,
                            contentDescription = null,
                            tint = MaterialTheme.colorScheme.onSurfaceVariant,
                            modifier = Modifier.size(64.dp)
                        )
                        Spacer(modifier = Modifier.height(16.dp))
                        Text(
                            text = "No Spreadsheets Found",
                            style = MaterialTheme.typography.titleMedium,
                            fontWeight = FontWeight.Bold
                        )
                        Spacer(modifier = Modifier.height(6.dp))
                        Text(
                            text = "Scan a bill to create your first Excel file or tap 'New File' above.",
                            style = MaterialTheme.typography.bodyMedium,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                }
            } else {
                LazyColumn(
                    modifier = Modifier.fillMaxSize(),
                    contentPadding = PaddingValues(16.dp),
                    verticalArrangement = Arrangement.spacedBy(14.dp)
                ) {
                    items(filteredTargets, key = { it.id }) { target ->
                        SpreadsheetCard(
                            target = target,
                            onSetDefault = { onSetDefault(target) },
                            onOpen = { onOpen(target) },
                            onShare = { onShare(target) },
                            onExport = { onExport(target) },
                            onDelete = { targetToDelete = target }
                        )
                    }
                }
            }
        }
    }

    targetToDelete?.let { target ->
        AlertDialog(
            onDismissRequest = { targetToDelete = null },
            title = { Text("Delete Spreadsheet?") },
            text = { Text("Are you sure you want to delete '${target.name}'? This will remove it from the list.") },
            confirmButton = {
                Button(
                    onClick = {
                        onDelete(target)
                        targetToDelete = null
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.error)
                ) {
                    Text("Delete")
                }
            },
            dismissButton = {
                TextButton(onClick = { targetToDelete = null }) {
                    Text("Cancel")
                }
            }
        )
    }

    // New Excel File Dialog
    if (showNewExcelDialog) {
        var name by remember { mutableStateOf("") }
        AlertDialog(
            onDismissRequest = { showNewExcelDialog = false },
            title = { Text("Create New Excel (.xlsx) File") },
            text = {
                OutlinedTextField(
                    value = name,
                    onValueChange = { name = it },
                    label = { Text("File Name") },
                    placeholder = { Text("e.g. Travel_Expenses_2026") },
                    trailingIcon = { Text(".xlsx", color = Color.Gray, modifier = Modifier.padding(end = 12.dp)) },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth()
                )
            },
            confirmButton = {
                Button(
                    onClick = {
                        val finalName = if (name.trim().isNotEmpty()) name.trim() else "Bills_${System.currentTimeMillis()}"
                        onCreateNewExcel(finalName)
                        showNewExcelDialog = false
                    }
                ) {
                    Text("Create")
                }
            },
            dismissButton = {
                TextButton(onClick = { showNewExcelDialog = false }) {
                    Text("Cancel")
                }
            }
        )
    }

    // New Google Sheet Dialog
    if (showNewSheetDialog) {
        var title by remember { mutableStateOf("") }
        AlertDialog(
            onDismissRequest = { showNewSheetDialog = false },
            title = { Text("Create New Google Sheet") },
            text = {
                OutlinedTextField(
                    value = title,
                    onValueChange = { title = it },
                    label = { Text("Sheet Title") },
                    placeholder = { Text("e.g. Monthly Budget 2026") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth()
                )
            },
            confirmButton = {
                Button(
                    onClick = {
                        val finalTitle = if (title.trim().isNotEmpty()) title.trim() else "Bills_${System.currentTimeMillis()}"
                        onCreateNewGoogleSheet(finalTitle)
                        showNewSheetDialog = false
                    }
                ) {
                    Text("Create in Drive")
                }
            },
            dismissButton = {
                TextButton(onClick = { showNewSheetDialog = false }) {
                    Text("Cancel")
                }
            }
        )
    }

    // Google Cloud Setup Helper Dialog
    if (showCloudSetupDialog) {
        val clipboardManager = LocalClipboardManager.current
        val context = LocalContext.current
        AlertDialog(
            onDismissRequest = { showCloudSetupDialog = false },
            title = {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(Icons.Default.Cloud, contentDescription = null, tint = GoogleSheetsGreen)
                    Spacer(modifier = Modifier.width(8.dp))
                    Text("Google Cloud Sync Guide")
                }
            },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    Text(
                        text = "To sync directly to Google Drive via the Google Sheets API, Google requires adding your app credentials in Google Cloud Console:",
                        style = MaterialTheme.typography.bodySmall
                    )
                    Text("Package: com.billscanner.app", fontWeight = FontWeight.Bold, fontSize = 12.sp)
                    Text("Debug SHA-1 Key:", fontWeight = FontWeight.Bold, fontSize = 12.sp)
                    SelectionContainer {
                        Text(
                            text = "1D:3D:B1:BE:58:48:CE:AA:C3:C0:6E:5B:72:6C:77:C9:A5:2A:41:B6",
                            fontSize = 11.sp,
                            color = MaterialTheme.colorScheme.primary,
                            modifier = Modifier
                                .background(MaterialTheme.colorScheme.surfaceVariant, RoundedCornerShape(6.dp))
                                .padding(8.dp)
                        )
                    }
                    FilledTonalButton(
                        onClick = {
                            clipboardManager.setText(AnnotatedString("1D:3D:B1:BE:58:48:CE:AA:C3:C0:6E:5B:72:6C:77:C9:A5:2A:41:B6"))
                            Toast.makeText(context, "SHA-1 copied to clipboard!", Toast.LENGTH_SHORT).show()
                        },
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Icon(Icons.Default.ContentCopy, contentDescription = null, modifier = Modifier.size(16.dp))
                        Spacer(modifier = Modifier.width(6.dp))
                        Text("Copy SHA-1 to Clipboard", fontSize = 12.sp)
                    }
                    Divider()
                    Text(
                        text = "Tip: You can tap 'Open' or 'Share' on any Excel (.xlsx) file to open and import it into Google Sheets on your phone without any cloud setup!",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            },
            confirmButton = {
                Button(onClick = { showCloudSetupDialog = false }) {
                    Text("Close")
                }
            }
        )
    }
}

@Composable
fun GoogleAccountBanner(
    account: GoogleSignInAccount?,
    onSignInClick: () -> Unit,
    onSignOutClick: () -> Unit,
    onHelpClick: () -> Unit
) {
    Surface(
        color = if (account != null) GoogleSheetsGreen.copy(alpha = 0.1f) else MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f),
        modifier = Modifier.fillMaxWidth()
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween,
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp, vertical = 8.dp)
        ) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                modifier = Modifier.weight(1f)
            ) {
                Icon(
                    imageVector = Icons.Default.Cloud,
                    contentDescription = null,
                    tint = if (account != null) GoogleSheetsGreen else MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.size(20.dp)
                )
                Spacer(modifier = Modifier.width(8.dp))
                Column {
                    Text(
                        text = if (account != null) "Connected: ${account.email}" else "Google Sheets Sync",
                        style = MaterialTheme.typography.bodySmall,
                        fontWeight = FontWeight.SemiBold
                    )
                    Text(
                        text = if (account != null) "Ready for Google Drive" else "Sign in to save directly to Google Sheets",
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }

            Row(verticalAlignment = Alignment.CenterVertically) {
                IconButton(onClick = onHelpClick) {
                    Icon(
                        imageVector = Icons.Default.HelpOutline,
                        contentDescription = "Cloud Setup Info",
                        modifier = Modifier.size(20.dp),
                        tint = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }

                if (account != null) {
                    TextButton(onClick = onSignOutClick) {
                        Text("Sign Out", fontSize = 12.sp)
                    }
                } else {
                    FilledTonalButton(
                        onClick = onSignInClick,
                        shape = RoundedCornerShape(8.dp),
                        contentPadding = PaddingValues(horizontal = 10.dp, vertical = 2.dp)
                    ) {
                        Text("Connect", fontSize = 12.sp)
                    }
                }
            }
        }
    }
}
