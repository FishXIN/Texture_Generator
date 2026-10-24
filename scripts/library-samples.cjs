const { chromium } = require('@playwright/test');
const fs = require('node:fs/promises');
const path = require('node:path');

async function main() {
  const root = path.resolve(process.argv[2] || '../完整纹理库样例');
  await fs.mkdir(root, { recursive: true });
  const browser = await chromium.launch({ executablePath: process.env.TEXTURE_TEST_BROWSER || undefined });
  try {
    const page = await browser.newPage(); await page.goto('http://127.0.0.1:5173');
    const presets = await page.evaluate(async () => {
      const m = await import('/src/features/material/model.ts');
      return m.materialPresets.map(p => ({ id: p.id, name: p.name, group: p.group, category: m.presetGroups[p.group] }));
    });
    const index = [];
    for (const preset of presets) {
      const output = await page.evaluate(async ({ id }) => {
        const m = await import('/src/features/material/model.ts');
        const w = await import('/src/features/material/workerClient.ts');
        const p = m.newMaterial(id); p.export.size = 512;
        const result = await w.materialTask(p, 512, true).promise;
        return { bytes: Array.from(new Uint8Array(await result.blob.arrayBuffer())), project: JSON.stringify(p, null, 2) };
      }, preset);
      const folder = path.join(root, preset.category); await fs.mkdir(folder, { recursive: true });
      const filename = `${preset.name}.png`; await fs.writeFile(path.join(folder, filename), Buffer.from(output.bytes));
      await fs.writeFile(path.join(folder, `${preset.name}.material.json`), output.project);
      index.push({ ...preset, file: `${preset.category}/${filename}` });
      console.log(preset.name);
    }
    const modes = await page.evaluate(async () => {
      const m = await import('/src/features/material/model.ts'); return Object.entries(m.motions).filter(([id]) => id !== 'none');
    });
    await fs.mkdir(path.join(root, '循环动态'), { recursive: true });
    for (const [motion, name] of modes) {
      const bytes = await page.evaluate(async ({ motion }) => {
        const m = await import('/src/features/material/model.ts'), w = await import('/src/features/material/workerClient.ts');
        const p = m.newMaterial(motion === 'refresh' ? 'snow' : 'mixed-grain'); p.export.background = 'transparent';
        p.timeline = { duration: 1, fps: 12, phase: 0 };
        p.layers[0].motion = motion; p.layers[0].count = 150; p.layers[0].sizeMin = .005; p.layers[0].sizeMax = .025;
        const out = await w.materialTask(p, 128, true, undefined, { format: 'sequence' }).promise;
        return Array.from(new Uint8Array(await out.blob.arrayBuffer()));
      }, { motion });
      await fs.writeFile(path.join(root, '循环动态', `${name}.zip`), Buffer.from(bytes));
      console.log(`动态 ${name}`);
    }
    await fs.writeFile(path.join(root, 'index.json'), JSON.stringify(index, null, 2));
    await fs.writeFile(path.join(root, '使用说明.txt'), '119 个黑白预设；每项提供 512 px PNG 和可重新打开的项目。循环动态提供 13 种 12 FPS 透明 PNG 序列，周期端点不重复。PNG 用于正片叠底，柔光组可用滤色。所有素材为程序化质感，不是实物扫描。\n');
  } finally { await browser.close(); }
}
main().catch(e => { console.error(e); process.exitCode = 1; });
