package app.driftless.tracking.core

/** Goal reminder wording. `seed` (e.g. day of year) rotates lines so the same one isn't seen daily. */
object ReminderCopy {
    private val lines: Map<Int, List<Pair<String, String>>> = mapOf(
        50 to listOf(
            "Halfway there 👀" to "{used} of {limit} {unit}. Pace yourself, legend.",
            "Plot twist: you're at 50%" to "{used} of {limit} {unit}. The other half can wait.",
            "Bestie, half your {unit} are gone" to "{used} of {limit} today. Still in control 💪",
        ),
        80 to listOf(
            "Brain says: slow down 🧠" to "{used} of {limit} {unit}. Only {left} left, make them count.",
            "Thumb check 👍" to "{used} of {limit} {unit}. Your thumb deserves a breather.",
            "Danger zone 🚨" to "{used} of {limit} {unit}. Just {left} more before your limit.",
        ),
        90 to listOf(
            "Last one loading… ⏳" to "{used} of {limit} {unit}. One more and you're done for today.",
            "One more, then log off?" to "{used} of {limit} {unit}. Remember saying ‘just one more’?",
            "Final boss: your limit 🎮" to "{used} of {limit} {unit}. You've got this.",
        ),
        100 to listOf(
            "Limit reached. Brain = fried 🍳" to "{used} of {limit} {unit}. Time for a side quest offline.",
            "That's a wrap 🎬" to "{used} of {limit} {unit}. Go touch some grass 🌱",
            "Log off. Wake up. ☀️" to "{used} of {limit} {unit}. Your offline lore is waiting.",
        ),
    )

    fun pick(percent: Int, used: Int, limit: Int, unit: String, seed: Int): Pair<String, String> {
        val level = lines.keys.filter { it <= percent }.maxOrNull() ?: lines.keys.min()
        val options = lines.getValue(level)
        val (title, text) = options[Math.floorMod(seed, options.size)]
        fun fill(s: String) = s.replace("{used}", "$used").replace("{limit}", "$limit")
            .replace("{left}", "${maxOf(0, limit - used)}").replace("{unit}", unit)
        return fill(title) to fill(text)
    }
}
