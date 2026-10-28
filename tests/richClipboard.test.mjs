import test from 'node:test'
import assert from 'node:assert/strict'
import {
  buildCurrentParentBlocks,
  buildParentRichContent,
  compressClipboardImage,
  copyParentRichContent
} from '../src/services/richClipboard.js'

class FakeFileReader {
  readAsDataURL(blob) {
    blob.arrayBuffer().then((buffer) => {
      this.result = `data:${blob.type};base64,${Buffer.from(buffer).toString('base64')}`
      this.onload()
    }).catch((error) => this.onerror(error))
  }
}

test('未发布课次直接读取当前学生图文，缺项可省略且内部媒体不进入复制内容', () => {
  const blocks = buildCurrentParentBlocks({
    totalFeedback: { content: '总课评' },
    student: {
      studentId: '7', comment: '个人课评',
      artworks: [{ displayFileId: '22', sortOrder: 2, title: '第二张' },
        { displayFileId: '21', sortOrder: 1, title: '第一张' }],
      studentRecords: [{ fileId: '99' }]
    },
    materials: [{ fileId: '31', assetType: 'CLASSROOM_PHOTO', visible: true, title: '课堂过程' },
      { fileId: '32', assetType: 'CLASSROOM_VIDEO', visible: true },
      { fileId: '33', assetType: 'STUDENT_RECORD_PHOTO', visible: true },
      { fileId: '34', assetType: 'CLASSROOM_PHOTO', visible: false }]
  })
  assert.deepEqual(blocks.map((block) => [block.type, block.fileId || null]), [
    ['TOTAL_FEEDBACK', null], ['ARTWORK', '21'], ['ARTWORK', '22'],
    ['CLASSROOM_RECORD', '31'], ['PERSONAL_FEEDBACK', null]
  ])
  assert.deepEqual(buildCurrentParentBlocks({ student: { comment: '只有个人课评' } }),
    [{ type: 'PERSONAL_FEEDBACK', text: '只有个人课评' }])
  assert.deepEqual(buildCurrentParentBlocks({}), [])
})

test('图文剪贴板保持总课评、独立图片、课堂记录文字、个人课评的顺序', async () => {
  const previous = globalThis.FileReader
  globalThis.FileReader = FakeFileReader
  try {
    const blocks = [
      { type: 'TOTAL_FEEDBACK', text: '总课评' },
      { type: 'ARTWORK', fileId: '1', text: '作品一' },
      { type: 'ARTWORK', fileId: '2', text: '作品二' },
      { type: 'CLASSROOM_RECORD', fileId: '3', text: '课堂观察' },
      { type: 'PERSONAL_FEEDBACK', text: '个人课评' }
    ]
    const result = await buildParentRichContent(blocks,
      async () => new Blob(['image'], { type: 'image/png' }))
    assert.equal((result.html.match(/<img /g) || []).length, 3)
    assert.ok(result.html.indexOf('总课评') < result.html.indexOf('作品一'))
    assert.ok(result.html.indexOf('作品二') < result.html.indexOf('课堂观察'))
    assert.ok(result.html.indexOf('课堂观察') < result.html.indexOf('个人课评'))
    assert.ok(result.html.includes('data:image/png;base64,'))
  } finally {
    globalThis.FileReader = previous
  }
})

test('复制图文使用压缩后的图片 Blob，但不改变原始图片读取结果', async () => {
  const previous = globalThis.FileReader
  globalThis.FileReader = FakeFileReader
  const source = new Blob(['source'], { type: 'image/png' })
  const compressed = new Blob(['compressed'], { type: 'image/jpeg' })
  let transformed = null
  try {
    const result = await buildParentRichContent(
      [{ type: 'ARTWORK', fileId: '1', text: '作品' }],
      async () => source,
      { transformImage: async (blob) => { transformed = blob; return compressed } }
    )
    assert.equal(transformed, source)
    assert.ok(result.html.includes('data:image/jpeg;base64,'))
  } finally {
    globalThis.FileReader = previous
  }
})

test('普通图片压缩为 JPEG 并限制最长边，透明图片保留 PNG', async () => {
  const previousDocument = globalThis.document
  const previousBitmap = globalThis.createImageBitmap
  const rendered = []
  globalThis.createImageBitmap = async () => ({
    width: 4000,
    height: 2000,
    close() {}
  })
  globalThis.document = {
    createElement: () => {
      const canvas = {
        width: 0,
        height: 0,
        getContext: () => ({
          drawImage() {},
          getImageData: () => ({ data: new Uint8ClampedArray([0, 0, 0, 255]) })
        }),
        toBlob(callback, type) {
          rendered.push({ width: canvas.width, height: canvas.height, type })
          callback(new Blob(['compressed'], { type }))
        }
      }
      return canvas
    }
  }
  try {
    const jpeg = await compressClipboardImage(new Blob(['large-image-content'], { type: 'image/jpeg' }))
    assert.equal(jpeg.type, 'image/jpeg')
    assert.deepEqual(rendered[0], { width: 2048, height: 1024, type: 'image/jpeg' })

    globalThis.document.createElement = () => {
      const canvas = {
        width: 0,
        height: 0,
        getContext: () => ({
          drawImage() {},
          getImageData: () => ({ data: new Uint8ClampedArray([0, 0, 0, 0]) })
        }),
        toBlob(callback, type) { callback(new Blob(['compressed'], { type })) }
      }
      return canvas
    }
    const png = await compressClipboardImage(new Blob(['large-transparent-image'], { type: 'image/png' }))
    assert.equal(png.type, 'image/png')
  } finally {
    if (previousDocument) globalThis.document = previousDocument
    else delete globalThis.document
    if (previousBitmap) globalThis.createImageBitmap = previousBitmap
    else delete globalThis.createImageBitmap
  }
})

test('当前学生所有内容为空时不能复制', async () => {
  await assert.rejects(buildParentRichContent([], async () => new Blob(['image'], { type: 'image/png' })),
    /没有可复制的图文/)
})

test('图片读取失败时复制失败，且在异步读取前调用剪贴板写入', async () => {
  const previousClipboard = globalThis.navigator
  const previousItem = globalThis.ClipboardItem
  let writeCalled = false
  let loadCalled = false
  globalThis.ClipboardItem = class { constructor(data) { this.data = data } }
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: {
    clipboard: { write(items) {
      writeCalled = true
      return Promise.all(Object.values(items[0].data))
    } }
  } })
  try {
    const result = copyParentRichContent(async () => {
      loadCalled = true
      return { blocks: [{ type: 'ARTWORK', fileId: 'missing' }] }
    }, async () => { throw new Error('图片读取失败') })
    assert.equal(writeCalled, true)
    assert.equal(loadCalled, false)
    await assert.rejects(result, /图片读取失败/)
  } finally {
    Object.defineProperty(globalThis, 'navigator', { configurable: true, value: previousClipboard })
    globalThis.ClipboardItem = previousItem
  }
})
