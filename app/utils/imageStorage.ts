import { supabase } from "~/utils/supabase";

function inferImageFormat(base64Data: string): {
  contentType: string;
  extension: string;
} {
  const normalized = base64Data.trim();

  if (normalized.startsWith("iVBORw0KGgo")) {
    return { contentType: "image/png", extension: "png" };
  }

  if (normalized.startsWith("/9j/")) {
    return { contentType: "image/jpeg", extension: "jpg" };
  }

  if (normalized.startsWith("UklGR")) {
    return { contentType: "image/webp", extension: "webp" };
  }

  return { contentType: "image/jpeg", extension: "jpg" };
}

export async function uploadImage(base64Data: string, folder: string): Promise<string> {
  const { contentType, extension } = inferImageFormat(base64Data);
  const base64Response = await fetch(`data:${contentType};base64,${base64Data}`);
  const blob = await base64Response.blob();

  const filename = `${folder}/${Date.now()}-${Math.random().toString(36).substring(7)}.${extension}`;

  const { error } = await supabase.storage
    .from('split-g-images')
    .upload(filename, blob, {
      contentType,
      cacheControl: '3600'
    });

  if (error) throw error;

  const { data: { publicUrl } } = supabase.storage
    .from('split-g-images')
    .getPublicUrl(filename);

  return publicUrl;
}