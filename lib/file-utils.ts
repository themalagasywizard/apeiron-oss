// File utility functions

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes'
  
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}

export function getFileIcon(mimeType: string): string {
  if (mimeType.startsWith('image/')) return '🖼️'
  if (mimeType === 'application/pdf') return '📄'
  if (mimeType.includes('document') || mimeType.includes('word')) return '📝'
  if (mimeType.includes('text')) return '📄'
  if (mimeType.includes('spreadsheet') || mimeType.includes('excel')) return '📊'
  if (mimeType.includes('presentation') || mimeType.includes('powerpoint')) return '📈'
  return '📎'
}

export function getFileCategory(mimeType: string): 'image' | 'pdf' | 'document' | 'other' {
  if (mimeType.startsWith('image/')) return 'image'
  if (mimeType === 'application/pdf') return 'pdf'
  if (mimeType.includes('document') || mimeType.includes('text') || mimeType.includes('word')) return 'document'
  return 'other'
}

export function isImageFile(mimeType: string): boolean {
  return mimeType.startsWith('image/')
}

export function isPDFFile(mimeType: string): boolean {
  return mimeType === 'application/pdf'
}

export function isTextFile(mimeType: string): boolean {
  return mimeType.startsWith('text/') || 
         mimeType.includes('document') || 
         mimeType.includes('word')
}

export function validateFileType(mimeType: string): boolean {
  const allowedTypes = [
    'image/jpeg',
    'image/png', 
    'image/gif',
    'image/webp',
    'image/svg+xml',
    'application/pdf',
    'text/plain',
    'text/csv',
    'text/markdown',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ]
  
  return allowedTypes.includes(mimeType)
}

export function validateFileSize(size: number, maxSizeMB: number = 10): boolean {
  return size <= maxSizeMB * 1024 * 1024
}

export function createFileId(): string {
  return `file_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
} 