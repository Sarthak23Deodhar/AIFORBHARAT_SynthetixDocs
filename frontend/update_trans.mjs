import fs from 'fs';

let content = fs.readFileSync('src/utils/translations.js', 'utf8');

const tMap = {
    tabDocs: { en: '📄 Documentation', hi: '📄 दस्तावेज़', mr: '📄 दस्तऐवज', ta: '📄 ஆவணம்', te: '📄 డాక్యుమెంటేషన్', kn: '📄 ದಾಖಲೆ', ml: '📄 ഡോക്യുമെന്റേഷൻ', bn: '📄 ডকুমেন্টেশন', gu: '📄 દસ્તાવેજ', pa: '📄 ਦਸਤਾਵੇਜ਼' },
    tabGreenops: { en: '🌱 GreenOps', hi: '🌱 ग्रीनओप्स', mr: '🌱 ग्रीनऑप्स', ta: '🌱 கிரீன்ஆப்ஸ்', te: '🌱 గ్రీన్‌ఆప్స్', kn: '🌱 ಗ್ರೀನ್‌ಆಪ್ಸ್', ml: '🌱 ഗ്രീൻഓപ്സ്', bn: '🌱 গ্রিনঅপস', gu: '🌱 ગ્રીનઓપ્સ', pa: '🌱 ਗ੍ਰੀਨਓਪਸ' },
    tabGovernance: { en: '⚖️ Governance', hi: '⚖️ गवर्नेंस', mr: '⚖️ गव्हर्नन्स', ta: '⚖️ நிர்வாகம்', te: '⚖️ పాలన', kn: '⚖️ ಆಡಳಿತ', ml: '⚖️ ഭരണം', bn: '⚖️ প্রশাসন', gu: '⚖️ શાસન', pa: '⚖️ ਪ੍ਰਸ਼ਾਸਨ' },
    tabOrchestrator: { en: '⚙️ Orchestrator', hi: '⚙️ ऑर्केस्ट्रेटर', mr: '⚙️ ऑर्केस्ट्रेटर', ta: '⚙️ ஆர்கெஸ்ட்ரேட்டர்', te: '⚙️ ఆర్కెస్ట్రేటర్', kn: '⚙️ ಆರ್ಕೆಸ್ಟ್ರೇಟರ್', ml: '⚙️ ഓർക്കസ്‌ട്രേറ്റർ', bn: '⚙️ অর্কেস্ট্রেটর', gu: '⚙️ ઓર્કેસ્ટ્રેટર', pa: '⚙️ ਆਰਕੈਸਟਰੇਟਰ' },
    sidebarCode: { en: 'Code Viewer', hi: 'कोड व्यूअर', mr: 'कोड व्हিউअर', ta: 'குறியீடு பார்வையாளர்', te: 'కోడ్ వ్యూయర్', kn: 'ಕೋಡ್ ವೀಕ್ಷಕ', ml: 'കോഡ് വ്യൂവർ', bn: 'কোড ভিউয়ার', gu: 'કોડ વ્યૂઅર', pa: 'ਕੋਡ ਦਰਸ਼ਕ' },
    sidebarSettings: { en: 'Settings', hi: 'सेटिंग्स', mr: 'सेटिंग्ज', ta: 'அமைப்புகள்', te: 'సెట్టింగులు', kn: 'ಸೆಟ್ಟಿಂಗ್‌ಗಳು', ml: 'ക്രമീകരണങ്ങൾ', bn: 'সেটিংস', gu: 'સેટિંગ્સ', pa: 'ਸੈਟਿੰਗਜ਼' },
    sidebarLogout: { en: 'Logout', hi: 'लॉगआउट', mr: 'लॉगआउट', ta: 'வெளியேறு', te: 'లాగ్అవుట్', kn: 'ಲಾಗ್ಔಟ್', ml: 'ലോഗ്ഔട്ട്', bn: 'লগআউট', gu: 'લોગઆઉટ', pa: 'ਲਾਗਆਊਟ' },
    sidebarThemeDark: { en: 'Dark Mode', hi: 'डार्क मोड', mr: 'डार्क मोड', ta: 'இருள் முறை', te: 'డార్క్ మోడ్', kn: 'ಡಾರ್ಕ್ ಮೋಡ್', ml: 'ഡാർക്ക് മോഡ്', bn: 'ডার্ক মোড', gu: 'ડાર્ક મોડ', pa: 'ਡਾਰਕ ਮੋਡ' },
    sidebarThemeLight: { en: 'Light Mode', hi: 'लाइट मोड', mr: 'लाइट मोड', ta: 'ஒளி முறை', te: 'లైట్ మోడ్', kn: 'ಲೈಟ್ ಮೋಡ್', ml: 'ലൈറ്റ് മോഡ്', bn: 'লাইট মোড', gu: 'લાઇટ મોડ', pa: 'ਲਾਈਟ ਮੋਡ' },
    headerExplain: { en: 'Explain', hi: 'विवरण दें', mr: 'स्पष्टीकरण द्या', ta: 'விளக்க', te: 'వివరించండి', kn: 'ವಿವರಿಸಿ', ml: 'വിശദീകരിക്കുക', bn: 'ব্যাখ্যা করুন', gu: 'સમજાવો', pa: 'ਸਮਝਾਓ' },
    headerExplaining: { en: 'Explaining…', hi: 'विवरण दे रहा है…', mr: 'स्पष्टीकरण देत आहे…', ta: 'விளக்குகிறது…', te: 'వివరిస్తోంది…', kn: 'ವಿವರಿಸಲಾಗುತ್ತಿದೆ…', ml: 'വിശദീകരിക്കുന്നു…', bn: 'ব্যাখ্যা করছে…', gu: 'સમજાવી રહ્યું છે…', pa: 'ਸਮਝਾ ਰਿਹਾ ਹੈ…' },
    headerAiExplanation: { en: 'AI Explanation', hi: 'AI विवरण', mr: 'AI स्पष्टीकरण', ta: 'AI விளக்கம்', te: 'AI వివరణ', kn: 'AI ವಿವರಣೆ', ml: 'AI വിശദീകരണം', bn: 'AI ব্যাখ্যা', gu: 'AI સમજૂતી', pa: 'AI ਵਿਆਖਿਆ' },
    linesLabel: { en: 'lines', hi: 'पंक्तियाँ', mr: 'ओळी', ta: 'வரிகள்', te: 'పంక్తులు', kn: 'ಸಾಲುಗಳು', ml: 'വരികൾ', bn: 'লাইন', gu: 'રેખાઓ', pa: 'ਲਾਈਨਾਂ' },
    codeClean: { en: 'Code is Clean', hi: 'कोड सुरक्षित है', mr: 'कोड सुरक्षित आहे', ta: 'குறியீடு சுத்தமாக உள்ளது', te: 'కోడ్ సురక్షితంగా ఉంది', kn: 'ಕೋಡ್ ಸುರಕ್ಷಿತವಾಗಿದೆ', ml: 'കോഡ് സുരക്ഷിതമാണ്', bn: 'কোড পরিষ্কার', gu: 'કોડ સ્વચ્છ છે', pa: 'ਕੋਡ ਸਾਫ਼ ਹੈ' }
};

const langs = ['en', 'hi', 'mr', 'ta', 'te', 'kn', 'ml', 'bn', 'gu', 'pa'];

langs.forEach(lang => {
    const reg = new RegExp(`(${lang}: \\{[^}]+)\\},`, 'g');
    const match = content.match(reg);
    if (match) {
        let appendStr = '';
        for (let key in tMap) {
            appendStr += `        ${key}: '${tMap[key][lang]}',\n`;
        }
        const newBlock = match[0].replace('},', `${appendStr}    },`);
        content = content.replace(match[0], newBlock);
    }
});

fs.writeFileSync('src/utils/translations.js', content, 'utf8');
console.log('Translations updated!');
