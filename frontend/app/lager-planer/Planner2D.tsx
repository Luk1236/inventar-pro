import React, { useState, useRef } from 'react';
import type { LayoutState, LayoutItem, StockState, StockMappingItem } from './index';

// ─── Design tokens ────────────────────────────────────────────────────────────
const T = {
  bg: '#080f1c', sidebar: '#0c1929', gridMaj: 'rgba(59,130,246,0.3)', gridMin: 'rgba(59,130,246,0.08)',
  text: '#e8edf5', textDim: '#4e6a85', selectedStroke: '#fff', sidebarBorder: 'rgba(30,64,148,0.4)',
  
  // Storage
  rack: 'rgba(234, 179, 8, 0.7)', rackStroke: '#facc15',
  cantilever: 'rgba(249, 115, 22, 0.7)', cantileverStroke: '#fb923c',
  shelf: 'rgba(250, 204, 21, 0.7)', shelfStroke: '#fde047',
  cablerack: 'rgba(202, 138, 4, 0.7)', cablerackStroke: '#eab308',
  hazmat: 'rgba(220, 38, 38, 0.7)', hazmatStroke: '#ef4444',
  
  // Transport
  forklift: 'rgba(234, 179, 8, 0.9)', forkliftStroke: '#fbbf24',
  palletjack: 'rgba(156, 163, 175, 0.9)', palletjackStroke: '#d1d5db',
  conveyor: 'rgba(75, 85, 99, 0.8)', conveyorStroke: '#9ca3af',
  dolly: 'rgba(180, 83, 9, 0.9)', dollyStroke: '#d97706',
  scissorlift: 'rgba(2ea, 88, 12, 0.9)', scissorliftStroke: '#f97316',

  // Workspaces
  table: '#4b5563', tableStroke: '#9ca3af',
  office: 'rgba(59, 130, 246, 0.2)', officeStroke: '#60a5fa',
  workbench: '#374151', workbenchStroke: '#6b7280',
  charging: 'rgba(6, 182, 212, 0.4)', chargingStroke: '#22d3ee',
  trash: 'rgba(16, 185, 129, 0.4)', trashStroke: '#34d399',

  // Infra
  zone: 'rgba(59, 130, 246, 0.4)', zoneStroke: '#60a5fa',
  door: 'rgba(16, 185, 129, 0.6)', doorStroke: '#34d399',
  rolldoor: 'rgba(148, 163, 184, 0.6)', rolldoorStroke: '#94a3b8',
  ramp: 'rgba(100, 116, 139, 0.6)', rampStroke: '#64748b',
  stairs: 'rgba(107, 114, 128, 0.6)', stairsStroke: '#9ca3af',
  pillar: '#374151', pillarStroke: '#6b7280',
  fireext: 'rgba(239, 68, 68, 0.8)', fireextStroke: '#f87171',
  dangerzone: 'rgba(234, 179, 8, 0.4)', dangerzoneStroke: '#facc15',
  wall: '#94a3b8', wallStroke: '#cbd5e1',

  // Media
  pallet: '#8B5A2B', palletStroke: '#A0522D',
  wirebox: 'rgba(156, 163, 175, 0.3)', wireboxStroke: '#d1d5db',
  flightcase: '#111827', flightcaseStroke: '#d1d5db',
  wirecart: 'rgba(107, 114, 128, 0.4)', wirecartStroke: '#9ca3af',
  ibc: 'rgba(255, 255, 255, 0.4)', ibcStroke: '#e2e8f0',
};

const CELL_SIZE = 20;

type Planner2DProps = { layout: LayoutState; setLayout: React.Dispatch<React.SetStateAction<LayoutState>>; stock: StockState; setStock: React.Dispatch<React.SetStateAction<StockState>>; articles: any[]; pickRoute: string[]; setPickRoute: React.Dispatch<React.SetStateAction<string[]>> };

export default function Planner2D({ layout, setLayout, stock, setStock, articles, pickRoute, setPickRoute }: Planner2DProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dragging, setDragging] = useState<{ id: string; offsetX: number; offsetY: number } | null>(null);
  const [activeTab, setActiveTab] = useState<'tools' | 'inventory' | 'route'>('tools');
  const [openCat, setOpenCat] = useState<string>('storage');
  const [selectedSpot, setSelectedSpot] = useState<{ level: number, spot: number } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const getPointerCoords = (e: React.PointerEvent<SVGSVGElement> | PointerEvent) => {
    if (!svgRef.current) return { x: 0, y: 0 };
    const pt = svgRef.current.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY;
    const cursorPt = pt.matrixTransform(svgRef.current.getScreenCTM()?.inverse());
    return { x: cursorPt.x / CELL_SIZE, y: cursorPt.y / CELL_SIZE };
  };

  const handlePointerDown = (e: React.PointerEvent<SVGRectElement>, item: LayoutItem) => {
    e.stopPropagation(); setSelectedId(item.id); setSelectedSpot(null);
    const { x, y } = getPointerCoords(e);
    setDragging({ id: item.id, offsetX: x - item.x, offsetY: y - item.y });
    // @ts-ignore
    e.target.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!dragging) return;
    const { x, y } = getPointerCoords(e);
    let newX = Math.round(x - dragging.offsetX); let newY = Math.round(y - dragging.offsetY);
    newX = Math.max(0, Math.min(newX, layout.grid.width)); newY = Math.max(0, Math.min(newY, layout.grid.height));
    setLayout(prev => ({ ...prev, items: prev.items.map(it => it.id === dragging.id ? { ...it, x: newX, y: newY } : it) }));
  };

  const handlePointerUp = (e: React.PointerEvent<SVGSVGElement>) => {
    if (dragging) {
      // @ts-ignore
      if (e.target.releasePointerCapture) e.target.releasePointerCapture(e.pointerId);
      setDragging(null);
    }
  };

  const addItem = (type: LayoutItem['type'], customLabel?: string, customColor?: string) => {
    let w = 2, h = 2;
    if (['pillar', 'pallet', 'palletjack', 'hazmat', 'dolly', 'fireext', 'flightcase', 'wirecart', 'ibc'].includes(type)) { w = 1; h = 1; }
    if (['rack', 'cantilever', 'shelf', 'conveyor', 'stairs', 'cablerack'].includes(type)) { w = 4; h = 1; }
    if (['forklift', 'table', 'wirebox', 'charging', 'trash'].includes(type)) { w = 2; h = 1; }
    if (['scissorlift'].includes(type)) { w = 1; h = 2; }
    if (['workbench'].includes(type)) { w = 3; h = 1; }
    if (['office', 'ramp'].includes(type)) { w = 4; h = 4; }
    if (['wall'].includes(type)) { w = 5; h = 0.5; }

    const isStorage = ['rack', 'cantilever', 'shelf', 'cablerack'].includes(type);

    const newItem: LayoutItem = {
      id: Math.random().toString(36).substring(2, 9),
      type, x: Math.floor(layout.grid.width / 2), y: Math.floor(layout.grid.height / 2), w, h, rotation: 0,
      label: customLabel || type.toUpperCase(),
      levels: isStorage ? 4 : undefined,
      spots: isStorage ? 4 : undefined,
      color: customColor,
    };
    setLayout(prev => ({ ...prev, items: [...prev.items, newItem] }));
    setSelectedId(newItem.id);
  };

  const deleteSelected = () => {
    if (!selectedId) return;
    setLayout(prev => ({ ...prev, items: prev.items.filter(it => it.id !== selectedId) }));
    setStock(prev => ({ ...prev, mapping: prev.mapping.filter(m => m.rack_id !== selectedId) }));
    setSelectedId(null);
  };

  const rotateSelected = () => {
    if (!selectedId) return;
    setLayout(prev => ({ ...prev, items: prev.items.map(it => it.id === selectedId ? { ...it, w: it.h, h: it.w, rotation: (it.rotation + 90) % 360 } : it) }));
  };

  const selectedItem = layout.items.find(it => it.id === selectedId);

  const assignArticleToSpot = (articleId: string) => {
    if (!selectedItem || !selectedSpot) return;
    setStock(prev => {
      const filtered = prev.mapping.filter(m => !(m.rack_id === selectedItem.id && m.level === selectedSpot.level && m.spot === selectedSpot.spot));
      if (articleId === 'CLEAR') return { mapping: filtered };
      return { mapping: [...filtered, { article_id: articleId, rack_id: selectedItem.id, level: selectedSpot.level, spot: selectedSpot.spot, quantity: 1 }] };
    });
  };

  const categories = [
    {
      id: 'storage', title: '🏗️ Regale & Lagerung',
      items: [
        { type: 'rack', label: '+ Schwerlastregal', color: T.rackStroke },
        { type: 'cantilever', label: '+ Kragarmregal', color: T.cantileverStroke },
        { type: 'shelf', label: '+ Fachbodenregal', color: T.shelfStroke },
        { type: 'cablerack', label: '+ Kabeltrommel-Regal', color: T.cablerackStroke },
        { type: 'hazmat', label: '+ Gefahrstoffschrank', color: T.hazmatStroke },
      ]
    },
    {
      id: 'handling', title: '🚜 Fahrzeuge & Transport',
      items: [
        { type: 'forklift', label: '+ Gabelstapler', color: T.forkliftStroke },
        { type: 'palletjack', label: '+ Hubwagen', color: T.palletjackStroke },
        { type: 'dolly', label: '+ Rollbrett / Dolly', color: T.dollyStroke },
        { type: 'scissorlift', label: '+ Scherenhebebühne', color: T.scissorliftStroke },
        { type: 'conveyor', label: '+ Förderband', color: T.conveyorStroke },
      ]
    },
    {
      id: 'work', title: '🛠️ Arbeitsbereiche',
      items: [
        { type: 'table', label: '+ Packtisch', color: T.tableStroke },
        { type: 'office', label: '+ Büro-Container', color: T.officeStroke },
        { type: 'workbench', label: '+ Werkbank (Toolboard)', color: T.workbenchStroke },
        { type: 'charging', label: '+ Lade-Station', color: T.chargingStroke },
        { type: 'trash', label: '+ Müll-Trennstation', color: T.trashStroke },
      ]
    },
    {
      id: 'infra', title: '🧱 Gebäude & Zonen',
      items: [
        { type: 'wall', label: '+ Wand (Architektur)', color: T.wallStroke },
        { type: 'door', label: '+ Personentür', color: T.doorStroke },
        { type: 'rolldoor', label: '+ Rolltor', color: T.rolldoorStroke },
        { type: 'ramp', label: '+ Laderampe', color: T.rampStroke },
        { type: 'stairs', label: '+ Treppe', color: T.stairsStroke },
        { type: 'pillar', label: '+ Betonpfeiler', color: T.pillarStroke },
        { type: 'fireext', label: '+ Feuerlösch-Station', color: T.fireextStroke },
      ]
    },
    {
      id: 'media', title: '🧰 Ladehilfsmittel',
      items: [
        { type: 'pallet', label: '+ Europalette', color: T.palletStroke },
        { type: 'wirebox', label: '+ Gitterbox', color: T.wireboxStroke },
        { type: 'flightcase', label: '+ Flightcase', color: T.flightcaseStroke },
        { type: 'wirecart', label: '+ Kabel-Gitterwagen', color: T.wirecartStroke },
        { type: 'ibc', label: '+ IBC Container', color: T.ibcStroke },
      ]
    }
  ];

  return (
    <div style={{ display: 'flex', width: '100%', height: '100%', background: T.bg, fontFamily: 'system-ui' }}>
      
      {/* SIDEBAR */}
      <div style={{ width: 340, background: T.sidebar, borderRight: `1px solid ${T.sidebarBorder}`, display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', borderBottom: `1px solid ${T.sidebarBorder}` }}>
          <button onClick={() => setActiveTab('tools')} style={{ ...tabBtnStyle, background: activeTab === 'tools' ? 'rgba(59,130,246,0.1)' : 'transparent', color: activeTab === 'tools' ? '#60a5fa' : T.textDim, borderBottom: activeTab === 'tools' ? '2px solid #3b82f6' : 'none' }}>
            🧰 Werkzeuge
          </button>
          <button onClick={() => setActiveTab('inventory')} style={{ ...tabBtnStyle, background: activeTab === 'inventory' ? 'rgba(59,130,246,0.1)' : 'transparent', color: activeTab === 'inventory' ? '#60a5fa' : T.textDim, borderBottom: activeTab === 'inventory' ? '2px solid #3b82f6' : 'none' }}>
            📦 Einlagern
          </button>
          <button onClick={() => setActiveTab('route')} style={{ ...tabBtnStyle, background: activeTab === 'route' ? 'rgba(59,130,246,0.1)' : 'transparent', color: activeTab === 'route' ? '#60a5fa' : T.textDim, borderBottom: activeTab === 'route' ? '2px solid #3b82f6' : 'none' }}>
            🗺️ Route
          </button>
        </div>

        <div style={{ padding: 16, flex: 1, overflowY: 'auto' }}>
          {activeTab === 'tools' ? (
            <>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {categories.map(cat => (
                  <div key={cat.id} style={{ border: `1px solid ${T.sidebarBorder}`, borderRadius: 8, overflow: 'hidden' }}>
                    <div onClick={() => setOpenCat(openCat === cat.id ? '' : cat.id)} style={{ padding: '12px 16px', background: openCat === cat.id ? 'rgba(59,130,246,0.1)' : '#040c1e', color: '#fff', cursor: 'pointer', fontWeight: 'bold', display: 'flex', justifyContent: 'space-between' }}>
                      {cat.title} <span>{openCat === cat.id ? '▼' : '▶'}</span>
                    </div>
                    {openCat === cat.id && (
                      <div style={{ padding: 12, background: 'rgba(0,0,0,0.2)', display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {cat.items.map(it => (
                          <button key={it.type} onClick={() => addItem(it.type as any, it.label.replace('+ ', ''))} style={btnStyle(it.color)}>{it.label}</button>
                        ))}
                        {cat.id === 'infra' && (
                          <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
                            <div style={{ color: T.textDim, fontSize: 12 }}>Farbige Zonen:</div>
                            <button onClick={() => addItem('zone', 'Wareneingang', 'rgba(16, 185, 129, 0.4)')} style={btnStyle('#34d399')}>+ Wareneingang</button>
                            <button onClick={() => addItem('zone', 'Warenausgang', 'rgba(239, 68, 68, 0.4)')} style={btnStyle('#f87171')}>+ Warenausgang</button>
                            <button onClick={() => addItem('dangerzone', 'Sperrzone', T.dangerzone)} style={btnStyle(T.dangerzoneStroke)}>+ Sperrzone (Gelb/Schwarz)</button>
                            <button onClick={() => addItem('zone', 'Standard-Zone', T.zone)} style={btnStyle(T.zoneStroke)}>+ Standard-Zone</button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {selectedItem && (
                <div style={{ marginTop: 20, padding: 16, background: 'rgba(59,130,246,0.05)', borderRadius: 8, border: `1px solid #3b82f6` }}>
                  <div style={{ color: '#60a5fa', fontWeight: 'bold', marginBottom: 12 }}>✏️ Eigenschaften</div>
                  <label style={labelStyle}>Bezeichnung</label>
                  <input style={inputStyle} value={selectedItem.label} onChange={(e) => setLayout(p => ({ ...p, items: p.items.map(it => it.id === selectedItem.id ? { ...it, label: e.target.value } : it) }))} />

                  <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
                    <div style={{ flex: 1 }}><label style={labelStyle}>Breite (m)</label><input type="number" style={inputStyle} value={selectedItem.w} onChange={(e) => setLayout(p => ({ ...p, items: p.items.map(it => it.id === selectedItem.id ? { ...it, w: parseFloat(e.target.value) || 1 } : it) }))} /></div>
                    <div style={{ flex: 1 }}><label style={labelStyle}>Tiefe (m)</label><input type="number" style={inputStyle} value={selectedItem.h} onChange={(e) => setLayout(p => ({ ...p, items: p.items.map(it => it.id === selectedItem.id ? { ...it, h: parseFloat(e.target.value) || 1 } : it) }))} /></div>
                  </div>

                  {['rack', 'cantilever', 'shelf', 'cablerack'].includes(selectedItem.type) && (
                    <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
                      <div style={{ flex: 1 }}><label style={labelStyle}>Ebenen</label><input type="number" style={inputStyle} value={selectedItem.levels || 4} onChange={(e) => setLayout(p => ({ ...p, items: p.items.map(it => it.id === selectedItem.id ? { ...it, levels: parseInt(e.target.value) || 1 } : it) }))} /></div>
                      <div style={{ flex: 1 }}><label style={labelStyle}>Spalten</label><input type="number" style={inputStyle} value={selectedItem.spots || 4} onChange={(e) => setLayout(p => ({ ...p, items: p.items.map(it => it.id === selectedItem.id ? { ...it, spots: parseInt(e.target.value) || 1 } : it) }))} /></div>
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
                    <button onClick={rotateSelected} style={{ ...actionBtnStyle, background: '#3b82f6' }}>🔄 Drehen</button>
                    <button onClick={deleteSelected} style={{ ...actionBtnStyle, background: '#ef4444' }}>🗑️ Löschen</button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div>
              <div style={{ color: T.textDim, fontSize: 13, marginBottom: 16 }}>1. Regal auswählen.<br/>2. Fach anklicken.<br/>3. Artikel zuweisen.</div>
              {!selectedItem || !['rack', 'cantilever', 'shelf', 'cablerack'].includes(selectedItem.type) ? (
                <div style={{ padding: 16, background: 'rgba(234, 179, 8, 0.1)', border: '1px solid rgba(234, 179, 8, 0.4)', borderRadius: 8, color: '#facc15', fontSize: 13 }}>Bitte wähle zuerst ein Regal aus!</div>
              ) : (
                <>
                  <div style={{ color: '#fff', fontWeight: 'bold', marginBottom: 12 }}>{selectedItem.label} - Plätze</div>
                  <div style={{ display: 'grid', gridTemplateRows: `repeat(${selectedItem.levels || 4}, 1fr)`, gap: 4, marginBottom: 20 }}>
                    {Array.from({ length: selectedItem.levels || 4 }).map((_, lIdx) => {
                      const level = (selectedItem.levels || 4) - lIdx;
                      return (
                        <div key={level} style={{ display: 'flex', gap: 4 }}>
                          {Array.from({ length: selectedItem.spots || 4 }).map((_, sIdx) => {
                            const spot = sIdx + 1;
                            const isSelected = selectedSpot?.level === level && selectedSpot?.spot === spot;
                            const mappedItem = stock.mapping.find(m => m.rack_id === selectedItem.id && m.level === level && m.spot === spot);
                            return (
                              <button key={spot} onClick={() => setSelectedSpot({ level, spot })} style={{ flex: 1, padding: 8, fontSize: 10, borderRadius: 4, cursor: 'pointer', border: 'none', background: isSelected ? '#3b82f6' : mappedItem ? '#10b981' : '#1f2937', color: '#fff' }}>E{level}-P{spot}</button>
                            );
                          })}
                        </div>
                      )
                    })}
                  </div>
                  {selectedSpot && (
                    <div style={{ padding: 12, background: 'rgba(0,0,0,0.3)', borderRadius: 8 }}>
                      <div style={{ color: '#60a5fa', fontSize: 12, fontWeight: 'bold', marginBottom: 10 }}>Zuweisung: E{selectedSpot.level}-P{selectedSpot.spot}</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 300, overflowY: 'auto' }}>
                        <button onClick={() => assignArticleToSpot('CLEAR')} style={{ ...actionBtnStyle, background: '#ef4444', marginBottom: 10 }}>🗑️ Platz leeren</button>
                        {articles.map(art => (
                          <button key={art.id} onClick={() => assignArticleToSpot(art.id)} style={{ background: '#1f2937', color: '#fff', border: '1px solid #374151', padding: '8px 12px', borderRadius: 6, textAlign: 'left', cursor: 'pointer', fontSize: 12 }}>{art.name}</button>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          ) : (
            <div>
              <div style={{ color: T.textDim, fontSize: 13, marginBottom: 16 }}>Wähle Artikel aus, um den optimalen Laufweg (Pick-Route) zu berechnen.</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {articles.map(art => {
                  const isPicked = pickRoute.includes(art.id);
                  return (
                    <button key={art.id} onClick={() => setPickRoute(prev => isPicked ? prev.filter(id => id !== art.id) : [...prev, art.id])} style={{ background: isPicked ? 'rgba(16, 185, 129, 0.2)' : '#1f2937', color: isPicked ? '#34d399' : '#fff', border: `1px solid ${isPicked ? '#10b981' : '#374151'}`, padding: '10px 12px', borderRadius: 6, textAlign: 'left', cursor: 'pointer', fontSize: 13, display: 'flex', justifyContent: 'space-between' }}>
                      <span>{art.name}</span>
                      <span>{isPicked ? '✓' : '+'}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* CANVAS */}
      <div style={{ flex: 1, overflow: 'auto', display: 'flex', justifyContent: 'center', alignItems: 'center' }} onPointerDown={() => setSelectedId(null)}>
        <svg ref={svgRef} width={layout.grid.width * CELL_SIZE} height={layout.grid.height * CELL_SIZE} style={{ background: '#0a1424', boxShadow: '0 0 40px rgba(0,0,0,0.5)', border: `2px solid ${T.sidebarBorder}` }} onPointerMove={handlePointerMove} onPointerUp={handlePointerUp} onPointerLeave={handlePointerUp}>
          <defs>
            <pattern id="smallGrid" width={CELL_SIZE} height={CELL_SIZE} patternUnits="userSpaceOnUse"><path d={`M ${CELL_SIZE} 0 L 0 0 0 ${CELL_SIZE}`} fill="none" stroke={T.gridMin} strokeWidth="1" /></pattern>
            <pattern id="largeGrid" width={CELL_SIZE * 5} height={CELL_SIZE * 5} patternUnits="userSpaceOnUse"><rect width={CELL_SIZE * 5} height={CELL_SIZE * 5} fill="url(#smallGrid)" /><path d={`M ${CELL_SIZE * 5} 0 L 0 0 0 ${CELL_SIZE * 5}`} fill="none" stroke={T.gridMaj} strokeWidth="1" /></pattern>
            <pattern id="stripes" width="20" height="20" patternTransform="rotate(45)" patternUnits="userSpaceOnUse">
              <rect width="20" height="20" fill="rgba(234, 179, 8, 0.4)" />
              <rect width="10" height="20" fill="rgba(0,0,0,0.6)" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#largeGrid)" />

          {/* Polyline for Pick Route */}
          {pickRoute.length > 0 && (
            <polyline
              points={pickRoute.map(artId => {
                const mapItem = stock.mapping.find(m => m.article_id === artId);
                if (!mapItem) return null;
                const rack = layout.items.find(r => r.id === mapItem.rack_id);
                if (!rack) return null;
                return `${(rack.x + rack.w / 2) * CELL_SIZE},${(rack.y + rack.h / 2) * CELL_SIZE}`;
              }).filter(Boolean).join(' ')}
              fill="none"
              stroke="#10b981"
              strokeWidth="4"
              strokeDasharray="8 8"
              opacity="0.8"
            />
          )}

          {layout.items.map((item) => {
            const isSelected = item.id === selectedId;
            let fill = (T as any)[item.type] || T.rack;
            let stroke = (T as any)[`${item.type}Stroke`] || T.rackStroke;
            if (item.type === 'zone') { stroke = item.color ? item.color.replace('0.4', '1') : T.zoneStroke; fill = item.color || T.zone; }
            if (item.type === 'dangerzone') { fill = 'url(#stripes)'; stroke = T.dangerzoneStroke; }

            return (
              <g key={item.id} transform={`translate(${item.x * CELL_SIZE}, ${item.y * CELL_SIZE})`}>
                <rect
                  width={item.w * CELL_SIZE} height={item.h * CELL_SIZE}
                  fill={fill} stroke={isSelected ? T.selectedStroke : stroke} strokeWidth={isSelected ? 3 : 2}
                  rx={['door', 'rolldoor', 'pillar', 'ramp', 'stairs', 'dangerzone', 'wall'].includes(item.type) ? 0 : 4}
                  style={{ cursor: dragging?.id === item.id ? 'grabbing' : 'grab' }}
                  onPointerDown={(e) => handlePointerDown(e, item)}
                />
                {['pillar', 'wirebox', 'wirecart'].includes(item.type) && (
                  <><line x1={0} y1={0} x2={item.w * CELL_SIZE} y2={item.h * CELL_SIZE} stroke={stroke} strokeWidth={2} /><line x1={item.w * CELL_SIZE} y1={0} x2={0} y2={item.h * CELL_SIZE} stroke={stroke} strokeWidth={2} /></>
                )}
                {item.w * CELL_SIZE >= 30 && item.h * CELL_SIZE >= 20 && item.type !== 'pillar' && (
                  <text x={(item.w * CELL_SIZE) / 2} y={(item.h * CELL_SIZE) / 2} fill="#fff" fontSize="11" fontFamily="system-ui" fontWeight="bold" textAnchor="middle" dominantBaseline="middle" pointerEvents="none">
                    {item.label}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}

const tabBtnStyle = { flex: 1, padding: '14px 10px', fontSize: 14, fontWeight: 'bold' as const, cursor: 'pointer', border: 'none' };
const btnStyle = (color: string) => ({ background: 'transparent', border: `1px solid ${color}`, color: color, padding: '8px 12px', borderRadius: 8, cursor: 'pointer', fontWeight: 'bold' as const, textAlign: 'left' as const, fontSize: 13 });
const labelStyle = { display: 'block', color: T.textDim, fontSize: 12, marginBottom: 4 };
const inputStyle = { width: '100%', background: '#040c1e', border: `1px solid ${T.sidebarBorder}`, color: T.text, padding: '8px', borderRadius: 6, boxSizing: 'border-box' as const };
const actionBtnStyle = { flex: 1, padding: '8px', border: 'none', borderRadius: 6, color: '#fff', fontWeight: 'bold' as const, cursor: 'pointer' };
