import { lazy, Suspense, useState } from 'react';
import { MaterialStudio } from '@/features/material/MaterialStudio';
import { parseProject } from '@/features/project/io';
import { useProjectStore } from '@/features/project/store';
const PatternStudio = lazy(() => import('./PatternStudio'));

export default function App() {
  const [pattern, setPattern] = useState(new URLSearchParams(location.search).get('studio') === 'pattern');
  const openPattern = (text: string) => {
    useProjectStore.getState().replace(parseProject(text));
    history.replaceState(null, '', `${location.pathname}?studio=pattern`); setPattern(true);
  };
  return pattern ? <Suspense fallback={<div style={{ padding: 24 }}>正在打开图形工作台…</div>}><PatternStudio /></Suspense>
    : <MaterialStudio onOpenPattern={openPattern} />;
}
