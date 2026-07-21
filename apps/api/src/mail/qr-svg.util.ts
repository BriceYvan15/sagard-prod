import * as QRCode from 'qrcode'

export async function generateQrSvg(data: string, size: number): Promise<string> {
  const svg = await QRCode.toString(data, {
    type: 'svg',
    margin: 0,
    width: size,
    color: {
      dark: '#1E1E1E',
      light: '#ffffff',
    },
    errorCorrectionLevel: 'M',
  })
  return svg
}
