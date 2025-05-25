
import React from 'react';
// Update to .ts/.tsx extensions
import { Model, ModelSettings, SettingsPanelProps as LocalSettingsPanelProps, ApiKeyStatus, getActualModelIdentifier, ImagenSettings } from '../types.ts';
import { ArrowUpTrayIcon, PhotoIcon, XMarkIcon, MagnifyingGlassIcon, KeyIcon, InformationCircleIcon } from './Icons.tsx';

// Use the aliased SettingsPanelProps from types.ts
const SettingsPanel: React.FC<LocalSettingsPanelProps> = ({
  selectedModel,
  onModelChange,
  modelSettings, // This will be ModelSettings & Partial<ImagenSettings>
  onModelSettingsChange,
  onImageUpload,
  imagePreview,
  onFileUpload,
  uploadedTextFileName,
  isWebSearchEnabled,
  onWebSearchToggle,
  disabled,
  apiKeyStatuses
}) => {
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>, type: 'image' | 'text') => {
    const file = event.target.files?.[0];
    if (type === 'image') {
      onImageUpload(file || null);
    } else if (type === 'text') {
      onFileUpload(file || null);
    }
    event.target.value = ''; // Reset file input
  };

  const models: Model[] = Object.values(Model) as Model[];
  const currentApiKeyStatus = apiKeyStatuses[selectedModel];
  // Updated: Web search is available if it's a Gemini Platform model (using AI Studio Key) and not an image model.
  const isCurrentModelGeminiPlatformChat = currentApiKeyStatus?.isGeminiPlatform && !currentApiKeyStatus?.isMock && !currentApiKeyStatus?.isImageGeneration;
  const isImagenModel = selectedModel === Model.IMAGEN3 || currentApiKeyStatus?.isImageGeneration;
  const actualModelId = getActualModelIdentifier(selectedModel);
  const isDeepseekChat = actualModelId === 'deepseek-chat';

  const generalFileAcceptTypes = ".txt,.md,.json,.js,.ts,.jsx,.tsx,.py,.java,.c,.cpp,.h,.hpp,.cs,.go,.rs,.rb,.php,.html,.htm,.css,.scss,.less,.xml,.yaml,.yml,.ini,.sh,.bat,.ps1,.sql,.csv,.log,.pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation";

  const typedModelSettings = modelSettings as ModelSettings & ImagenSettings; // Cast to include all ImagenSettings props

  const aspectRatios: { value: string; label: string }[] = [
    { value: '1:1', label: '1:1 (Square)' },
    { value: '16:9', label: '16:9 (Landscape)' },
    { value: '9:16', label: '9:16 (Portrait)' },
    { value: '4:3', label: '4:3 (Standard)' },
    { value: '3:4', label: '3:4 (Tall)' },
  ];


  return (
    <div className="space-y-6 p-1">
      <div>
        <label htmlFor="model-select" className="block text-sm font-medium text-neutral-darker dark:text-secondary-light mb-1">
          Select Model
        </label>
        <select
          id="model-select"
          value={selectedModel}
          onChange={(e) => onModelChange(e.target.value as Model)}
          disabled={disabled}
          className="w-full p-2 border border-secondary dark:border-neutral-darkest rounded-md bg-neutral-light dark:bg-neutral-dark focus:ring-primary dark:focus:ring-primary-light focus:border-primary dark:focus:border-primary-light outline-none"
        >
          {models.map((model) => (
            <option key={model} value={model}>
              {model} 
            </option>
          ))}
        </select>
      </div>

      <div className="border-t border-secondary dark:border-neutral-darkest pt-4">
        <h3 className="text-lg font-semibold text-neutral-darker dark:text-secondary-light mb-2 flex items-center">
            <KeyIcon className="w-5 h-5 mr-2 text-primary dark:text-primary-light" /> 
            API Key Status
        </h3>
        {currentApiKeyStatus && (
            <div className={`p-3 rounded-md text-sm ${
                currentApiKeyStatus.isSet || currentApiKeyStatus.isMock 
                    ? 'bg-green-100 dark:bg-green-900 border-green-500 dark:border-green-400 text-green-700 dark:text-green-300' 
                    : 'bg-red-100 dark:bg-red-900 border-red-500 dark:border-red-400 text-red-700 dark:text-red-300'
            } border`}>
                <p className="font-medium">
                    {currentApiKeyStatus.modelName} ({currentApiKeyStatus.isMock ? "Mock" : "Live API Key"})
                </p>
                <p>Env Variable: <code>process.env.{currentApiKeyStatus.envVarName}</code></p>
                {currentApiKeyStatus.isSet ? (
                    <p>Key detected in environment.</p>
                ) : (
                    currentApiKeyStatus.isMock ? 
                    <p>Key NOT detected, but this is a mock model and will function.</p> :
                    <p>Key NOT detected in environment.</p>
                )}
                {!currentApiKeyStatus.isSet && !currentApiKeyStatus.isMock && (
                    <p className="mt-1 font-semibold">This model will not function without the API key (<code>process.env.{currentApiKeyStatus.envVarName}</code>).</p>
                )}
                 {currentApiKeyStatus.isGeminiPlatform && (
                    <p className="mt-1 text-xs text-neutral-600 dark:text-neutral-400">
                        This model uses the Google AI Studio API Key (<code>API_KEY</code>).
                    </p>
                 )}
                 <p className="mt-2 text-xs text-neutral-600 dark:text-neutral-400">
                    <InformationCircleIcon className="w-4 h-4 inline mr-1" />
                    Environment variables should be set in <code>config.js</code>.
                </p>
            </div>
        )}
      </div>

      {!isImagenModel && ( // Hide chat model settings for Imagen
        <div className="space-y-4 border-t border-secondary dark:border-neutral-darkest pt-4">
          <h3 className="text-lg font-semibold text-neutral-darker dark:text-secondary-light">Model Settings (Chat)</h3>
          <div>
            <label htmlFor="system-instruction" className="block text-sm font-medium text-neutral-darker dark:text-secondary-light mb-1">
              System Instruction
            </label>
            <textarea
              id="system-instruction"
              rows={3}
              value={typedModelSettings.systemInstruction}
              onChange={(e) => onModelSettingsChange({ systemInstruction: e.target.value })}
              disabled={disabled}
              className="w-full p-2 border border-secondary dark:border-neutral-darkest rounded-md bg-neutral-light dark:bg-neutral-dark focus:ring-primary dark:focus:ring-primary-light focus:border-primary dark:focus:border-primary-light outline-none"
            />
          </div>
          <div>
            <label htmlFor="temperature" className="block text-sm font-medium text-neutral-darker dark:text-secondary-light mb-1">
              Temperature: {typedModelSettings.temperature.toFixed(2)}
            </label>
            <input
              type="range"
              id="temperature"
              min="0"
              max={currentApiKeyStatus?.isGeminiPlatform ? "1" : "2"} // Gemini models usually 0-1, OpenAI can go up to 2
              step="0.01"
              value={typedModelSettings.temperature}
              onChange={(e) => onModelSettingsChange({ temperature: parseFloat(e.target.value) })}
              disabled={disabled}
              className="w-full h-2 bg-secondary dark:bg-neutral-darkest rounded-lg appearance-none cursor-pointer accent-primary dark:accent-primary-light"
            />
          </div>
          { (currentApiKeyStatus?.isGeminiPlatform && !currentApiKeyStatus.isImageGeneration) && ( 
          <div>
            <label htmlFor="top-k" className="block text-sm font-medium text-neutral-darker dark:text-secondary-light mb-1">
              Top K: {typedModelSettings.topK}
            </label>
            <input
              type="range"
              id="top-k"
              min="1"
              max="100" 
              step="1"
              value={typedModelSettings.topK}
              onChange={(e) => onModelSettingsChange({ topK: parseInt(e.target.value, 10) })}
              disabled={disabled}
              className="w-full h-2 bg-secondary dark:bg-neutral-darkest rounded-lg appearance-none cursor-pointer accent-primary dark:accent-primary-light"
            />
          </div>
          )}
          <div> 
            <label htmlFor="top-p" className="block text-sm font-medium text-neutral-darker dark:text-secondary-light mb-1">
              Top P: {typedModelSettings.topP.toFixed(2)}
            </label>
            <input
              type="range"
              id="top-p"
              min="0"
              max="1"
              step="0.01"
              value={typedModelSettings.topP}
              onChange={(e) => onModelSettingsChange({ topP: parseFloat(e.target.value) })}
              disabled={disabled}
              className="w-full h-2 bg-secondary dark:bg-neutral-darkest rounded-lg appearance-none cursor-pointer accent-primary dark:accent-primary-light"
            />
          </div>
        </div>
      )}
      
      {isImagenModel && currentApiKeyStatus?.isGeminiPlatform && ( 
        <div className="space-y-4 border-t border-secondary dark:border-neutral-darkest pt-4">
           <h3 className="text-lg font-semibold text-neutral-darker dark:text-secondary-light">Image Generation Settings</h3>
           <div>
             <label htmlFor="imagen-num-images" className="block text-sm font-medium text-neutral-darker dark:text-secondary-light mb-1">
                Number of Images: {typedModelSettings.numberOfImages}
             </label>
             <input
                type="number"
                id="imagen-num-images"
                min="1"
                max="4"
                step="1"
                value={typedModelSettings.numberOfImages || 1}
                onChange={(e) => onModelSettingsChange({ numberOfImages: parseInt(e.target.value, 10) })}
                disabled={disabled}
                className="w-full p-2 border border-secondary dark:border-neutral-darkest rounded-md bg-neutral-light dark:bg-neutral-dark focus:ring-primary dark:focus:ring-primary-light focus:border-primary dark:focus:border-primary-light outline-none"
             />
           </div>
           <div>
             <label htmlFor="imagen-aspect-ratio" className="block text-sm font-medium text-neutral-darker dark:text-secondary-light mb-1">
                Aspect Ratio
             </label>
             <select
                id="imagen-aspect-ratio"
                value={typedModelSettings.aspectRatio || '1:1'}
                onChange={(e) => onModelSettingsChange({ aspectRatio: e.target.value })}
                disabled={disabled}
                className="w-full p-2 border border-secondary dark:border-neutral-darkest rounded-md bg-neutral-light dark:bg-neutral-dark focus:ring-primary dark:focus:ring-primary-light focus:border-primary dark:focus:border-primary-light outline-none"
                >
                {aspectRatios.map(ar => (
                    <option key={ar.value} value={ar.value}>{ar.label}</option>
                ))}
             </select>
           </div>
           <div>
             <label htmlFor="imagen-output-mime" className="block text-sm font-medium text-neutral-darker dark:text-secondary-light mb-1">
                Output Format
             </label>
             <select
                id="imagen-output-mime"
                value={typedModelSettings.outputMimeType || 'image/jpeg'}
                onChange={(e) => onModelSettingsChange({ outputMimeType: e.target.value as 'image/jpeg' | 'image/png' })}
                disabled={disabled}
                className="w-full p-2 border border-secondary dark:border-neutral-darkest rounded-md bg-neutral-light dark:bg-neutral-dark focus:ring-primary dark:focus:ring-primary-light focus:border-primary dark:focus:border-primary-light outline-none"
                >
                <option value="image/jpeg">JPEG</option>
                <option value="image/png">PNG</option>
             </select>
           </div>
        </div>
      )}


      {!isImagenModel && ( // Hide attachments section for Imagen
        <div className="space-y-4 border-t border-secondary dark:border-neutral-darkest pt-4">
          <h3 className="text-lg font-semibold text-neutral-darker dark:text-secondary-light">Attachments (Chat)</h3>
          
          {selectedModel !== Model.CLAUDE && !isDeepseekChat && (
              <div>
                  <label htmlFor="image-upload" className={`flex items-center justify-center w-full px-4 py-2 border-2 border-dashed border-secondary dark:border-neutral-darkest rounded-md  ${disabled ? 'cursor-not-allowed opacity-50' :'cursor-pointer hover:bg-secondary/50 dark:hover:bg-neutral-dark/50'} transition-colors`}>
                      <PhotoIcon className="w-5 h-5 mr-2 text-primary dark:text-primary-light"/>
                      <span className="text-sm text-neutral-darker dark:text-secondary-light">Upload Image</span>
                      <input id="image-upload" type="file" accept="image/*" className="hidden" onChange={(e) => handleFileChange(e, 'image')} disabled={disabled} />
                  </label>
                  {imagePreview && (
                  <div className="mt-2 relative group w-24 h-24">
                      <img src={imagePreview} alt="Preview" className="w-full h-full object-cover rounded"/>
                      <button
                          onClick={() => onImageUpload(null)}
                          className="absolute top-0 right-0 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                          aria-label="Remove image"
                          disabled={disabled}
                      >
                          <XMarkIcon className="w-4 h-4" />
                      </button>
                  </div>
                  )}
              </div>
          )}
          {isDeepseekChat && (
              <p className="text-xs text-neutral-500 dark:text-neutral-400">Image uploads are not supported by the Deepseek-chat model.</p>
          )}
          {selectedModel === Model.CLAUDE && (
              <p className="text-xs text-neutral-500 dark:text-neutral-400">Image uploads are not applicable for the mock Claude model.</p>
          )}

          <div> 
              {(selectedModel !== Model.CLAUDE) && (
                  <>
                      <label htmlFor="file-upload" className={`flex items-center justify-center w-full px-4 py-2 border-2 border-dashed border-secondary dark:border-neutral-darkest rounded-md  ${disabled ? 'cursor-not-allowed opacity-50' :'cursor-pointer hover:bg-secondary/50 dark:hover:bg-neutral-dark/50'} transition-colors`}>
                          <ArrowUpTrayIcon className="w-5 h-5 mr-2 text-primary dark:text-primary-light"/>
                          <span className="text-sm text-neutral-darker dark:text-secondary-light">Upload File (Text-based)</span>
                          <input id="file-upload" type="file" accept={generalFileAcceptTypes} className="hidden" onChange={(e) => handleFileChange(e, 'text')} disabled={disabled} />
                      </label>
                      {uploadedTextFileName && (
                          <div className="mt-2 text-sm text-neutral-darker dark:text-secondary-light flex items-center">
                              File: {uploadedTextFileName}
                              <button
                                  onClick={() => onFileUpload(null)}
                                  className="ml-2 text-red-500 hover:text-red-700"
                                  aria-label="Remove file"
                                  disabled={disabled}
                              >
                                  <XMarkIcon className="w-4 h-4" />
                              </button>
                          </div>
                      )}
                  </>
              )}
                {selectedModel === Model.CLAUDE && (
                  <p className="text-xs text-neutral-500 dark:text-neutral-400">File uploads are not applicable for the mock Claude model.</p>
              )}
          </div>
        </div>
      )}
      
      {isImagenModel && currentApiKeyStatus?.isGeminiPlatform && (
         <p className="text-xs text-neutral-500 dark:text-neutral-400 border-t border-secondary dark:border-neutral-darkest pt-4">
            Attachments (like user image uploads or file uploads) and Web Search are not applicable for Imagen3 image generation.
        </p>
      )}

      {isCurrentModelGeminiPlatformChat && (  // Web search for Gemini Chat (AI Studio Key)
        <div className="space-y-2 border-t border-secondary dark:border-neutral-darkest pt-4">
          <h3 className="text-lg font-semibold text-neutral-darker dark:text-secondary-light">Tools (Gemini Chat)</h3>
          <label htmlFor="web-search-toggle" className={`flex items-center ${disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}>
            <div className="relative">
              <input
                type="checkbox"
                id="web-search-toggle"
                className="sr-only"
                checked={isWebSearchEnabled}
                onChange={(e) => onWebSearchToggle(e.target.checked)}
                disabled={disabled} 
              />
              <div className={`block w-10 h-6 rounded-full transition-colors ${isWebSearchEnabled ? 'bg-primary dark:bg-primary-light' : 'bg-secondary dark:bg-neutral-darkest'}`}></div>
              <div className={`dot absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition transform ${isWebSearchEnabled ? 'translate-x-full' : ''}`}></div>
            </div>
            <div className="ml-3 text-sm text-neutral-darker dark:text-secondary-light flex items-center">
                <MagnifyingGlassIcon className="w-4 h-4 mr-1" />
                Enable Web Search (Google)
            </div>
          </label>
        </div>
      )}
    </div>
  );
};

export default SettingsPanel;