const fs = require('fs');
const path = require('path');

const files = [
  'src/features/poc/RecurringAlarmModal.tsx',
  'src/features/poc/AlarmTestScreen.tsx',
  'src/features/poc/NativeCodeInspectorModal.tsx',
  'src/features/poc/AlarmConflictModal.tsx',
  'src/features/poc/Alarm24hTimelineChart.tsx',
  'src/features/poc/FullScreenAlarmModal.tsx',
  'src/features/poc/HealthCheckScreen.tsx'
];

files.forEach(file => {
  const filePath = path.join(__dirname, file);
  if (!fs.existsSync(filePath)) return;
  
  let content = fs.readFileSync(filePath, 'utf-8');
  
  // Skip if already added
  if (content.includes('import tw from')) return;
  
  const importToAdd = `import { View, Text, TouchableOpacity, ScrollView, TextInput, Switch, Image } from 'react-native';\nimport tw from 'twrnc';\n`;
  
  // Add right after React import
  content = content.replace(/(import React.*?;\n)/, `$1${importToAdd}`);
  
  // Or at the top if React import not found
  if (!content.includes(importToAdd)) {
    content = importToAdd + content;
  }
  
  fs.writeFileSync(filePath, content, 'utf-8');
});
console.log('Fixed imports');
