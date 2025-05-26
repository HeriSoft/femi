
import { ModelSettings, ApiChatMessage, ApiStreamChunk, GeneralApiSendMessageParams } from '../types.ts';

const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';

export async function* sendOpenAIMessageStream(
  params: GeneralApiSendMessageParams
): AsyncGenerator<ApiStreamChunk, void, undefined> {
  const { apiKey, modelIdentifier, history, modelSettings } = params;

  if (!apiKey) {
    yield { error: "OpenAI API Key is not configured.", isFinished: true };
    return;
  }

  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${apiKey}`,
  };

  const body = {
    model: modelIdentifier,
    messages: history,
    temperature: modelSettings.temperature,
    top_p: modelSettings.topP, // OpenAI uses top_p
    // max_tokens: 1024, // Optional: configure max_tokens
    stream: true,
  };

  try {
    const response = await fetch(OPENAI_API_URL, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorDetail = errorData.error?.message || `Error: ${response.status} ${response.statusText}`;
      yield { error: `OpenAI API Error: ${errorDetail}`, isFinished: true };
      return;
    }

    if (!response.body) {
      yield { error: 'OpenAI API Error: No response body received.', isFinished: true };
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
               yield { isFinished: true }; // Can signal finish based on reason
            }
          } catch (e) {
            console.error('Error parsing OpenAI stream chunk:', e, jsonStr);
            // Decide if we should yield an error or just skip malformed chunk
          }
        }
        boundary = buffer.indexOf('\n\n');
      }
    }
    // Final flush for any remaining buffer content if stream ends without [DONE] or finish_reason
     if (buffer.startsWith('data: ')) {
        const jsonStr = buffer.substring(6).trim();
         if (jsonStr === '[DONE]') {
            yield { isFinished: true };
            return;
          }
        if (jsonStr) {
            try {
                const parsed = JSON.parse(jsonStr);
                if (parsed.choices && parsed.choices[0]?.delta?.content) {
                    yield { textDelta: parsed.choices[0].delta.content };
                }
            } catch (e) {
                // ignore
            }
        }
    }

  } catch (error: any) {
    console.error('OpenAI Service Fetch Error:', error);
    yield { error: `Fetch error: ${error.message || 'Unknown fetch error'}`, isFinished: true };
  }
  // Ensure a final finished signal if not already sent
  yield { isFinished: true };
}
