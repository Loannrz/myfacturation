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
  const result = await embedFacturX({
    pdf: pdfBuffer,
    xml,
    profile: Profile.EN16931,
    flavor: Flavor.FACTUR_X,
    addPdfA3Metadata: true,
  })
  return Buffer.from(result.pdf)
}
