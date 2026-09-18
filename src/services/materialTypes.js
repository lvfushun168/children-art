export const MATERIAL_CATEGORIES = Object.freeze({
  REFERENCE: '范画',
  DEMO: '范画',
  STEP: '步骤图',
  CLASSROOM: '课堂记录',
  COURSEWARE: '课件'
})

export const FILE_VALIDATION_PROFILES = Object.freeze({
  COURSEWARE: 'COURSEWARE'
})

const API_ASSET_TYPES = Object.freeze({
  [MATERIAL_CATEGORIES.REFERENCE]: 'DEMO_IMAGE',
  [MATERIAL_CATEGORIES.DEMO]: 'DEMO_IMAGE',
  [MATERIAL_CATEGORIES.STEP]: 'STEP_IMAGE',
  [MATERIAL_CATEGORIES.COURSEWARE]: 'COURSEWARE'
})

export const isVideoFile = (file) => String(file?.type || '').toLowerCase().startsWith('video/')

export const studentRecordAssetTypeFor = (file) => isVideoFile(file)
  ? 'STUDENT_RECORD_VIDEO'
  : 'STUDENT_RECORD_PHOTO'

export const isStudentRecordAssetType = (value) => [
  'STUDENT_RECORD_PHOTO',
  'STUDENT_RECORD_VIDEO'
].includes(String(value || '').toUpperCase())

export const isStudentRecordVideo = (value) => String(value?.assetType || value || '').toUpperCase() === 'STUDENT_RECORD_VIDEO'

const isClassroomCategory = (category) => [
  MATERIAL_CATEGORIES.CLASSROOM,
  '课堂照片',
  '课堂视频'
].includes(category)

export const isReferenceMaterialType = (value) => [
  MATERIAL_CATEGORIES.REFERENCE,
  MATERIAL_CATEGORIES.DEMO,
  MATERIAL_CATEGORIES.STEP,
  '课堂参考图',
  'DEMO_IMAGE',
  'STEP_IMAGE'
].includes(String(value || '').trim().toUpperCase())

export const apiAssetTypeForUpload = (category, file) => {
  if (isClassroomCategory(category)) {
    return isVideoFile(file) ? 'CLASSROOM_VIDEO' : 'CLASSROOM_PHOTO'
  }
  return API_ASSET_TYPES[category] || category
}

export const uiMaterialTypeForUpload = (category, file) => {
  if (isClassroomCategory(category)) {
    return isVideoFile(file) ? '课堂视频' : '课堂照片'
  }
  return category
}

export const defaultMaterialVisible = () => false

export const materialCategoryForType = (type) => {
  if (isReferenceMaterialType(type)) return MATERIAL_CATEGORIES.REFERENCE
  if (type === '课件') return MATERIAL_CATEGORIES.COURSEWARE
  if (type === '课堂照片' || type === '课堂视频') return MATERIAL_CATEGORIES.CLASSROOM
  return type || MATERIAL_CATEGORIES.REFERENCE
}
