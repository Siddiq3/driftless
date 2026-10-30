package app.driftless.tracking.core

/** A bounded script hint, not spoken-language recognition. No text leaves this call.
 * Latin/romanized text and ambiguous mixed scripts use the phone-language fallback.
 * Devanagari maps to Hindi copy; other languages also use that script.
 */
fun detectContentLanguage(texts: List<CharSequence>): String? {
    val counts = mutableMapOf<String, Int>()
    var inspected = 0
    outer@ for (text in texts) for (ch in text) {
        if (++inspected > 4096) break@outer
        if (!ch.isLetter()) continue
        val language = when (ch.code) {
            in 0x0C00..0x0C7F -> "te"
            in 0x0C80..0x0CFF -> "kn"
            in 0x0B80..0x0BFF -> "ta"
            in 0x0D00..0x0D7F -> "ml"
            in 0x0900..0x097F -> "hi"
            else -> continue
        }
        counts[language] = (counts[language] ?: 0) + 1
    }
    val best = counts.maxByOrNull { it.value } ?: return null
    return best.key.takeIf { best.value >= 4 && best.value * 100 >= counts.values.sum() * 60 }
}
