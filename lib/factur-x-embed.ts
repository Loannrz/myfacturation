/**
 * Intégration Factur-X : XML EN16931 conforme généré en interne, puis intégration
 * dans le PDF via @stackforge-eu/factur-x (attach + métadonnées PDF/A-3).
 * Évite libxml2-wasm et garantit BR-62, BR-63, BR-FR-10, Guideline officielle.
 */
import { embedFacturX, Profile, Flavor } from '@stackforge-eu/factur-x'
import { buildEN16931XML, type DocumentData } from '@/lib/en16931-xml'

/**
 * Génère un PDF Factur-X : XML EN16931 (conforme validateur) intégré dans le PDF
 * avec métadonnées PDF/A-3. Le XML est produit par buildEN16931XML (schemeID EM,
 * SIREN, Guideline officielle) ; la librairie gère uniquement l’attache et le XMP.
 */
export async function embedFacturXInPdf(
  pdfBuffer: Buffer,
  data: DocumentData
): Promise<Buffer> {
  const xml = buildEN16931XML(data)
  // #region agent log
  fetch('http://127.0.0.1:7447/ingest/6a373d2b-7fa3-4ca7-b8ba-3aa5dfb24e88', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'e00367' }, body: JSON.stringify({ sessionId: 'e00367', location: 'factur-x-embed.ts:embedFacturXInPdf', message: 'XML before embed', data: { xmlLength: xml.length, hasBillingReference: xml.includes('<ram:BillingReference>'), hasInvoiceReferencedDocument: xml.includes('<ram:InvoiceReferencedDocument>'), documentType: data.documentType }, timestamp: Date.now(), hypothesisId: 'H2' }) }).catch(() => {});
  // #endregion
  const result = await embedFacturX({
    pdf: pdfBuffer,
    xml,
    profile: Profile.EN16931,
    flavor: Flavor.FACTUR_X,
    addPdfA3Metadata: true,
  })
  return Buffer.from(result.pdf)
}
