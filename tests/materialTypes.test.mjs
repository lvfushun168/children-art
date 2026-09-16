import assert from 'node:assert/strict'
import test from 'node:test'

import {
  MATERIAL_CATEGORIES,
  apiAssetTypeForUpload,
  defaultMaterialVisible,
  isStudentRecordAssetType,
  isStudentRecordVideo,
  materialCategoryForType,
  studentRecordAssetTypeFor,
  uiMaterialTypeForUpload
} from '../src/services/materialTypes.js'

test('classifies classroom image and video uploads without mixing material sections', () => {
  assert.equal(apiAssetTypeForUpload(MATERIAL_CATEGORIES.CLASSROOM, { type: 'image/jpeg' }), 'CLASSROOM_PHOTO')
  assert.equal(apiAssetTypeForUpload(MATERIAL_CATEGORIES.CLASSROOM, { type: 'video/mp4' }), 'CLASSROOM_VIDEO')
  assert.equal(apiAssetTypeForUpload('课堂照片', { type: 'video/mp4' }), 'CLASSROOM_VIDEO')
  assert.equal(uiMaterialTypeForUpload(MATERIAL_CATEGORIES.CLASSROOM, { type: 'image/jpeg' }), '课堂照片')
  assert.equal(uiMaterialTypeForUpload(MATERIAL_CATEGORIES.CLASSROOM, { type: 'video/mp4' }), '课堂视频')
})

test('keeps the four material categories and visibility defaults explicit', () => {
  assert.equal(apiAssetTypeForUpload(MATERIAL_CATEGORIES.DEMO, { type: 'image/png' }), 'DEMO_IMAGE')
  assert.equal(apiAssetTypeForUpload(MATERIAL_CATEGORIES.STEP, { type: 'image/png' }), 'STEP_IMAGE')
  assert.equal(apiAssetTypeForUpload(MATERIAL_CATEGORIES.COURSEWARE, { type: 'application/pdf' }), 'COURSEWARE')
  assert.equal(defaultMaterialVisible(MATERIAL_CATEGORIES.DEMO), true)
  assert.equal(defaultMaterialVisible(MATERIAL_CATEGORIES.STEP), true)
  assert.equal(defaultMaterialVisible(MATERIAL_CATEGORIES.CLASSROOM), false)
  assert.equal(defaultMaterialVisible(MATERIAL_CATEGORIES.COURSEWARE), false)
  assert.equal(materialCategoryForType('课堂视频'), MATERIAL_CATEGORIES.CLASSROOM)
  assert.equal(materialCategoryForType('课件'), MATERIAL_CATEGORIES.COURSEWARE)
})

test('keeps student records independent from classroom materials', () => {
  assert.equal(studentRecordAssetTypeFor({ type: 'image/jpeg' }), 'STUDENT_RECORD_PHOTO')
  assert.equal(studentRecordAssetTypeFor({ type: 'video/mp4' }), 'STUDENT_RECORD_VIDEO')
  assert.equal(isStudentRecordAssetType('STUDENT_RECORD_PHOTO'), true)
  assert.equal(isStudentRecordAssetType('CLASSROOM_PHOTO'), false)
  assert.equal(isStudentRecordVideo({ assetType: 'STUDENT_RECORD_VIDEO' }), true)
  assert.equal(isStudentRecordVideo({ assetType: 'STUDENT_RECORD_PHOTO' }), false)
})
