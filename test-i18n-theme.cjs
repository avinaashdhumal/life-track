const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('🧪 Starting LifeTrack i18n, Theme & Accessibility Test Suite...\n');

// 1. Load and validate translation JSON files
const locales = ['en', 'hi', 'mr', 'es'];
const localeData = {};

for (const loc of locales) {
  const filePath = path.join(__dirname, 'src/i18n/locales', `${loc}.json`);
  assert(fs.existsSync(filePath), `Translation file missing: ${filePath}`);
  const content = fs.readFileSync(filePath, 'utf8');
  localeData[loc] = JSON.parse(content);
  console.log(`✅ Loaded and parsed ${loc}.json successfully`);
}

// 2. Parity Test across all locales
function extractLeafKeys(obj, prefix = '') {
  let keys = [];
  for (const k of Object.keys(obj)) {
    const full = prefix ? `${prefix}.${k}` : k;
    if (typeof obj[k] === 'object' && obj[k] !== null && !Array.isArray(obj[k])) {
      keys = keys.concat(extractLeafKeys(obj[k], full));
    } else {
      keys.push(full);
    }
  }
  return keys;
}

const enKeys = new Set(extractLeafKeys(localeData.en));
console.log(`\n🔑 Total keys defined in English base: ${enKeys.size}`);

for (const loc of ['hi', 'mr', 'es']) {
  const locKeys = new Set(extractLeafKeys(localeData[loc]));
  const missing = [...enKeys].filter((k) => !locKeys.has(k));
  const extra = [...locKeys].filter((k) => !enKeys.has(k));

  assert.strictEqual(missing.length, 0, `${loc} has missing keys: ${missing.join(', ')}`);
  assert.strictEqual(extra.length, 0, `${loc} has extra keys: ${extra.join(', ')}`);
  console.log(`✅ 100% key parity verified for locale "${loc}" (${locKeys.size}/${enKeys.size} keys match)`);
}

// 3. Test string interpolation tokens matching between base and translations
console.log('\n🔍 Testing interpolation placeholders across all languages...');
function getInterpolationTokens(str) {
  if (typeof str !== 'string') return [];
  const matches = str.match(/\{\{([a-zA-Z0-9_]+)\}\}/g);
  return matches ? matches.map((m) => m.replace(/[{}]/g, '')) : [];
}

function verifyPlaceholders(enObj, targetObj, loc, path = '') {
  for (const key of Object.keys(enObj)) {
    const currentPath = path ? `${path}.${key}` : key;
    const enVal = enObj[key];
    const targetVal = targetObj[key];

    if (typeof enVal === 'string' && typeof targetVal === 'string') {
      const enTokens = getInterpolationTokens(enVal).sort();
      const targetTokens = getInterpolationTokens(targetVal).sort();
      assert.deepStrictEqual(
        enTokens,
        targetTokens,
        `Mismatch in interpolation tokens at "${currentPath}" in "${loc}": expected [${enTokens}] but got [${targetTokens}]`
      );
    } else if (typeof enVal === 'object' && enVal !== null && !Array.isArray(enVal)) {
      verifyPlaceholders(enVal, targetVal, loc, currentPath);
    }
  }
}

for (const loc of ['hi', 'mr', 'es']) {
  verifyPlaceholders(localeData.en, localeData[loc], loc);
  console.log(`✅ All interpolation placeholders match exactly for "${loc}"`);
}

// 4. Verify Theme definitions
console.log('\n🎨 Testing Theme tokens and Light/Dark contrasts...');
const themeContextFile = fs.readFileSync(path.join(__dirname, 'src/context/ThemeContext.tsx'), 'utf8');

assert(themeContextFile.includes("darkColors: ThemeColors"), 'Dark theme colors defined');
assert(themeContextFile.includes("lightColors: ThemeColors"), 'Light theme colors defined');
assert(themeContextFile.includes("bg: '#09090b'"), 'Dark background defined as zinc-950 (#09090b)');
assert(themeContextFile.includes("bg: '#f8fafc'"), 'Light background defined as slate-50 (#f8fafc)');
assert(themeContextFile.includes("statusBarStyle: 'light-content'"), 'Dark status bar style light-content');
assert(themeContextFile.includes("statusBarStyle: 'dark-content'"), 'Light status bar style dark-content');
console.log('✅ Theme color palettes and semantic tokens verified');

// 5. Verify Accessibility attributes in components
console.log('\n♿ Testing Accessibility (a11y) attributes in source files...');
// Every UI file with interactive elements is audited (found automatically, so new or moved
// screens can't silently skip the check).
const listTsxFiles = (dir) =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return listTsxFiles(full);
    return entry.name.endsWith('.tsx') ? [path.relative(__dirname, full)] : [];
  });
const filesToCheck = ['src/App.tsx', ...listTsxFiles(path.join(__dirname, 'src/features'))].filter((file) => {
  const content = fs.readFileSync(path.join(__dirname, file), 'utf8');
  return /onPress=|<TouchableOpacity|<Switch|<TextInput/.test(content);
});

for (const file of filesToCheck) {
  const content = fs.readFileSync(path.join(__dirname, file), 'utf8');
  assert(content.includes('accessible={true}'), `${file} contains accessible={true}`);
  assert(content.includes('accessibilityRole='), `${file} contains accessibilityRole`);
  assert(content.includes('accessibilityLabel='), `${file} contains accessibilityLabel`);
  console.log(`✅ ${file} passed accessibility attributes check`);
}

// 5b. Every translation key used in the code exists (a missing key shows the raw key to users)
console.log('\n🔎 Checking that every t(\'key\') used in src/ exists in en.json...');
const listSourceFiles = (dir) =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === '__tests__' ? [] : listSourceFiles(full);
    return /\.(ts|tsx)$/.test(entry.name) ? [full] : [];
  });
const hasKey = (key) => key.split('.').reduce((obj, part) => (obj ? obj[part] : undefined), localeData.en) !== undefined;
const missingKeys = [];
for (const file of listSourceFiles(path.join(__dirname, 'src'))) {
  const content = fs.readFileSync(file, 'utf8');
  for (const match of content.matchAll(/\bt\(\s*['"]([a-zA-Z0-9_]+\.[a-zA-Z0-9_.]+)['"]/g)) {
    if (!hasKey(match[1])) missingKeys.push(`${path.relative(__dirname, file)}: ${match[1]}`);
  }
}
assert.deepStrictEqual(missingKeys, [], `Translation keys used in code but missing from en.json:\n${missingKeys.join('\n')}`);
console.log('✅ All translation keys used in code exist');

// 6. Test runtime translation resolution with i18next
console.log('\n🌐 Testing runtime i18next translation resolution and language switching...');
const i18n = require('i18next');

i18n.init({
  resources: {
    en: { translation: localeData.en },
    hi: { translation: localeData.hi },
    mr: { translation: localeData.mr },
    es: { translation: localeData.es }
  },
  lng: 'en',
  fallbackLng: 'en',
  interpolation: { escapeValue: false }
});

// Test English
assert.strictEqual(i18n.t('app.name'), 'LifeTrack');
assert.strictEqual(i18n.t('tabs.alarms'), 'Alarms');
assert.strictEqual(i18n.t('fullScreenAlarm.snooze', { minutes: 10 }), 'Snooze 10 Minutes');
assert.strictEqual(i18n.t('routine.title'), 'Daily Routine');
assert.strictEqual(i18n.t('shift.title'), 'Shift & Schedule');
console.log('✅ English (en) runtime translations verified');

// Test Hindi
i18n.changeLanguage('hi');
assert.strictEqual(i18n.t('app.name'), 'लाइफट्रैक');
assert.strictEqual(i18n.t('tabs.alarms'), 'अलार्म');
assert.strictEqual(i18n.t('categories.medicine'), 'दवाई');
assert.strictEqual(i18n.t('fullScreenAlarm.snooze', { minutes: 10 }), '10 मिनट स्नूज़');
assert.strictEqual(i18n.t('routine.title'), 'दैनिक दिनचर्या');
assert.strictEqual(i18n.t('shift.title'), 'शिफ्ट और अनुसूची');
console.log('✅ Hindi (hi) runtime translations verified');

// Test Marathi
i18n.changeLanguage('mr');
assert.strictEqual(i18n.t('app.name'), 'लाइफट्रॅक');
assert.strictEqual(i18n.t('tabs.alarms'), 'अलार्म');
assert.strictEqual(i18n.t('categories.medicine'), 'औषध');
assert.strictEqual(i18n.t('fullScreenAlarm.snooze', { minutes: 10 }), '10 मिनिटे स्नूझ');
assert.strictEqual(i18n.t('routine.title'), 'दैनिक दिनचर्या');
assert.strictEqual(i18n.t('shift.title'), 'शिफ्ट आणि वेळापत्रक');
console.log('✅ Marathi (mr) runtime translations verified');

// Test Spanish
i18n.changeLanguage('es');
assert.strictEqual(i18n.t('app.name'), 'LifeTrack');
assert.strictEqual(i18n.t('tabs.alarms'), 'Alarmas');
assert.strictEqual(i18n.t('categories.medicine'), 'Medicamento');
assert.strictEqual(i18n.t('fullScreenAlarm.snooze', { minutes: 10 }), 'Posponer 10 minutos');
assert.strictEqual(i18n.t('routine.title'), 'Rutina Diaria');
assert.strictEqual(i18n.t('shift.title'), 'Turnos y Horario');
console.log('✅ Spanish (es) runtime translations verified');

console.log('\n🎉 ALL TESTS PASSED! 100% SUCCESS.\n');
