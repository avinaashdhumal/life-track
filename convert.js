const fs = require('fs');
const path = require('path');

function processFile(filePath) {
    let content = fs.readFileSync(filePath, 'utf8');
    
    // Check if it's already processed to some extent
    if (content.includes("from 'react-native'")) {
        // We'll still process, just in case
    }

    // Replace HTML tags with React Native tags
    content = content.replace(/<div/g, '<View');
    content = content.replace(/<\/div>/g, '</View>');
    
    content = content.replace(/<span/g, '<Text');
    content = content.replace(/<\/span>/g, '</Text>');
    
    content = content.replace(/<p/g, '<Text');
    content = content.replace(/<\/p>/g, '</Text>');
    
    content = content.replace(/<h[1-6]/g, '<Text');
    content = content.replace(/<\/h[1-6]>/g, '</Text>');
    
    content = content.replace(/<button/g, '<TouchableOpacity');
    content = content.replace(/<\/button>/g, '</TouchableOpacity>');
    
    content = content.replace(/<header/g, '<View');
    content = content.replace(/<\/header>/g, '</View>');
    
    content = content.replace(/<main/g, '<ScrollView');
    content = content.replace(/<\/main>/g, '</ScrollView>');
    
    content = content.replace(/<nav/g, '<View');
    content = content.replace(/<\/nav>/g, '</View>');
    
    content = content.replace(/<section/g, '<View');
    content = content.replace(/<\/section>/g, '</View>');
    
    content = content.replace(/<input/g, '<TextInput');
    
    content = content.replace(/onClick=/g, 'onPress=');

    // lucide-react to lucide-react-native
    content = content.replace(/'lucide-react'/g, "'lucide-react-native'");
    
    // Add imports if missing
    if (!content.includes('react-native') && (content.includes('<View') || content.includes('<Text') || content.includes('<TouchableOpacity') || content.includes('<ScrollView'))) {
        content = `import { View, Text, TouchableOpacity, ScrollView, TextInput } from 'react-native';\nimport tw from 'twrnc';\n` + content;
    } else if (content.includes('react-native') && !content.includes('twrnc')) {
        content = content.replace(/import {[^}]+} from 'react-native';/, match => match + `\nimport tw from 'twrnc';`);
    }
    
    // Replace className with twrnc
    // 1. className="string" -> style={tw`string`}
    content = content.replace(/className="([^"]+)"/g, 'style={tw`$1`}');
    
    // 2. className={`string ${var}`} -> style={tw`string ${var}`}
    content = content.replace(/className=\{`([^`]+)`\}/g, 'style={tw`$1`}');
    
    // 3. className={condition ? 'a' : 'b'} -> style={tw.style(condition ? 'a' : 'b')}
    // This is tricky with regex, we'll do a basic replace for the common ones
    // Actually, tw`...` can't take ternary unless inside ${}. 
    // Wait, tw.style() takes arguments.
    // Let's replace className={ with style={tw.style( for complex ones?
    // Let's just do a greedy replace for className={...} where ... is not a template literal
    content = content.replace(/className=\{([^`][^}]+)\}/g, 'style={tw.style($1)}');

    fs.writeFileSync(filePath, content, 'utf8');
}

function walkDir(dir) {
    fs.readdirSync(dir).forEach(f => {
        let dirPath = path.join(dir, f);
        let isDirectory = fs.statSync(dirPath).isDirectory();
        if (isDirectory) {
            walkDir(dirPath);
        } else if (dirPath.endsWith('.tsx') || dirPath.endsWith('.ts')) {
            processFile(dirPath);
        }
    });
}

walkDir('./src');
console.log('Conversion complete.');
