export const isPersistedPortfolioTemplateId = (templateId) => /^[1-9]\d*$/.test(String(templateId ?? ''))
