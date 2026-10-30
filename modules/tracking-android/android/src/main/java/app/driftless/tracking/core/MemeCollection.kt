package app.driftless.tracking.core

import kotlin.random.Random

/** Curated offline reactions, selected using a transient native-script hint or phone language. */
data class MemeReaction(val id: String, val language: String, val description: String, val captions: List<String>) {
    val captionVariantCount get() = memeTaglineParts(language, captions).size
    fun caption(index: Int, count: Int, shorts: Boolean): String {
        val lines = if (count == 1) firstCountCaptions(language, shorts) else captions
        val combined = memeTaglineParts(language, lines).render(index)
        val feed = when (language) {
            "te" -> if (shorts) "షార్ట్స్" else "రీల్స్"
            "hi" -> if (shorts) "शॉर्ट्स" else "रील्स"
            "ta" -> if (shorts) "ஷார்ட்ஸ்" else "ரீல்ஸ்"
            "kn" -> if (shorts) "ಶಾರ್ಟ್ಸ್" else "ರೀಲ್ಸ್"
            "ml" -> if (shorts) "ഷോർട്സ്" else "റീൽസ്"
            else -> if (shorts) "Shorts" else "Reels"
        }
        return combined.replace("{count}", count.toString()).replace("{feed}", feed)
    }
}

/** A first view gets a playful greeting rather than a high-count roast. */
private fun firstCountCaptions(language: String, shorts: Boolean): List<String> {
    val one = when (language) {
        "te" -> if (shorts) "1 షార్ట్" else "1 రీల్"
        "hi" -> if (shorts) "1 शॉर्ट" else "1 रील"
        "ta" -> if (shorts) "1 ஷார்ட்" else "1 ரீல்"
        "kn" -> if (shorts) "1 ಶಾರ್ಟ್" else "1 ರೀಲ್"
        "ml" -> if (shorts) "1 ഷോർട്ട്" else "1 റീൽ"
        else -> if (shorts) "1 Short" else "1 Reel"
    }
    return when (language) {
        "te" -> listOf("$one చూశావ్! ‘ఇంకొక్కటి’ కథ మొదలైందా?", "$one అయింది! అల్గారిథమ్ హాయ్ అంటోంది.", "$one మాత్రమే… టైమ్ మీద కాస్త కన్నేసి ఉంచు బ్రో!")
        "hi" -> listOf("$one देख ली! ‘बस एक और’ की कहानी शुरू?", "$one हुई! अल्गोरिदम ने हाज़िरी लगा ली।", "$one ही अभी… टाइम पर भी नज़र रखना बॉस!")
        "ta" -> listOf("$one பார்த்தாச்சு! ‘இன்னும் ஒண்ணு’ கதை ஆரம்பமா?", "$one முடிஞ்சது! அல்காரிதம் ஹாய் சொல்லுது.", "$one தான்… நேரத்தையும் கொஞ்சம் பாரு பாஸ்!")
        "kn" -> listOf("$one ನೋಡಿದೆ! ‘ಇನ್ನೊಂದೇ’ ಕಥೆ ಶುರುವಾಯ್ತಾ?", "$one ಆಯ್ತು! ಅಲ್ಗಾರಿದಮ್ ಹಾಯ್ ಹೇಳುತ್ತಿದೆ.", "$one ಮಾತ್ರ… ಸಮಯದ ಮೇಲೂ ಸ್ವಲ್ಪ ಗಮನ ಇರಲಿ ಗುರು!")
        "ml" -> listOf("$one കണ്ടു! ‘ഒരെണ്ണം കൂടി’ കഥ തുടങ്ങുകയാണോ?", "$one ആയി! അൽഗോരിതം ഹായ് പറയുന്നു.", "$one മാത്രം… സമയവും ഒന്ന് നോക്കണേ ബ്രോ!")
        else -> listOf("$one in. The ‘just one more’ origin story?", "$one down. The algorithm says hey, bestie.", "$one so far. Keep this side quest short.")
    }
}

object MemeCollection {
    val all = listOf(
        MemeReaction("8435694412970132003", "te", "Brahmanandam reaction", listOf("{count} {feed}! నీ ప్లాన్స్ అన్నీ వెయిటింగ్‌లోనే బ్రో.", "{count} {feed} చూశావ్… కథేంటో గుర్తుందా?", "{count} {feed}! అల్గారిథమ్‌కి నువ్వే బెస్ట్ ఫ్రెండ్.")),
        MemeReaction("9325940450794846015", "en", "Baby — stop it", listOf("{count} {feed}! Even the baby said “stop it”.", "{count} {feed}. “Last one” has become a running joke.", "{count} {feed}? Your thumb needs a timeout.")),
        MemeReaction("13540987034857193291", "en", "Obama shrug", listOf("{count} {feed}. Productivity left the group chat.", "{count} {feed} later: “How did we get here?”", "Your plans watching you hit {count} {feed}: 🤷")),
        MemeReaction("17481394", "te", "Allu Arjun — దేవుడా", listOf("దేవుడా… {count} {feed}! నా బొటనవేలికి సెలవు లేదా?", "ఇంకొక్కటి అన్నా… {count} {feed} అయ్యాయి! దేవుడా!", "{count} {feed}! స్క్రోల్ చేశానా… షిఫ్ట్ చేశానా?")),
        MemeReaction("17491207", "te", "Vijay Deverakonda applause", listOf("{count} {feed}! ఈ డెడికేషన్ చదువులో ఉంటేనా… 👏", "{count} {feed} పూర్తి! బొటనవేలికి స్టాండింగ్ ఓవేషన్.", "{count} {feed}! స్క్రోల్‌లో గోల్డ్ మెడల్ నీదే.")),
        MemeReaction("19062170", "ta", "Nazriya — Oh my god", listOf("{count} {feed} ஆ?! ஒரு ரீல் தானே சொன்னே!", "{count} {feed}! டைம் எங்கே போச்சுன்னு கேக்காதே.", "{count} {feed}! உன் கட்டை விரலுக்கு ஓய்வு கொடு பாஸ்.")),
        MemeReaction("1639610178022128587", "en", "Captain facepalm", listOf("{count} {feed}? Even the captain needs a minute.", "{count} {feed}. Your thumb boldly went too far.", "“Last one” has been buffering for {count} {feed}.")),
        MemeReaction("26311914", "en", "Office reaction", listOf("{count} {feed}. This meeting could have been a nap.", "{count} {feed}? Your thumb deserves paid leave.", "{count} {feed} done. Zero emails answered. Iconic.")),
        MemeReaction("19613528", "te", "ఇదేం కర్మ రా దేవుడా", listOf("{count} {feed}! ఇదేం స్క్రోల్ కర్మ రా దేవుడా!", "{count} {feed} తర్వాత కూడా “ఇంకొక్కటి” అంటావా?", "{count} {feed}! టైమ్ పోయింది… కర్మ మిగిలింది.")),
        MemeReaction("18989504", "te", "Mohan Babu reaction", listOf("{count} {feed}… మనం ఇంకా మారలేదా అనిపిస్తోంది!", "నిన్న “ఇంకొక్కటి”… ఇవాళ {count} {feed}. మారాలి బ్రో!", "{count} {feed}! అల్గారిథమ్ మారింది… మనం ఎప్పుడు?")),
        MemeReaction("11698943022656515827", "ml", "Malayalam shock", listOf("{count} {feed}?! ഒരെണ്ണം കൂടി എന്നല്ലേ പറഞ്ഞത്!", "{count} {feed}! വിരലിന് ശമ്പളം കൊടുക്കേണ്ടി വരും.", "{count} {feed} കഴിഞ്ഞു… സമയം എവിടെ പോയി ബ്രോ?")),
        MemeReaction("2220434", "en", "LOL", listOf("{count} {feed}. Your screen-time report is doing stand-up.", "{count} {feed}? The “quick break” lore goes crazy.", "{count} {feed} later, your to-do list is laughing.")),
        MemeReaction("18436093036671839738", "hi", "Angry fan", listOf("{count} {feed}?! इतना गुस्सा अपने स्क्रीन टाइम पर करो!", "{count} {feed}! फ़ोन रख दो, मैच कल भी है।", "{count} {feed} देख लीं… अब आँखों की भी सुन लो!")),
        MemeReaction("26943442", "en", "Grr tantrum", listOf("{count} {feed}. Your sleep schedule has filed a complaint.", "{count} {feed}? Your to-do list is throwing hands.", "{count} {feed} later: brain says “grr”, thumb says “next”.")),
        MemeReaction("26603621", "ta", "Tamil reaction", listOf("{count} {feed}! உன் வேலைகள் எல்லாம் வெயிட்டிங் பாஸ்!", "{count} {feed} முடிஞ்சது… இப்போ கொஞ்சம் எழுந்திரு!", "{count} {feed}! ஸ்க்ரோலுக்கு இடைவேளை விடலாமே?")),
        MemeReaction("15163183427800024375", "ta", "Tamil chat reaction", listOf("{count} {feed}! “இன்னும் ஒண்ணு” ஒரு பெரிய சீரியல் போல!", "{count} {feed} ஆச்சு… உன் வேலைகள் வெயிட்டிங் பாஸ்.", "{count} {feed}! போதும் தம்பி, கொஞ்சம் உலகத்தையும் பாரு.")),
        MemeReaction("8654309939311906392", "ta", "Tamil comedy", listOf("{count} {feed}! உன் ஸ்கிரீன் டைமே காமெடி பண்ணுது!", "{count} {feed} பார்த்தாச்சு… சிரிச்சுக்கிட்டே ஒரு பிரேக் எடு!", "{count} {feed}! அல்காரிதம் உன்னை விட மாட்டேங்குது.")),
        MemeReaction("11928059376514140513", "ta", "Shocked Tamil reaction", listOf("{count} {feed} ஆ?! அஞ்சு நிமிஷம்னு சொன்னியே!", "{count} {feed}! ஒரு சீசனே பார்த்துட்ட பாஸ்.", "{count} {feed}! இந்த ட்விஸ்ட்டை எதிர்பார்க்கலையே!")),
        MemeReaction("16700119470799159990", "hi", "Amrish Puri reaction", listOf("{count} {feed}! मोगैम्बो का स्क्रीन टाइम भी इतना नहीं होगा।", "{count} {feed} देख लीं… अब थोड़ा ऑफ़लाइन भी जी लो!", "{count} {feed}! ये स्क्रॉल है या ओवरटाइम?")),
        MemeReaction("18754360", "hi", "Amrish Puri — चुप", listOf("{count} {feed}! अब “बस एक और” बोलना बंद!", "{count} {feed} हो गईं… अब अंगूठे को चुप कराओ!", "{count} {feed}! अल्गोरिदम बोले “और”, हम बोले “ब्रेक”!"))
    )

    /** Prefer matching assets; an unavailable language retains the existing mixed-pool fallback. */
    fun poolForLanguage(pool: List<MemeReaction>, language: String?): List<MemeReaction> =
        pool.filter { it.language == language }.ifEmpty { pool }

    /** Sample without replacement; also prevent the last item repeating across cycle boundaries. */
    fun choose(pool: List<MemeReaction>, used: Set<String>, last: String?, random: Random = Random.Default): MemeReaction? {
        if (pool.isEmpty()) return null
        val remaining = pool.filter { it.id !in used }
        val candidates = (if (remaining.isEmpty()) pool else remaining).filter { it.id != last }
        return (candidates.ifEmpty { if (remaining.isEmpty()) pool else remaining }).random(random)
    }

    fun captionIndex(meme: MemeReaction, previous: Int, random: Random = Random.Default): Int =
        (0 until meme.captionVariantCount).filter { it != previous }.random(random)
}
