
import React, { useState } from 'react';
import { Model, ModelSettings, SettingsPanelProps as LocalSettingsPanelProps, ApiKeyStatus, getActualModelIdentifier, ImagenSettings, Persona, OpenAITtsSettings, OpenAiTtsVoice } from '../types.ts';
import { ArrowUpTrayIcon, PhotoIcon, XMarkIcon, MagnifyingGlassIcon, KeyIcon, InformationCircleIcon, UserCircleIcon, PlusCircleIcon, TrashIcon, PencilSquareIcon, SpeakerWaveIcon } from './Icons.tsx';


const SettingsPanel: React.FC<LocalSettingsPanelProps> = ({
  selectedModel,
  onModelChange,
  modelSettings, 
  onModelSettingsChange,
  onImageUpload,
  imagePreview,
  onFileUpload,
  uploadedTextFileName,
  isWebSearchEnabled,
  onWebSearchToggle,
  disabled,
  apiKeyStatuses,
  personas,
  activePersonaId,
  onPersonaChange,
  onPersonaSave,
  onPersonaDelete,
}) => {
  const [showPersonaForm, setShowPersonaForm] = useState(false);
  const [editingPersona, setEditingPersona] = useState<Persona | null>(null);
  const [personaName, setPersonaName] = useState('');
  const [personaInstruction, setPersonaInstruction] = useState('');


  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>, type: 'image' | 'text') => {
    const file = event.target.files?.[0];
    if (type === 'image') {
      onImageUpload(file || null);
    } else if (type === 'text') {
      onFileUpload(file || null);
    }
    event.target.value = ''; 
  };

  const handlePersonaEdit = (persona: Persona) => {
    setEditingPersona(persona);
    setPersonaName(persona.name);
    setPersonaInstruction(persona.instruction);
    setShowPersonaForm(true);
  };

  const handlePersonaFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!personaName.trim() || !personaInstruction.trim()) return;
    const newPersona: Persona = {
      id: editingPersona?.id || `persona-${Date.now()}`,
      name: personaName.trim(),
      instruction: personaInstruction.trim(),
    };
    onPersonaSave(newPersona);
    if (!editingPersona) { // if it was a new persona, select it
        onPersonaChange(newPersona.id);
    } else if (editingPersona && activePersonaId === editingPersona.id) {
        // If active persona was edited, ensure its changes are reflected
        // by re-applying it (or let ChatPage handle it via useEffect on activePersonaId/personas)
        onPersonaChange(newPersona.id); // Re-select to apply new instruction
    }
    setEditingPersona(null);
    setPersonaName('');
    setPersonaInstruction('');
    setShowPersonaForm(false);
  };
  
  const handleAddNewPersonaClick = () => {
    setEditingPersona(null);
    setPersonaName('');
    setPersonaInstruction('');
    setShowPersonaForm(true);
  };

  const currentActivePersona = activePersonaId ? personas.find(p => p.id === activePersonaId) : null;
  const effectiveSystemInstruction = currentActivePersona ? currentActivePersona.instruction : modelSettings.systemInstruction;


  const models: Model[] = Object.values(Model) as Model[];
  const currentApiKeyStatus = apiKeyStatuses[selectedModel];
  const isCurrentModelGeminiPlatformChat = currentApiKeyStatus?.isGeminiPlatform && !currentApiKeyStatus?.isMock && !currentApiKeyStatus?.isImageGeneration;
  const isImagenModel = selectedModel === Model.IMAGEN3 || currentApiKeyStatus?.isImageGeneration;
  const isTextToSpeechModel = selectedModel === Model.OPENAI_TTS || currentApiKeyStatus?.isTextToSpeech;
  const actualModelId = getActualModelIdentifier(selectedModel);
  const isDeepseekChat = actualModelId === 'deepseek-chat';

  const generalFileAcceptTypes = ".txt,.md,.json,.js,.ts,.jsx,.tsx,.py,.java,.c,.cpp,.h,.hpp,.cs,.go,.rs,.rb,.php,.html,.htm,.css,.scss,.less,.xml,.yaml,.yml,.ini,.sh,.bat,.ps1,.sql,.csv,.log,.pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation";

  const typedModelSettings = modelSettings as ModelSettings & ImagenSettings & OpenAITtsSettings; 

  const aspectRatios: { value: string; label: string }[] = [
    { value: '1:1', label: '1:1 (Square)' },
    { value: '16:9', label: '16:9 (Landscape)' },
    { value: '9:16', label: '9:16 (Portrait)' },
    { value: '4:3', label: '4:3 (Standard)' },
    { value: '3:4', label: '3:4 (Tall)' },
  ];

  const ttsVoices: { value: OpenAiTtsVoice; label: string }[] = [
    { value: 'alloy', label: 'Alloy' },
    { value: 'echo', label: 'Echo' },
    { value: 'fable', label: 'Fable' },
    { value: 'onyx', label: 'Onyx' },
    { value: 'nova', label: 'Nova' },
    { value: 'shimmer', label: 'Shimmer' },
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
                    {currentApiKeyStatus.modelName} ({currentApiKeyStatus.isMock ? "Mock" : (currentApiKeyStatus.isTextToSpeech ? "TTS API" : "Live API Key")})
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

      {/* Persona Management Section */}
      {!isImagenModel && !isTextToSpeechModel && (
        <div className="space-y-4 border-t border-secondary dark:border-neutral-darkest pt-4">
          <h3 className="text-lg font-semibold text-neutral-darker dark:text-secondary-light mb-2 flex items-center">
            <UserCircleIcon className="w-5 h-5 mr-2 text-primary dark:text-primary-light" />
            Persona
          </h3>
          <div>
            <label htmlFor="persona-select" className="block text-sm font-medium text-neutral-darker dark:text-secondary-light mb-1">
              Active Persona
            </label>
            <div className="flex items-center space-x-2">
                <select
                    id="persona-select"
                    value={activePersonaId || ''}
                    onChange={(e) => onPersonaChange(e.target.value || null)}
                    disabled={disabled}
                    className="flex-grow p-2 border border-secondary dark:border-neutral-darkest rounded-md bg-neutral-light dark:bg-neutral-dark focus:ring-primary dark:focus:ring-primary-light focus:border-primary dark:focus:border-primary-light outline-none"
                >
                    <option value="">Default / Custom Instruction</option>
                    {personas.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                </select>
                <button
                    onClick={handleAddNewPersonaClick}
                    disabled={disabled}
                    className="p-2 text-primary dark:text-primary-light hover:bg-secondary/50 dark:hover:bg-neutral-dark/50 rounded-md"
                    title="Add New Persona"
                >
                    <PlusCircleIcon className="w-6 h-6" />
                </button>
            </div>
          </div>

          {showPersonaForm && (
            <form onSubmit={handlePersonaFormSubmit} className="p-3 border border-secondary dark:border-neutral-darkest rounded-md bg-secondary-light/50 dark:bg-neutral-dark/30 space-y-3 mt-2">
              <h4 className="text-md font-semibold">{editingPersona ? 'Edit Persona' : 'Add New Persona'}</h4>
              <div>
                <label htmlFor="persona-name" className="block text-xs font-medium">Name</label>
                <input
                  id="persona-name"
                  type="text"
                  value={personaName}
                  onChange={(e) => setPersonaName(e.target.value)}
                  placeholder="E.g., Python Expert"
                  className="w-full p-2 mt-1 border rounded-md text-sm bg-neutral-light dark:bg-neutral-dark"
                  required
                />
              </div>
              <div>
                <label htmlFor="persona-instruction" className="block text-xs font-medium">System Instruction</label>
                <textarea
                  id="persona-instruction"
                  rows={3}
                  value={personaInstruction}
                  onChange={(e) => setPersonaInstruction(e.target.value)}
                  placeholder="Define the AI's role and behavior..."
                  className="w-full p-2 mt-1 border rounded-md text-sm bg-neutral-light dark:bg-neutral-dark"
                  required
                />
              </div>
              <div className="flex justify-end space-x-2">
                <button type="button" onClick={() => { setShowPersonaForm(false); setEditingPersona(null);}} className="px-3 py-1 text-sm rounded-md hover:bg-gray-200 dark:hover:bg-neutral-600">Cancel</button>
                <button type="submit" className="px-3 py-1 text-sm bg-primary hover:bg-primary-dark text-white rounded-md">{editingPersona ? 'Save Changes' : 'Add Persona'}</button>
              </div>
            </form>
          )}

          {personas.length > 0 && !showPersonaForm && (
            <div className="mt-2 space-y-1 max-h-32 overflow-y-auto pr-1">
              {/* List of personas for quick edit/delete - only if not actively adding/editing one */}
              {personas.map(p => (
                <div key={p.id} className={`flex justify-between items-center p-1.5 rounded text-xs ${activePersonaId === p.id ? 'bg-primary-light/20 dark:bg-primary-dark/30' : 'hover:bg-secondary/30 dark:hover:bg-neutral-dark/30'}`}>
                  <span className="truncate flex-grow" title={p.name}>{p.name}</span>
                  <div className="flex-shrink-0">
                    <button onClick={() => handlePersonaEdit(p)} className="p-0.5 text-yellow-600 hover:text-yellow-800 dark:text-yellow-400 dark:hover:text-yellow-300 mr-1" title="Edit Persona"><PencilSquareIcon className="w-3 h-3"/></button>
                    <button onClick={() => onPersonaDelete(p.id)} className="p-0.5 text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300" title="Delete Persona"><TrashIcon className="w-3 h-3"/></button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}


      {!isImagenModel && !isTextToSpeechModel && ( 
        <div className="space-y-4 border-t border-secondary dark:border-neutral-darkest pt-4">
          <h3 className="text-lg font-semibold text-neutral-darker dark:text-secondary-light">Model Settings (Chat)</h3>
          <div>
            <label htmlFor="system-instruction" className="block text-sm font-medium text-neutral-darker dark:text-secondary-light mb-1">
              System Instruction {currentActivePersona ? `(from Persona: ${currentActivePersona.name})` : '(Custom)'}
            </label>
            <textarea
              id="system-instruction"
              rows={3}
              value={effectiveSystemInstruction}
              onChange={(e) => onModelSettingsChange({ systemInstruction: e.target.value })}
              disabled={disabled || !!currentActivePersona} // Disable if persona is active
              className={`w-full p-2 border border-secondary dark:border-neutral-darkest rounded-md bg-neutral-light dark:bg-neutral-dark focus:ring-primary dark:focus:ring-primary-light focus:border-primary dark:focus:border-primary-light outline-none ${!!currentActivePersona ? 'opacity-70 cursor-not-allowed' : ''}`}
            />
             {!!currentActivePersona && <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">To edit, change persona to "Default / Custom Instruction" or edit the active persona.</p>}
          </div>
          <div>
            <label htmlFor="temperature" className="block text-sm font-medium text-neutral-darker dark:text-secondary-light mb-1">
              Temperature: {typedModelSettings.temperature.toFixed(2)}
            </label>
            <input
              type="range"
              id="temperature"
              min="0"
              max={currentApiKeyStatus?.isGeminiPlatform ? "1" : "2"} 
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

      {isTextToSpeechModel && (
        <div className="space-y-4 border-t border-secondary dark:border-neutral-darkest pt-4">
          <h3 className="text-lg font-semibold text-neutral-darker dark:text-secondary-light flex items-center">
            <SpeakerWaveIcon className="w-5 h-5 mr-2 text-primary dark:text-primary-light" />
            Text-to-Speech Settings
          </h3>
          <div>
            <label htmlFor="tts-voice" className="block text-sm font-medium text-neutral-darker dark:text-secondary-light mb-1">
              Voice
            </label>
            <select
              id="tts-voice"
              value={typedModelSettings.voice || 'alloy'}
              onChange={(e) => onModelSettingsChange({ voice: e.target.value as OpenAiTtsVoice })}
              disabled={disabled}
              className="w-full p-2 border border-secondary dark:border-neutral-darkest rounded-md bg-neutral-light dark:bg-neutral-dark focus:ring-primary dark:focus:ring-primary-light focus:border-primary dark:focus:border-primary-light outline-none"
            >
              {ttsVoices.map(voice => (
                <option key={voice.value} value={voice.value}>{voice.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="tts-speed" className="block text-sm font-medium text-neutral-darker dark:text-secondary-light mb-1">
              Speed: {(typedModelSettings.speed || 1.0).toFixed(2)}x
            </label>
            <input
              type="range"
              id="tts-speed"
              min="0.25"
              max="4.0"
              step="0.05"
              value={typedModelSettings.speed || 1.0}
              onChange={(e) => onModelSettingsChange({ speed: parseFloat(e.target.value) })}
              disabled={disabled}
              className="w-full h-2 bg-secondary dark:bg-neutral-darkest rounded-lg appearance-none cursor-pointer accent-primary dark:accent-primary-light"
            />
          </div>
           <div>
            <label htmlFor="tts-model" className="block text-sm font-medium text-neutral-darker dark:text-secondary-light mb-1">
              TTS Model Quality
            </label>
            <select
              id="tts-model"
              value={typedModelSettings.modelIdentifier || 'tts-1'}
              onChange={(e) => onModelSettingsChange({ modelIdentifier: e.target.value as 'tts-1' | 'tts-1-hd' })}
              disabled={disabled}
              className="w-full p-2 border border-secondary dark:border-neutral-darkest rounded-md bg-neutral-light dark:bg-neutral-dark focus:ring-primary dark:focus:ring-primary-light focus:border-primary dark:focus:border-primary-light outline-none"
            >
              <option value="tts-1">Standard (tts-1)</option>
              <option value="tts-1-hd">High Definition (tts-1-hd)</option>
            </select>
          </div>
        </div>
      )}


      {!isImagenModel && !isTextToSpeechModel && ( 
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
      
      {(isImagenModel || isTextToSpeechModel) && (
         <p className="text-xs text-neutral-500 dark:text-neutral-400 border-t border-secondary dark:border-neutral-darkest pt-4">
            {isImagenModel && "Attachments, Web Search, and Personas are not applicable for Imagen3 image generation."}
            {isTextToSpeechModel && "Attachments, Web Search, and Personas are not applicable for OpenAI TTS."}
        </p>
      )}

      {isCurrentModelGeminiPlatformChat && !isTextToSpeechModel && ( 
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
