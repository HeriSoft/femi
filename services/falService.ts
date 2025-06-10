
import { FluxKontexSettings, EditImageWithFluxKontexParams as ClientEditImageWithFluxKontexParams, SingleImageData, MultiImageData } from '../types.ts';

// Matches the parameters expected by the updated proxy endpoint
// This interface is now defined in types.ts as EditImageWithFluxKontexParams
// For clarity, let's ensure client-side usage matches what's in types.ts.
// export interface EditImageWithFluxKontexParams { // This definition is now in types.ts
//   modelIdentifier: string;
//   prompt: string;
//   settings: FluxKontexSettings;
//   imageData: SingleImageData | MultiImageData; // Use the union type
// }


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
  params: ClientEditImageWithFluxKontexParams // Use the type from types.ts
): Promise<FluxKontexSubmitProxyResponse> {
  const { modelIdentifier, prompt, settings, imageData } = params; 

  let bodyPayload: any = {
    modelIdentifier,
    prompt,
    guidance_scale: settings.guidance_scale,
    safety_tolerance: settings.safety_tolerance,
    num_inference_steps: settings.num_inference_steps,
    seed: settings.seed,
    num_images: settings.num_images,
    output_format: settings.output_format,
  };

  if (settings.aspect_ratio && settings.aspect_ratio !== 'default') {
    bodyPayload.aspect_ratio = settings.aspect_ratio;
  }
  // If settings.aspect_ratio is 'default' or undefined, it's omitted from the payload.

  if ('images_data' in imageData) { // Check if it's MultiImageData
    bodyPayload.images_data = imageData.images_data;
  } else { // It's SingleImageData
    bodyPayload.image_base_64 = imageData.image_base_64;
    bodyPayload.image_mime_type = imageData.image_mime_type;
  }

  try {
    const response = await fetch('/api/fal/image/edit/flux-kontext', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(bodyPayload),
    });

    const data: FluxKontexSubmitProxyResponse = await response.json();

    if (!response.ok || data.error) {
      return { error: data.error || `Fal.ai Flux Kontext proxy submission failed: ${response.statusText}` };
    }
    
    if (data.requestId) {
      return { requestId: data.requestId, message: data.message };
    } else {
      return { error: data.error || "Fal.ai Flux Kontext proxy did not return a requestId." };
    }

  } catch (error: any) {
    console.error("Error calling Fal.ai Flux Kontext proxy service for submission:", error);
    return { error: `Network or unexpected error calling Fal.ai Flux Kontext proxy for submission: ${error.message}` };
  }
}

export async function checkFluxKontexStatusProxy(
  requestId: string,
  modelIdentifier: string // Added modelIdentifier
): Promise<FluxKontexStatusProxyResponse> {
  try {
    const response = await fetch('/api/fal/image/edit/status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ requestId, modelIdentifier }), // Send modelIdentifier
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