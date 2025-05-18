import fs from 'fs';
import path from 'path';
import readline from 'readline';

const COMMON_TRANSLATIONS: { [key: string]: { [lang: string]: string } } = {
  'check in': { ro: 'check-in' },
  'check out': { ro: 'check-out' },
  'total': { ro: 'total' },
  'per': { ro: 'pe' },
  'contact': { ro: 'contact' },
  'email': { ro: 'email' },
  'august': { ro: 'august' },
  'thursday': { ro: 'joi' },
  'unsubscribe': { ro: 'dezabonare' },
  'cancel': { ro: 'anulează' },
  'cancellation': { ro: 'anulare' },
  'discount': { ro: 'reducere' }
};

interface TranslationItem {
  key: string;
  value: string;
  suggestion?: string;
}

function loadTranslationFile(lang: string): any {
  const filePath = path.join(process.cwd(), 'locales', `${lang}.json`);
  const content = fs.readFileSync(filePath, 'utf8');
  return JSON.parse(content);
}

function saveTranslationFile(lang: string, data: any): void {
  const filePath = path.join(process.cwd(), 'locales', `${lang}.json`);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

function findUntranslatedItems(): TranslationItem[] {
  const en = loadTranslationFile('en');
  const ro = loadTranslationFile('ro');
  const items: TranslationItem[] = [];

  const findItems = (enObj: any, roObj: any, prefix = '') => {
    Object.entries(enObj).forEach(([key, value]) => {
      const fullKey = prefix ? `${prefix}.${key}` : key;
      
      if (typeof value === 'string' && roObj[key] === value) {
        // Find suggestion based on common translations
        let suggestion: string | undefined;
        const lowerValue = value.toLowerCase();
        
        for (const [pattern, translations] of Object.entries(COMMON_TRANSLATIONS)) {
          if (lowerValue.includes(pattern)) {
            suggestion = value.replace(new RegExp(pattern, 'gi'), translations.ro);
            break;
          }
        }
        
        items.push({
          key: fullKey,
          value,
          suggestion
        });
      } else if (typeof value === 'object' && value !== null && roObj[key]) {
        findItems(value, roObj[key], fullKey);
      }
    });
  };

  findItems(en, ro);
  return items;
}

function updateTranslation(key: string, newValue: string): void {
  const ro = loadTranslationFile('ro');
  const keys = key.split('.');
  let current = ro;
  
  for (let i = 0; i < keys.length - 1; i++) {
    if (!current[keys[i]]) {
      current[keys[i]] = {};
    }
    current = current[keys[i]];
  }
  
  current[keys[keys.length - 1]] = newValue;
  saveTranslationFile('ro', ro);
}

async function interactiveTranslation() {
  const items = findUntranslatedItems();
  
  if (items.length === 0) {
    console.log('✅ No untranslated items found!');
    return;
  }
  
  console.log(`Found ${items.length} untranslated items.\n`);
  
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  const question = (prompt: string): Promise<string> => {
    return new Promise(resolve => rl.question(prompt, resolve));
  };
  
  for (const item of items) {
    console.log(`\nKey: ${item.key}`);
    console.log(`English: "${item.value}"`);
    if (item.suggestion) {
      console.log(`Suggestion: "${item.suggestion}"`);
    }
    
    const answer = await question('Romanian translation (or Enter to skip, "s" for suggestion): ');
    
    if (answer.toLowerCase() === 's' && item.suggestion) {
      updateTranslation(item.key, item.suggestion);
      console.log(`✓ Updated with suggestion: "${item.suggestion}"`);
    } else if (answer.trim()) {
      updateTranslation(item.key, answer.trim());
      console.log(`✓ Updated with: "${answer.trim()}"`);
    } else {
      console.log('⏭️  Skipped');
    }
  }
  
  rl.close();
  console.log('\n✅ Translation helper completed!');
}

// Add batch translation option
async function batchTranslate() {
  const items = findUntranslatedItems();
  let updated = 0;
  
  console.log('Starting batch translation with suggestions...\n');
  
  for (const item of items) {
    if (item.suggestion) {
      updateTranslation(item.key, item.suggestion);
      console.log(`✓ ${item.key}: "${item.value}" → "${item.suggestion}"`);
      updated++;
    }
  }
  
  console.log(`\n✅ Batch translation completed: ${updated} items updated`);
  console.log(`ℹ️  ${items.length - updated} items still need manual translation`);
}

// Command line interface
const args = process.argv.slice(2);

if (args[0] === '--batch') {
  batchTranslate();
} else if (args[0] === '--report') {
  const items = findUntranslatedItems();
  console.log('Untranslated items report:\n');
  items.forEach(item => {
    console.log(`${item.key}: "${item.value}"`);
    if (item.suggestion) {
      console.log(`  Suggestion: "${item.suggestion}"`);
    }
  });
  console.log(`\nTotal: ${items.length} items`);
} else {
  console.log('Translation Helper');
  console.log('=================');
  console.log('Options:');
  console.log('  --batch    Apply automatic suggestions');
  console.log('  --report   Show untranslated items report');
  console.log('  (no args)  Interactive translation mode\n');
  
  if (args.length === 0) {
    interactiveTranslation();
  }
}