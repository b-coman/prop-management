// scripts/validate-multipage-structure.ts
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { websiteTemplateSchema, propertyOverridesSchema } from '../src/lib/overridesSchemas-multipage';

// Template and overrides file paths
const TEMPLATE_PATH = resolve(__dirname, '../firestore/websiteTemplates/holiday-house-multipage.json');
const OVERRIDES_PATH = resolve(__dirname, '../firestore/propertyOverrides/prahova-mountain-chalet-multipage.json');

function validateTemplate() {
  try {
    console.log(`📋 Validating template file: ${TEMPLATE_PATH}`);
    const templateData = JSON.parse(readFileSync(TEMPLATE_PATH, 'utf8'));
    
    // Validate against the schema
    const result = websiteTemplateSchema.safeParse(templateData);
    
    if (result.success) {
      console.log('✅ Template validation passed!');
      return true;
    } else {
      console.error('❌ Template validation failed:');
      console.error(result.error.format());
      return false;
    }
  } catch (error) {
    console.error('❌ Error reading or parsing template file:', error);
    return false;
  }
}

function validateOverrides() {
  try {
    console.log(`📋 Validating overrides file: ${OVERRIDES_PATH}`);
    const overridesData = JSON.parse(readFileSync(OVERRIDES_PATH, 'utf8'));
    
    // Validate against the schema
    const result = propertyOverridesSchema.safeParse(overridesData);
    
    if (result.success) {
      console.log('✅ Overrides validation passed!');
      return true;
    } else {
      console.error('❌ Overrides validation failed:');
      console.error(result.error.format());
      return false;
    }
  } catch (error) {
    console.error('❌ Error reading or parsing overrides file:', error);
    return false;
  }
}

function main() {
  console.log('🔍 Starting validation of multi-page template and overrides...');
  
  const templateValid = validateTemplate();
  const overridesValid = validateOverrides();
  
  if (templateValid && overridesValid) {
    console.log('✅ All validations passed! Files are ready to be uploaded to Firestore.');
  } else {
    console.error('❌ Validation failed. Please fix the issues before uploading to Firestore.');
    process.exit(1);
  }
}

main();