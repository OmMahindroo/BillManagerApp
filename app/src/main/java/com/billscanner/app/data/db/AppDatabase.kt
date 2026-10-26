package com.billscanner.app.data.db

import android.content.Context
import androidx.room.Database
import androidx.room.Room
import androidx.room.RoomDatabase
import androidx.room.TypeConverter
import androidx.room.TypeConverters
import com.billscanner.app.data.model.BillRecord
import com.billscanner.app.data.model.DestinationType
import com.billscanner.app.data.model.SpreadsheetTarget

class Converters {
    @TypeConverter
    fun fromDestinationType(type: DestinationType): String = type.name

    @TypeConverter
    fun toDestinationType(value: String): DestinationType = runCatching {
        DestinationType.valueOf(value)
    }.getOrDefault(DestinationType.LOCAL_EXCEL)
}

@Database(
    entities = [SpreadsheetTarget::class, BillRecord::class],
    version = 1,
    exportSchema = false
)
@TypeConverters(Converters::class)
abstract class AppDatabase : RoomDatabase() {
    abstract fun spreadsheetTargetDao(): SpreadsheetTargetDao
    abstract fun billDao(): BillDao

    companion object {
        @Volatile
        private var INSTANCE: AppDatabase? = null

        fun getDatabase(context: Context): AppDatabase {
            return INSTANCE ?: synchronized(this) {
                val instance = Room.databaseBuilder(
                    context.applicationContext,
                    AppDatabase::class.java,
                    "bill_scanner_database"
                ).fallbackToDestructiveMigration().build()
                INSTANCE = instance
                instance
            }
        }
    }
}
