import { useState, useEffect, useRef, Fragment } from 'react'
import type { Quote, QuoteLine, ProductCategory, PresetType } from './types'
import categoriesData from './data/products.json'
import ClientPDF from './ClientPDF'
import QuoteList from './QuoteList'
import { apiSave, apiLoad } from './api'

const categories = categoriesData as ProductCategory[]

// ── Helpers ───────────────────────────────────────────────────────────────────
const EUR = (n: number) =>
  n.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'

const fmtDate = (iso: string) => {
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

function findProduct(id: string) {
  for (const cat of categories) {
    const p = cat.items.find(i => i.id === id)
    if (p) return p
  }
  return null
}

// ── Section config ────────────────────────────────────────────────────────────
// cats = category ids visible in the picker for this section
const SECTION_CFG: Record<PresetType, { label: string; color: string; cats: string[] }> = {
  machine:       { label: 'Macchina',      color: '#1a6fd4', cats: ['macchine'] },
  alimentacion:  { label: 'Alimentación',  color: '#c43535', cats: ['alimentacion'] },
  tube:          { label: 'Tubo',          color: '#1a7a3a', cats: ['tubi'] },
  boquilla_std:  { label: 'Boquillas',     color: '#c87800', cats: ['dispersori'] },
  boquilla_spec: { label: 'Boquilla esp.', color: '#b84a00', cats: ['dispersori', 'bastoni', 'prolunghe', 'connettori'] },
  liquid:        { label: 'Liquido',       color: '#7c3fa0', cats: ['florifens'] },
}

const SECTION_ORDER: PresetType[] = ['machine', 'alimentacion', 'tube', 'boquilla_std', 'boquilla_spec', 'liquid']

const ROLL_LENGTHS: Record<string, number> = {
  '4213': 100, '4223': 100, '4224': 100, '4225': 25,
  '4248': 100, '4271': 25,
}

const VAT = 0.21

// ── Default preset lines ──────────────────────────────────────────────────────
function makePresetLine(preset: PresetType, defaultProductId = ''): QuoteLine {
  const p = defaultProductId ? findProduct(defaultProductId) : null
  return {
    id: `preset-${preset}`,
    preset,
    productId:     p?.id       ?? '',
    name:          p?.name     ?? '',
    desc:          '',
    resellerPrice: p?.reseller ?? 0,
    publicPrice:   p?.public   ?? 0,
    qty:           (preset === 'boquilla_std' || preset === 'boquilla_spec') ? 0 : 1,
    packSize:      p?.packSize ?? 1,
    packOnly:      p?.packOnly ?? false,
    metersNeeded:  0,
  }
}

const DEFAULT_PRESETS: QuoteLine[] = [
  makePresetLine('machine'),
  makePresetLine('alimentacion'),
  makePresetLine('tube'),
  makePresetLine('boquilla_std',  '4219'),
  makePresetLine('boquilla_spec', '4253'),
  makePresetLine('liquid'),
]

// ── Blank quote ───────────────────────────────────────────────────────────────
const BLANK_QUOTE: Quote = {
  clientName: '', clientAddress: '', clientCIF: '', clientPhone: '',
  quoteNumber: '',
  date: new Date().toISOString().slice(0, 10),
  type: 'installation', notes: '',
  lines: DEFAULT_PRESETS,
  discount: 0, laborHours: 0, laborRate: 20,
  transportTrips: 0, transportRate: 50,
}

// ── ProductPicker ─────────────────────────────────────────────────────────────
interface PickerProps {
  value: string
  onChange: (id: string) => void
  catFilter?: string[]
}

function ProductPicker({ value, onChange, catFilter }: PickerProps) {
  const [open, setOpen]     = useState(false)
  const [search, setSearch] = useState('')
  const wrapRef  = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const selected = value ? findProduct(value) : null

  const visible = (catFilter ? categories.filter(c => catFilter.includes(c.id)) : categories)
    .map(cat => ({
      ...cat,
      items: cat.items.filter(p =>
        search === '' ||
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        p.id.toLowerCase().includes(search.toLowerCase())
      ),
    }))
    .filter(cat => cat.items.length > 0)

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 10)
  }, [open])

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false); setSearch('')
      }
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  const pick = (id: string) => { onChange(id); setOpen(false); setSearch('') }

  return (
    <div className="picker" ref={wrapRef}>
      <button type="button" className="picker-btn" onClick={() => setOpen(o => !o)}>
        <span className="picker-btn-text">{selected ? selected.name : '— seleziona —'}</span>
        <span className="picker-arrow">{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div className="picker-dropdown">
          <input ref={inputRef} type="text" className="picker-search"
            value={search} onChange={e => setSearch(e.target.value)} placeholder="Cerca..." />
          <div className="picker-list">
            <div className="picker-item picker-custom" onClick={() => pick('')}>— seleziona —</div>
            {visible.map(cat => (
              <div key={cat.id}>
                <div className="picker-group-label">{cat.label}</div>
                {cat.items.map(p => (
                  <div
                    key={p.id}
                    className={`picker-item${p.id === value ? ' picker-item-active' : ''}`}
                    onClick={() => pick(p.id)}
                  >
                    <span className="picker-item-name">{p.name}</span>
                    <span className="picker-item-prices">{EUR(p.reseller)} / {EUR(p.public)}</span>
                  </div>
                ))}
              </div>
            ))}
            {visible.length === 0 && <div className="picker-empty">Nessun prodotto trovato</div>}
          </div>
        </div>
      )}
    </div>
  )
}

// ── App ───────────────────────────────────────────────────────────────────────
export default function App() {
  const [showClientPDF, setShowClientPDF] = useState(false)
  const [showQuoteList, setShowQuoteList] = useState(false)
  const [saving, setSaving]               = useState(false)
  const [saveMsg, setSaveMsg]             = useState('')
  const [quote, setQuote] = useState<Quote>(() => {
    try {
      const s = localStorage.getItem('mosquitos-quote')
      if (s) {
        const raw = JSON.parse(s) as Partial<Quote>
        const base: Quote = {
          ...BLANK_QUOTE,
          ...raw,
          lines: raw.lines ?? DEFAULT_PRESETS.map(l => ({ ...l })),
        }
        if (!base.lines.some(l => l.preset)) {
          return { ...base, lines: [...DEFAULT_PRESETS.map(l => ({ ...l })), ...base.lines] }
        }
        return base

      }
    } catch { /* ignore */ }
    return { ...BLANK_QUOTE, lines: DEFAULT_PRESETS.map(l => ({ ...l })) }
  })

  useEffect(() => {
    localStorage.setItem('mosquitos-quote', JSON.stringify(quote))
  }, [quote])

  function update(patch: Partial<Quote>) {
    setQuote(q => ({ ...q, ...patch }))
  }

  function updateLine(id: string, patch: Partial<QuoteLine>) {
    setQuote(q => ({ ...q, lines: q.lines.map(l => l.id === id ? { ...l, ...patch } : l) }))
  }

  // Add a line inside a section (inserted after the last line of that section)
  function addSectionLine(sectionId: PresetType) {
    const newLine: QuoteLine = {
      id: crypto.randomUUID(),
      sectionId,
      productId: '', name: '', desc: '',
      resellerPrice: 0, publicPrice: 0,
      qty: 1, packSize: 1, packOnly: false,
    }
    setQuote(q => {
      const lines = [...q.lines]
      let insertAt = lines.length
      for (let i = lines.length - 1; i >= 0; i--) {
        if (lines[i].preset === sectionId || lines[i].sectionId === sectionId) {
          insertAt = i + 1
          break
        }
      }
      lines.splice(insertAt, 0, newLine)
      return { ...q, lines }
    })
  }

  // Add an uncategorised extra line at the very end
  function addGeneralLine() {
    setQuote(q => ({
      ...q,
      lines: [...q.lines, {
        id: crypto.randomUUID(),
        productId: '', name: '', desc: '',
        resellerPrice: 0, publicPrice: 0,
        qty: 1, packSize: 1, packOnly: false,
      }],
    }))
  }

  function removeLine(id: string) {
    setQuote(q => ({ ...q, lines: q.lines.filter(l => l.id !== id) }))
  }

  function pickProduct(lineId: string, productId: string, sectionId?: PresetType) {
    if (!productId) {
      updateLine(lineId, {
        productId: '', name: '', desc: '',
        resellerPrice: 0, publicPrice: 0, packSize: 1, packOnly: false,
      })
      return
    }
    const p = findProduct(productId)
    if (!p) return

    const patch: Partial<QuoteLine> = {
      productId: p.id, name: p.name, desc: p.desc ?? '',
      resellerPrice: p.reseller, publicPrice: p.public,
      packSize: p.packSize, packOnly: p.packOnly,
    }

    // Tube anchor: recalc qty from existing meters
    if (sectionId === 'tube') {
      const line = quote.lines.find(l => l.id === lineId)
      const m = line?.metersNeeded ?? 0
      patch.qty = m > 0 ? Math.round((m / (ROLL_LENGTHS[p.id] ?? 100)) * 100) / 100 : 0
    } else {
      patch.qty = p.packOnly ? p.packSize : 1
    }

    updateLine(lineId, patch)
  }

  function handleTubeMeter(lineId: string, meters: number) {
    const line = quote.lines.find(l => l.id === lineId)
    if (!line) return
    const rollLen = ROLL_LENGTHS[line.productId] ?? 100
    updateLine(lineId, {
      metersNeeded: meters,
      qty: meters > 0 ? Math.round((meters / rollLen) * 100) / 100 : 0,
    })
  }

  async function handleSave() {
    setSaving(true); setSaveMsg('')
    try {
      const id = await apiSave(
        quote,
        { totalPublic: totalClientNet, totalWithVat: grandTotal },
        quote.supabaseId
      )
      setQuote(q => ({ ...q, supabaseId: id }))
      setSaveMsg('✓ Guardado')
      setTimeout(() => setSaveMsg(''), 3000)
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      setSaveMsg(`Error: ${msg.slice(0, 60)}`)
      setTimeout(() => setSaveMsg(''), 6000)
    } finally {
      setSaving(false)
    }
  }

  async function handleLoad(id: string) {
    try {
      const loaded = await apiLoad(id)
      setQuote(loaded)
      setShowQuoteList(false)
    } catch (e) {
      alert('Error al cargar el presupuesto')
    }
  }

  function resetQuote() {
    if (window.confirm('Creare un nuovo preventivo? I dati correnti verranno cancellati.')) {
      setQuote({
        ...BLANK_QUOTE,
        date: new Date().toISOString().slice(0, 10),
        lines: DEFAULT_PRESETS.map(l => ({ ...l })),
      })
    }
  }

  // ── Calculations ──────────────────────────────────────────────────────────────
  const totalMyCost    = quote.lines.reduce((s, l) => s + l.resellerPrice * l.qty, 0)
  const totalClientRaw = quote.lines.reduce((s, l) => s + l.publicPrice   * l.qty, 0)
  const discountAmt    = totalClientRaw * (quote.discount / 100)
  const totalClientNet = totalClientRaw - discountAmt
  const margin         = totalClientNet - totalMyCost
  const vatGoods       = totalClientNet * VAT
  const totalGoodsVAT  = totalClientNet + vatGoods

  const laborTotal     = quote.laborHours     * quote.laborRate
  const transportTotal = quote.transportTrips * quote.transportRate
  const workTotal      = laborTotal + transportTotal
  const vatWork        = workTotal * VAT
  const workWithVAT    = workTotal + vatWork

  const grandTotal = totalGoodsVAT + (quote.type === 'installation' ? workWithVAT : 0)

  // Partition lines
  const generalLines = quote.lines.filter(l => !l.preset && !l.sectionId)

  // ── Row renderer ──────────────────────────────────────────────────────────────
  function renderRow(line: QuoteLine, idx: number) {
    const isAnchor       = !!line.preset
    const sid            = line.preset ?? line.sectionId
    const cfg            = sid ? SECTION_CFG[sid] : undefined
    const isSectionExtra = !!line.sectionId && !line.preset

    const myCost    = line.resellerPrice * line.qty
    const clientTot = line.publicPrice   * line.qty
    const lineVAT   = clientTot * VAT
    const packWarn  = line.packOnly && line.qty > 0 && line.qty % line.packSize !== 0

    const rowCls = sid
      ? `section-row section-${sid}${isSectionExtra ? ' section-extra' : ''}`
      : `extra-row ${idx % 2 === 0 ? 'tr-even' : 'tr-odd'}`

    const tubeCalc = line.preset === 'tube' && line.productId && (line.metersNeeded ?? 0) > 0
      ? `= ${((line.metersNeeded ?? 0) / (ROLL_LENGTHS[line.productId] ?? 100)).toFixed(2)} rotoli`
      : null

    return (
      <tr key={line.id} className={rowCls}>

        {/* Product */}
        <td className="th-product">
          <div className="no-print product-cell-wrap">
            {cfg && isAnchor && (
              <span className="preset-badge" style={{ background: cfg.color }}>{cfg.label}</span>
            )}
            {cfg && isSectionExtra && (
              <span className="section-extra-tag" style={{ color: cfg.color }}>└</span>
            )}
            <ProductPicker
              value={line.productId}
              onChange={id => pickProduct(line.id, id, sid)}
              catFilter={cfg?.cats}
            />
            {line.preset === 'tube' ? (
              <div className="tube-helper">
                <input
                  type="number" className="num-input tube-m-input"
                  value={(line.metersNeeded ?? 0) === 0 ? '' : line.metersNeeded}
                  onChange={e => handleTubeMeter(line.id, parseFloat(e.target.value) || 0)}
                  min={0} placeholder="Metri necessari"
                />
                <span className="tube-m-unit">m</span>
                {tubeCalc && <span className="tube-calc">{tubeCalc}</span>}
              </div>
            ) : (
              <input
                type="text" className="name-input"
                value={line.name}
                onChange={e => updateLine(line.id, { name: e.target.value })}
                placeholder={isAnchor ? '' : 'nome prodotto...'}
              />
            )}
          </div>
          <div className="print-only print-prod-name">
            {cfg && isAnchor && <span className="print-preset-label">{cfg.label}:&nbsp;</span>}
            {line.preset === 'tube' && (line.metersNeeded ?? 0) > 0
              ? `${line.name} · ${line.metersNeeded}m`
              : (line.name || '—')}
          </div>
        </td>

        {/* Desc */}
        <td className="th-desc">
          <input type="text" className="desc-input" value={line.desc}
            onChange={e => updateLine(line.id, { desc: e.target.value })} placeholder="—" />
        </td>

        {/* Reseller price */}
        <td className="th-price">
          <input type="number" className="num-input"
            value={line.resellerPrice === 0 ? '' : line.resellerPrice}
            onChange={e => updateLine(line.id, { resellerPrice: parseFloat(e.target.value) || 0 })}
            min={0} step={0.01} placeholder="0.00" />
        </td>

        {/* Public price */}
        <td className="th-price">
          <input type="number" className="num-input"
            value={line.publicPrice === 0 ? '' : line.publicPrice}
            onChange={e => updateLine(line.id, { publicPrice: parseFloat(e.target.value) || 0 })}
            min={0} step={0.01} placeholder="0.00" />
        </td>

        {/* Qty */}
        <td className="th-qty">
          <div className="qty-cell">
            <input
              type="number"
              className={`num-input qty-inp${packWarn ? ' warn-input' : ''}`}
              value={line.qty === 0 ? '' : line.qty}
              onChange={e => updateLine(line.id, { qty: parseFloat(e.target.value) || 0 })}
              min={0} step={line.preset === 'tube' ? 0.01 : 1} placeholder="0"
            />
            {packWarn && (
              <span className="warn-badge no-print" title={`Conf. richiesta: multiplo di ${line.packSize}`}>⚠</span>
            )}
          </div>
        </td>

        {/* Pack info */}
        <td className="th-pack no-print">
          <span className={`pack-tag${line.packOnly ? ' pack-required' : ''}`}>
            {line.packOnly ? '×' : ''}{line.packSize}
          </span>
        </td>

        {/* Computed */}
        <td className="th-comp cost-cell">{EUR(myCost)}</td>
        <td className="th-comp client-cell">{EUR(clientTot)}</td>
        <td className="th-comp vat-cell">{EUR(lineVAT)}</td>

        {/* Delete (not for preset anchors) */}
        <td className="th-del no-print">
          {!isAnchor && (
            <button className="del-btn" onClick={() => removeLine(line.id)} title="Rimuovi">×</button>
          )}
        </td>
      </tr>
    )
  }

  // ── Render ────────────────────────────────────────────────────────────────────
  if (showClientPDF) {
    return <ClientPDF quote={quote} onClose={() => setShowClientPDF(false)} />
  }

  return (
    <div className="app">
      {showQuoteList && (
        <QuoteList onLoad={handleLoad} onClose={() => setShowQuoteList(false)} />
      )}

      {/* Screen header */}
      <header className="app-header no-print">
        <div className="app-title">
          <span className="mosquito-icon">🦟</span>
          <span>Mosquitos — Preventivi</span>
        </div>
        <div className="header-actions">
          <button className="btn btn-ghost" onClick={resetQuote}>Nuovo</button>
          <button className="btn btn-ghost" onClick={() => setShowQuoteList(true)}>📂 Mis prev.</button>
          <button
            className={`btn btn-save${saving ? ' btn-saving' : ''}`}
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? 'Guardando…' : (quote.supabaseId ? '💾 Actualizar' : '💾 Guardar')}
          </button>
          {saveMsg && <span className="save-msg">{saveMsg}</span>}
          <button className="btn btn-client" onClick={() => setShowClientPDF(true)}>Vista Cliente →</button>
          <button className="btn btn-primary" onClick={() => window.print()}>Interno PDF</button>
        </div>
      </header>

      {/* Print header */}
      <div className="print-header print-only">
        <div className="print-title">PREVENTIVO</div>
        <div className="print-meta">
          <div><strong>Cliente:</strong> {quote.clientName || '—'}</div>
          <div><strong>Data:</strong> {fmtDate(quote.date)}</div>
          {quote.quoteNumber && <div><strong>N°:</strong> {quote.quoteNumber}</div>}
          <div><strong>Tipo:</strong> {quote.type === 'installation' ? 'Con Installazione' : 'Hazlo Tú Mismo'}</div>
        </div>
      </div>

      <div className="app-body">

        {/* Quote info */}
        <section className="card no-print">
          <div className="card-header">Dati Preventivo</div>
          <div className="client-row">
            <label className="field field-grow">
              <span>Cliente</span>
              <input type="text" value={quote.clientName} onChange={e => update({ clientName: e.target.value })} placeholder="Nome cliente / azienda" />
            </label>
            <label className="field">
              <span>N° Prev.</span>
              <input type="text" value={quote.quoteNumber} onChange={e => update({ quoteNumber: e.target.value })} placeholder="001" style={{ width: 70 }} />
            </label>
            <label className="field">
              <span>Data</span>
              <input type="date" value={quote.date} onChange={e => update({ date: e.target.value })} />
            </label>
          </div>
          <div className="client-row" style={{ marginTop: 8, paddingBottom: 14 }}>
            <div className="field">
              <span>Tipo preventivo</span>
              <div className="type-toggle">
                <label className={`type-opt${quote.type === 'installation' ? ' active' : ''}`}>
                  <input type="radio" name="qtype" value="installation" checked={quote.type === 'installation'} onChange={() => update({ type: 'installation' })} />
                  Con installazione
                </label>
                <label className={`type-opt${quote.type === 'diy' ? ' active' : ''}`}>
                  <input type="radio" name="qtype" value="diy" checked={quote.type === 'diy'} onChange={() => update({ type: 'diy' })} />
                  Hazlo tú mismo
                </label>
              </div>
            </div>
            <label className="field field-grow">
              <span>Note</span>
              <input type="text" value={quote.notes} onChange={e => update({ notes: e.target.value })} placeholder="Note per il cliente..." />
            </label>
          </div>
          {/* Client details used in client-facing PDF */}
          <div className="client-row client-row-extra">
            <label className="field field-grow">
              <span>Dirección cliente</span>
              <input type="text" value={quote.clientAddress} onChange={e => update({ clientAddress: e.target.value })} placeholder="Calle, ciudad (CP)..." />
            </label>
            <label className="field" style={{ width: 130 }}>
              <span>CIF/NIF</span>
              <input type="text" value={quote.clientCIF} onChange={e => update({ clientCIF: e.target.value })} placeholder="B12345678" />
            </label>
            <label className="field" style={{ width: 140 }}>
              <span>Teléfono</span>
              <input type="text" value={quote.clientPhone} onChange={e => update({ clientPhone: e.target.value })} placeholder="+34 600 000 000" />
            </label>
          </div>
        </section>

        {/* Materials table */}
        <section className="card">
          <div className="card-header">
            <span>Materiali</span>
            <button className="btn btn-secondary btn-sm no-print" onClick={addGeneralLine}>+ Riga libera</button>
          </div>
          <div className="table-scroll">
            <table className="mtable">
              <thead>
                <tr>
                  <th className="th-product">Prodotto</th>
                  <th className="th-desc">Descrizione</th>
                  <th className="th-price">P.Rivenditore</th>
                  <th className="th-price">P.Pubblico</th>
                  <th className="th-qty">Q.tà</th>
                  <th className="th-pack no-print">Pack</th>
                  <th className="th-comp">Costo mio</th>
                  <th className="th-comp">Tot. cliente</th>
                  <th className="th-comp">IVA 21%</th>
                  <th className="th-del no-print"></th>
                </tr>
              </thead>
              <tbody>
                {/* One fragment per section, in fixed order */}
                {SECTION_ORDER.map(presetType => {
                  const cfg         = SECTION_CFG[presetType]
                  const anchorLine  = quote.lines.find(l => l.preset === presetType)
                  const sectionExtras = quote.lines.filter(l => l.sectionId === presetType)

                  return (
                    <Fragment key={presetType}>
                      {anchorLine && renderRow(anchorLine, 0)}
                      {sectionExtras.map((line, idx) => renderRow(line, idx))}
                      {/* Section add button */}
                      <tr className="section-add-row no-print">
                        <td colSpan={10}>
                          <button
                            className="section-add-btn"
                            style={{ color: cfg.color, borderColor: cfg.color + '55' }}
                            onClick={() => addSectionLine(presetType)}
                          >
                            + aggiungi a <strong>{cfg.label}</strong>
                          </button>
                        </td>
                      </tr>
                    </Fragment>
                  )
                })}

                {/* General / uncategorised extras */}
                {generalLines.length > 0 && (
                  <Fragment>
                    <tr className="extra-divider-row no-print">
                      <td colSpan={10} className="extra-divider-cell">Righe libere</td>
                    </tr>
                    {generalLines.map((line, idx) => renderRow(line, idx))}
                  </Fragment>
                )}
              </tbody>

              <tfoot>
                <tr className="subtotal-row">
                  <td colSpan={6} className="no-print subtotal-label">Subtotale</td>
                  <td colSpan={4} className="print-only subtotal-label-print">Subtotale</td>
                  <td className="th-comp subtotal-cell foot-cost">{EUR(totalMyCost)}</td>
                  <td className="th-comp subtotal-cell foot-client">{EUR(totalClientRaw)}</td>
                  <td className="th-comp subtotal-cell foot-vat">{EUR(totalClientRaw * VAT)}</td>
                  <td className="no-print" />
                </tr>
              </tfoot>
            </table>
          </div>
        </section>

        {/* Summary + Installation */}
        <div className={quote.type === 'installation' ? 'two-col' : 'one-col'}>

          <section className="card">
            <div className="card-header">Riepilogo</div>
            <div className="summary-grid">
              <span className="sg-label">Totale rivenditore</span>
              <span className="sg-val muted">{EUR(totalMyCost)}</span>

              <span className="sg-label">Totale pubblico</span>
              <span className="sg-val">{EUR(totalClientRaw)}</span>

              <span className="sg-label">Sconto</span>
              <span className="sg-val discount-val">
                <span className="no-print">
                  <input type="number" className="discount-input"
                    value={quote.discount === 0 ? '' : quote.discount}
                    onChange={e => update({ discount: parseFloat(e.target.value) || 0 })}
                    min={0} max={100} step={0.5} placeholder="0" />
                  <span>%</span>
                </span>
                <span className="print-only">{quote.discount}%</span>
                {quote.discount > 0 && <span className="discount-amt">− {EUR(discountAmt)}</span>}
              </span>

              <div className="sg-divider" /><div className="sg-divider" />

              <span className="sg-label bold">Totale netto</span>
              <span className="sg-val bold">{EUR(totalClientNet)}</span>

              <span className="sg-label">IVA 21%</span>
              <span className="sg-val">{EUR(vatGoods)}</span>

              <span className="sg-label bold">Totale con IVA</span>
              <span className="sg-val bold highlight">{EUR(totalGoodsVAT)}</span>

              <div className="sg-divider" /><div className="sg-divider" />

              <span className="sg-label">Margine</span>
              <span className={`sg-val bold ${margin >= 0 ? 'positive' : 'negative'}`}>{EUR(margin)}</span>
            </div>
          </section>

          {quote.type === 'installation' && (
            <section className="card">
              <div className="card-header">Installazione</div>
              <div className="install-grid">
                <span className="ig-label">Manodopera</span>
                <div className="ig-row">
                  <input type="number" className="no-print num-input inst-inp"
                    value={quote.laborHours === 0 ? '' : quote.laborHours}
                    onChange={e => update({ laborHours: parseFloat(e.target.value) || 0 })}
                    min={0} step={0.5} placeholder="ore" />
                  <span className="print-only ig-pv">{quote.laborHours} ore</span>
                  <span className="ig-x">×</span>
                  <input type="number" className="no-print num-input inst-inp"
                    value={quote.laborRate === 0 ? '' : quote.laborRate}
                    onChange={e => update({ laborRate: parseFloat(e.target.value) || 0 })}
                    min={0} step={5} placeholder="€/h" />
                  <span className="print-only ig-pv">{EUR(quote.laborRate)}/h</span>
                  <span className="ig-eq">=</span>
                  <span className="ig-total">{EUR(laborTotal)}</span>
                </div>

                <span className="ig-label">Trasporto</span>
                <div className="ig-row">
                  <input type="number" className="no-print num-input inst-inp"
                    value={quote.transportTrips === 0 ? '' : quote.transportTrips}
                    onChange={e => update({ transportTrips: parseFloat(e.target.value) || 0 })}
                    min={0} step={1} placeholder="viaggi" />
                  <span className="print-only ig-pv">{quote.transportTrips} viaggi</span>
                  <span className="ig-x">×</span>
                  <input type="number" className="no-print num-input inst-inp"
                    value={quote.transportRate === 0 ? '' : quote.transportRate}
                    onChange={e => update({ transportRate: parseFloat(e.target.value) || 0 })}
                    min={0} step={5} placeholder="€" />
                  <span className="print-only ig-pv">{EUR(quote.transportRate)}/viaggio</span>
                  <span className="ig-eq">=</span>
                  <span className="ig-total">{EUR(transportTotal)}</span>
                </div>

                <div className="ig-divider" /><div className="ig-divider" />

                <span className="ig-label">Subtotale lavoro</span>
                <span className="ig-total">{EUR(workTotal)}</span>
                <span className="ig-label">IVA 21%</span>
                <span className="ig-total">{EUR(vatWork)}</span>
                <span className="ig-label bold">Lavoro con IVA</span>
                <span className="ig-total bold highlight">{EUR(workWithVAT)}</span>
              </div>
            </section>
          )}
        </div>

        {/* Grand total */}
        <section className="grand-total">
          <span className="gt-label">TOTALE FINALE CON IVA</span>
          <span className="gt-value">{EUR(grandTotal)}</span>
        </section>

        {quote.notes && (
          <div className="print-notes print-only"><strong>Note:</strong> {quote.notes}</div>
        )}

      </div>
    </div>
  )
}
