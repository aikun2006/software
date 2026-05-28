const mammoth = require('mammoth');
const path = process.argv[2];

async function extractContent() {
  try {
    const result = await mammoth.convertToHtml({ path });
    console.log(result.value);
  } catch (err) {
    console.error('Error:', err.message);
  }
}

extractContent();