import { supabase } from "~/utils/supabase";

async function uploadWithRetry(
  blob: Blob, 
  filename: string, 
  retries = 3
): Promise<string> {
  let lastError;
  
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const { data, error } = await supabase.storage
        .from('split-g-images')
        .upload(filename, blob, {
          contentType: 'image/jpeg',
          cacheControl: '3600',
          upsert: true
        });

      if (error) {
        console.error(`Upload attempt ${attempt + 1} failed:`, error);
        lastError = error;
        // Wait a bit between retries (exponential backoff)
        await new Promise(r => setTimeout(r, 1000 * Math.pow(2, attempt)));
        continue;
      }

      const { data: { publicUrl } } = supabase.storage
        .from('split-g-images')
        .getPublicUrl(filename);

      return publicUrl;
    } catch (err) {
      console.error(`Upload attempt ${attempt + 1} failed with exception:`, err);
      lastError = err;
      // Wait a bit between retries
      await new Promise(r => setTimeout(r, 1000 * Math.pow(2, attempt)));
    }
  }
  
  throw new Error(`Failed to upload after ${retries} attempts: ${lastError}`);
}

export async function uploadImage(base64Data: string, folder: string): Promise<string> {
  try {
    console.log(`Starting upload to folder: ${folder}`);
    
    if (!base64Data) {
      console.warn("No base64 data provided, returning empty URL");
      return "";
    }
    
    // Remove any data URL prefix if present to get clean base64
    let cleanBase64 = base64Data;
    if (base64Data.includes('base64,')) {
      cleanBase64 = base64Data.split('base64,')[1];
    }
    
    // Clean up the base64 string - remove whitespace
    cleanBase64 = cleanBase64.trim().replace(/\s/g, '');
    
    // Log part of the data for debugging
    console.log(`Base64 data length: ${cleanBase64.length} chars, prefix: ${cleanBase64.substring(0, 10)}...`);
    
    // Create a direct Blob from the base64 data
    let blob;
    try {
      // Convert base64 to binary
      const byteCharacters = atob(cleanBase64);
      const byteArrays = [];
      
      // Process in chunks to handle large images
      for (let offset = 0; offset < byteCharacters.length; offset += 1024) {
        const slice = byteCharacters.slice(offset, offset + 1024);
        const byteNumbers = new Array(slice.length);
        for (let i = 0; i < slice.length; i++) {
          byteNumbers[i] = slice.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        byteArrays.push(byteArray);
      }
      
      blob = new Blob(byteArrays, { type: 'image/jpeg' });
      console.log(`Blob created successfully: ${blob.size} bytes`);
    } catch (error) {
      console.error("Failed to create blob from base64:", error);
      return ""; // Return empty URL on error
    }
    
    if (!blob || blob.size === 0) {
      console.error("Generated blob is empty");
      return ""; // Return empty URL if blob is empty
    }
    
    const filename = `${folder}/${Date.now()}-${Math.random().toString(36).substring(7)}.jpg`;
    console.log(`Generated filename: ${filename}`);
    
    try {
      return await uploadWithRetry(blob, filename);
    } catch (error) {
      console.error("Failed to upload to Supabase:", error);
      return ""; // Return empty URL on upload failure
    }
  } catch (error) {
    console.error("Image upload error:", error);
    return ""; // Return empty URL on any error
  }
}