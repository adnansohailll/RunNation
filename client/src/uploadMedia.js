const CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
const UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;

// Downscales/re-encodes an image file client-side before upload, so a
// multi-photo phone-camera batch doesn't turn into a slow, data-hungry
// upload. Falls back to the original file if canvas decoding fails.
export async function compressImage(file, { maxDim = 1600, quality = 0.82 } = {}) {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    canvas.getContext("2d").drawImage(bitmap, 0, 0, width, height);
    bitmap.close();

    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
    return blob ?? file;
  } catch {
    return file;
  }
}

async function uploadToCloudinaryResource(blob, resourceType) {
  if (!CLOUD_NAME || !UPLOAD_PRESET) {
    throw new Error(`${resourceType === "video" ? "Voice note" : "Photo"} uploads aren't configured yet.`);
  }

  const formData = new FormData();
  formData.append("file", blob);
  formData.append("upload_preset", UPLOAD_PRESET);

  const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/${resourceType}/upload`, {
    method: "POST",
    body: formData,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error?.message || "Upload failed");
  return data.secure_url;
}

export function uploadToCloudinary(blob) {
  return uploadToCloudinaryResource(blob, "image");
}

// Cloudinary treats non-image uploads (audio included) as its "video"
// resource type — there's no separate audio endpoint.
export function uploadAudioToCloudinary(blob) {
  return uploadToCloudinaryResource(blob, "video");
}
