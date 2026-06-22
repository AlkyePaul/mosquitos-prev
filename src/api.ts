import type { Quote } from './types'

const FN = import.meta.env.VITE_FN_URL as string

export interface PresupuestoSummary {
  id: string
  quote_number: string
  client_name: string
  date: string
  type: string
  total_with_vat: number
  updated_at: string
}

// Convert camelCase Quote → snake_case DB row
function quoteToRow(q: Quote, totals: { totalPublic: number; totalWithVat: number }) {
  return {
    quote_number:    q.quoteNumber,
    client_name:     q.clientName,
    client_address:  q.clientAddress,
    client_cif:      q.clientCIF,
    client_phone:    q.clientPhone,
    date:            q.date,
    type:            q.type,
    notes:           q.notes,
    lines:           q.lines,
    discount:        q.discount,
    labor_hours:     q.laborHours,
    labor_rate:      q.laborRate,
    transport_trips: q.transportTrips,
    transport_rate:  q.transportRate,
    total_public:    Math.round(totals.totalPublic    * 100) / 100,
    total_with_vat:  Math.round(totals.totalWithVat   * 100) / 100,
  }
}

// Convert snake_case DB row → camelCase Quote
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function rowToQuote(row: any): Quote & { supabaseId: string } {
  return {
    supabaseId:     row.id,
    quoteNumber:    row.quote_number  ?? '',
    clientName:     row.client_name   ?? '',
    clientAddress:  row.client_address ?? '',
    clientCIF:      row.client_cif    ?? '',
    clientPhone:    row.client_phone  ?? '',
    date:           row.date          ?? '',
    type:           row.type          ?? 'installation',
    notes:          row.notes         ?? '',
    lines:          row.lines         ?? [],
    discount:       row.discount      ?? 0,
    laborHours:     row.labor_hours   ?? 0,
    laborRate:      row.labor_rate    ?? 20,
    transportTrips: row.transport_trips ?? 0,
    transportRate:  row.transport_rate ?? 50,
  }
}

export async function apiList(): Promise<PresupuestoSummary[]> {
  const res = await fetch(FN)
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

export async function apiSave(
  q: Quote,
  totals: { totalPublic: number; totalWithVat: number },
  supabaseId?: string
): Promise<string> {
  const body = supabaseId
    ? { id: supabaseId, ...quoteToRow(q, totals) }
    : quoteToRow(q, totals)

  const res = await fetch(FN, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(body),
  })
  if (!res.ok) throw new Error(await res.text())
  const data = await res.json()
  return data.id as string
}

export async function apiLoad(id: string): Promise<Quote & { supabaseId: string }> {
  const res = await fetch(`${FN}?id=${encodeURIComponent(id)}`)
  if (!res.ok) throw new Error(await res.text())
  return rowToQuote(await res.json())
}

export async function apiDelete(id: string): Promise<void> {
  const res = await fetch(`${FN}?id=${encodeURIComponent(id)}`, { method: 'DELETE' })
  if (!res.ok) throw new Error(await res.text())
}
