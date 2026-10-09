import sharp from 'sharp';

type SocialImageOptions = {
  title: string;
  label?: string;
  description?: string;
  lang?: string;
};

const xml = (value: string) => value.replace(/[&<>"']/g, c => (
  {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c] || c
));

function wrap(text: string, maxChars: number, maxLines: number): string[] {
  const words = text.trim().split(/\s+/);
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    const candidate = line ? line + ' ' + word : word;
    if (candidate.length > maxChars && line) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  }
  if (line) lines.push(line);
  if (lines.length > maxLines) {
    const remaining = lines.slice(maxLines - 1).join(' ');
    lines.splice(maxLines - 1, Infinity, remaining.slice(0, maxChars - 1).trimEnd() + '…');
  }
  return lines.slice(0, maxLines);
}

/** Produce image/png bytes for social platforms; not an SVG preview. */
export async function socialImagePng({title, label='ENGINEERING NOTES', description='', lang='en'}: SocialImageOptions): Promise<Buffer> {
  const fontSize = title.length > 95 ? 44 : title.length > 65 ? 51 : 60;
  const lines = wrap(title, fontSize === 60 ? 31 : fontSize === 51 ? 38 : 44, 3);
  const yStart = 225 + (3 - lines.length) * 18;
  const titleText = lines.map((line, i) =>
    '<text x="80" y="' + (yStart + i * (fontSize + 19)) + '" font-size="' + fontSize +
    '" font-weight="750" letter-spacing="-1.3" fill="#F0F7FC">' + xml(line) + '</text>'
  ).join('');
  const bodyY = Math.max(445, yStart + lines.length * (fontSize + 19) + 3);
  const subText = wrap(description, 82, 1).map((line,i) =>
    '<text x="82" y="' + (bodyY + i * 26) + '" font-size="21" fill="#9DB4C7">' + xml(line) + '</text>'
  ).join('');
  const labelText = xml(label.toUpperCase().slice(0,65));

  const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">' +
    '<defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#122334"/>' +
    '<stop offset="1" stop-color="#0C1420"/></linearGradient>' +
    '<radialGradient id="glow"><stop stop-color="#42CBD3" stop-opacity=".17"/>' +
    '<stop offset="1" stop-color="#42CBD3" stop-opacity="0"/></radialGradient>' +
    '<pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">' +
    '<path d="M40 0H0V40" fill="none" stroke="#3A6670" stroke-opacity=".16"/></pattern></defs>' +
    '<rect width="1200" height="630" fill="url(#bg)"/>' +
    '<rect width="1200" height="630" fill="url(#grid)"/>' +
    '<circle cx="1130" cy="60" r="430" fill="url(#glow)"/>' +
    '<path d="M790 108 L1110 108 L1110 395 M866 175 L1024 175 L1024 435 M944 256 L1130 256" ' +
    'fill="none" stroke="#5DD9E7" stroke-width="2" opacity=".12"/>' +
    '<rect x="80" y="82" width="10" height="10" rx="5" fill="#5DD9E7"/>' +
    '<text x="107" y="92" font-family="DejaVu Sans, sans-serif" font-size="17" ' +
    'font-weight="650" letter-spacing="3" fill="#5DD9E7">' + labelText + '</text>' +
    '<g font-family="DejaVu Sans, Arial, sans-serif">' + titleText + subText + '</g>' +
    '<path d="M80 545 H1120" stroke="#2B4357" stroke-width="2"/>' +
    '<text x="80" y="587" font-family="DejaVu Sans, sans-serif" font-size="22" font-weight="700" fill="#F0F7FC">tai.bui_</text>' +
    '<text x="1120" y="587" text-anchor="end" font-family="DejaVu Sans, sans-serif" font-size="19" fill="#8FB0C5">' +
    (lang === 'vi' ? 'Kỹ thuật · Kiến trúc · AI' : 'Systems · Architecture · AI') + '</text></svg>';

  return sharp(Buffer.from(svg)).png({compressionLevel:9}).toBuffer();
}
