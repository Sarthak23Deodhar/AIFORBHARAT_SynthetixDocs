import fs from 'fs';

let content = fs.readFileSync('src/utils/translations.js', 'utf8');

if (!content.includes('sa: {')) {
    const sanskritTrans = `
    sa: {
        tabDocs: 'दस्तावेज़नम्',
        tabDiagram: 'वास्तुकलाचित्रम्',
        tabSecurity: 'सुरक्षा',
        btnListen: 'शृणु',
        btnSynthesizing: 'संश्लेषणम् भवति...',
        btnPlaying: 'वादनम् भवति...',
        statusGenerating: 'निर्माणम् भवति...',
        statusReady: 'निर्मितम्',
        sidebarThemeDark: 'अन्धकारमयम्',
        sidebarThemeLight: 'प्रकाशमयम्',
        sidebarSettings: 'सेटिंग्स',
        sidebarLogout: 'निर्गच्छ',
        explainAnalyzing: 'विश्लेषणम् भवति...',
        greenTitle: 'स्थायि-तन्त्रज्ञानम्',
        greenSubtitle: 'अङ्गारपदचिह्नस्य ऊर्जायाश्च विश्लेषणम्',
        greenScanBtn: 'दक्षतां पश्यतु',
        greenScore: 'दक्षता अङ्कः',
        orchTitle: 'अभिकर्तृ-सञ्चालनम्',
        orchRunBtn: 'अभिकर्तृ-प्रणालीं चालयतु',
        greenOpsDashboard: 'हरित-सञ्चालन-फलकम्',
        awsCarbonFootprint: 'AWS ग्राहक-अङ्गार-पदचिह्नम्',
        syncing: 'समकालीकरणम्...',
        refresh: 'नूतनीकरणम्',
        totalCO2e: 'कुल CO₂e',
        metricTons: 'मेट्रिक टन्',
        vsLastMonth: 'गतमासात् -१२%',
        sipTrackerLoading: 'सुरक्षा-प्रणालीं समकालीकरोति...',
        devName: 'विकासकः',
        govTitle: 'AI सॉफ्टवेयर-सामग्री-चिट्टिका',
        govSubtitle: 'भवतः कोड् मध्ये AI उपयोगस्य वास्तविक-समय-अनुसरणम्',
        govAuthLlm: 'रचनात्मक-LLM',
        govFile: 'सञ्चिका',
        searchPlaceholder: 'सर्च-कुंजीं टङ्कयतु...',
        noProposals: 'कानि अपि विवरणानि न प्राप्तानि |',
        summarizeBtn: 'संक्षेपणम् कुरु',
        loading: 'प्रतीक्ष्यताम्...',
        summarize: 'संक्षिप्य वद',
        hide: 'गोपय',
        show: 'दर्शय',
        viewOnSips: 'जालपुटे पश्य',
        askingBedrock: 'AI पृच्छति...',
        analyzeHint: '३ क्रमिक-AI-अभिकर्तृभिः सम्पादके विद्यमानस्य कोड् इत्यस्य विश्लेषणं करोति',
        stage0: 'अन्वेषक-अभिकर्ता दुर्बलतां पश्यति...',
        stage1: 'प्रमाणक-अभिकर्ता प्राप्तान् अंशान् पश्यति...',
        stage2: 'संश्लेषक-अभिकर्ता भवतः प्रतिवेदनं लिखति...',
        scanSummary: 'अन्वेषक-परिणामाः',
        findingsCnt: 'प्राप्तांशाः',
        vResults: 'प्रमाण-परिणामाः',
        confirmed: 'दृढीकृताः',
        sReport: 'संश्लेषित-प्रतिवेदनम्',
        noScanner: 'अन्वेषकेण किमपि न प्राप्तम् |',
        noReport: 'किमपि प्रतिवेदनं न निर्मितम् |',
        confLvl: '% प्रमाणम्'
    },
    `;

    // Add 'sa' to the export default object
    content = content.replace('export default T;', `${sanskritTrans}\nexport default T;`);
    fs.writeFileSync('src/utils/translations.js', content, 'utf8');
    console.log('Sanskrit translations added!');
} else {
    console.log('Sanskrit already exists.');
}
