

import { FluxKontexSettings, EditImageWithFluxKontexParams as BaseEditParams, SingleImageData, MultiImageData, FluxDevSettings, GenerateImageWithFluxDevParams } from '../types.ts';

// Interface for parameters including optional request headers
export interface FalServiceEditParams extends BaseEditParams {
  requestHeaders?: HeadersInit;
}
export interface FalServiceGenerateParams extends GenerateImageWithFluxDevParams {
  requestHeaders?: HeadersInit;
}


// Updated response type for the initial submission from the proxy
export interface FalSubmitProxyResponse {
  requestId?: string;
  message?: string;
  error?: string;
}

// Updated response type for the status check from the proxy
export interface FalStatusProxyResponse {
  status?: 'COMPLETED' | 'IN_PROGRESS' | 'IN_QUEUE' | 'ERROR' | 'COMPLETED_NO_IMAGE' | 'NOT_FOUND' | 'PROXY_REQUEST_ERROR' | 'NETWORK_ERROR' | string;
  imageUrl?: string; // Generic field for resulting image URL
  imageUrls?: string[]; // For models that return multiple images
  error?: string;
  message?: string; 
  rawResult?: any; 
}


export async function editImageWithFluxKontexProxy(
  params: FalServiceEditParams 
): Promise<FalSubmitProxyResponse> {
  const { modelIdentifier, prompt, settings, imageData, requestHeaders } = params; 

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

  if ('images_data' in imageData) { 
    bodyPayload.images_data = imageData.images_data;
  } else { 
    bodyPayload.image_base_64 = imageData.image_base_64;
    bodyPayload.image_mime_type = imageData.image_mime_type;
  }

  try {
    const fetchOptions: RequestInit = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(requestHeaders || {}), 
      },
      body: JSON.stringify(bodyPayload),
    };
    
    const response = await fetch('/api/fal/image/edit/flux-kontext', fetchOptions);

    const data: FalSubmitProxyResponse = await response.json();

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


export async function generateImageWithFluxDevProxy(
  params: FalServiceGenerateParams
): Promise<FalSubmitProxyResponse> {
  const { modelIdentifier, prompt, settings, requestHeaders } = params;

  const bodyPayload = {
    modelIdentifier,
    prompt,
    ...settings // Spread all settings from FluxDevSettings
  };

  try {
    const fetchOptions: RequestInit = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(requestHeaders || {}),
      },
      body: JSON.stringify(bodyPayload),
    };

    const response = await fetch('/api/fal/image/generate/flux-dev', fetchOptions);
    const data: FalSubmitProxyResponse = await response.json();

    if (!response.ok || data.error) {
      return { error: data.error || `Fal.ai Flux Dev proxy submission failed: ${response.statusText}` };
    }
    
    if (data.requestId) {
      return { requestId: data.requestId, message: data.message };
    } else {
      return { error: data.error || "Fal.ai Flux Dev proxy did not return a requestId." };
    }

  } catch (error: any) {
    console.error("Error calling Fal.ai Flux Dev proxy service for submission:", error);
    return { error: `Network or unexpected error calling Fal.ai Flux Dev proxy for submission: ${error.message}` };
  }
}


export async function checkFalQueueStatusProxy( // Renamed for generality
  requestId: string,
  modelIdentifier: string 
): Promise<FalStatusProxyResponse> {
  try {
    const response = await fetch('/api/fal/image/edit/status', { // Keep using existing status endpoint, as it's now generic
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }, 
      body: JSON.stringify({ requestId, modelIdentifier }), 
    });
    
    const data: FalStatusProxyResponse = await response.json();
    
    if (!response.ok) {
        return { 
            error: data.error || `Fal.ai status check failed with HTTP status: ${response.statusText}`, 
            status: data.status || 'PROXY_REQUEST_ERROR', 
            rawResult: data 
        };
    }
    // The proxy now handles extracting the correct image URL(s) based on modelIdentifier
    return { 
        status: data.status, 
        imageUrl: data.imageUrl, 
        imageUrls: data.imageUrls,
        error: data.error, 
        message: data.message,
        rawResult: data.rawResult 
    };

  } catch (error: any) {
    console.error("Error calling Fal.ai status proxy service:", error);
    return { error: `Network error checking Fal.ai status: ${error.message}`, status: 'NETWORK_ERROR' };
  }
}
