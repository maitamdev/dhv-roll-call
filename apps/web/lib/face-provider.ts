type CompreFaceSubject = {
  subject: string;
  similarity: number;
};

export type FaceMatchResult = {
  matched: boolean;
  similarity: number;
  detectedFaces: number;
};

function config() {
  const baseUrl = process.env.COMPREFACE_URL?.replace(/\/$/, '');
  const apiKey = process.env.COMPREFACE_API_KEY;
  if (!baseUrl || !apiKey) {
    throw new Error('FACE_PROVIDER_NOT_CONFIGURED');
  }
  return { baseUrl, apiKey };
}

function imageFile(image: Buffer) {
  const bytes = new Uint8Array(image);
  return new Blob([bytes], { type: 'image/jpeg' });
}

export async function enrollFace(providerSubject: string, image: Buffer) {
  const { baseUrl, apiKey } = config();
  const form = new FormData();
  form.append('file', imageFile(image), 'enrollment.jpg');
  const url = `${baseUrl}/api/v1/recognition/faces?subject=${encodeURIComponent(providerSubject)}&det_prob_threshold=0.85`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'x-api-key': apiKey },
    body: form,
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) {
    throw new Error(`FACE_ENROLLMENT_FAILED_${response.status}`);
  }
  return response.json();
}

export async function recognizeFace(
  providerSubject: string,
  image: Buffer,
  threshold: number,
): Promise<FaceMatchResult> {
  const { baseUrl, apiKey } = config();
  const form = new FormData();
  form.append('file', imageFile(image), 'verification.jpg');
  const url = `${baseUrl}/api/v1/recognition/recognize?limit=1&prediction_count=1&det_prob_threshold=0.85`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'x-api-key': apiKey },
    body: form,
    signal: AbortSignal.timeout(12_000),
  });
  if (!response.ok) throw new Error(`FACE_RECOGNITION_FAILED_${response.status}`);

  const payload = await response.json();
  const faces = Array.isArray(payload?.result) ? payload.result : [];
  const subjects: CompreFaceSubject[] = Array.isArray(faces[0]?.subjects) ? faces[0].subjects : [];
  const best = subjects[0];
  const similarity = typeof best?.similarity === 'number' ? best.similarity : 0;
  return {
    matched: faces.length === 1 && best?.subject === providerSubject && similarity >= threshold,
    similarity,
    detectedFaces: faces.length,
  };
}

export async function deleteFaceSubject(providerSubject: string) {
  const { baseUrl, apiKey } = config();
  const url = `${baseUrl}/api/v1/recognition/faces?subject=${encodeURIComponent(providerSubject)}`;
  const response = await fetch(url, {
    method: 'DELETE',
    headers: { 'x-api-key': apiKey },
    signal: AbortSignal.timeout(12_000),
  });
  if (!response.ok && response.status !== 404) {
    throw new Error(`FACE_DELETE_FAILED_${response.status}`);
  }
}

export function decodeJpegDataUrl(value: unknown): Buffer {
  if (typeof value !== 'string') throw new Error('INVALID_IMAGE');
  const match = value.match(/^data:image\/jpeg;base64,([A-Za-z0-9+/=]+)$/);
  if (!match) throw new Error('INVALID_IMAGE_FORMAT');
  const image = Buffer.from(match[1], 'base64');
  if (image.length < 8_000 || image.length > 2_000_000) throw new Error('INVALID_IMAGE_SIZE');
  return image;
}
