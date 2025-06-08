
import { FluxKontexSettings } from '../types.ts';

// Matches the parameters expected by the updated proxy endpoint
export interface EditImageWithFluxKontexParams {
  image_base_64: string; // Changed from imageBase64 to image_base_64
  imageMimeType: 'image/jpeg' | 'image/png'; 
  prompt: string;
  settings: FluxKontexSettings; 
}

// Updated response type for the initial submission from the proxy
export interface FluxKontexSubmitProxyResponse {
  requestId?: string;
  message?: string;
  error?: string;
}

// Updated response type for the status check from the proxy
export interface FluxKontexStatusProxyResponse {
  status?: 'COMPLETED' | 'IN_PROGRESS' | 'IN_QUEUE' | 'ERROR' | 'COMPLETED_NO_IMAGE' | 'NOT_FOUND' | 'PROXY_REQUEST_ERROR' | 'NETWORK_ERROR' | string; // Added more specific statuses from proxy
  editedImageUrl?: string;
  error?: string;
  message?: string; 
  rawResult?: any; 
}


export async function editImageWithFluxKontexProxy(
  params: EditImageWithFluxKontexParams
): Promise<FluxKontexSubmitProxyResponse> {
  const { image_base_64, imageMimeType, prompt, settings } = params; 

  try {
    const response = await fetch('/api/fal/image/edit/flux-kontext', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        image_base_64: image_base_64,
        image_mime_type: imageMimeType,
        prompt: prompt,
        guidance_scale: settings.guidance_scale,
        safety_tolerance: settings.safety_tolerance,
        num_inference_steps: settings.num_inference_steps,
        seed: settings.seed,
        num_images: settings.num_images,
        aspect_ratio: settings.aspect_ratio,
      }),
    });

    const data: FluxKontexSubmitProxyResponse = await response.json();

    if (!response.ok || data.error) {
      return { error: data.error || `Fal.ai Flux Kontext proxy submission failed: ${response.statusText}` };
    }
    
    if (data.requestId) {
      return { requestId: data.requestId, message: data.message };
    } else {
      // This case should ideally be handled by the proxy returning an error if requestId is missing
      return { error: data.error || "Fal.ai Flux Kontext proxy did not return a requestId." };
    }

  } catch (error: any) {
    console.error("Error calling Fal.ai Flux Kontext proxy service for submission:", error);
    return { error: `Network or unexpected error calling Fal.ai Flux Kontext proxy for submission: ${error.message}` };
  }
}

export async function checkFluxKontexStatusProxy(
  requestId: string
): Promise<FluxKontexStatusProxyResponse> {
  try {
    const response = await fetch('/api/fal/image/edit/status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ requestId }),
    });
    
    const data: FluxKontexStatusProxyResponse = await response.json();
    
    if (!response.ok) {
        return { 
            error: data.error || `Fal.ai status check failed with HTTP status: ${response.statusText}`, 
            status: data.status || 'PROXY_REQUEST_ERROR', 
            rawResult: data 
        };
    }
    return { 
        status: data.status, 
        editedImageUrl: data.editedImageUrl, 
        error: data.error, 
        message: data.message,
        rawResult: data.rawResult 
    };

  } catch (error: any) {
    console.error("Error calling Fal.ai status proxy service:", error);
    return { error: `Network error checking Fal.ai status: ${error.message}`, status: 'NETWORK_ERROR' };
  }
}
