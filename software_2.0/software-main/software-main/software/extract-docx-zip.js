const AdmZip = require('adm-zip');
const path = process.argv[2];
const fs = require('fs');

async function extractContent() {
  try {
    const zip = new AdmZip(path);
    const zipEntries = zip.getEntries();
    
    // Read document.xml which contains the main content
    const documentXml = zip.readAsText('word/document.xml');
    
    // Simple XML to text extraction (removing tags)
    let text = documentXml
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
      .replace(/&nbsp;/g, ' ')
      .trim();
    
    console.log(text);
  } catch (err) {
    console.error('Error:', err.message);
  }
}

extractContent();