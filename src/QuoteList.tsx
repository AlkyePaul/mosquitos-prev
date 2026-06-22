import { useState, useEffect } from 'react'
import { apiList, apiDelete } from './api'
import type { PresupuestoSummary } from './api'

const EUR = (n: number) =>
  n.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'

const fmtDate = (iso: string) => {
  if (!iso) return '—'
  const [y, m, d] = iso.slice(0, 10).split('-')
  return `${d}/${m}/${y}`
}

interface Props {
  onLoad:  (id: string) => void
  onClose: () => void
}

export default function QuoteList({ onLoad, onClose }: Props) {
  const [rows, setRows]       = useState<PresupuestoSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState('')
  const [deleting, setDeleting] = useState<string | null>(null)

  async function load() {
    setLoading(true); setError('')
    try { setRows(await apiList()) }
    catch (e) { setError(e instanceof Error ? e.message : 'Error') }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  async function handleDelete(id: string, name: string) {
    if (!window.confirm(`Eliminar el presupuesto de "${name}"?`)) return
    setDeleting(id)
    try { await apiDelete(id); setRows(r => r.filter(x => x.id !== id)) }
    catch (e) { alert(e instanceof Error ? e.message : 'Error al eliminar') }
    finally { setDeleting(null) }
  }

  return (
    <div className="ql-overlay" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="ql-panel">
        <div className="ql-header">
          <span className="ql-title">Presupuestos guardados</span>
          <button className="ql-close" onClick={onClose}>×</button>
        </div>

        {loading && <div className="ql-state">Cargando...</div>}
        {error   && <div className="ql-state ql-error">{error} <button onClick={load}>Reintentar</button></div>}

        {!loading && !error && rows.length === 0 && (
          <div className="ql-state ql-empty">No hay presupuestos guardados aún.</div>
        )}

        {!loading && !error && rows.length > 0 && (
          <table className="ql-table">
            <thead>
              <tr>
                <th>N°</th>
                <th>Cliente</th>
                <th>Fecha</th>
                <th>Tipo</th>
                <th className="ql-right">Total</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.id} className="ql-row" onClick={() => onLoad(r.id)}>
                  <td className="ql-num">{r.quote_number || '—'}</td>
                  <td className="ql-name">{r.client_name || '—'}</td>
                  <td className="ql-date">{fmtDate(r.date)}</td>
                  <td>
                    <span className={`ql-badge ${r.type === 'installation' ? 'ql-inst' : 'ql-diy'}`}>
                      {r.type === 'installation' ? 'Instalación' : 'DIY'}
                    </span>
                  </td>
                  <td className="ql-right ql-total">{EUR(r.total_with_vat)}</td>
                  <td className="ql-actions" onClick={e => e.stopPropagation()}>
                    <button
                      className="ql-del-btn"
                      disabled={deleting === r.id}
                      onClick={() => handleDelete(r.id, r.client_name)}
                      title="Eliminar"
                    >×</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
