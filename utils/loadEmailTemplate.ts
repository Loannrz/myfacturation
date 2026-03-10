import fs from 'fs'
import path from 'path'

const templatesDir = path.join(process.cwd(), 'templates', 'email')

/**
 * Loads an email template by name and replaces placeholders.
 * @param templateName - Filename without path (e.g. 'verificationEmail.html')
 * @param placeholders - Object mapping placeholder names (without braces) to values
 */
export async function loadEmailTemplate(
  templateName: string,
  placeholders: Record<string, string>
): Promise<string> {
  const filePath = path.join(templatesDir, templateName)
  let html = await fs.promises.readFile(filePath, 'utf-8')
  for (const [key, value] of Object.entries(placeholders)) {
    html = html.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value)
  }
  return html
}
