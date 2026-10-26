package com.billscanner.app.data.model

enum class BillCategory(val title: String, val defaultKeywordMatches: List<String>) {
    GROCERIES(
        "Groceries",
        listOf("supermarket", "mart", "grocery", "food", "provisions", "bazaar", "produce", "fruits", "veggies", "bread", "milk")
    ),
    DINING(
        "Food & Dining",
        listOf("restaurant", "cafe", "coffee", "bistro", "diner", "bakery", "kitchen", "bar", "grill", "burger", "pizza", "swiggy", "zomato")
    ),
    UTILITIES(
        "Utilities",
        listOf("electricity", "water", "gas", "broadband", "internet", "power", "energy", "telecom", "recharge", "mobile bill")
    ),
    FUEL_TRAVEL(
        "Fuel & Travel",
        listOf("fuel", "petrol", "diesel", "station", "oil", "uber", "ola", "transport", "flight", "taxi", "toll", "parking", "railway")
    ),
    HEALTHCARE(
        "Healthcare",
        listOf("pharmacy", "chemist", "hospital", "clinic", "medical", "doctor", "health", "medicines", "drugs", "dental")
    ),
    OFFICE(
        "Office & Supplies",
        listOf("stationery", "paper", "print", "supplies", "office", "books", "xerox", "pen", "pencil", "notebook")
    ),
    SHOPPING(
        "Shopping & Retail",
        listOf("clothing", "apparel", "wear", "store", "mall", "fashion", "electronics", "hardware", "amazon", "flipkart")
    ),
    ENTERTAINMENT(
        "Entertainment",
        listOf("cinema", "movie", "theatre", "tickets", "game", "amusement", "show")
    ),
    FITNESS(
        "Fitness & Wellness",
        listOf("fitness", "gym", "studio", "yoga", "workout", "membership", "sports", "trainer", "crossfit", "pilates")
    ),
    OTHER(
        "Other",
        emptyList()
    );

    companion object {
        fun detectCategory(rawText: String): BillCategory {
            for (category in entries) {
                if (category == OTHER) continue
                for (keyword in category.defaultKeywordMatches) {
                    val pattern = java.util.regex.Pattern.compile("\\b${java.util.regex.Pattern.quote(keyword)}\\b", java.util.regex.Pattern.CASE_INSENSITIVE)
                    if (pattern.matcher(rawText).find()) {
                        return category
                    }
                }
            }
            return OTHER
        }

        fun fromTitle(title: String): BillCategory {
            return entries.firstOrNull { it.title.equals(title, ignoreCase = true) } ?: OTHER
        }
    }
}
