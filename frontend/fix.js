const fs = require('fs');
const path = require('path');

const adminDir = path.join(__dirname, 'src/app/admin');
const files = [
  'audios/page.tsx',
  'users/page.tsx',
  'buttons/page.tsx',
  'categories/page.tsx',
  'storage/page.tsx',
  'history/page.tsx'
];

files.forEach(f => {
  const filePath = path.join(adminDir, f);
  if (!fs.existsSync(filePath)) return;
  
  let content = fs.readFileSync(filePath, 'utf-8');
  
  // Replace layout containers
  content = content.replace(/rounded-md border border-zinc-200 bg-white/g, 'rounded-xl border border-outline-variant bg-surface-container');
  content = content.replace(/rounded-md/g, 'rounded-xl'); // Change inputs/buttons to match Expressive shapes
  
  // Replace colors
  content = content.replace(/bg-zinc-50/g, 'bg-surface-container-high');
  content = content.replace(/text-zinc-500/g, 'text-on-surface-variant');
  content = content.replace(/text-zinc-700/g, 'text-on-surface');
  content = content.replace(/text-zinc-400/g, 'text-on-surface-variant');
  content = content.replace(/border-zinc-300/g, 'border-outline');
  content = content.replace(/border-zinc-200/g, 'border-outline-variant');
  content = content.replace(/border-zinc-100/g, 'border-outline-variant');
  content = content.replace(/bg-emerald-700/g, 'bg-primary');
  content = content.replace(/text-white/g, 'text-on-primary');
  content = content.replace(/text-zinc-900/g, 'text-on-surface');
  content = content.replace(/text-zinc-950/g, 'text-on-surface');
  
  // Storage specific fixes
  content = content.replace(/text-emerald-700/g, 'text-primary');
  content = content.replace(/bg-emerald-50/g, 'bg-primary-container text-on-primary-container');
  
  fs.writeFileSync(filePath, content);
  console.log('Fixed', f);
});
