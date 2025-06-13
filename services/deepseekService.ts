

import { ModelSettings, ApiChatMessage, ApiStreamChunk, GeneralApiSendMessageParams, UserSessionState } from '../types.ts';

// GeneralApiSendMessageParams will no longer include apiKey
interface ProxiedGeneralApiSendMessageParams {
  modelIdentifier: string;
  history: ApiChatMessage[]; 
  modelSettings: ModelSettings;
  userSession: UserSessionState; // Added userSession
}

export async function* sendDeepseekMessageStream(
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
    const response = await fetch('/api/deepseek/chat/stream', {
      method: 'POST',
      headers: headers,
      body: JSON.stringify({ modelIdentifier, history, modelSettings }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorDetail = errorData.error || `Error: ${response.status} ${response.statusText}`;
      yield { error: `Deepseek Proxy Error: ${errorDetail}`, isFinished: true };
      return;
    }

    if (!response.body) {
        yield { error: 'Deepseek Proxy Error: No response body received.', isFinished: true };
        return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      
      buffer += decoder.decode(value, { stream: true });
      
      let boundary = buffer.indexOf('\n\n');
      while (boundary !== -1) {
        const chunkLine = buffer.substring(0, boundary).trim();
        buffer = buffer.substring(boundary + 2);

        if (chunkLine.startsWith('data: ')) {
          const jsonStr = chunkLine.substring(6);
           if (jsonStr === '[DONE]') { 
            yield { isFinished: true };
            return;
          }
          try {
            const parsed = JSON.parse(jsonStr);
            if (parsed.choices && parsed.choices[0]?.delta?.content) {
              yield { textDelta: parsed.choices[0].delta.content };
            }
             if (parsed.choices && parsed.choices[0]?.finish_reason) {
               yield { isFinished: true }; 
            }
          } catch (e) {
            console.error('Error parsing Deepseek stream chunk from proxy:', e, jsonStr);
          }
        }
        boundary = buffer.indexOf('\n\n');
      }
    }
    if (buffer.startsWith('data: ')) {
        const jsonStr = buffer.substring(6).trim();
        if (jsonStr === '[DONE]') {
            yield { isFinished: true };
            return;
        }
        if (jsonStr) { // Check if jsonStr is not empty before parsing
            try {
                const parsed = JSON.parse(jsonStr);
                if (parsed.choices && parsed.choices[0]?.delta?.content) {
                    yield { textDelta: parsed.choices[0].delta.content };
                }
            } catch (e) {
                 console.warn("Final part of Deepseek stream was not valid JSON, ignoring.", jsonStr, e);
            }
        }
    }

  } catch (error: any) {
    console.error('Deepseek Proxy Service Fetch Error:', error);
    yield { error: `Fetch error to Deepseek proxy: ${error.message || 'Unknown fetch error'}`, isFinished: true };
  }
  yield { isFinished: true };
}