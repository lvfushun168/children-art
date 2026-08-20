export const MATERIAL_CATEGORIES = Object.freeze({
  DEMO: '范画',
  STEP: '步骤图',
  CLASSROOM: '课堂记录',
  COURSEWARE: '课件'
})

const API_ASSET_TYPES = Object.freeze({
  [MATERIAL_CATEGORIES.DEMO]: 'DEMO_IMAGE',
  [MATERIAL_CATEGORIES.STEP]: 'STEP_IMAGE',
  [MATERIAL_CATEGORIES.COURSEWARE]: 'COURSEWARE'
})

export const isVideoFile = (file) => String(file?.type || '').toLowerCase().startsWith('video/')

const isClassroomCategory = (category) => [
  MATERIAL_CATEGORIES.CLASSROOM,
  '课堂照片',
  '课堂视频'
].includes(category)

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

export const defaultMaterialVisible = (category) => [
  MATERIAL_CATEGORIES.DEMO,
  MATERIAL_CATEGORIES.STEP
].includes(category)

export const materialCategoryForType = (type) => {
  if (type === '范画') return MATERIAL_CATEGORIES.DEMO
  if (type === '步骤图') return MATERIAL_CATEGORIES.STEP
  if (type === '课件') return MATERIAL_CATEGORIES.COURSEWARE
  if (type === '课堂照片' || type === '课堂视频') return MATERIAL_CATEGORIES.CLASSROOM
  return type || MATERIAL_CATEGORIES.DEMO
}
