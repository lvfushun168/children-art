import html2canvas from 'html2canvas'
import { jsPDF } from 'jspdf'

export async function exportPortfolioPdf({ pageElements, fileName, exportedAt }) {
  const elements = pageElements.filter(Boolean)
  if (!elements.length) throw new Error('没有可导出的页面')

  const pdf = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
    compress: true
  })

  for (let index = 0; index < elements.length; index += 1) {
    const canvas = await html2canvas(elements[index], {
      scale: 2,
      backgroundColor: '#f7f7f2',
      useCORS: true,
      logging: false
    })
    const image = canvas.toDataURL('image/jpeg', 0.96)
    if (index > 0) pdf.addPage('a4', 'landscape')
    pdf.addImage(image, 'JPEG', 0, 0, 297, 210, undefined, 'FAST')
  }

  const blob = pdf.output('blob')
  const fileUrl = URL.createObjectURL(blob)
  pdf.save(fileName)
  return {
    fileName,
    fileUrl,
    pageCount: elements.length,
    exportedAt
  }
}
