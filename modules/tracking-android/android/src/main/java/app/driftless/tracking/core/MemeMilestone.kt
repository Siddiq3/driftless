package app.driftless.tracking.core

/** First count once per day, then new 50-count crossings. Never replay recorded milestones. */
fun nextMemeMilestone(previousDate: String?, previousCount: Int?, date: String, count: Int, shown: Int): Int? {
    if (count == 1 && shown == 0 && (previousDate != date || previousCount == null || previousCount < 1)) return 1
    if (previousDate != date || previousCount == null || count <= previousCount || count < 50) return null
    val milestone = count / 50 * 50
    return milestone.takeIf { previousCount / 50 < count / 50 && it > shown }
}

object MemeLanguages {
    val supported = setOf("en", "te", "hi", "ta", "kn", "ml")
    /** Prefer a configured regional language over a generic English fallback. Never infer from country. */
    fun resolve(deviceLanguages: List<String>): String {
        val languages = deviceLanguages.map { it.substringBefore('-').substringBefore('_').lowercase(java.util.Locale.ROOT) }
        return languages.firstOrNull { it in supported && it != "en" } ?: "en"
    }
}

data class MemeCopy(val caption: String, val pause: String, val continueWatching: String, val close: String)

/** Bundled, offline copy. Language comes from the phone, never from location. */
fun memeCopy(language: String, milestone: Int): MemeCopy {
    val variant = (milestone / 50 - 1).coerceAtLeast(0) % 3
    return when (language) {
        "te" -> MemeCopy(listOf("ఇంకొక్క రీల్ అన్నావ్… $milestone అయ్యాయి!", "రీల్స్‌కి ఎనర్జీ ఉంది… నీ బ్రెయిన్‌కి ఉందా?", "స్క్రోల్‌కి చిన్న బ్రేక్ ఇద్దామా?")[variant], "కాస్త బ్రేక్ తీసుకుందాం", "ఇంకాసేపు చూస్తా", "మూసివేయి")
        "hi" -> MemeCopy(listOf("बस एक और रील? $milestone हो गईं!", "स्क्रॉल फुल स्पीड, दिमाग लो बैटरी!", "रील्स को भी थोड़ा इंतज़ार करने दो!")[variant], "थोड़ा ब्रेक लें", "देखते रहें", "बंद करें")
        "ta" -> MemeCopy(listOf("இன்னும் ஒரு ரீல் தானே? $milestone ஆகிடுச்சு!", "ஸ்க்ரோல் வேகம் அதிகம்… மூளைக்கு ஓய்வு வேணும்!", "ரீல்ஸுக்கு ஒரு குட்டி பிரேக் விடலாமா?")[variant], "கொஞ்சம் ஓய்வு", "தொடர்ந்து பார்க்க", "மூடு")
        "kn" -> MemeCopy(listOf("ಇನ್ನೊಂದೇ ರೀಲ್ ಅಂದಿದ್ದು… $milestone ಆಯ್ತು!", "ಸ್ಕ್ರೋಲ್ ಫುಲ್ ಸ್ಪೀಡ್, ಮೆದುಳು ಲೋ ಬ್ಯಾಟರಿ!", "ರೀಲ್ಸ್‌ಗೆ ಸ್ವಲ್ಪ ಬ್ರೇಕ್ ಕೊಡೋಣವೇ?")[variant], "ಸ್ವಲ್ಪ ವಿರಾಮ", "ನೋಡುತ್ತಲೇ ಇರುತ್ತೇನೆ", "ಮುಚ್ಚಿ")
        "ml" -> MemeCopy(listOf("ഒരു റീൽ കൂടി എന്നല്ലേ? $milestone ആയി!", "സ്ക്രോൾ ഫുൾ സ്പീഡ്, തലച്ചോർ ലോ ബാറ്ററി!", "റീൽസിന് ഒരു ചെറിയ ബ്രേക്ക് കൊടുത്താലോ?")[variant], "ഒരു ബ്രേക്ക് എടുക്കാം", "കാണുന്നത് തുടരാം", "അടയ്ക്കുക")
        else -> MemeCopy(listOf("“Just one more” became $milestone. Bro.", "Your thumb: unlimited. Your brain: 1%.", "The reels can wait. Main character break?")[variant], "Take a break", "Continue scrolling", "Close")
    }
}
