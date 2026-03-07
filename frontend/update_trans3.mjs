import fs from 'fs';

let content = fs.readFileSync('src/utils/translations.js', 'utf8');

const tMap = {
    // GreenOps Dashboard Specific
    greenOpsDashboard: { en: 'GreenOps Dashboard', hi: 'ग्रीनऑप्स डैशबोर्ड', mr: 'ग्रीनऑप्स डॅशबोर्ड', ta: 'கிரீன்ஆப்ஸ் டாஷ்போர்டு', te: 'గ్రీన్‌ఆప్స్ డాష్‌బోర్డ్', kn: 'ಗ್ರೀನ್‌ಆಪ್ಸ್ ಡ್ಯಾಶ್‌ಬೋರ್ಡ್', ml: 'ഗ്രീൻഓപ്സ് ഡാഷ്‌ബോർഡ്', bn: 'গ্রিনঅপস ড্যাশবোর্ড', gu: 'ગ્રીનઓપ્સ ડેશબોર્ડ', pa: 'ਗ੍ਰੀਨਓਪਸ ਡੈਸ਼ਬੋਰਡ' },
    awsCarbonFootprint: { en: 'AWS Customer Carbon Footprint · March 2026', hi: 'AWS कस्टमर कार्बन फुटप्रिंट · मार्च 2026', mr: 'AWS ग्राहक कार्बन फूटप्रिंट · मार्च 2026', ta: 'AWS கார்பன் தடம் · மார்ச் 2026', te: 'AWS కార్బన్ ఫుట్‌ప్రింట్ · మార్చి 2026', kn: 'AWS ಕಾರ್ಬನ್ ಹೆಜ್ಜೆಗುರುತು · ಮಾರ್ಚ್ 2026', ml: 'AWS കാർബൺ ഫൂട്ട്പ്രിന്റ് · മാർച്ച് 2026', bn: 'AWS কার্বন পদচিহ্ন · মার্চ ২০২৬', gu: 'AWS કાર્બન ફૂટપ્રિન્ટ · માર્ચ 2026', pa: 'AWS ਕਾਰਬਨ ਫੁੱਟਪ੍ਰਿੰਟ · ਮਾਰਚ 2026' },
    syncing: { en: 'Syncing...', hi: 'सिंक हो रहा है...', mr: 'सिंक करत आहे...', ta: 'ஒத்திசைக்கிறது...', te: 'సమకాలీకరిస్తోంది...', kn: 'ಸಿಂಕ್ ಮಾಡಲಾಗುತ್ತಿದೆ...', ml: 'സിങ്ക് ചെയ്യുന്നു...', bn: 'সিঙ্ক হচ্ছে...', gu: 'સિંક કરી રહ્યું છે...', pa: 'ਸਿੰਕ ਹੋ ਰਿਹਾ ਹੈ...' },
    refresh: { en: 'Refresh', hi: 'रिफ्रेश', mr: 'रिफ्रेश', ta: 'புதுப்பி', te: 'రిఫ్రెష్', kn: 'ರಿಫ್ರೆಶ್', ml: 'പുതുക്കുക', bn: 'রিফ্রেশ', gu: 'રિફ્રેશ', pa: 'ਰਿਫ੍ਰੈਸ਼' },
    totalCO2e: { en: 'Total CO₂e', hi: 'कुल CO₂e', mr: 'एकूण CO₂e', ta: 'மொத்த CO₂e', te: 'మొత్తం CO₂e', kn: 'ಒಟ್ಟು CO₂e', ml: 'ആകെ CO₂e', bn: 'মোট CO₂e', gu: 'કુલ CO₂e', pa: 'ਕੁੱਲ CO₂e' },
    metricTons: { en: 'metric tons', hi: 'मीट्रिक टन', mr: 'मेट्रिक टन', ta: 'மெட்ரிக் டன்கள்', te: 'మెట్రిక్ టన్నులు', kn: 'ಮೆಟ್ರಿಕ್ ಟನ್‌ಗಳು', ml: 'മെട്രിക് ടണ്ണുകൾ', bn: 'মেট্রিক টন', gu: 'મેટ્રિક ટન', pa: 'ਮੀਟ੍ਰਿਕ ਟਨ' },
    vsLastMonth: { en: '-12% vs last month', hi: 'पिछले महीने की तुलना में -12%', mr: 'गेल्या महिन्याच्या तुलनेत -१२%', ta: 'கடந்த மாதத்தை விட -12%', te: 'గత నెలతో పోలిస్తే -12%', kn: 'ಕಳೆದ ತಿಂಗಳಿಗಿಂತ -12%', ml: 'കഴിഞ്ഞ മാസത്തെ അപേക്ഷിച്ച് -12%', bn: 'গত মাসের তুলনায় -12%', gu: 'ગયા મહિના કરતાં -12%', pa: 'ਪਿਛਲੇ ਮਹੀਨੇ ਨਾਲੋਂ -12%' },

    // SipTracker Specific
    sipTrackerLoading: { en: 'Syncing enterprise security profile on AWS CloudTrail...', hi: 'एडब्ल्यूएस क्लाउडट्रेल पर एंटरप्राइज सुरक्षा प्रोफाइल सिंक हो रहा है...', mr: 'एडब्ल्यूएस क्लाउडट्रेलवर एंटरप्राइज सुरक्षा प्रोफाईल सिंक करत आहे...', ta: 'AWS CloudTrail இல் நிறுவன பாதுகாப்பு சுயவிவரத்தை ஒத்திசைக்கிறது...', te: 'AWS లో ఎంటర్‌ప్రైజ్ భద్రతా ప్రొఫైల్‌ను సమకాలీకరిస్తోంది...', kn: 'AWS ನಲ್ಲಿ ಎಂಟರ್‌ಪ್ರೈಸ್ ಭದ್ರತಾ ಪ್ರೊಫೈಲ್ ಅನ್ನು ಸಿಂಕ್ ಮಾಡಲಾಗುತ್ತಿದೆ...', ml: 'AWS-ൽ എന്റർപ്രൈസ് സുരക്ഷാ പ്രൊഫൈൽ സിങ്ക് ചെയ്യുന്നു...', bn: 'AWS এ এন্টারপ্রাইজ সুরক্ষা প্রোফাইল সিঙ্ক হচ্ছে...', gu: 'AWS પર એન્ટરપ્રાઇઝ સુરક્ષા પ્રોફાઇલ સિંક કરી રહ્યું છે...', pa: 'AWS ਤੇ ਐਂਟਰਪ੍ਰਾਈਜ਼ ਸੁਰੱਖਿਆ ਪ੍ਰੋਫਾਈਲ ਸਿੰਕ ਹੋ ਰਿਹਾ ਹੈ...' },
    devName: { en: 'Developer', hi: 'डेवलपर', mr: 'डेव्हलपर', ta: 'டெவலப்பர்', te: 'డెవలపర్', kn: 'ಡೆವಲಪರ್', ml: 'ഡെവലപ്പർ', bn: 'ডেভেলপার', gu: 'ડેવલપર', pa: 'ਡਿਵੈਲਪਰ' }
};

const langs = ['en', 'hi', 'mr', 'ta', 'te', 'kn', 'ml', 'bn', 'gu', 'pa'];

langs.forEach(lang => {
    const reg = new RegExp(`(${lang}: \\{[^}]+)\\},`, 'g');
    const match = content.match(reg);
    if (match) {
        let appendStr = '';
        for (let key in tMap) {
            appendStr += `        ${key}: '${tMap[key][lang] || tMap[key]['en']}',\n`;
        }
        const newBlock = match[0].replace('},', `${appendStr}    },`);
        content = content.replace(match[0], newBlock);
    }
});

fs.writeFileSync('src/utils/translations.js', content, 'utf8');
console.log('SipTracker Translations updated!');
