const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[character]))

const textHtml = (value) => escapeHtml(value).replace(/\r?\n/g, '<br>')

export const buildCurrentParentBlocks = ({ totalFeedback, student, materials }) => {
  const blocks = []
  const total = String(totalFeedback?.content || '').trim()
  if (total) blocks.push({ type: 'TOTAL_FEEDBACK', text: total })

  const artworks = Array.isArray(student?.artworks) && student.artworks.length
    ? student.artworks.filter((artwork) => !artwork.status || artwork.status === 'ACTIVE')
      .sort((left, right) => Number(left.sortOrder || 0) - Number(right.sortOrder || 0))
    : student?.fileId ? [{ fileId: student.fileId, title: student.artworkTitle || '' }] : []
  for (const artwork of artworks) {
    const fileId = artwork.displayFileId || artwork.fileId
    if (fileId) blocks.push({ type: 'ARTWORK', fileId, text: artwork.title || artwork.artworkTitle || '' })
  }

  for (const material of materials || []) {
    if (material?.assetType !== 'CLASSROOM_PHOTO' || material.visible === false
      || (material.status && material.status !== 'ACTIVE') || !material.fileId) continue
    blocks.push({ type: 'CLASSROOM_RECORD', fileId: material.fileId, text: material.title || '' })
  }

  const personal = String(student?.comment || '').trim()
  if (personal) blocks.push({ type: 'PERSONAL_FEEDBACK', text: personal })
  return blocks
}

const blobToDataUrl = (blob) => new Promise((resolve, reject) => {
  const reader = new FileReader()
  reader.onload = () => resolve(String(reader.result || ''))
  reader.onerror = () => reject(new Error('图片读取失败'))
  reader.readAsDataURL(blob)
})

const drawableForBlob = async (blob) => {
  if (typeof globalThis.createImageBitmap === 'function') {
    try {
      const bitmap = await globalThis.createImageBitmap(blob)
      return { drawable: bitmap, width: bitmap.width, height: bitmap.height, cleanup: () => bitmap.close?.() }
    } catch {
      // 回退到 HTMLImageElement，兼容部分浏览器无法直接解码 Blob 的情况。
    }
  }

  const imageConstructor = globalThis.Image
  const urlApi = globalThis.URL
  if (typeof imageConstructor !== 'function' || typeof urlApi?.createObjectURL !== 'function') return null
  const objectUrl = urlApi.createObjectURL(blob)
  try {
    const image = await new Promise((resolve, reject) => {
      const value = new imageConstructor()
      value.onload = () => resolve(value)
      value.onerror = () => reject(new Error('图片解码失败'))
      value.src = objectUrl
    })
    return {
      drawable: image,
      width: image.naturalWidth || image.width,
      height: image.naturalHeight || image.height,
      cleanup: () => urlApi.revokeObjectURL(objectUrl)
    }
  } catch {
    urlApi.revokeObjectURL(objectUrl)
    return null
  }
}

const hasTransparency = (context, width, height, fallback) => {
  if (typeof context?.getImageData !== 'function') return fallback
  try {
    const pixels = context.getImageData(0, 0, width, height).data
    for (let index = 3; index < pixels.length; index += 4) {
      if (pixels[index] < 255) return true
    }
    return false
  } catch {
    return fallback
  }
}

/** 将图片缩小并转换为适合剪贴板的临时副本，不修改服务器原图。 */
export const compressClipboardImage = async (blob, { maxSide = 2048, jpegQuality = 0.85 } = {}) => {
  if (!(blob instanceof Blob) || !String(blob.type || '').startsWith('image/')) return blob
  const mimeType = String(blob.type || '').toLowerCase()
  if (mimeType === 'image/gif') return blob
  if (typeof document === 'undefined') return blob

  const decoded = await drawableForBlob(blob)
  if (!decoded || !decoded.width || !decoded.height) return blob
  const maxDimension = Math.max(decoded.width, decoded.height)
  const safeMaxSide = Number.isFinite(Number(maxSide)) && Number(maxSide) > 0 ? Number(maxSide) : 2048
  const scale = Math.min(1, safeMaxSide / maxDimension)
  const width = Math.max(1, Math.round(decoded.width * scale))
  const height = Math.max(1, Math.round(decoded.height * scale))

  try {
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const context = canvas.getContext('2d')
    if (!context) return blob
    context.drawImage(decoded.drawable, 0, 0, width, height)
    const transparent = hasTransparency(context, width, height, mimeType === 'image/png' || mimeType === 'image/webp')
    const outputType = transparent ? 'image/png' : 'image/jpeg'
    const output = await new Promise((resolve, reject) => {
      canvas.toBlob((value) => value ? resolve(value) : reject(new Error('图片压缩失败')), outputType,
        transparent ? undefined : jpegQuality)
    })
    return scale < 1 || output.size < blob.size ? output : blob
  } catch {
    return blob
  } finally {
    decoded.cleanup?.()
  }
}

export const buildParentRichContent = async (blocks, loadImage, { transformImage = compressClipboardImage } = {}) => {
  const html = []
  const plain = []
  let artworkIndex = 0
  let recordIndex = 0
  for (const block of blocks || []) {
    if (block.type === 'TOTAL_FEEDBACK') {
      html.push(`<p><strong>本节课总课评</strong></p><p>${textHtml(block.text)}</p>`)
      plain.push(`本节课总课评\n${block.text}`)
    } else if (block.type === 'ARTWORK' || block.type === 'CLASSROOM_RECORD') {
      const isArtwork = block.type === 'ARTWORK'
      const index = isArtwork ? ++artworkIndex : ++recordIndex
      if (index === 1) {
        const title = isArtwork ? '作品' : '课堂记录'
        html.push(`<p><strong>${title}</strong></p>`)
        plain.push(title)
      }
      const blob = await loadImage(block.fileId)
      if (!(blob instanceof Blob) || !String(blob.type || '').startsWith('image/')) {
        throw new Error('图片读取失败，无法复制完整图文')
      }
      const clipboardBlob = await transformImage(blob)
      const dataUrl = await blobToDataUrl(clipboardBlob instanceof Blob ? clipboardBlob : blob)
      if (!/^data:image\/(?:png|jpe?g|webp|gif);base64,/i.test(dataUrl)) {
        throw new Error('图片格式无法写入图文剪贴板')
      }
      html.push(`<p><img src="${dataUrl}" alt="${escapeHtml(block.text || `${isArtwork ? '作品' : '课堂记录'}${index}`)}"></p>`)
      plain.push(`[${isArtwork ? '作品' : '课堂记录'}图片 ${index}]`)
      if (block.text) {
        html.push(`<p>${textHtml(block.text)}</p>`)
        plain.push(block.text)
      }
    } else if (block.type === 'PERSONAL_FEEDBACK') {
      html.push(`<p><strong>学生补充课评</strong></p><p>${textHtml(block.text)}</p>`)
      plain.push(`学生补充课评\n${block.text}`)
    }
  }
  if (!html.length) throw new Error('当前学生没有可复制的图文')
  return { html: html.join(''), plain: plain.join('\n\n') }
}

export const copyParentRichContent = (loadBlocks, loadImage, options = {}) => {
  if (typeof navigator === 'undefined' || typeof navigator.clipboard?.write !== 'function'
    || typeof ClipboardItem !== 'function') {
    throw new Error('当前浏览器不支持图文剪贴板，请使用桌面 Chrome')
  }
  // 在点击事件内立即调用 write，图片读取通过 ClipboardItem 的异步数据完成。
  const content = Promise.resolve().then(loadBlocks).then(({ blocks, verifyVersion }) =>
    buildParentRichContent(blocks, loadImage, options).then(async (result) => {
      if (verifyVersion) await verifyVersion()
      return result
    }))
  const item = new ClipboardItem({
    'text/html': content.then((value) => new Blob([value.html], { type: 'text/html' })),
    'text/plain': content.then((value) => new Blob([value.plain], { type: 'text/plain' }))
  })
  return navigator.clipboard.write([item])
}
