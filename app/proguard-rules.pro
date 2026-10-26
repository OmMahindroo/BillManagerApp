# Apache POI rules
-keep class org.apache.poi.** { *; }
-dontwarn org.apache.poi.**
-dontwarn org.apache.commons.codec.**
-dontwarn org.apache.xmlbeans.**

# Google API Client & Sheets rules
-keep class com.google.api.client.** { *; }
-keep class com.google.api.services.sheets.** { *; }
-dontwarn com.google.api.client.**
-dontwarn com.google.api.services.sheets.**

# ML Kit rules
-keep class com.google.mlkit.** { *; }
-keep class com.google.android.gms.vision.** { *; }
