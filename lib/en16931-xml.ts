/**
 * Construction des données document (facture/avoir) et génération du XML EN16931
 * conforme (Factur-X / CII). L’intégration dans le PDF utilise @stackforge-eu/factur-x.
 */
import { parseBankAccounts, parseEmitterProfiles } from '@/lib/billing-settings'

function esc(text: string | null | undefined): string {
  if (text == null || text === '') return ''
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function dateFormat102(s: string | Date | null | undefined): string {
  if (!s) return ''
  const d = typeof s === 'string' ? new Date(s.trim().split(/[T\s]/)[0]) : new Date(s)
  if (Number.isNaN(d.getTime())) return ''
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}${m}${day}`
}

/** Extrait le nombre de jours des conditions de paiement (ex. "30 jours" → 30). */
function parsePaymentTermDays(paymentTerms: string | null | undefined): number | null {
  if (!paymentTerms || !paymentTerms.trim()) return null
  const m = paymentTerms.trim().match(/(\d+)\s*jour/i)
  return m ? Math.max(0, parseInt(m[1]!, 10)) : null
}

/** Calcule la date d'échéance à partir de la date d'émission + X jours (format ISO YYYY-MM-DD). */
function addDaysToDate(issueDate: string, days: number): string {
  const d = new Date(issueDate.trim().split(/[T\s]/)[0])
  if (Number.isNaN(d.getTime())) return ''
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

function formatAmount(n: number): string {
  return Number(n).toFixed(2)
}

function countryToIso2(country: string | null | undefined): string {
  if (!country || !country.trim()) return 'FR'
  const c = country.trim().toUpperCase()
  if (c.length === 2) return c
  const map: Record<string, string> = { FRANCE: 'FR', BELGIQUE: 'BE', SUISSE: 'CH', LUXEMBOURG: 'LU', ALLEMAGNE: 'DE', GERMANY: 'DE', ESPAGNE: 'ES', ITALIE: 'IT', UK: 'GB', 'RÉPUBLIQUE FRANÇAISE': 'FR' }
  return map[c] ?? c.slice(0, 2)
}

function siretToSiren(siret: string | null | undefined): string {
  const s = (siret ?? '').replace(/\D/g, '')
  return s.length >= 9 ? s.slice(0, 9) : s
}

function vatCategoryCode(rate: number): string {
  return (rate ?? 0) <= 0 ? 'Z' : 'S'
}

export interface SellerInfo {
  name: string
  address: string
  postalCode: string
  city: string
  country: string
  companyId: string // SIRET (14 chiffres) — SIREN = 9 premiers chiffres
  vatId?: string
  vatExemptionReason?: string
  electronicAddress?: string // BT-34 email vendeur
}

export interface BuyerInfo {
  name: string
  address: string
  postalCode: string
  city: string
  country: string
  companyId?: string // SIRET
  vatId?: string
  electronicAddress?: string // BT-49 email acheteur
}

export interface BankInfo {
  accountHolder: string
  bankName: string
  iban: string
  bic: string
}

export interface LineItem {
  description: string
  quantity: number
  unitPrice: number
  vatRate: number
  lineTotalHT: number
}

export interface DocumentData {
  documentType: 'invoice' | 'credit_note'
  documentNumber: string
  issueDate: string
  dueDate: string | null
  currency: string
  totalHT: number
  vatAmount: number
  totalTTC: number
  amountDue: number
  paymentMethod: string
  paymentDueDate: string | null
  paymentTermsDescription?: string // BT-20
  seller: SellerInfo
  buyer: BuyerInfo
  bank: BankInfo | null
  lines: LineItem[]
  /** BR-FR-05 : mention pénalités de retard (PMD) */
  legalNotePenalties?: string
  /** BR-FR-05 : mention frais de recouvrement (PMT) */
  legalNoteRecovery?: string
  /** BR-FR-05 : mention escompte ou son absence (AAB) */
  legalNoteDiscount?: string
  /** Avoir uniquement — BR-FR-CO-05 */
  originalInvoiceNumber?: string
  /** Avoir uniquement — BR-FR-CO-05 (format ISO YYYY-MM-DD) */
  originalInvoiceDate?: string
  /** Avoir uniquement */
  creditNoteReason?: string
}

/** URN Guideline exigée par le validateur (BT-24). */
const GUIDELINE_ID_EN16931 = 'urn:cen.eu:en16931:2017'

/** Namespaces Factur-X / EN16931 (exacts pour les validateurs). */
const NS_RAM = 'urn:un:unece:uncefact:data:standard:ReusableAggregateBusinessInformationEntity:100'
const NS_QDT = 'urn:un:unece:uncefact:data:standard:QualifiedDataType:100'

/** Vérifie que le XML d'un avoir contient bien une référence facture d'origine (BR-FR-CO-05). */
function verifyCreditNoteBillingReferenceInXml(xml: string): void {
  const hasBillingRef = xml.includes('<ram:BillingReference>') && xml.includes('</ram:BillingReference>')
  const hasInvoiceRefDoc = xml.includes('<ram:InvoiceReferencedDocument>') && xml.includes('</ram:InvoiceReferencedDocument>')
  const hasIssuerAssignedId = xml.includes('<ram:IssuerAssignedID>') && xml.includes('</ram:IssuerAssignedID>')
  const hasFormattedIssueDate = xml.includes('<ram:FormattedIssueDateTime>') && xml.includes('format="102"')
  const ok = (hasBillingRef || hasInvoiceRefDoc) && hasIssuerAssignedId && hasFormattedIssueDate
  if (!ok) {
    console.error('BR-FR-CO-05 BillingReference/InvoiceReferencedDocument missing in final XML.')
    throw new Error('BR-FR-CO-05 : la référence à la facture d\'origine est absente ou invalide dans le XML généré.')
  }
}

/** Génère le XML EN16931 (CII) conforme Factur-X : Guideline officielle, SIREN, BT-34/BT-49 avec schemeID EM. */
export function buildEN16931XML(data: DocumentData): string {
  const docType = data.documentType === 'credit_note' ? '381' : '380'
  const issueDate = dateFormat102(data.issueDate)
  const dueDate = dateFormat102(data.paymentDueDate || data.dueDate) || issueDate

  if (data.amountDue > 0 && !dueDate && !data.paymentTermsDescription) {
    throw new Error('BR-CO-25 : lorsque le montant dû est positif, la date d\'échéance ou les conditions de paiement sont obligatoires. Renseignez la date d\'échéance de la facture (ou du devis d\'origine) ou des conditions de paiement (ex. "30 jours").')
  }

  if (data.documentType === 'credit_note') {
    if (!data.originalInvoiceNumber || !String(data.originalInvoiceNumber).trim()) {
      throw new Error('BR-FR-CO-05 : un avoir doit obligatoirement référencer la facture d\'origine (numéro de facture manquant).')
    }
    if (!data.originalInvoiceDate || !String(data.originalInvoiceDate).trim()) {
      throw new Error('BR-FR-CO-05 : un avoir doit obligatoirement référencer la facture d\'origine (date de la facture manquante).')
    }
    const origDate102 = dateFormat102(data.originalInvoiceDate)
    if (!origDate102) {
      throw new Error('BR-FR-CO-05 : la date de la facture d\'origine doit être au format valide (YYYY-MM-DD).')
    }
  }

  const sellerSiren = siretToSiren(data.seller.companyId)
  if (sellerSiren.length !== 9) {
    throw new Error('Le SIREN vendeur (9 chiffres) est obligatoire pour le PDF Factur-X. Renseignez le SIRET dans Paramètres > Facturation ou dans le profil émetteur.')
  }
  const hasVat = data.vatAmount > 0
  const headerVatCategory = hasVat ? 'S' : 'Z'
  const headerVatRate = hasVat && data.totalHT > 0 ? (data.vatAmount / data.totalHT) * 100 : 0

  const parts: string[] = []
  parts.push('<?xml version="1.0" encoding="UTF-8"?>')
  parts.push('<rsm:CrossIndustryInvoice xmlns:rsm="urn:un:unece:uncefact:data:standard:CrossIndustryInvoice:100" xmlns:ram="' + NS_RAM + '" xmlns:udt="urn:un:unece:uncefact:data:standard:UnqualifiedDataType:100" xmlns:qdt="' + NS_QDT + '">')

  parts.push('<rsm:ExchangedDocumentContext>')
  parts.push('<ram:GuidelineSpecifiedDocumentContextParameter>')
  parts.push('<ram:ID>' + esc(GUIDELINE_ID_EN16931) + '</ram:ID>')
  parts.push('</ram:GuidelineSpecifiedDocumentContextParameter>')
  parts.push('</rsm:ExchangedDocumentContext>')

  parts.push('<rsm:ExchangedDocument>')
  parts.push('<ram:ID>' + esc(data.documentNumber) + '</ram:ID>')
  parts.push('<ram:TypeCode>' + esc(docType) + '</ram:TypeCode>')
  if (issueDate) parts.push('<ram:IssueDateTime><udt:DateTimeString format="102">' + esc(issueDate) + '</udt:DateTimeString></ram:IssueDateTime>')
  if (data.legalNotePenalties) parts.push('<ram:IncludedNote><ram:SubjectCode>PMD</ram:SubjectCode><ram:Content>' + esc(data.legalNotePenalties) + '</ram:Content></ram:IncludedNote>')
  if (data.legalNoteRecovery) parts.push('<ram:IncludedNote><ram:SubjectCode>PMT</ram:SubjectCode><ram:Content>' + esc(data.legalNoteRecovery) + '</ram:Content></ram:IncludedNote>')
  if (data.legalNoteDiscount) parts.push('<ram:IncludedNote><ram:SubjectCode>AAB</ram:SubjectCode><ram:Content>' + esc(data.legalNoteDiscount) + '</ram:Content></ram:IncludedNote>')
  if (data.documentType === 'credit_note' && data.originalInvoiceNumber) parts.push('<ram:IncludedNote><ram:Content>Facture d\'origine: ' + esc(data.originalInvoiceNumber) + '</ram:Content></ram:IncludedNote>')
  if (data.documentType === 'credit_note' && data.creditNoteReason) parts.push('<ram:IncludedNote><ram:Content>Motif: ' + esc(data.creditNoteReason) + '</ram:Content></ram:IncludedNote>')
  parts.push('</rsm:ExchangedDocument>')

  parts.push('<rsm:SupplyChainTradeTransaction>')
  parts.push('<ram:ApplicableHeaderTradeAgreement>')
  parts.push('<ram:SellerTradeParty>')
  parts.push('<ram:Name>' + esc(data.seller.name) + '</ram:Name>')
  parts.push('<ram:PostalTradeAddress>')
  parts.push('<ram:PostcodeCode>' + esc(data.seller.postalCode) + '</ram:PostcodeCode>')
  parts.push('<ram:LineOne>' + esc(data.seller.address) + '</ram:LineOne>')
  parts.push('<ram:CityName>' + esc(data.seller.city) + '</ram:CityName>')
  parts.push('<ram:CountryID>' + esc(countryToIso2(data.seller.country)) + '</ram:CountryID>')
  parts.push('</ram:PostalTradeAddress>')
  parts.push('<ram:SpecifiedLegalOrganization><ram:ID schemeID="0002">' + esc(sellerSiren) + '</ram:ID></ram:SpecifiedLegalOrganization>')
  if (data.seller.vatId) parts.push('<ram:SpecifiedTaxRegistration><ram:ID schemeID="VA">' + esc(data.seller.vatId) + '</ram:ID></ram:SpecifiedTaxRegistration>')
  parts.push('<ram:SpecifiedTaxRegistration><ram:ID schemeID="FC">' + esc(sellerSiren) + '</ram:ID></ram:SpecifiedTaxRegistration>')
  if (data.seller.vatExemptionReason) parts.push('<ram:SpecifiedTaxRegistration><ram:ID schemeID="VAT">' + esc(data.seller.vatExemptionReason) + '</ram:ID></ram:SpecifiedTaxRegistration>')
  if (data.seller.electronicAddress) parts.push('<ram:URIUniversalCommunication><ram:URIID schemeID="EM">' + esc(data.seller.electronicAddress) + '</ram:URIID></ram:URIUniversalCommunication>')
  parts.push('</ram:SellerTradeParty>')
  parts.push('<ram:BuyerTradeParty>')
  parts.push('<ram:Name>' + esc(data.buyer.name) + '</ram:Name>')
  parts.push('<ram:PostalTradeAddress>')
  parts.push('<ram:PostcodeCode>' + esc(data.buyer.postalCode) + '</ram:PostcodeCode>')
  parts.push('<ram:LineOne>' + esc(data.buyer.address) + '</ram:LineOne>')
  parts.push('<ram:CityName>' + esc(data.buyer.city) + '</ram:CityName>')
  parts.push('<ram:CountryID>' + esc(countryToIso2(data.buyer.country)) + '</ram:CountryID>')
  parts.push('</ram:PostalTradeAddress>')
  if (data.buyer.companyId) parts.push('<ram:SpecifiedLegalOrganization><ram:ID>' + esc(data.buyer.companyId) + '</ram:ID></ram:SpecifiedLegalOrganization>')
  if (data.buyer.vatId) parts.push('<ram:SpecifiedTaxRegistration><ram:ID schemeID="VA">' + esc(data.buyer.vatId) + '</ram:ID></ram:SpecifiedTaxRegistration>')
  if (data.buyer.electronicAddress) parts.push('<ram:URIUniversalCommunication><ram:URIID schemeID="EM">' + esc(data.buyer.electronicAddress) + '</ram:URIID></ram:URIUniversalCommunication>')
  parts.push('</ram:BuyerTradeParty>')
  parts.push('</ram:ApplicableHeaderTradeAgreement>')

  parts.push('<ram:ApplicableHeaderTradeDelivery/>')

  parts.push('<ram:ApplicableHeaderTradeSettlement>')
  if (data.documentType === 'credit_note' && data.originalInvoiceNumber && data.originalInvoiceDate) {
    const origDate102 = dateFormat102(data.originalInvoiceDate)
    // #region agent log
    fetch('http://127.0.0.1:7447/ingest/6a373d2b-7fa3-4ca7-b8ba-3aa5dfb24e88', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'e00367' }, body: JSON.stringify({ sessionId: 'e00367', location: 'en16931-xml.ts:buildEN16931XML', message: 'Emitting BillingReference for credit note', data: { origNum: data.originalInvoiceNumber, origDate102 }, timestamp: Date.now(), hypothesisId: 'H1' }) }).catch(() => {});
    // #endregion
    // BR-FR-CO-05 : référence facture d'origine. BillingReference (CII) + InvoiceReferencedDocument (certains validateurs).
    parts.push('<ram:BillingReference>')
    parts.push('<ram:InvoiceDocumentReference>')
    parts.push('<ram:IssuerAssignedID>' + esc(data.originalInvoiceNumber) + '</ram:IssuerAssignedID>')
    parts.push('<ram:FormattedIssueDateTime><qdt:DateTimeString format="102">' + esc(origDate102) + '</qdt:DateTimeString></ram:FormattedIssueDateTime>')
    parts.push('</ram:InvoiceDocumentReference>')
    parts.push('</ram:BillingReference>')
    parts.push('<ram:InvoiceReferencedDocument>')
    parts.push('<ram:IssuerAssignedID>' + esc(data.originalInvoiceNumber) + '</ram:IssuerAssignedID>')
    parts.push('<ram:FormattedIssueDateTime><udt:DateTimeString format="102">' + esc(origDate102) + '</udt:DateTimeString></ram:FormattedIssueDateTime>')
    parts.push('</ram:InvoiceReferencedDocument>')
  }
  parts.push('<ram:InvoiceCurrencyCode>' + esc(data.currency || 'EUR') + '</ram:InvoiceCurrencyCode>')
  if (data.bank) {
    parts.push('<ram:SpecifiedTradeSettlementPaymentMeans>')
    parts.push('<ram:TypeCode>58</ram:TypeCode>')
    parts.push('<ram:PayeePartyCreditorFinancialAccount><ram:IBANID>' + esc(data.bank.iban) + '</ram:IBANID></ram:PayeePartyCreditorFinancialAccount>')
    if (data.bank.bic) parts.push('<ram:PayeeSpecifiedCreditorFinancialInstitution><ram:BICID>' + esc(data.bank.bic) + '</ram:BICID></ram:PayeeSpecifiedCreditorFinancialInstitution>')
    parts.push('</ram:SpecifiedTradeSettlementPaymentMeans>')
  }
  if (dueDate) parts.push('<ram:SpecifiedTradePaymentDueDateDateTime><udt:DateTimeString format="102">' + esc(dueDate) + '</udt:DateTimeString></ram:SpecifiedTradePaymentDueDateDateTime>')
  if (data.paymentTermsDescription) parts.push('<ram:SpecifiedTradePaymentTerms><ram:Description>' + esc(data.paymentTermsDescription) + '</ram:Description></ram:SpecifiedTradePaymentTerms>')
  if (data.amountDue > 0 && dueDate) {
    parts.push('<ram:SpecifiedTradePaymentTerms>')
    parts.push('<ram:DueDateDateTime format="102">' + esc(dueDate) + '</ram:DueDateDateTime>')
    parts.push('</ram:SpecifiedTradePaymentTerms>')
  }
  parts.push('<ram:ApplicableTradeTax>')
  parts.push('<ram:CalculatedAmount>' + formatAmount(data.vatAmount) + '</ram:CalculatedAmount>')
  parts.push('<ram:TypeCode>VAT</ram:TypeCode>')
  parts.push('<ram:BasisAmount>' + formatAmount(data.totalHT) + '</ram:BasisAmount>')
  parts.push('<ram:CategoryCode>' + headerVatCategory + '</ram:CategoryCode>')
  parts.push('<ram:RateApplicablePercent>' + formatAmount(headerVatRate) + '</ram:RateApplicablePercent>')
  parts.push('</ram:ApplicableTradeTax>')
  parts.push('<ram:SpecifiedTradeSettlementHeaderMonetarySummation>')
  parts.push('<ram:LineTotalAmount>' + formatAmount(data.totalHT) + '</ram:LineTotalAmount>')
  parts.push('<ram:TaxBasisTotalAmount>' + formatAmount(data.totalHT) + '</ram:TaxBasisTotalAmount>')
  parts.push('<ram:TaxTotalAmount currencyID="' + esc(data.currency) + '">' + formatAmount(data.vatAmount) + '</ram:TaxTotalAmount>')
  parts.push('<ram:GrandTotalAmount>' + formatAmount(data.totalTTC) + '</ram:GrandTotalAmount>')
  parts.push('<ram:DuePayableAmount>' + formatAmount(data.amountDue) + '</ram:DuePayableAmount>')
  parts.push('</ram:SpecifiedTradeSettlementHeaderMonetarySummation>')
  parts.push('</ram:ApplicableHeaderTradeSettlement>')

  data.lines.forEach((line, idx) => {
    const lineCat = vatCategoryCode(line.vatRate ?? 0)
    parts.push('<ram:IncludedSupplyChainTradeLineItem>')
    parts.push('<ram:AssociatedDocumentLineDocument><ram:LineID>' + esc(String(idx + 1)) + '</ram:LineID></ram:AssociatedDocumentLineDocument>')
    parts.push('<ram:SpecifiedTradeProduct><ram:Name>' + esc(line.description || 'Ligne ' + (idx + 1)) + '</ram:Name></ram:SpecifiedTradeProduct>')
    parts.push('<ram:SpecifiedLineTradeDelivery><ram:BilledQuantity unitCode="C62">' + String(line.quantity) + '</ram:BilledQuantity></ram:SpecifiedLineTradeDelivery>')
    parts.push('<ram:SpecifiedLineTradeSettlement>')
    parts.push('<ram:ApplicableTradeTax>')
    parts.push('<ram:TypeCode>VAT</ram:TypeCode>')
    parts.push('<ram:CategoryCode>' + lineCat + '</ram:CategoryCode>')
    parts.push('<ram:RateApplicablePercent>' + formatAmount(line.vatRate ?? 0) + '</ram:RateApplicablePercent>')
    parts.push('</ram:ApplicableTradeTax>')
    parts.push('<ram:SpecifiedTradeSettlementLineMonetarySummation><ram:LineTotalAmount>' + formatAmount(line.lineTotalHT) + '</ram:LineTotalAmount></ram:SpecifiedTradeSettlementLineMonetarySummation>')
    parts.push('</ram:SpecifiedLineTradeSettlement>')
    parts.push('<ram:SpecifiedLineTradeAgreement><ram:NetPriceProductTradePrice><ram:ChargeAmount>' + formatAmount(line.unitPrice) + '</ram:ChargeAmount></ram:NetPriceProductTradePrice></ram:SpecifiedLineTradeAgreement>')
    parts.push('</ram:IncludedSupplyChainTradeLineItem>')
  })

  parts.push('</rsm:SupplyChainTradeTransaction>')
  parts.push('</rsm:CrossIndustryInvoice>')
  const xml = parts.join('\n')
  if (data.documentType === 'credit_note') verifyCreditNoteBillingReferenceInXml(xml)
  return xml
}

// ——— Construction DocumentData depuis Invoice / CreditNote + settings ———

type InvoiceLike = {
  number: string
  issueDate: string
  dueDate: string | null
  currency: string
  totalHT: number
  vatAmount: number
  totalTTC: number
  paymentMethod: string | null
  paymentTerms: string | null
  quote?: { dueDate?: string | null } | null
  bankAccountId: string | null
  emitterProfileId: string | null
  tvaNonApplicable?: boolean | null
  client?: { firstName?: string | null; lastName?: string | null; companyName?: string | null; email?: string | null; address?: string | null; companyAddress?: string | null; postalCode?: string | null; city?: string | null; country?: string | null; siret?: string | null; vatNumber?: string | null } | null
  company?: { name?: string | null; legalName?: string | null; address?: string | null; postalCode?: string | null; city?: string | null; country?: string | null; siret?: string | null; vatNumber?: string | null; vatExempt?: boolean | null; email?: string | null } | null
  lines: Array<{ description?: string; quantity?: number; unitPrice?: number; vatRate?: number; total?: number }>
}

type SettingsLike = {
  companyName?: string | null
  legalStatus?: string | null
  address?: string | null
  postalCode?: string | null
  city?: string | null
  emitterProfiles?: string | Array<{ id: string; name?: string; companyName?: string; legalStatus?: string; address?: string; postalCode?: string; city?: string; country?: string; siret?: string; vatNumber?: string; vatExempt?: boolean; vatExemptionReason?: string; apeCode?: string; email?: string; phone?: string; website?: string }> | null
  bankAccounts?: string | Array<{ id: string; accountHolder?: string; bankName?: string; iban?: string; bic?: string }> | null
  bankAccountHolder?: string | null
  bankName?: string | null
  bankIban?: string | null
  bankBic?: string | null
  vatApplicable?: boolean
  vatExemptionReason?: string | null
}

function getEmitter(doc: InvoiceLike, settings: SettingsLike): SellerInfo {
  const profiles = Array.isArray(settings.emitterProfiles) ? settings.emitterProfiles : parseEmitterProfiles(typeof settings.emitterProfiles === 'string' ? settings.emitterProfiles : null)
  const profile = doc.emitterProfileId && profiles.length ? profiles.find((p: { id: string }) => p.id === doc.emitterProfileId) : null
  const vatApplicable = settings.vatApplicable !== false && !doc.tvaNonApplicable
  if (profile) {
    const p = profile as { companyName?: string; legalStatus?: string; address?: string; postalCode?: string; city?: string; country?: string; siret?: string; vatNumber?: string; vatExempt?: boolean; vatExemptionReason?: string; email?: string }
    return {
      name: p.companyName ?? '',
      address: p.address ?? '',
      postalCode: p.postalCode ?? '',
      city: p.city ?? '',
      country: p.country ?? 'FR',
      companyId: p.siret ?? '',
      vatId: vatApplicable && !p.vatExempt ? (p.vatNumber ?? undefined) : undefined,
      vatExemptionReason: p.vatExempt ? (p.vatExemptionReason ?? 'TVA non applicable – article 293 B du CGI') : undefined,
      electronicAddress: p.email ?? undefined,
    }
  }
  const s = settings as { siret?: string; vatNumber?: string; country?: string; email?: string }
  return {
    name: settings.companyName ?? '',
    address: settings.address ?? '',
    postalCode: settings.postalCode ?? '',
    city: settings.city ?? '',
    country: s.country ?? 'FR',
    companyId: s.siret ?? '',
    vatId: vatApplicable ? s.vatNumber ?? undefined : undefined,
    vatExemptionReason: !vatApplicable ? ((settings.vatExemptionReason as string) || 'TVA non applicable – article 293 B du CGI') : undefined,
    electronicAddress: s.email ?? doc.company?.email ?? undefined,
  }
}

function getBank(doc: InvoiceLike, settings: SettingsLike): BankInfo | null {
  const accounts = Array.isArray(settings.bankAccounts) ? settings.bankAccounts : parseBankAccounts(typeof settings.bankAccounts === 'string' ? settings.bankAccounts : null)
  const found = doc.bankAccountId && accounts.length ? accounts.find((a: { id: string }) => a.id === doc.bankAccountId) : null
  if (found) return { accountHolder: found.accountHolder ?? '', bankName: found.bankName ?? '', iban: found.iban ?? '', bic: found.bic ?? '' }
  if (settings.bankAccountHolder || settings.bankIban) return { accountHolder: settings.bankAccountHolder ?? '', bankName: settings.bankName ?? '', iban: settings.bankIban ?? '', bic: settings.bankBic ?? '' }
  return null
}

function getBuyer(doc: InvoiceLike): BuyerInfo {
  const c = doc.company
  const cl = doc.client
  if (c) {
    return {
      name: c.legalName || c.name || '',
      address: c.address ?? '',
      postalCode: c.postalCode ?? '',
      city: c.city ?? '',
      country: c.country ?? 'FR',
      companyId: c.siret ?? undefined,
      vatId: c.vatExempt ? undefined : (c.vatNumber ?? undefined),
      electronicAddress: c.email ?? undefined,
    }
  }
  if (cl) {
    const fullName = [cl.firstName, cl.lastName].filter(Boolean).join(' ') || cl.companyName || ''
    return {
      name: fullName,
      address: cl.address ?? cl.companyAddress ?? '',
      postalCode: cl.postalCode ?? '',
      city: cl.city ?? '',
      country: cl.country ?? 'FR',
      companyId: cl.siret ?? undefined,
      vatId: cl.vatNumber ?? undefined,
      electronicAddress: cl.email ?? undefined,
    }
  }
  return { name: '', address: '', postalCode: '', city: '', country: 'FR' }
}

export function buildDocumentDataFromInvoice(invoice: InvoiceLike, settings: SettingsLike): DocumentData {
  const seller = getEmitter(invoice, settings)
  const buyer = getBuyer(invoice)
  const bank = getBank(invoice, settings)
  const lines: LineItem[] = (invoice.lines ?? []).map((l) => {
    const qty = Number(l.quantity) || 1
    const unit = Number(l.unitPrice) || 0
    const rate = Number(l.vatRate) ?? 20
    const total = Number(l.total) ?? qty * unit * (1 + rate / 100)
    const lineHT = total / (1 + rate / 100)
    return { description: l.description ?? '', quantity: qty, unitPrice: unit, vatRate: rate, lineTotalHT: Math.round(lineHT * 100) / 100 }
  })
  // BR-FR-05 : mentions légales françaises (PMD, PMT, AAB) — textes par défaut si non fournis
  const legalNotePenalties = (settings as { legalNotePenalties?: string }).legalNotePenalties ?? 'En cas de retard de paiement, des pénalités de retard seront appliquées conformément à l\'article L.441-6 du code de commerce.'
  const legalNoteRecovery = (settings as { legalNoteRecovery?: string }).legalNoteRecovery ?? 'En cas de retard de paiement, des indemnités forfaitaires pour frais de recouvrement seront exigibles.'
  const legalNoteDiscount = (settings as { legalNoteDiscount?: string }).legalNoteDiscount ?? 'Aucun escompte en cas de paiement anticipé.'

  const rawDueDate = invoice.dueDate ?? invoice.quote?.dueDate ?? null
  const paymentDueDate = (() => {
    if (rawDueDate && String(rawDueDate).trim()) return rawDueDate
    const days = parsePaymentTermDays(invoice.paymentTerms)
    if (days != null) return addDaysToDate(invoice.issueDate, days)
    return null
  })()

  return {
    documentType: 'invoice',
    documentNumber: invoice.number,
    issueDate: invoice.issueDate,
    dueDate: paymentDueDate ?? invoice.dueDate,
    currency: invoice.currency || 'EUR',
    totalHT: invoice.totalHT,
    vatAmount: invoice.vatAmount,
    totalTTC: invoice.totalTTC,
    amountDue: invoice.totalTTC,
    paymentMethod: invoice.paymentMethod ?? '',
    paymentDueDate,
    paymentTermsDescription: invoice.paymentTerms ?? undefined,
    seller,
    buyer,
    bank,
    lines,
    legalNotePenalties,
    legalNoteRecovery,
    legalNoteDiscount,
  }
}

type CreditNoteLike = InvoiceLike & {
  invoice?: { number: string; issueDate?: string } | null
  reason?: string | null
  dueDate?: string | null
}

export function buildDocumentDataFromCreditNote(creditNote: CreditNoteLike, settings: SettingsLike): DocumentData {
  const base = buildDocumentDataFromInvoice(creditNote, settings)
  base.documentType = 'credit_note'
  base.originalInvoiceNumber = creditNote.invoice?.number ?? undefined
  base.originalInvoiceDate = creditNote.invoice?.issueDate ?? undefined
  base.creditNoteReason = creditNote.reason ?? undefined
  const creditNoteDueDate = creditNote.dueDate ?? creditNote.invoice?.issueDate ?? null
  base.paymentDueDate = creditNoteDueDate && String(creditNoteDueDate).trim() ? creditNoteDueDate : (base.paymentDueDate ?? creditNote.invoice?.issueDate ?? null)
  base.dueDate = base.paymentDueDate ?? base.dueDate
  // #region agent log
  fetch('http://127.0.0.1:7447/ingest/6a373d2b-7fa3-4ca7-b8ba-3aa5dfb24e88', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'e00367' }, body: JSON.stringify({ sessionId: 'e00367', location: 'en16931-xml.ts:buildDocumentDataFromCreditNote', message: 'Credit note data for Factur-X', data: { hasInvoice: !!creditNote.invoice, originalInvoiceNumber: base.originalInvoiceNumber, originalInvoiceDate: base.originalInvoiceDate }, timestamp: Date.now(), hypothesisId: 'H4' }) }).catch(() => {});
  // #endregion
  return base
}
