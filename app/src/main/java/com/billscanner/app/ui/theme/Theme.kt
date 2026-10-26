package com.billscanner.app.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

private val LightColorScheme = lightColorScheme(
    primary = TealPrimary,
    onPrimary = Color.White,
    primaryContainer = Color(0xFFE0F2F1),
    onPrimaryContainer = TealPrimaryDark,
    secondary = TealSecondary,
    onSecondary = Color.White,
    background = BackgroundLight,
    surface = SurfaceLight,
    surfaceVariant = Color(0xFFE8ECE9),
    onSurface = TextPrimary,
    onSurfaceVariant = TextSecondary,
    error = ErrorRed,
    outline = BorderStrokeColor
)

private val DarkColorScheme = darkColorScheme(
    primary = TealAccent,
    onPrimary = Color(0xFF00382E),
    primaryContainer = TealPrimaryDark,
    onPrimaryContainer = Color(0xFFE0F2F1),
    secondary = TealPrimaryLight,
    onSecondary = Color.Black,
    background = Color(0xFF101413),
    surface = Color(0xFF191D1C),
    surfaceVariant = Color(0xFF282E2C),
    onSurface = Color(0xFFE1E3E1),
    onSurfaceVariant = Color(0xFFC0C7C4),
    error = Color(0xFFFFB4AB)
)

@Composable
fun BillScannerTheme(
    darkTheme: Boolean = isSystemInDarkTheme(),
    content: @Composable () -> Unit
) {
    val colorScheme = if (darkTheme) DarkColorScheme else LightColorScheme

    MaterialTheme(
        colorScheme = colorScheme,
        typography = Typography,
        content = content
    )
}
