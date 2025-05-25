
// Update to .ts extension
import { Model, ModelSettings, Part } from '../types.ts';


const MOCK_DELAY = 50; // ms per chunk

async function* streamResponse(text: string): AsyncGenerator<string, void, undefined> {
  const words = text.split(/\s+/);
  for (const word of words) {
    await new Promise(resolve => setTimeout(resolve, MOCK_DELAY));
    yield word + " ";
  }
}

export async function* sendMockMessageStream(
  parts: Part[],
  model: Model,
  settings: ModelSettings
): AsyncGenerator<string, void, undefined> {
  let promptText = "Mocked request: ";
  parts.forEach(part => {
    if (part.text) promptText += part.text + " ";
    if (part.inlineData) promptText += "[Image Data Received] ";
  });

  let responseText = "";
  switch (model) {
    case Model.GPT4O:
      responseText = `This is a mocked response from ChatGPT (gpt-4o). You said: "${promptText}". My settings are temperature ${settings.temperature}. I will now tell you a short story. Once upon a time, in a land of pure imagination, a brave user interacted with a mock AI.`;
      break;
    case Model.DEEPSEEK:
      responseText = `Deepseek (Mock using deepseek-chat identifier) here. I specialize in code and chat. You asked: "${promptText}". Here's a Python snippet: \`print("Hello from Deepseek Mock (deepseek-chat)!")\`. This is just a simulation. My settings are temperature ${settings.temperature}.`;
      break;
    case Model.CLAUDE:
      responseText = `Hello, I'm a mock version of Claude. You sent: "${promptText}". I aim to be helpful and harmless. This response is generated to simulate a simulation. Have a wonderful day!`;
      break;
    default:
      responseText = `The selected model (${model}) is currently configured as a mock, but no specific mock response is available. Your prompt was: "${promptText}".`;
  }
  
  yield* streamResponse(responseText);
}