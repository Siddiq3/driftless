package app.driftless.tracking.core

/** Offline combinations only. Indices, never displayed copy or inspected content, are saved. */
data class TaglineParts(val openers: List<String>, val counts: List<String>, val closers: List<String>) {
    val size get() = openers.size * counts.size * closers.size
    fun render(index: Int): String {
        val selected = Math.floorMod(index, size)
        val opener = selected / (counts.size * closers.size)
        val count = selected / closers.size % counts.size
        val closer = selected % closers.size
        return "${openers[opener]} ${counts[count]} ${closers[closer]}"
    }
}

internal fun memeTaglineParts(language: String, counts: List<String>): TaglineParts {
    val (openers, closers) = when (language) {
        "te" -> listOf("బ్రో…", "అరె మామా,", "ఓరి నాయనా!", "సీరియస్‌గా?") to
            listOf("బొటనవేలికి రెస్ట్ ఇవ్వు.", "నీ సైడ్ క్వెస్ట్: కాస్త నీళ్లు తాగు.", "ఇంకొక్కటి అన్నావ్ గుర్తుందా?", "ఆఫ్‌లైన్‌లో కూడా నీ కథ ఉంది!")
        "hi" -> listOf("अरे यार,", "भाई…", "सच में?", "एक मिनट बॉस!") to
            listOf("अंगूठे को भी आराम दे।", "अगला मिशन: थोड़ा पानी पी लो।", "बस एक और कहा था ना?", "ऑफ़लाइन वाली कहानी भी जी लो।")
        "ta" -> listOf("பாஸ்…", "அடடா!", "நிஜமாவா?", "ஒரு நிமிஷம் நண்பா,") to
            listOf("விரலுக்கும் கொஞ்சம் ஓய்வு கொடு.", "அடுத்த மிஷன்: கொஞ்சம் தண்ணீர் குடி.", "இன்னும் ஒண்ணு தானே சொன்னே?", "ஆஃப்லைனிலும் உன் கதை இருக்கு!")
        "kn" -> listOf("ಗುರು…", "ಅಯ್ಯೋ!", "ನಿಜವಾಗ್ಲೂ?", "ಒಂದು ನಿಮಿಷ ಬಾಸ್,") to
            listOf("ಬೆರಳಿಗೂ ಸ್ವಲ್ಪ ರೆಸ್ಟ್ ಕೊಡು.", "ಮುಂದಿನ ಮಿಷನ್: ಸ್ವಲ್ಪ ನೀರು ಕುಡಿ.", "ಇನ್ನೊಂದೇ ಅಂದಿದ್ದೆ ನೆನಪಿದೆಯಾ?", "ಆಫ್‌ಲೈನ್‌ನಲ್ಲೂ ನಿನ್ನ ಕಥೆ ಇದೆ!")
        "ml" -> listOf("ബ്രോ…", "അയ്യോ!", "സീരിയസായിട്ടാണോ?", "ഒരു മിനിറ്റ് ബോസ്,") to
            listOf("വിരലിനും കുറച്ച് വിശ്രമം കൊടുക്ക്.", "അടുത്ത മിഷൻ: കുറച്ച് വെള്ളം കുടിക്കൂ.", "ഒരെണ്ണം കൂടി എന്നല്ലേ പറഞ്ഞത്?", "ഓഫ്‌ലൈനിലും നിന്റെ കഥയുണ്ട്!")
        else -> listOf("Bestie…", "Plot twist:", "Bro,", "Quick vibe check:") to
            listOf("Give your thumb a tiny break.", "Next side quest: drink some water.", "Remember saying ‘just one more’?", "Your offline lore is waiting.")
    }
    return TaglineParts(openers, counts, closers)
}
