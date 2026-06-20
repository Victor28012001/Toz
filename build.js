// client/build.js
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const wwwDir = path.resolve(__dirname, '../www');

// Create www directory
if (!fs.existsSync(wwwDir)) {
    fs.mkdirSync(wwwDir, { recursive: true });
}

// Copy index.html
let html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
fs.writeFileSync(path.join(wwwDir, 'index.html'), html);

// Copy style.css if exists
const cssPath = path.join(__dirname, 'style.css');
if (fs.existsSync(cssPath)) {
    fs.copyFileSync(cssPath, path.join(wwwDir, 'style.css'));
}

// Copy src directory
const srcDir = path.join(__dirname, 'src');
const destSrcDir = path.join(wwwDir, 'src');
if (fs.existsSync(destSrcDir)) {
    fs.rmSync(destSrcDir, { recursive: true, force: true });
}
fs.cpSync(srcDir, destSrcDir, { recursive: true });

console.log('✅ Build complete! Files copied to ../www');