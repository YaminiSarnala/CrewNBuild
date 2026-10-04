// // ---------------------------------------------------------------------------
// // Port of the web src/services/upload.js.
// //
// // The web version receives a browser File object and calls URL.createObjectURL
// // for a preview. React Native has neither. Instead we accept an asset object
// // from expo-image-picker (or any { uri, name, mimeType } shape) and build the
// // multipart body from the local file URI, which RN's FormData understands.
// // The endpoint and field name ('file') are unchanged.
// // ---------------------------------------------------------------------------
// import { apiClient } from './client'

// function guessName(uri, fallback = 'upload.jpg') {
//   const tail = uri?.split('/').pop()
//   return tail && tail.includes('.') ? tail : fallback
// }

// function guessMimeType(name) {
//   const ext = name.split('.').pop()?.toLowerCase()
//   if (ext === 'png') return 'image/png'
//   if (ext === 'webp') return 'image/webp'
//   if (ext === 'heic') return 'image/heic'
//   if (ext === 'pdf') return 'application/pdf'
//   return 'image/jpeg'
// }

// /**
//  * @param {{ uri: string, fileName?: string, name?: string, mimeType?: string, type?: string }} asset
//  *        Typically `result.assets[0]` from expo-image-picker.
//  */
// export async function uploadLocalFile(asset) {
//   if (!asset?.uri) throw new Error('uploadLocalFile requires an asset with a uri')

//   const name = asset.fileName || asset.name || guessName(asset.uri)
//   const type = asset.mimeType || (asset.type && asset.type.includes('/') ? asset.type : null) || guessMimeType(name)

//   const formData = new FormData()
//   formData.append('file', { uri: asset.uri, name, type })

//   const response = await apiClient.post('/files/upload', formData)

//   return {
//     ...response.data,
//     previewUrl: asset.uri, // local URI works directly as an <Image> source
//     name,
//     type,
//   }
// }

// /**
//  * Appends a picker asset to an existing FormData under an arbitrary field name.
//  * Used by the timeline and daily-workflow screens, which post several images
//  * alongside text fields in one multipart request.
//  */
// export function appendAsset(formData, fieldName, asset) {
//   if (!asset?.uri) return formData
//   const name = asset.fileName || asset.name || guessName(asset.uri)
//   const type = asset.mimeType || guessMimeType(name)
//   formData.append(fieldName, { uri: asset.uri, name, type })
//   return formData
// }


// Port of web services/upload.js — multipart upload to /files/upload.
// Takes an expo-image-picker asset and returns the server's file record.
import { apiClient } from './client'

export async function uploadLocalFile(asset, name = 'upload.jpg') {
  const formData = new FormData()
  formData.append('file', {
    uri: asset.uri,
    name: asset.fileName || name,
    type: asset.mimeType || 'image/jpeg',
  })
  const response = await apiClient.post('/files/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return response.data
}