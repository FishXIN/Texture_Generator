import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { Download, Gauge, ImageIcon, Layers3, Sparkles } from 'lucide-react';
import { BaseImageUploader } from '@/features/assets/components/BaseImageUploader';
import { ElementThumbList } from '@/features/assets/components/ElementThumbList';
import { ElementsUploader } from '@/features/assets/components/ElementsUploader';
import { EmptyState } from '@/features/texture/components/EmptyState';
import { PreviewCanvas } from '@/features/texture/components/PreviewCanvas';
import { SeedControl } from '@/features/texture/components/SeedControl';
import { SliderField } from '@/shared/ui/SliderField';
import { ExportBar } from '@/features/export/components/ExportBar';
import { ThemeToggle } from '@/shared/theme/ThemeToggle';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card';
import { generateLayout } from '@/features/texture/engine/layout';
import { useAssetsStore } from '@/features/assets/store';
import { useParamsStore } from '@/features/texture/store';
import { useThemeStore } from '@/shared/theme/store';

export default function App() {
  const [notice, setNotice] = useState('准备就绪');
  const { baseAsset, elements, isLoading, setBaseImage, clearBaseImage, addElements, removeElement } =
    useAssetsStore();
  const { params, setParam, reshuffle } = useParamsStore();
  const { theme, toggleTheme } = useThemeStore();

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  const placements = useMemo(() => {
    if (!baseAsset) return [];
    return generateLayout({
      canvasWidth: baseAsset.width,
      canvasHeight: baseAsset.height,
      elements,
      params,
    });
  }, [baseAsset, elements, params]);

  const baseMeta = baseAsset ? `${baseAsset.width} x ${baseAsset.height}` : '未上传';
  const platform = window.electron?.platform ?? 'web';

  const handleBaseUpload = async (files: File[]) => {
    if (!files[0]) return;
    try {
      await setBaseImage(files[0]);
      setNotice(`已载入底图：${files[0].name}`);
    } catch (error) {
      console.error(error);
      setNotice('底图加载失败，请确认文件可读。');
    }
  };

  const handleElementsUpload = async (files: File[]) => {
    if (!files.length) return;
    try {
      await addElements(files);
      setNotice(`已新增 ${files.length} 个元素素材。`);
    } catch (error) {
      console.error(error);
      setNotice('元素加载失败，请检查 PNG / JPEG / WEBP / SVG 文件。');
    }
  };

  return (
    <div className="h-screen overflow-hidden bg-background text-foreground">
      <div className="flex h-full">
        <main className="flex min-w-0 flex-1 flex-col border-r border-border bg-muted/20">
          <header className="flex items-center justify-between border-b border-border px-6 py-4">
            <div>
              <p className="text-ui-xs uppercase tracking-[0.24em] text-muted-foreground">Texture / Array Generator</p>
              <h1 className="mt-1 text-ui-md font-semibold">纹理 / 阵列生成器</h1>
              <p className="mt-1 text-ui-xs text-muted-foreground">
                Electron + React + Canvas 实时预览，导出 PNG / JPEG / SVG
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="rounded-full border border-border bg-card px-3 py-1 text-ui-xs text-muted-foreground">
                平台：{platform}
              </div>
              <ThemeToggle theme={theme} onToggle={toggleTheme} />
            </div>
          </header>

          <section className="grid grid-cols-3 gap-3 border-b border-border px-6 py-4">
            <StatCard icon={<ImageIcon className="h-4 w-4" />} label="底图尺寸" value={baseMeta} />
            <StatCard icon={<Layers3 className="h-4 w-4" />} label="元素数量" value={`${elements.length}`} />
            <StatCard icon={<Sparkles className="h-4 w-4" />} label="排布实例" value={`${placements.length}`} />
          </section>

          <div className="min-h-0 flex-1 p-4 md:p-6">
            {baseAsset ? (
              <PreviewCanvas baseAsset={baseAsset} elements={elements} placements={placements} />
            ) : (
              <EmptyState />
            )}
          </div>

          <footer className="flex items-center justify-between border-t border-border px-6 py-3 text-ui-xs text-muted-foreground">
            <span>{notice}</span>
            <span>参数调整会实时刷新画布</span>
          </footer>
        </main>

        <aside className="w-[380px] shrink-0 overflow-y-auto bg-background px-4 py-4">
          <div className="space-y-4 pb-8">
            <Card>
              <CardHeader>
                <CardTitle>素材管理</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <BaseImageUploader
                  disabled={isLoading}
                  baseAsset={baseAsset}
                  onUpload={handleBaseUpload}
                  onClear={() => {
                    clearBaseImage();
                    setNotice('已清空底图。');
                  }}
                />
                <ElementsUploader disabled={isLoading} onUpload={handleElementsUpload} />
                <ElementThumbList
                  elements={elements}
                  onRemove={(id, name) => {
                    removeElement(id);
                    setNotice(`已移除元素：${name}`);
                  }}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>参数控制</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <SliderField
                  label="密度"
                  hint="控制随机排布的实例数量，过高会增加计算与绘制压力。"
                  min={1}
                  max={2000}
                  step={1}
                  value={params.density}
                  onChange={(value) => setParam('density', value)}
                />
                <SliderField
                  label="基础尺寸"
                  hint="按元素原始像素的倍数进行缩放。"
                  min={0.1}
                  max={3}
                  step={0.01}
                  value={params.baseSize}
                  onChange={(value) => setParam('baseSize', value)}
                  format={(value) => `${value.toFixed(2)}x`}
                />
                <SliderField
                  label="元素间距"
                  hint="正值时尽量避免元素重叠并保留间隔，负值时允许元素彼此压叠。"
                  min={-120}
                  max={120}
                  step={1}
                  value={params.spacing}
                  onChange={(value) => setParam('spacing', value)}
                  format={(value) => `${Math.round(value)}px`}
                />
                <SliderField
                  label="边缘间距"
                  hint="负值时元素可越过边缘且最多显示一半，0 时刚好贴边，正值时会与边缘保持距离。"
                  min={-200}
                  max={200}
                  step={1}
                  value={params.edgeMargin}
                  onChange={(value) => setParam('edgeMargin', value)}
                  format={(value) => `${Math.round(value)}px`}
                />
                <SliderField
                  label="尺寸随机度"
                  hint="0 表示所有元素同尺寸，1 表示最大随机波动。"
                  min={0}
                  max={1}
                  step={0.01}
                  value={params.sizeRandomness}
                  onChange={(value) => setParam('sizeRandomness', value)}
                  format={(value) => `${Math.round(value * 100)}%`}
                />
                <SliderField
                  label="基础角度"
                  hint="未启用完全随机时，元素会围绕该角度波动。"
                  min={0}
                  max={360}
                  step={1}
                  value={params.baseAngle}
                  onChange={(value) => setParam('baseAngle', value)}
                  format={(value) => `${Math.round(value)}°`}
                />
                <SliderField
                  label="旋转随机度"
                  hint="决定相对基础角度的随机偏移范围。"
                  min={0}
                  max={180}
                  step={1}
                  value={params.rotationRandomness}
                  onChange={(value) => setParam('rotationRandomness', value)}
                  format={(value) => `${Math.round(value)}°`}
                />
                <label className="flex cursor-pointer items-center justify-between rounded-xl border border-border bg-muted/40 px-3 py-3 text-ui-sm">
                  <div>
                    <div className="font-medium">完全随机旋转</div>
                    <div className="mt-1 text-ui-xs text-muted-foreground">开启后将忽略基础角度，直接在 0 - 360 度间随机。</div>
                  </div>
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-primary"
                    checked={params.rotationFullRandom}
                    onChange={(event) => setParam('rotationFullRandom', event.target.checked)}
                  />
                </label>
                <SeedControl
                  seed={params.seed}
                  onSeedChange={(value) => setParam('seed', value)}
                  onReshuffle={() => {
                    reshuffle();
                    setNotice('已刷新随机种子，生成新的排布结果。');
                  }}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>导出</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-start gap-2 rounded-xl border border-border bg-muted/40 px-3 py-3 text-ui-xs text-muted-foreground">
                  <Download className="mt-0.5 h-4 w-4 text-foreground" />
                  <span>位图导出会使用离屏 Canvas 重新绘制，避免预览缩放带来的清晰度损失。</span>
                </div>
                <ExportBar baseAsset={baseAsset} elements={elements} placements={placements} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>当前状态</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-ui-sm text-muted-foreground">
                <InfoLine icon={<Gauge className="h-4 w-4" />} text={`底图：${baseAsset ? baseAsset.name : '未加载'}`} />
                <InfoLine icon={<Layers3 className="h-4 w-4" />} text={`元素：${elements.length} 个`} />
                <InfoLine icon={<Gauge className="h-4 w-4" />} text={`元素间距：${Math.round(params.spacing)}px`} />
                <InfoLine icon={<Gauge className="h-4 w-4" />} text={`边缘间距：${Math.round(params.edgeMargin)}px`} />
                <InfoLine icon={<Sparkles className="h-4 w-4" />} text={`随机种子：${params.seed}`} />
              </CardContent>
            </Card>
          </div>
        </aside>
      </div>
    </div>
  );
}

function StatCard({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card px-4 py-3 shadow-sm shadow-black/5">
      <div className="flex items-center gap-2 text-ui-xs text-muted-foreground">
        {icon}
        <span>{label}</span>
      </div>
      <div className="mt-2 text-ui-md font-semibold text-foreground">{value}</div>
    </div>
  );
}

function InfoLine({ icon, text }: { icon: ReactNode; text: string }) {
  return <div className="flex items-center gap-2">{icon}<span>{text}</span></div>;
}
