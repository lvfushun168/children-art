import { pageParams, queryString, request } from './apiClient.js'

const id = (value) => (value === null || value === undefined || value === '' ? undefined : String(value))
const page = (path, params = {}) => request(`${path}${queryString(pageParams(params))}`)

export const api = {
  workbench: {
    summary: () => request('/workbench/summary'),
    templates: () => request('/workbench/templates')
  },
  auth: {
    login: (body) => request('/auth/login', { method: 'POST', body, auth: false }),
    refresh: (body) => request('/auth/refresh', { method: 'POST', body, auth: false }),
    logout: () => request('/auth/logout', { method: 'POST' }),
    me: () => request('/me'),
    permissions: () => request('/permissions'),
    preferences: (body) => request('/me/preferences', { method: 'PATCH', body }),
    roles: () => request('/roles'),
    createRole: (body) => request('/roles', { method: 'POST', body }),
    updateRole: (roleId, body) => request(`/roles/${id(roleId)}`, { method: 'PATCH', body }),
    replaceRolePermissions: (roleId, body) => request(`/roles/${id(roleId)}/permissions`, { method: 'PUT', body }),
    users: (params) => page('/users', params),
    createUser: (body) => request('/users', { method: 'POST', body }),
    updateUser: (userId, body) => request(`/users/${id(userId)}`, { method: 'PATCH', body }),
    resetPassword: (userId, body) => request(`/users/${id(userId)}/reset-password`, { method: 'POST', body }),
    replaceUserRoles: (userId, body) => request(`/users/${id(userId)}/roles`, { method: 'PUT', body }),
    memberships: (userId) => request(`/users/${id(userId)}/campus-memberships`),
    replaceMemberships: (userId, body) => request(`/users/${id(userId)}/campus-memberships`, { method: 'PUT', body })
  },
  master: {
    campuses: (params) => page('/campuses', params),
    campus: (campusId) => request(`/campuses/${id(campusId)}`),
    createCampus: (body) => request('/campuses', { method: 'POST', body }),
    updateCampus: (campusId, body) => request(`/campuses/${id(campusId)}`, { method: 'PATCH', body }),
    teachers: (params) => page('/teachers', params),
    teacher: (teacherId) => request(`/teachers/${id(teacherId)}`),
    createTeacher: (body) => request('/teachers', { method: 'POST', body }),
    updateTeacher: (teacherId, body) => request(`/teachers/${id(teacherId)}`, { method: 'PATCH', body }),
    students: (params) => page('/students', params),
    student: (studentId) => request(`/students/${id(studentId)}`),
    createStudent: (body) => request('/students', { method: 'POST', body }),
    updateStudent: (studentId, body) => request(`/students/${id(studentId)}`, { method: 'PATCH', body }),
    classes: (params) => page('/classes', params),
    class: (classId) => request(`/classes/${id(classId)}`),
    createClass: (body) => request('/classes', { method: 'POST', body }),
    updateClass: (classId, body) => request(`/classes/${id(classId)}`, { method: 'PATCH', body }),
    classTypes: (params) => page('/class-types', params),
    courses: (params) => page('/courses', params),
    course: (courseId) => request(`/courses/${id(courseId)}`),
    createCourse: (body) => request('/courses', { method: 'POST', body }),
    updateCourse: (courseId, body) => request(`/courses/${id(courseId)}`, { method: 'PATCH', body }),
    terms: (params) => page('/terms', params),
    externalLinks: (params) => page('/external-course-links', params),
    externalLink: (linkId) => request(`/external-course-links/${id(linkId)}`),
    createExternalLink: (body) => request('/external-course-links', { method: 'POST', body }),
    updateExternalLink: (linkId, body) => request(`/external-course-links/${id(linkId)}`, { method: 'PATCH', body })
  },
  files: {
    createUploadSession: (body) => request('/files/upload-sessions', { method: 'POST', body }),
    uploadContent: (sessionId, body, contentType) => request(`/files/upload-sessions/${id(sessionId)}/content`, {
      method: 'PUT', body, rawBody: true, headers: { 'Content-Type': contentType || 'application/octet-stream' }
    }),
    completeUpload: (sessionId, body, key) => request(`/files/upload-sessions/${id(sessionId)}/complete`, {
      method: 'POST', body, idempotencyKey: key
    }),
    file: (fileId) => request(`/files/${id(fileId)}`),
    content: (fileId) => request(`/files/${id(fileId)}/content`, { responseType: 'blob' }),
    addReference: (fileId, body) => request(`/files/${id(fileId)}/references`, { method: 'POST', body })
  },
  imports: {
    list: (params) => page('/imports', params),
    create: (body) => request('/imports', { method: 'POST', body }),
    get: (batchId) => request(`/imports/${id(batchId)}`),
    preview: (batchId, body) => request(`/imports/${id(batchId)}/preview`, { method: 'POST', body }),
    rows: (batchId, params) => page(`/imports/${id(batchId)}/rows`, params),
    confirm: (batchId, body, key) => request(`/imports/${id(batchId)}/confirm`, { method: 'POST', body, idempotencyKey: key })
  },
  lessons: {
    list: (params) => page('/lessons', params),
    today: (params) => page('/lessons/today', params),
    get: (lessonId) => request(`/lessons/${id(lessonId)}`),
    create: (body) => request('/lessons', { method: 'POST', body }),
    update: (lessonId, body) => request(`/lessons/${id(lessonId)}`, { method: 'PATCH', body }),
    attendance: (lessonId) => request(`/lessons/${id(lessonId)}/attendance`),
    updateAttendance: (lessonId, studentId, body) => request(`/lessons/${id(lessonId)}/attendance/${id(studentId)}`, { method: 'PATCH', body }),
    transition: (lessonId, body) => request(`/lessons/${id(lessonId)}/status-transitions`, { method: 'POST', body }),
    completion: (lessonId) => request(`/lessons/${id(lessonId)}/completion-check`),
    workspace: (lessonId, options = {}) => request(`/lessons/${id(lessonId)}/workspace`, options),
    archiveCommit: (lessonId, body, key) => request(`/lessons/${id(lessonId)}/archive/commit`, { method: 'POST', body, idempotencyKey: key })
  },
  assets: {
    list: (lessonId) => request(`/lessons/${id(lessonId)}/assets`),
    create: (lessonId, body) => request(`/lessons/${id(lessonId)}/assets`, { method: 'POST', body }),
    createBatch: (lessonId, items) => request(`/lessons/${id(lessonId)}/assets/batch`, { method: 'POST', body: { items } }),
    update: (assetId, body) => request(`/assets/${id(assetId)}`, { method: 'PATCH', body }),
    remove: (assetId, version) => request(`/assets/${id(assetId)}${queryString({ version })}`, { method: 'DELETE' }),
    emptyConfirmation: (lessonId, body) => request(`/lessons/${id(lessonId)}/assets/empty-confirmation`, { method: 'PUT', body }),
    artworks: (lessonId) => request(`/lessons/${id(lessonId)}/artworks`),
    createArtwork: (lessonId, body) => request(`/lessons/${id(lessonId)}/artworks`, { method: 'POST', body }),
    createArtworksBatch: (lessonId, items) => request(`/lessons/${id(lessonId)}/artworks/batch`, { method: 'POST', body: { items } }),
    updateArtwork: (artworkId, body) => request(`/artworks/${id(artworkId)}`, { method: 'PATCH', body }),
    removeArtwork: (artworkId, version) => request(`/artworks/${id(artworkId)}${queryString({ version })}`, { method: 'DELETE' }),
    removeArtworkVersion: (artworkId, versionId, version) => request(`/artworks/${id(artworkId)}/versions/${id(versionId)}${queryString({ version })}`, { method: 'DELETE' }),
    confirmArtwork: (artworkId, body) => request(`/artworks/${id(artworkId)}/confirm`, { method: 'POST', body }),
    processArtwork: (artworkId, body) => request(`/artworks/${id(artworkId)}/process-jobs`, { method: 'POST', body }),
    processArtworksBatch: (lessonId, artworkIds, body = {}) => request(`/lessons/${id(lessonId)}/artworks/process-jobs`, {
      method: 'POST', body: { artworkIds: artworkIds.map(id), ...body }
    })
  },
  feedback: {
    list: (lessonId) => request(`/lessons/${id(lessonId)}/feedbacks`),
    saveForStudent: (lessonId, studentId, body) => request(`/lessons/${id(lessonId)}/feedbacks/${id(studentId)}`, { method: 'PUT', body }),
    saveBatch: (lessonId, items) => request(`/lessons/${id(lessonId)}/feedbacks/batch`, { method: 'PUT', body: { items } }),
    update: (feedbackId, body) => request(`/feedbacks/${id(feedbackId)}`, { method: 'PATCH', body }),
    confirm: (feedbackId, body) => request(`/feedbacks/${id(feedbackId)}/confirm`, { method: 'POST', body }),
    confirmBatch: (lessonId, items) => request(`/lessons/${id(lessonId)}/feedbacks/confirm-batch`, { method: 'POST', body: { items } }),
    versions: (feedbackId) => request(`/feedbacks/${id(feedbackId)}/versions`),
    generate: (lessonId, body) => request(`/lessons/${id(lessonId)}/feedbacks/generate`, { method: 'POST', body }),
    regenerate: (feedbackId, body) => request(`/feedbacks/${id(feedbackId)}/regenerate`, { method: 'POST', body }),
    templates: () => request('/feedback-templates'),
    imageTemplates: () => request('/image-templates'),
    promptTemplates: () => request('/prompt-templates')
  },
  jobs: {
    get: (jobId) => request(`/jobs/${id(jobId)}`),
    list: (params) => request(`/jobs${queryString(params)}`),
    retry: (jobId) => request(`/jobs/${id(jobId)}/retry`, { method: 'POST' }),
    cancel: (jobId, reason) => request(`/jobs/${id(jobId)}/cancel${queryString({ reason })}`, { method: 'POST' })
  },
  parent: {
    draft: (lessonId) => request(`/lessons/${id(lessonId)}/share-page/draft`),
    saveDraft: (lessonId, body) => request(`/lessons/${id(lessonId)}/share-page/draft`, { method: 'PUT', body }),
    publish: (lessonId, body, key) => request(`/lessons/${id(lessonId)}/share-page/publish`, { method: 'POST', body, idempotencyKey: key }),
    skip: (lessonId, body) => request(`/lessons/${id(lessonId)}/share-page/skip`, { method: 'POST', body }),
    revoke: (pageId, body) => request(`/share-pages/${id(pageId)}/revoke`, { method: 'POST', body }),
    republish: (pageId, body, key) => request(`/share-pages/${id(pageId)}/republish`, { method: 'POST', body, idempotencyKey: key }),
    touchTasks: (lessonId, body, key) => request(`/lessons/${id(lessonId)}/touch-tasks`, { method: 'POST', body, idempotencyKey: key }),
    skipTouchTasks: (lessonId, body, key) => request(`/lessons/${id(lessonId)}/touch-tasks/skip`, { method: 'POST', body, idempotencyKey: key }),
    touchTasksForLesson: (lessonId, params = {}) => request(`/touch-tasks${queryString({ lessonId: id(lessonId), ...params })}`),
    markSent: (taskId, body) => request(`/touch-tasks/${id(taskId)}/mark-sent`, { method: 'POST', body }),
    fallbackManual: (taskId, body) => request(`/touch-tasks/${id(taskId)}/fallback-manual`, { method: 'POST', body }),
    retryTouch: (taskId, body) => request(`/touch-tasks/${id(taskId)}/retry`, { method: 'POST', body }),
    cancelTouch: (taskId, body) => request(`/touch-tasks/${id(taskId)}/cancel`, { method: 'POST', body }),
    publicShare: (token) => request(`/public/share/${encodeURIComponent(token)}`, { auth: false }),
    publicAsset: (token, accessKey) => request(`/public/share/${encodeURIComponent(token)}/assets/${encodeURIComponent(accessKey)}`, { auth: false, responseType: 'blob' })
  },
  archive: {
    records: (params) => page('/archive-records', params),
    record: (recordId) => request(`/archive-records/${id(recordId)}`),
    versions: (lessonId) => request(`/lessons/${id(lessonId)}/archive-versions`),
    update: (recordId, body) => request(`/archive-records/${id(recordId)}`, { method: 'PATCH', body }),
    teacherArchives: (params) => page('/teacher-archives', params)
  },
  todo: {
    list: (params) => page('/todos', params),
    wheatTraces: (params) => page('/wheat-traces', params),
    complete: (todoId, body) => request(`/todos/${id(todoId)}/complete`, { method: 'POST', body }),
    cancel: (todoId, body) => request(`/todos/${id(todoId)}/cancel`, { method: 'POST', body }),
    wheat: (lessonId) => request(`/lessons/${id(lessonId)}/wheat-trace`),
    createWheat: (lessonId, key) => request(`/lessons/${id(lessonId)}/wheat-trace`, { method: 'POST', idempotencyKey: key }),
    getWheat: (wheatId) => request(`/wheat-traces/${id(wheatId)}`),
    transitionWheat: (wheatId, body) => request(`/wheat-traces/${id(wheatId)}/transition`, { method: 'POST', body })
  },
  m5: {
    teacherEffect: (lessonId) => request(`/lessons/${id(lessonId)}/teacher-effect`),
    saveTeacherEffectDraft: (lessonId, body) => request(`/lessons/${id(lessonId)}/teacher-effect/draft`, { method: 'PUT', body }),
    generateTeacherEffect: (lessonId, body, key) => request(`/lessons/${id(lessonId)}/teacher-effect/generate`, { method: 'POST', body, idempotencyKey: key }),
    confirmTeacherEffect: (effectId, body) => request(`/teacher-effects/${id(effectId)}/confirm`, { method: 'POST', body }),
    retryTeacherEffect: (effectId, body, key) => request(`/teacher-effects/${id(effectId)}/retry`, { method: 'POST', body, idempotencyKey: key }),
    skipTeacherEffect: (effectId, body) => request(`/teacher-effects/${id(effectId)}/skip`, { method: 'POST', body }),
    cloudArchive: (lessonId, body, key) => request(`/lessons/${id(lessonId)}/cloud-archive-jobs`, { method: 'POST', body, idempotencyKey: key }),
    syncTeacherArchive: (effectId, key) => request(`/teacher-archives/${id(effectId)}/sync`, { method: 'POST', idempotencyKey: key }),
    cloudJobs: (params) => page('/cloud-archive-jobs', params),
    retryCloud: (jobId, body, key) => request(`/cloud-archive-jobs/${id(jobId)}/retry`, { method: 'POST', body, idempotencyKey: key }),
    providers: (params) => request(`/configuration/providers${queryString(params)}`),
    providerGroups: () => request('/configuration/provider-groups'),
    providerTypes: () => request('/configuration/provider-types'),
    createProvider: (body) => request('/configuration/providers', { method: 'POST', body }),
    updateProvider: (providerId, body) => request(`/configuration/providers/${id(providerId)}`, { method: 'PUT', body }),
    testProvider: (providerId) => request(`/configuration/providers/${id(providerId)}/test`, { method: 'POST' }),
    wecomNotice: (body, key) => request('/wecom/internal-notices', { method: 'POST', body, idempotencyKey: key })
  },
  m6: {
    supervision: (params) => page('/supervision/lessons', params),
    qualityReviews: (params) => page('/quality-reviews', params),
    createQualityReview: (body) => request('/quality-reviews', { method: 'POST', body }),
    qualityReview: (reviewId) => request(`/quality-reviews/${id(reviewId)}`),
    qualityVersions: (reviewId) => request(`/quality-reviews/${id(reviewId)}/versions`),
    updateQualityReview: (reviewId, body) => request(`/quality-reviews/${id(reviewId)}`, { method: 'PATCH', body }),
    returnQualityReview: (reviewId, body) => request(`/quality-reviews/${id(reviewId)}/return`, { method: 'POST', body }),
    communications: (studentId, params) => page(`/students/${id(studentId)}/communication-records`, params),
    createCommunication: (studentId, body) => request(`/students/${id(studentId)}/communication-records`, { method: 'POST', body }),
    updateCommunication: (recordId, body) => request(`/communication-records/${id(recordId)}`, { method: 'PATCH', body }),
    deleteCommunication: (recordId, version) => request(`/communication-records/${id(recordId)}${queryString({ version })}`, { method: 'DELETE' }),
    profileFields: (params) => request(`/student-profile-fields${queryString(params)}`),
    profile: (studentId) => request(`/students/${id(studentId)}/profile-values`),
    saveProfileValue: (studentId, body) => request(`/students/${id(studentId)}/profile-values`, { method: 'POST', body }),
    saveProfileValues: (studentId, body) => request(`/students/${id(studentId)}/profile-values`, { method: 'PUT', body }),
    saveProfileValueByField: (studentId, fieldId, body) => request(`/students/${id(studentId)}/profile-values/${id(fieldId)}`, { method: 'PUT', body }),
    profileAudits: (studentId, params) => page(`/students/${id(studentId)}/profile-audits`, params),
    extraTasks: (params) => page('/extra-tasks', params),
    createExtraTask: (body) => request('/extra-tasks', { method: 'POST', body }),
    extraTask: (taskId) => request(`/extra-tasks/${id(taskId)}`),
    updateExtraTask: (taskId, body) => request(`/extra-tasks/${id(taskId)}`, { method: 'PATCH', body }),
    deleteExtraTask: (taskId, version) => request(`/extra-tasks/${id(taskId)}${queryString({ version })}`, { method: 'DELETE' }),
    extraArtworks: (taskId) => request(`/extra-tasks/${id(taskId)}/artworks`),
    createExtraArtwork: (taskId, body) => request(`/extra-tasks/${id(taskId)}/artworks`, { method: 'POST', body }),
    extraArtwork: (artworkId) => request(`/extra-task-artworks/${id(artworkId)}`),
    updateExtraArtwork: (artworkId, body) => request(`/extra-task-artworks/${id(artworkId)}`, { method: 'PATCH', body }),
    deleteExtraArtwork: (artworkId, version) => request(`/extra-task-artworks/${id(artworkId)}${queryString({ version })}`, { method: 'DELETE' })
  },
  portfolio: {
    templates: (params) => request(`/portfolio/templates${queryString(params)}`),
    template: (templateId) => request(`/portfolio/templates/${id(templateId)}`),
    createTemplate: (body) => request('/portfolio/templates', { method: 'POST', body }),
    updateTemplate: (templateId, body) => request(`/portfolio/templates/${id(templateId)}`, { method: 'PATCH', body }),
    createExportSession: (body) => request('/portfolio/exports/upload-sessions', { method: 'POST', body }),
    completeExport: (sessionId, body, key) => request(`/portfolio/exports/upload-sessions/${id(sessionId)}/complete`, { method: 'POST', body, idempotencyKey: key }),
    exports: (params) => page('/portfolio/exports', params),
    export: (exportId) => request(`/portfolio/exports/${id(exportId)}`)
  }
}

export { id as toApiId }
