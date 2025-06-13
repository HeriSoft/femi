

import { ModelSettings, ApiChatMessage, ApiStreamChunk, GeneralApiSendMessageParams, UserSessionState } from '../types.ts';

// GeneralApiSendMessageParams will no longer include apiKey
interface ProxiedGeneralApiSendMessageParams {
  modelIdentifier: string;
  history: ApiChatMessage[]; 
  modelSettings: ModelSettings;
  userSession: UserSessionState; // Added userSession
}

export async function* sendOpenAIMessageStream(
  params: ProxiedGeneralApiSendMessageParams // Updated params type
): AsyncGenerator<ApiStreamChunk, void, undefined> {
  const { modelIdentifier, history, modelSettings, userSession } = params;

  const headers: HeadersInit = { 'Content-Type': 'application/json' };
  if (userSession.isPaidUser && userSession.paidUserToken) {
    headers['X-Paid-User-Token'] = userSession.paidUserToken;
  } else if (userSession.isDemoUser && userSession.demoUserToken) {
    headers['X-Demo-Token'] = userSession.demoUserToken;
  }

  try {
    const response = await fetch('/api/openai/chat/stream', {
      method: 'POST',
      headers: headers,
      body: JSON.stringify({ modelIdentifier, history, modelSettings }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorDetail = errorData.error?.message || errorData.error || `Error: ${response.status} ${response.statusText}`; // check error.message from openai
      yield { error: `OpenAI Proxy Error: ${errorDetail}`, isFinished: true };
      return;
    }

    if (!response.body) {
      yield { error: 'OpenAI Proxy Error: No response body received.', isFinished: true };
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        // If buffer has content that wasn't fully processed (e.g. partial JSON after last \n\n)
        // it might be an issue. For typical OpenAI streams, this should be fine.
        break; 
      }

      buffer += decoder.decode(value, { stream: true });
      
      // OpenAI streams data with "data: " prefix and double newline separation for each chunk
      let boundary = buffer.indexOf('\n\n');
      while (boundary !== -1) {
        const chunkLineWithPrefix = buffer.substring(0, boundary);
        buffer = buffer.substring(boundary + 2); // Move past the '\n\n'

        if (chunkLineWithPrefix.startsWith('data: ')) {
          const jsonStr = chunkLineWithPrefix.substring(6).trim(); // Remove "data: " and trim
          if (jsonStr === '[DONE]') {
            yield { isFinished: true };
            return;
          }
          try {
            const parsed = JSON.parse(jsonStr);
            // Check for content delta
            if (parsed.choices && parsed.choices[0]?.delta?.content) {
              yield { textDelta: parsed.choices[0].delta.content };
            }
            // Check for finish reason (though [DONE] is more common for streams)
            if (parsed.choices && parsed.choices[0]?.finish_reason) {
               yield { isFinished: true };
               // if finish_reason is 'stop', it's a natural end.
               // if other reasons (length, content_filter), it might indicate truncation.
            }
          } catch (e) {
            console.error('Error parsing OpenAI stream chunk from proxy:', e, "JSON string:", jsonStr);
            // Potentially yield an error chunk or decide to skip malformed chunks
            // depending on how robust you want the stream to be.
            // For now, we'll log and continue, as some models might have complex intermediate non-JSON data
            // though typical chat completion stream is JSON per line.
          }
        }
        boundary = buffer.indexOf('\n\n');
      }
    }
    // After the loop, if it didn't end with [DONE] or a finish_reason,
    // ensure a final finished signal if not already sent.
    // This helps consumers know the stream has truly ended.
    // However, most OpenAI streams properly send [DONE].
    // This yield is a safety net.
    yield { isFinished: true };

  } catch (error: any) {
    console.error('OpenAI Proxy Service Fetch Error:', error);
    yield { error: `Fetch error to OpenAI proxy: ${error.message || 'Unknown fetch error'}`, isFinished: true };
  }
}