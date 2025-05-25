
import { ModelSettings, ApiChatMessage, ApiStreamChunk, GeneralApiSendMessageParams } from '../types.ts';

const DEEPSEEK_API_URL = 'https://api.deepseek.com/chat/completions'; // Standard endpoint

export async function* sendDeepseekMessageStream(
  params: GeneralApiSendMessageParams
): AsyncGenerator<ApiStreamChunk, void, undefined> {
  const { apiKey, modelIdentifier, history, modelSettings } = params;

  if (!apiKey) {
    yield { error: "Deepseek API Key is not configured.", isFinished: true };
    return;
  }

  // For Deepseek, ensure content is string (text-only for deepseek-chat)
  const textOnlyHistory = history.map(msg => {
    if (typeof msg.content !== 'string') {
      // Attempt to extract text if content is an array (e.g. from OpenAI format)
      const textPart = (msg.content as Array<any>).find(p => p.type === 'text');
      return { ...msg, content: textPart ? textPart.text : "" };
    }
    return msg;
  }).filter(msg => msg.content || msg.role === 'assistant'); // Ensure content exists or it's an empty assistant response

  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${apiKey}`,
  };

  const body = {
    model: modelIdentifier,
    messages: textOnlyHistory,
    temperature: modelSettings.temperature,
    top_p: modelSettings.topP,
    stream: true,
  };

  try {
    const response = await fetch(DEEPSEEK_API_URL, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorDetail = errorData.error?.message || `Error: ${response.status} ${response.statusText}`;
      yield { error: `Deepseek API Error: ${errorDetail}`, isFinished: true };
      return;
    }

    if (!response.body) {
        yield { error: 'Deepseek API Error: No response body received.', isFinished: true };
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
           if (jsonStr === '[DONE]') { // Deepseek might also use [DONE]
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
            console.error('Error parsing Deepseek stream chunk:', e, jsonStr);
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
    console.error('Deepseek Service Fetch Error:', error);
    yield { error: `Fetch error: ${error.message || 'Unknown fetch error'}`, isFinished: true };
  }
  yield { isFinished: true };
}
