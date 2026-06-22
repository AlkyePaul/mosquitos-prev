import { useState, useEffect } from 'react'
import type { Quote, PresetType } from './types'
import logoImg from './img/logopreventivi.png'

// ── Company constants ─────────────────────────────────────────────────────────
const CO = {
  name:   'JARDÍN SIN MOSQUITO',
  brand:  'UNA MARCA DE: MR VIAJES TOPIKIS S.L.',
  cif:    'CIF: B10701738',
  addr1:  'CALLE PALMA DE MALLORCA, 10',
  addr2:  'EL MASNOU (08320), BARCELONA, ESPAÑA',
  email:  'Hola@jardinsinmosquitos.es',
  tel:    'TEL. +34656628114',
  slogan: 'DISFRUTA DE TU ESPACIO. SIN MOSQUITOS.',
}

const CONDITIONS = [
  'La garantía del sistema queda condicionada a un uso correcto del equipo, al mantenimiento ordinario recomendado y al uso de líquidos compatibles, recomendados o autorizados para este tipo de sistemas.',
  'Quedan excluidas de la garantía las incidencias derivadas de falta de mantenimiento, acumulación de cal o suciedad, obstrucción de boquillas o filtros, uso de productos no adecuados, manipulación por terceros no autorizados, golpes, heladas, uso negligente o desgaste normal de piezas consumibles. Los trabajos de limpieza, desobstrucción, sustitución de consumibles o intervenciones no cubiertas por garantía podrán presupuestarse aparte.',
  'El cliente será responsable de la conservación ordinaria del sistema, incluyendo la revisión visual del circuito, la limpieza básica, la protección del equipo frente a condiciones climáticas adversas y la comunicación de cualquier incidencia con la mayor brevedad posible. La aceptación del presupuesto implica la aceptación de estas condiciones básicas de uso, mantenimiento y garantía.',
  'Podrán considerarse consumibles o elementos de reposición ordinaria los líquidos aromáticos, juntas, conectores, tubos, filtros u otros componentes sometidos a desgaste ordinario u obstrucción.',
]

const VAT = 0.21

const EUR = (n: number) =>
  n.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '€'

const fmtDate = (iso: string) => {
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

// ── Client line ───────────────────────────────────────────────────────────────
interface ClientLine {
  id: string
  label: string
  description: string
  price: number
  qty: number
  discount: number // %
}

const SECTION_LABELS: Record<PresetType, string> = {
  machine:       'EQUIPO',
  alimentacion:  'ALIMENTACIÓN',
  tube:          'TUBERÍA',
  boquilla_std:  'BOQUILLAS',
  boquilla_spec: 'SISTEMA DE DISPERSIÓN',
  liquid:        'AROMA DESHABITUANTE MOSQUITOS',
}

const SECTION_ORDER: PresetType[] = ['machine', 'alimentacion', 'tube', 'boquilla_std', 'boquilla_spec', 'liquid']

function buildClientLines(quote: Quote): ClientLine[] {
  const lines: ClientLine[] = []

  for (const sec of SECTION_ORDER) {
    const items = quote.lines.filter(l => l.preset === sec || l.sectionId === sec)
    const total = items.reduce((s, l) => s + l.publicPrice * l.qty, 0)
    if (total === 0) continue

    const parts = items.filter(l => l.name).map(l => {
      let t = l.name.toUpperCase()
      if (l.preset === 'tube' && (l.metersNeeded ?? 0) > 0) t += ` ${l.metersNeeded}M`
      if (l.desc) t += ` - ${l.desc.toUpperCase()}`
      return t
    })

    lines.push({
      id: `cl-${sec}`,
      label: SECTION_LABELS[sec],
      description: parts.join('\n'),
      price: total,
      qty: 1,
      discount: quote.discount,
    })
  }

  // Uncategorised extras
  for (const ex of quote.lines.filter(l => !l.preset && !l.sectionId && l.publicPrice > 0)) {
    lines.push({
      id: `cl-x-${ex.id}`,
      label: ex.name.toUpperCase() || 'EXTRA',
      description: ex.desc ?? '',
      price: ex.publicPrice * ex.qty,
      qty: 1,
      discount: quote.discount,
    })
  }

  // Installation — discount is typically 0 (it's a service fee, not a product)
  if (quote.type === 'installation') {
    const total = quote.laborHours * quote.laborRate + quote.transportTrips * quote.transportRate
    if (total > 0) {
      lines.push({
        id: 'cl-install',
        label: 'INSTALACIÓN',
        description: 'INSTALACIÓN Y PUESTA EN MARCHA DEL SISTEMA DE NEBULIZACIÓN',
        price: total,
        qty: 1,
        discount: 0,
      })
    }
  }

  return lines
}

// ── Component ─────────────────────────────────────────────────────────────────
interface Props {
  quote: Quote
  onClose: () => void
}

export default function ClientPDF({ quote, onClose }: Props) {
  const [lines, setLines]         = useState<ClientLine[]>(() => buildClientLines(quote))
  const [validDays, setValidDays] = useState(7)

  useEffect(() => {
    document.body.classList.add('client-pdf-mode')
    return () => document.body.classList.remove('client-pdf-mode')
  }, [])

  function updateLine(id: string, patch: Partial<ClientLine>) {
    setLines(ls => ls.map(l => l.id === id ? { ...l, ...patch } : l))
  }
  function removeLine(id: string) {
    setLines(ls => ls.filter(l => l.id !== id))
  }
  function addLine() {
    setLines(ls => [...ls, {
      id: crypto.randomUUID(), label: 'ÍTEM',
      description: '', price: 0, qty: 1, discount: 0,
    }])
  }

  const totalDiscount = lines.reduce((s, l) => s + l.price * l.qty * (l.discount / 100), 0)
  const baseImponible = lines.reduce((s, l) => s + l.price * l.qty * (1 - l.discount / 100), 0)
  const vatAmount     = baseImponible * VAT
  const grandTotal    = baseImponible + vatAmount

  return (
    <div className="pdf-overlay">

      {/* ── Toolbar ───────────────────────────────────────────────────── */}
      <div className="pdf-toolbar no-print">
        <button className="pdf-back-btn" onClick={onClose}>← Volver</button>
        <span className="pdf-toolbar-title">
          Vista Cliente — {quote.clientName || 'Sin nombre'}
          {quote.quoteNumber ? ` · ${quote.quoteNumber}` : ''}
        </span>
        <div className="pdf-toolbar-right">
          <label className="pdf-valid-label">
            Válido
            <input
              type="number" className="pdf-valid-input"
              value={validDays}
              onChange={e => setValidDays(Math.max(1, parseInt(e.target.value) || 7))}
              min={1} max={365}
            />
            días
          </label>
          <button className="pdf-add-btn" onClick={addLine}>+ Línea</button>
          <button className="pdf-print-btn" onClick={() => window.print()}>
            Stampa / PDF
          </button>
        </div>
      </div>

      {/* ── Page ──────────────────────────────────────────────────────── */}
      <div className="pdf-page">

        {/* Header: contact | logo | meta */}
        <div className="pdf-header">

          <div className="pdf-hdr-col pdf-hdr-left">
            <div className="pdf-hdr-contact">{CO.email}</div>
            <div className="pdf-hdr-contact">{CO.tel}</div>
          </div>

          <div className="pdf-hdr-col pdf-hdr-center">
            <img src={logoImg} alt="Jardín Sin Mosquitos" className="pdf-logo" />
            <div className="pdf-presupuesto">PRESUPUESTO</div>
          </div>

          <div className="pdf-hdr-col pdf-hdr-right">
            <div className="pdf-hdr-meta">Fecha: {fmtDate(quote.date)}</div>
            <div className="pdf-hdr-meta">Nº PRESUPUESTO: {quote.quoteNumber || '—'}</div>
          </div>

        </div>

        {/* Divider */}
        <div className="pdf-rule" />

        {/* Company | Client */}
        <div className="pdf-parties">

          <div className="pdf-party-left">
            <div className="pdf-party-heading">DATOS DE LA EMPRESA</div>
            <div className="pdf-party-name">{CO.name}</div>
            <div className="pdf-party-line">{CO.brand}</div>
            <div className="pdf-party-line">{CO.cif}</div>
            <div className="pdf-party-line">{CO.addr1}</div>
            <div className="pdf-party-line">{CO.addr2}</div>
          </div>

          <div className="pdf-party-right">
            <div className="pdf-party-heading pdf-ta-right">CLIENTE</div>
            <div className="pdf-party-line pdf-ta-right" style={{ marginBottom: 6 }}>
              DATOS DEL CLIENTE
            </div>
            <div className="pdf-cinfo-row">
              <span className="pdf-cinfo-key">CLIENTE:</span>
              <span>{quote.clientName || '—'}</span>
            </div>
            <div className="pdf-cinfo-row">
              <span className="pdf-cinfo-key">CIF/NIF:</span>
              <span>{quote.clientCIF || ''}</span>
            </div>
            <div className="pdf-cinfo-row">
              <span className="pdf-cinfo-key">DIRECCIÓN:</span>
              <span>{quote.clientAddress || ''}</span>
            </div>
            <div className="pdf-cinfo-row">
              <span className="pdf-cinfo-key">CONTACTOS:</span>
              <span>{quote.clientPhone || ''}</span>
            </div>
          </div>

        </div>

        {/* Table area */}
        <div className="pdf-detail-label">DETALLE</div>

        <table className="pdf-table">
          <thead>
            <tr className="pdf-thead-row">
              <th className="pdf-th pdf-th-concept">CONCEPTO</th>
              <th className="pdf-th pdf-th-r">PRECIO</th>
              <th className="pdf-th pdf-th-r">UNIDADES</th>
              <th className="pdf-th pdf-th-r">DTO.</th>
              <th className="pdf-th pdf-th-r">SUBTOTAL</th>
              <th className="pdf-th pdf-th-r">IVA</th>
              <th className="pdf-th pdf-th-r">TOTAL</th>
              <th className="pdf-th no-print" style={{ width: 28, background: 'transparent' }} />
            </tr>
          </thead>
          <tbody>
            {lines.map(line => {
              const fullPrice = line.price * line.qty
              const subtotal  = fullPrice * (1 - line.discount / 100)
              const lineTotal = subtotal * (1 + VAT)
              const dtoStr    = line.discount === 0
                ? '0%'
                : line.discount.toFixed(3).replace(/\.?0+$/, '') + '%'

              return (
                <tr key={line.id} className="pdf-tr">
                  <td className="pdf-td pdf-td-concept">
                    {/* Screen: editable */}
                    <div className="no-print pdf-concept-wrap">
                      <input
                        type="text"
                        className="pdf-in-label"
                        value={line.label}
                        onChange={e => updateLine(line.id, { label: e.target.value })}
                      />
                      <textarea
                        className="pdf-in-desc"
                        value={line.description}
                        onChange={e => updateLine(line.id, { description: e.target.value })}
                        rows={Math.max(1, (line.description.match(/\n/g)?.length ?? 0) + 1)}
                      />
                    </div>
                    {/* Print */}
                    <div className="print-only">
                      <div className="pdf-row-label">{line.label}</div>
                      {line.description && (
                        <div className="pdf-row-desc">{line.description}</div>
                      )}
                    </div>
                  </td>

                  <td className="pdf-td pdf-td-r">
                    <input type="number" className="no-print pdf-in-num"
                      value={line.price === 0 ? '' : line.price}
                      onChange={e => updateLine(line.id, { price: parseFloat(e.target.value) || 0 })}
                      min={0} step={0.01} placeholder="0.00" />
                    <span className="print-only">{EUR(line.price)}</span>
                  </td>

                  <td className="pdf-td pdf-td-r">
                    <input type="number" className="no-print pdf-in-num"
                      value={line.qty}
                      onChange={e => updateLine(line.id, { qty: Math.max(1, parseInt(e.target.value) || 1) })}
                      min={1} step={1} />
                    <span className="print-only">{line.qty}</span>
                  </td>

                  <td className="pdf-td pdf-td-r">
                    <input type="number" className="no-print pdf-in-num pdf-in-dto"
                      value={line.discount === 0 ? '' : line.discount}
                      onChange={e => updateLine(line.id, { discount: parseFloat(e.target.value) || 0 })}
                      min={0} max={100} step={0.001} placeholder="0" />
                    <span className="print-only">{dtoStr}</span>
                  </td>

                  <td className="pdf-td pdf-td-r">{EUR(subtotal)}</td>
                  <td className="pdf-td pdf-td-r">21%</td>
                  <td className="pdf-td pdf-td-r pdf-td-total">{EUR(lineTotal)}</td>

                  <td className="pdf-td no-print" style={{ width: 28, padding: '4px 2px' }}>
                    <button className="del-btn" onClick={() => removeLine(line.id)}>×</button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>

        {/* Totals block */}
        <div className="pdf-totals-wrap">
          {totalDiscount > 0 && (
            <div className="pdf-tot-row pdf-tot-discount">
              <span>DESCUENTO POR ITEM</span>
              <span>{EUR(totalDiscount)}</span>
            </div>
          )}
          <div className="pdf-tot-row">
            <span>BASE IMPONIBLE</span>
            <span>{EUR(baseImponible)}</span>
          </div>
          <div className="pdf-tot-row">
            <span>IVA 21%</span>
            <span>{EUR(vatAmount)}</span>
          </div>
          <div className="pdf-tot-row pdf-tot-grand">
            <span>TOTAL</span>
            <span>{EUR(grandTotal)}</span>
          </div>
        </div>

        {/* Vencimiento */}
        <div className="pdf-venc">
          <div className="pdf-venc-title">VENCIMIENTO</div>
          <div className="pdf-venc-body">Presupuesto válido por {validDays} días.</div>
          <div className="pdf-slogan">{CO.slogan}</div>
        </div>

        {/* Conditions */}
        <div className="pdf-rule pdf-rule-thin" />
        <div className="pdf-conditions">
          <div className="pdf-cond-title">CONDICIONES DE USO, MANTENIMIENTO Y GARANTÍA</div>
          {CONDITIONS.map((p, i) => <p key={i} className="pdf-cond-para">{p}</p>)}
        </div>

        <div className="pdf-page-num">1/1</div>
      </div>
    </div>
  )
}
