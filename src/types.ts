export interface Product {
  id: string
  name: string
  desc: string
  reseller: number
  public: number
  packSize: number
  packOnly: boolean
}

export interface ProductCategory {
  id: string
  label: string
  items: Product[]
}

export type PresetType = 'machine' | 'alimentacion' | 'tube' | 'boquilla_std' | 'boquilla_spec' | 'liquid'

export interface QuoteLine {
  id: string
  preset?: PresetType      // marks the anchor/fixed row for that section
  sectionId?: PresetType   // extra lines added within a section
  productId: string
  name: string
  desc: string
  resellerPrice: number
  publicPrice: number
  qty: number
  packSize: number
  packOnly: boolean
  metersNeeded?: number
}

export type QuoteType = 'installation' | 'diy'

export interface Quote {
  supabaseId?: string   // set once saved to DB
  clientName: string
  clientAddress: string
  clientCIF: string
  clientPhone: string
  quoteNumber: string
  date: string
  type: QuoteType
  notes: string
  lines: QuoteLine[]
  discount: number
  laborHours: number
  laborRate: number
  transportTrips: number
  transportRate: number
}
