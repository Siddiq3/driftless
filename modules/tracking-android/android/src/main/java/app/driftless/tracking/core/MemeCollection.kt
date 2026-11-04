package app.driftless.tracking.core

import kotlin.random.Random

/** Curated offline reactions, selected using a transient native-script hint or phone language. */
data class MemeReaction(
    val id: String,
    val language: String,
    val description: String,
    val captions: List<String>,
    /** Captions in other languages, so a meme from any language can be shown to anyone. */
    val translations: Map<String, List<String>> = emptyMap(),
) {
    fun linesFor(lang: String): List<String>? = if (lang == language) captions else translations[lang]
    /** Each line is one complete joke written for this meme; no stitched openers or closers. */
    fun captionVariantCount(lang: String = language) = linesFor(lang)?.size ?: 0
    fun caption(index: Int, count: Int, shorts: Boolean, lang: String = language): String {
        val language = if (linesFor(lang) != null) lang else this.language
        val lines = if (count == 1) firstCountCaptions(language, shorts) else linesFor(language)!!
        val combined = lines[Math.floorMod(index, lines.size)]
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
        "te" -> listOf("$one చూశావ్! “ఇంకొక్కటే” కథ మొదలైందా?", "$one అయింది… జాగ్రత్త, ఇక్కడి నుంచే మొదలవుతుంది 😉", "$one మాత్రమే… టైమ్ మీద ఒక కన్నేసి ఉంచు బ్రో!")
        "hi" -> listOf("$one देख ली! ‘बस एक और’ की कहानी शुरू?", "$one हुई! अल्गोरिदम ने हाज़िरी लगा ली।", "$one ही अभी… टाइम पर भी नज़र रखना बॉस!")
        "ta" -> listOf("$one பார்த்தாச்சு! ‘இன்னும் ஒண்ணு’ கதை ஆரம்பமா?", "$one முடிஞ்சது! அல்காரிதம் ஹாய் சொல்லுது.", "$one தான்… நேரத்தையும் கொஞ்சம் பாரு பாஸ்!")
        "kn" -> listOf("$one ನೋಡಿದೆ! ‘ಇನ್ನೊಂದೇ’ ಕಥೆ ಶುರುವಾಯ್ತಾ?", "$one ಆಯ್ತು! ಅಲ್ಗಾರಿದಮ್ ಹಾಯ್ ಹೇಳುತ್ತಿದೆ.", "$one ಮಾತ್ರ… ಸಮಯದ ಮೇಲೂ ಸ್ವಲ್ಪ ಗಮನ ಇರಲಿ ಗುರು!")
        "ml" -> listOf("$one കണ്ടു! ‘ഒരെണ്ണം കൂടി’ കഥ തുടങ്ങുകയാണോ?", "$one ആയി! അൽഗോരിതം ഹായ് പറയുന്നു.", "$one മാത്രം… സമയവും ഒന്ന് നോക്കണേ ബ്രോ!")
        else -> listOf("$one in. The ‘just one more’ origin story?", "$one down. The algorithm says hey, bestie.", "$one so far. Keep this side quest short.")
    }
}

object MemeCollection {
    val all = listOf(
        MemeReaction("8435694412970132003", "te", "Brahmanandam reaction", listOf("{count} {feed}?! ఏంటి బాబాయ్ ఇది… నేను షాక్‌లో ఉన్నా!", "{count} {feed} అయిపోయాయ్… ఇంకా ఆగట్లేదా? 😳", "నా ఫేస్ చూడు… {count} {feed} చూసినోడి ఫేస్ ఇదే!", "{count} {feed}! అమ్మ పిలిచింది కూడా వినపడలేదా?", "{count} {feed}… టైమ్ ఎక్కడికి పోయింది రా బాబూ?"),
            translations = mapOf("en" to listOf("{count} {feed}?! I'm in shock, bro.", "{count} {feed} and still going? 😳", "This face? That's the face of {count} {feed}."))),
        MemeReaction("9325940450794846015", "en", "Baby — stop it", listOf("{count} {feed}! Even the baby said “stop it”.", "{count} {feed}. “Last one” has become a running joke.", "{count} {feed}? Your thumb needs a timeout."),
            translations = mapOf("te" to listOf("{count} {feed}! ఆ పాప కూడా చెబుతోంది… ఆపు ఇక!", "{count} {feed}… “ఇంకొక్కటే” అనడం ఆపు బ్రో!", "{count} {feed}? చాలు చాలు, ఫోన్ కింద పెట్టు!"))),
        MemeReaction("13540987034857193291", "en", "Obama shrug", listOf("{count} {feed}. Productivity left the group chat.", "{count} {feed} later: “How did we get here?”", "Your plans watching you hit {count} {feed}: 🤷"),
            translations = mapOf("te" to listOf("{count} {feed}… ఎలా అయ్యాయో నాకూ తెలీదు 🤷", "{count} {feed} చూశాక నీ ప్లాన్స్ రియాక్షన్: 🤷", "{count} {feed}! పని సంగతేంటి? 🤷"))),
        MemeReaction("17481394", "te", "Allu Arjun — దేవుడా", listOf("దేవుడా… {count} {feed}! ఒక్కటే అన్నానుగా!", "{count} {feed}?! దేవుడా, నా బొటనవేలు అలసిపోయింది!", "దేవుడా! {count} {feed} చూసేశా… పుస్తకం ఇంకా మూసే ఉంది.", "{count} {feed}… దేవుడా, ఈ ఫోన్ నన్ను వదలట్లేదు!", "దేవుడా! నిద్ర వస్తోంది కానీ {feed} ఆగట్లేదు… {count} అయ్యాయ్!"),
            translations = mapOf("en" to listOf("Oh god… {count} {feed}! I said just one!", "{count} {feed}?! My thumb is exhausted.", "Oh god, {count} {feed} and the book is still closed."))),
        MemeReaction("17491207", "te", "Vijay Deverakonda applause", listOf("{count} {feed}! ఈ డెడికేషన్ చదువులో పెట్టుంటే టాపర్ నువ్వే 👏", "{count} {feed} పూర్తి! చప్పట్లు… కానీ ఇక చాలు 👏", "కంగ్రాట్స్! {count} {feed}… స్క్రోలింగ్‌లో నువ్వే నంబర్ వన్ 🏆", "{count} {feed}! ఈ స్టామినాకి ఒక అవార్డ్ ఇవ్వాల్సిందే 👏", "{count} {feed} ఏకధాటిగా! రికార్డ్ బ్రేక్ చేశావ్ బ్రో 👏"),
            translations = mapOf("en" to listOf("{count} {feed}! Put this dedication into studies and you'd top the class 👏", "{count} {feed} done. Applause… now stop 👏", "{count} {feed} in a row. Record broken 👏"))),
        MemeReaction("19062170", "ta", "Nazriya — Oh my god", listOf("{count} {feed} ஆ?! ஒரு ரீல் தானே சொன்னே!", "{count} {feed}! டைம் எங்கே போச்சுன்னு கேக்காதே.", "{count} {feed}! உன் கட்டை விரலுக்கு ஓய்வு கொடு பாஸ்."),
            translations = mapOf("te" to listOf("ఓ మై గాడ్! {count} {feed}?!", "{count} {feed}?! ఒక్కటే అన్నావ్ కదా! 😱", "అయ్యో! {count} {feed} ఎప్పుడు అయ్యాయ్?"), "en" to listOf("Oh my god, {count} {feed}?!", "{count} {feed}?! You said just one!", "{count} {feed}… when did that happen? 😱"))),
        MemeReaction("1639610178022128587", "en", "Captain facepalm", listOf("{count} {feed}? Even the captain needs a minute.", "{count} {feed}. Your thumb boldly went too far.", "“Last one” has been buffering for {count} {feed}."),
            translations = mapOf("te" to listOf("{count} {feed}?! నుదురు కొట్టుకోవాల్సిందే 🤦", "“ఇదే లాస్ట్” అని {count} {feed} అయ్యాయ్ 🤦", "{count} {feed}… ఏం చేయాలో అర్థం కావట్లేదు 🤦"))),
        MemeReaction("26311914", "en", "Office reaction", listOf("{count} {feed}. This meeting could have been a nap.", "{count} {feed}? Your thumb deserves paid leave.", "{count} {feed} done. Zero emails answered. Iconic."),
            translations = mapOf("te" to listOf("{count} {feed}! ఆఫీస్ పని ఎవరు చేస్తారు బాస్?", "{count} {feed} అయ్యాయ్… ఒక్క మెయిల్ కూడా చూడలేదు!", "{count} {feed}! బాస్ చూస్తే అయిపోయావ్!"))),
        MemeReaction("19613528", "te", "ఇదేం కర్మ రా దేవుడా", listOf("{count} {feed}! ఇదేం కర్మ రా దేవుడా!", "{count} {feed} అయినా ఇంకా “ఇంకొక్కటే” అంటున్నావా? ఇదేం కర్మ రా!", "పని అలాగే ఉంది… {count} {feed} అయిపోయాయ్. ఇదేం కర్మ రా దేవుడా!", "{count} {feed}… ఇదేం కర్మ రా, ఫోన్ కింద పెట్టలేకపోతున్నా!", "ఇదేం కర్మ రా దేవుడా… {count} {feed} చూసినా బోర్ కొట్టలేదా?"),
            translations = mapOf("en" to listOf("{count} {feed}. Why, universe, why?", "{count} {feed} and still saying “one more”?", "Work's untouched… {count} {feed} gone. Why, universe?"))),
        MemeReaction("18989504", "te", "Mohan Babu reaction", listOf("{count} {feed}! ఇది కరెక్ట్ కాదు… మారాలి!", "నిన్న “ఇంకొక్కటే”… ఈరోజు {count} {feed}. మారాలి నాయనా!", "{count} {feed}! క్రమశిక్షణ ఎక్కడ? ఫోన్ కింద పెట్టు!", "{count} {feed} చూశావా? చెప్పింది విను… బ్రేక్ తీసుకో!", "{count} {feed}! ఈ అలవాటు మంచిది కాదు నాయనా."),
            translations = mapOf("en" to listOf("{count} {feed}! This is not okay. Change!", "Yesterday “one more”… today {count} {feed}. Time to change.", "{count} {feed}! Where's the discipline? Phone down!"))),
        MemeReaction("11698943022656515827", "ml", "Malayalam shock", listOf("{count} {feed}?! ഒരെണ്ണം കൂടി എന്നല്ലേ പറഞ്ഞത്!", "{count} {feed}! വിരലിന് ശമ്പളം കൊടുക്കേണ്ടി വരും.", "{count} {feed} കഴിഞ്ഞു… സമയം എവിടെ പോയി ബ്രോ?"),
            translations = mapOf("te" to listOf("{count} {feed}?! ఇది నిజమేనా? 😳", "ఏంటి?! {count} {feed} అయిపోయాయా?", "{count} {feed}… షాక్ అయ్యావా? నేను కూడా!"), "en" to listOf("{count} {feed}?! Is this real? 😳", "Wait… {count} {feed} already?", "{count} {feed}. Shocked? Me too."))),
        MemeReaction("2220434", "en", "LOL", listOf("{count} {feed}. Your screen-time report is doing stand-up.", "{count} {feed}? The “quick break” lore goes crazy.", "{count} {feed} later, your to-do list is laughing."),
            translations = mapOf("te" to listOf("{count} {feed}! నవ్వొస్తోంది… కానీ టైమ్ పోతోంది 😂", "{count} {feed}… నీ స్క్రీన్ టైమ్ చూసి నవ్వాగట్లేదు 😂", "{count} {feed}? ఇది కామెడీ కాదు బ్రో, నిజం 😂"))),
        MemeReaction("18436093036671839738", "hi", "Angry fan", listOf("{count} {feed}?! इतना गुस्सा अपने स्क्रीन टाइम पर करो!", "{count} {feed}! फ़ोन रख दो, मैच कल भी है।", "{count} {feed} देख लीं… अब आँखों की भी सुन लो!"),
            translations = mapOf("te" to listOf("{count} {feed}?! ఈ కోపం స్క్రీన్ టైమ్ మీద చూపించు!", "{count} {feed}! ఫోన్ పక్కన పెట్టు, మ్యాచ్ రేపు కూడా ఉంది.", "{count} {feed} చూశావ్… ఇక కళ్ళ మాట కూడా విను!"), "en" to listOf("{count} {feed}?! Save that anger for your screen time!", "{count} {feed}! Phone down, the match is on tomorrow too.", "{count} {feed} watched… now listen to your eyes."))),
        MemeReaction("26943442", "en", "Grr tantrum", listOf("{count} {feed}. Your sleep schedule has filed a complaint.", "{count} {feed}? Your to-do list is throwing hands.", "{count} {feed} later: brain says “grr”, thumb says “next”."),
            translations = mapOf("te" to listOf("{count} {feed}! నిద్ర కోపంగా ఉంది 😤", "{count} {feed}… బొటనవేలు “ఇంకొక్కటి” అంటోంది, బుర్ర “చాలు” అంటోంది!", "{count} {feed}! చేయాల్సిన పనులు అలిగాయి 😤"))),
        MemeReaction("26603621", "ta", "Tamil reaction", listOf("{count} {feed}! உன் வேலைகள் எல்லாம் வெயிட்டிங் பாஸ்!", "{count} {feed} முடிஞ்சது… இப்போ கொஞ்சம் எழுந்திரு!", "{count} {feed}! ஸ்க்ரோலுக்கு இடைவேளை விடலாமே?"),
            translations = mapOf("te" to listOf("{count} {feed}! నీ పనులన్నీ వెయిటింగ్ బాస్!", "{count} {feed} అయ్యాయ్… ఇక లేచి నిలబడు!", "{count} {feed}! కాసేపు ఫోన్‌కి రెస్ట్ ఇవ్వు."), "en" to listOf("{count} {feed}! Your tasks are waiting, boss.", "{count} {feed} done… time to stand up!", "{count} {feed}! Give the phone a little rest."))),
        MemeReaction("15163183427800024375", "ta", "Tamil chat reaction", listOf("{count} {feed}! “இன்னும் ஒண்ணு” ஒரு பெரிய சீரியல் போல!", "{count} {feed} ஆச்சு… உன் வேலைகள் வெயிட்டிங் பாஸ்.", "{count} {feed}! போதும் தம்பி, கொஞ்சம் உலகத்தையும் பாரு."),
            translations = mapOf("te" to listOf("{count} {feed}! “ఇంకొక్కటే” సీరియల్ లాగా సాగుతోంది!", "{count} {feed}… నీ ఫ్రెండ్ రిప్లై కోసం వెయిట్ చేస్తున్నాడు!", "{count} {feed}! చాలు తమ్ముడూ, బయట ప్రపంచం కూడా ఉంది."), "en" to listOf("{count} {feed}. “One more” is now a full TV serial.", "{count} {feed}… your friend is still waiting for a reply.", "{count} {feed}! Enough, the real world exists too."))),
        MemeReaction("8654309939311906392", "ta", "Tamil comedy", listOf("{count} {feed}! உன் ஸ்கிரீன் டைமே காமெடி பண்ணுது!", "{count} {feed} பார்த்தாச்சு… சிரிச்சுக்கிட்டே ஒரு பிரேக் எடு!", "{count} {feed}! அல்காரிதம் உன்னை விட மாட்டேங்குது."),
            translations = mapOf("te" to listOf("{count} {feed}! నీ స్క్రీన్ టైమే పెద్ద కామెడీ 😂", "{count} {feed}… నవ్వుకుంటూ ఒక బ్రేక్ తీసుకో!", "{count} {feed}! ఈ ఫోన్ నిన్ను వదలట్లేదు బ్రో."), "en" to listOf("{count} {feed}! Your screen time is the real comedy 😂", "{count} {feed}… laugh it off and take a break.", "{count} {feed}! This phone just won't let you go."))),
        MemeReaction("11928059376514140513", "ta", "Shocked Tamil reaction", listOf("{count} {feed} ஆ?! அஞ்சு நிமிஷம்னு சொன்னியே!", "{count} {feed}! ஒரு சீசனே பார்த்துட்ட பாஸ்.", "{count} {feed}! இந்த ட்விஸ்ட்டை எதிர்பார்க்கலையே!"),
            translations = mapOf("te" to listOf("{count} {feed}?! ఐదు నిమిషాలే అన్నావ్ కదా!", "{count} {feed}! ఒక సీజన్ మొత్తం చూసేశావ్ బ్రో.", "{count} {feed}! ఈ ట్విస్ట్ ఎవరూ ఊహించలేదు!"), "en" to listOf("{count} {feed}?! You said five minutes!", "{count} {feed}! That's a whole season, bro.", "{count} {feed}! Nobody saw this twist coming."))),
        MemeReaction("16700119470799159990", "hi", "Amrish Puri reaction", listOf("{count} {feed}! मोगैम्बो का स्क्रीन टाइम भी इतना नहीं होगा।", "{count} {feed} देख लीं… अब थोड़ा ऑफ़लाइन भी जी लो!", "{count} {feed}! ये स्क्रॉल है या ओवरटाइम?"),
            translations = mapOf("te" to listOf("{count} {feed}… మొగాంబో ఖుష్ కాదు! 😠", "{count} {feed}! మొగాంబో కూడా ఇంత స్క్రీన్ టైమ్ చూడలేదు!", "{count} {feed}! ఇది స్క్రోలింగా లేక ఓవర్‌టైమా?"), "en" to listOf("{count} {feed}… Mogambo is NOT happy 😠", "{count} {feed}! Even Mogambo never had this much screen time.", "{count} {feed}! Is this scrolling or overtime?"))),
        MemeReaction("18754360", "hi", "Amrish Puri — चुप", listOf("{count} {feed}! अब “बस एक और” बोलना बंद!", "{count} {feed} हो गईं… अब अंगूठे को चुप कराओ!", "{count} {feed}! अल्गोरिदम बोले “और”, हम बोले “ब्रेक”!"),
            translations = mapOf("te" to listOf("చుప్! {count} {feed} చాలు!", "{count} {feed}! “ఇంకొక్కటే” అనడం ఆపు!", "{count} {feed}! ఇక సైలెంట్‌గా ఫోన్ కింద పెట్టు."), "en" to listOf("Quiet! {count} {feed} is enough!", "{count} {feed}! Stop saying “one more”.", "{count} {feed}! Now quietly put the phone down.")))
    )

    /** Language the card is shown in: the person's language when any meme has captions in it, else English. */
    fun displayLanguage(pool: List<MemeReaction>, language: String?): String =
        language?.takeIf { lang -> pool.any { it.linesFor(lang) != null } } ?: "en"

    /** Every meme with captions in [language], whatever language the meme itself comes from. */
    fun poolForLanguage(pool: List<MemeReaction>, language: String?): List<MemeReaction> {
        val display = displayLanguage(pool, language)
        return pool.filter { it.linesFor(display) != null }
    }

    /** Sample without replacement; also prevent the last item repeating across cycle boundaries. */
    fun choose(pool: List<MemeReaction>, used: Set<String>, last: String?, random: Random = Random.Default): MemeReaction? {
        if (pool.isEmpty()) return null
        val remaining = pool.filter { it.id !in used }
        val candidates = (if (remaining.isEmpty()) pool else remaining).filter { it.id != last }
        return (candidates.ifEmpty { if (remaining.isEmpty()) pool else remaining }).random(random)
    }

    fun captionIndex(meme: MemeReaction, previous: Int, random: Random = Random.Default, lang: String = meme.language): Int =
        (0 until meme.captionVariantCount(lang)).filter { it != previous }.random(random)
}
