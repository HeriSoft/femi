

import { FluxKontexSettings, EditImageWithFluxKontexParams, SingleImageData, MultiImageData, FluxDevSettings, GenerateImageWithFluxDevParams, UserSessionState, GenerateVideoWithKlingParams, KlingAiSettings, WanI2vSettings, GenerateVideoWithWanI2vParams } from '../types.ts'; // Updated

// FalServiceEditParams and FalServiceGenerateParams are now directly EditImageWithFluxKontexParams and GenerateImageWithFluxDevParams
// as these base types now include userSession and requestHeaders.

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
  videoUrl?: string; // For video generation results
  error?: string;
  message?: string; 
  rawResult?: any; 
}


export async function editImageWithFluxKontexProxy(
  params: EditImageWithFluxKontexParams 
): Promise<FalSubmitProxyResponse> {
  const { modelIdentifier, prompt, settings, imageData, requestHeaders, userSession } = params; 

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(requestHeaders || {}), // Spread headers passed from ChatPage (which should contain auth tokens)
  };

  // Removed internal header construction from userSession, as ChatPage now provides it in requestHeaders.
  // if (userSession.isPaidUser && userSession.paidUserToken) {
  //   headers['X-Paid-User-Token'] = userSession.paidUserToken;
  // } else if (userSession.isDemoUser && userSession.demoUserToken) {
  //   headers['X-Demo-Token'] = userSession.demoUserToken;
  // }


  let bodyPayload: any = {
    modelIdentifier,
    prompt,
    guidance_scale: settings.guidance_scale,
    // safety_tolerance is typically not used for kontext, proxy will filter
    // num_inference_steps is typically not used for kontext edit, proxy will filter
    seed: settings.seed,
    num_images: settings.num_images,
    output_format: settings.output_format,
  };

  if (settings.aspect_ratio && settings.aspect_ratio !== 'default') {
    bodyPayload.aspect_ratio = settings.aspect_ratio;
  }
   // Add other known valid settings if they are part of FluxKontexSettings type
  if (settings.safety_tolerance !== undefined) bodyPayload.safety_tolerance = settings.safety_tolerance;
  if (settings.num_inference_steps !== undefined) bodyPayload.num_inference_steps = settings.num_inference_steps;


  if ('images_data' in imageData) { 
    bodyPayload.images_data = imageData.images_data;
  } else { 
    bodyPayload.image_base_64 = imageData.image_base_64;
    bodyPayload.image_mime_type = imageData.image_mime_type;
  }

  try {
    const fetchOptions: RequestInit = {
      method: 'POST',
      headers: headers, 
      body: JSON.stringify(bodyPayload),
    };
    
    const response = await fetch('/api/fal/image/edit/flux-kontext', fetchOptions);
    const responseText = await response.text();
    let data: FalSubmitProxyResponse;

    try {
        if (!responseText) {
             console.error("[FalService Error] editImageWithFluxKontexProxy: Proxy returned an empty response. Status:", response.status, response.statusText);
             return { error: `Proxy returned an empty response (Status: ${response.status}) for Flux Kontext submission.`};
        }
        data = JSON.parse(responseText);
    } catch (e) {
        console.error("[FalService Error] editImageWithFluxKontexProxy: Proxy response was not valid JSON. Status:", response.status, response.statusText, "Response Text (first 500 chars):", responseText.substring(0, 500));
        return { error: `Proxy returned non-JSON response (Status: ${response.status}) for Flux Kontext. Response (partial): ${responseText.substring(0,100)}...`};
    }

    if (!response.ok || data.error) { // Check response.ok *after* trying to parse potential JSON error
      return { error: data.error || `Fal.ai Flux Kontext proxy submission failed: ${response.statusText}` };
    }
    
    if (data.requestId) {
      return { requestId: data.requestId, message: data.message };
    } else {
      // This case might be redundant if the check above catches it, but good for safety.
      return { error: data.error || "Fal.ai Flux Kontext proxy did not return a requestId." };
    }

  } catch (error: any) {
    console.error("Error calling Fal.ai Flux Kontext proxy service for submission:", error);
    return { error: `Network or unexpected error calling Fal.ai Flux Kontext proxy for submission: ${error.message}` };
  }
}


export async function generateImageWithFluxDevProxy(
  params: GenerateImageWithFluxDevParams
): Promise<FalSubmitProxyResponse> {
  const { modelIdentifier, prompt, settings, requestHeaders, userSession } = params;

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(requestHeaders || {}), // Spread headers passed from ChatPage
  };

  const bodyPayload = {
    modelIdentifier,
    prompt,
    ...settings // Spread all settings from FluxDevSettings
  };

  try {
    const fetchOptions: RequestInit = {
      method: 'POST',
      headers: headers, 
      body: JSON.stringify(bodyPayload),
    };

    const response = await fetch('/api/fal/image/generate/flux-dev', fetchOptions); // Updated endpoint
    const responseText = await response.text();
    let data: FalSubmitProxyResponse;

    try {
        if (!responseText) {
             console.error("[FalService Error] generateImageWithFluxDevProxy: Proxy returned an empty response. Status:", response.status, response.statusText);
             return { error: `Proxy returned an empty response (Status: ${response.status}) for Flux Dev submission.`};
        }
        data = JSON.parse(responseText);
    } catch (e) {
        console.error("[FalService Error] generateImageWithFluxDevProxy: Proxy response was not valid JSON. Status:", response.status, response.statusText, "Response Text (first 500 chars):", responseText.substring(0, 500));
        return { error: `Proxy returned non-JSON response (Status: ${response.status}) for Flux Dev. Response (partial): ${responseText.substring(0,100)}...`};
    }


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

export async function generateVideoWithKlingProxy(
  params: GenerateVideoWithKlingParams
): Promise<FalSubmitProxyResponse> {
  const { modelIdentifier, prompt, settings, imageData, requestHeaders, userSession } = params;

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(requestHeaders || {}),
  };

  const bodyPayload = {
    modelIdentifier,
    prompt,
    settings, // Pass the whole KlingAiSettings object
    image_base_64: imageData.image_base_64,
    image_mime_type: imageData.image_mime_type,
    // userSession is implicitly handled by proxy via headers
  };

  try {
    const fetchOptions: RequestInit = {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(bodyPayload),
    };
    // IMPORTANT: The backend endpoint for Kling video needs to be defined.
    // Example: '/api/fal/video/generate/kling'
    const response = await fetch('/api/fal/video/generate/kling', fetchOptions); 
    const responseText = await response.text();
    let data: FalSubmitProxyResponse;

    try {
      if (!responseText) {
        console.error("[FalService Error] generateVideoWithKlingProxy: Proxy returned an empty response. Status:", response.status, response.statusText);
        return { error: `Proxy returned an empty response (Status: ${response.status}) for Kling AI video submission.` };
      }
      data = JSON.parse(responseText);
    } catch (e) {
      console.error("[FalService Error] generateVideoWithKlingProxy: Proxy response was not valid JSON. Status:", response.status, response.statusText, "Response Text (first 500 chars):", responseText.substring(0, 500));
      return { error: `Proxy returned non-JSON response (Status: ${response.status}) for Kling AI video. Response (partial): ${responseText.substring(0, 100)}...` };
    }

    if (!response.ok || data.error) {
      return { error: data.error || `Fal.ai Kling AI Video proxy submission failed: ${response.statusText}` };
    }

    if (data.requestId) {
      return { requestId: data.requestId, message: data.message };
    } else {
      return { error: data.error || "Fal.ai Kling AI Video proxy did not return a requestId." };
    }

  } catch (error: any) {
    console.error("Error calling Fal.ai Kling AI Video proxy service for submission:", error);
    return { error: `Network or unexpected error calling Fal.ai Kling AI Video proxy for submission: ${error.message}` };
  }
}

export async function generateVideoWithWanI2vProxy(
  params: GenerateVideoWithWanI2vParams
): Promise<FalSubmitProxyResponse> {
  const { modelIdentifier, prompt, settings, imageData, requestHeaders } = params;

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(requestHeaders || {}),
  };

  const bodyPayload = {
    modelIdentifier,
    prompt,
    settings,
    image_base_64: imageData.image_base_64,
    image_mime_type: imageData.image_mime_type,
  };

  try {
    const fetchOptions: RequestInit = {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(bodyPayload),
    };
    const response = await fetch('/api/fal/video/generate/wan-i2v', fetchOptions);
    const responseText = await response.text();
    let data: FalSubmitProxyResponse;

    try {
      if (!responseText) {
        console.error("[FalService Error] generateVideoWithWanI2vProxy: Proxy returned an empty response. Status:", response.status, response.statusText);
        return { error: `Proxy returned an empty response (Status: ${response.status}) for Wan I2V video submission.` };
      }
      data = JSON.parse(responseText);
    } catch (e) {
      console.error("[FalService Error] generateVideoWithWanI2vProxy: Proxy response was not valid JSON. Status:", response.status, response.statusText, "Response Text (first 500 chars):", responseText.substring(0, 500));
      return { error: `Proxy returned non-JSON response (Status: ${response.status}) for Wan I2V video. Response (partial): ${responseText.substring(0, 100)}...` };
    }

    if (!response.ok || data.error) {
      return { error: data.error || `Fal.ai Wan I2V Video proxy submission failed: ${response.statusText}` };
    }

    if (data.requestId) {
      return { requestId: data.requestId, message: data.message };
    } else {
      return { error: data.error || "Fal.ai Wan I2V Video proxy did not return a requestId." };
    }
  } catch (error: any) {
    console.error("Error calling Fal.ai Wan I2V Video proxy service for submission:", error);
    return { error: `Network or unexpected error calling Fal.ai Wan I2V Video proxy for submission: ${error.message}` };
  }
}


export async function checkFalQueueStatusProxy( 
  requestId: string,
  modelIdentifier: string 
): Promise<FalStatusProxyResponse> {
  try {
    const response = await fetch('/api/fal/queue/status', { // Generic endpoint
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
    
    // Standardize response payload
    let responsePayload: FalStatusProxyResponse = {
        status: data.status,
        imageUrl: data.imageUrl,
        imageUrls: data.imageUrls,
        videoUrl: data.videoUrl,
        error: data.error,
        message: data.message,
        rawResult: data.rawResult || data, // Use rawResult from data if present, else use data itself
    };

    // The logic to extract URLs is now handled by the proxy, so the client receives a consistent format.
    // If status is COMPLETED, the proxy will have already put the correct URL(s) in the `videoUrl` or `imageUrls` fields.
    // We can still add client-side checks for safety.
    if (responsePayload.status === 'COMPLETED') {
        const isVideoModel = modelIdentifier.includes('kling-video') || modelIdentifier.includes('wan-i2v');
        if (isVideoModel && !responsePayload.videoUrl) {
            responsePayload.status = 'COMPLETED_NO_VIDEO';
            if (!responsePayload.message) responsePayload.message = "Processing completed, but no video URL was found in the proxy response.";
            if (!responsePayload.error) responsePayload.error = "Proxy result for video model did not contain expected video URL.";
        } else if (!isVideoModel && (!responsePayload.imageUrls || responsePayload.imageUrls.length === 0)) {
            responsePayload.status = 'COMPLETED_NO_IMAGE';
            if (!responsePayload.message) responsePayload.message = "Processing completed, but no image URLs were found in the proxy response.";
            if (!responsePayload.error) responsePayload.error = "Proxy result for image model did not contain expected image URL(s).";
        }
    } else if (responsePayload.status === 'ERROR' && !responsePayload.error) {
        responsePayload.error = responsePayload.rawResult?.error?.message || responsePayload.rawResult?.message || "Fal.ai reported an error.";
        if (!responsePayload.message) responsePayload.message = "Processing failed.";
    } else if (!responsePayload.status) { // If status is missing from proxy, but request was ok
        responsePayload.status = 'PROXY_REQUEST_ERROR';
        if (!responsePayload.error) responsePayload.error = 'Status missing from Fal.ai status check response from proxy.';
    }
    
    return responsePayload;

  } catch (error: any) {
    console.error("Error calling Fal.ai status proxy service:", error);
    return { error: `Network error checking Fal.ai status: ${error.message}`, status: 'NETWORK_ERROR' };
  }
}
