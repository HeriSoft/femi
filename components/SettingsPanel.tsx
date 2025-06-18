
import React, { useState } from 'react';
import { Model, ModelSettings, SettingsPanelProps, ApiKeyStatus, getActualModelIdentifier, ImagenSettings, Persona, OpenAITtsSettings, OpenAiTtsVoice, RealTimeTranslationSettings, AiAgentSettings, FluxKontexSettings, FluxKontexAspectRatio, FluxUltraSettings, FluxUltraAspectRatio, KlingAiSettings, KlingAiDuration, KlingAiAspectRatio, PrivateModeSettings, AnyModelSettings, TradingProSettings } from '../types.ts'; 
import { ArrowUpTrayIcon, PhotoIcon, XMarkIcon, MagnifyingGlassIcon, KeyIcon, InformationCircleIcon, UserCircleIcon, PlusCircleIcon, TrashIcon, PencilSquareIcon, SpeakerWaveIcon, LanguageIcon, PencilIcon as EditIcon, ArrowPathIcon, FilmIcon, PresentationChartLineIcon } from './Icons.tsx'; // Added PresentationChartLineIcon
import { TRANSLATION_TARGET_LANGUAGES, DEFAULT_FLUX_KONTEX_SETTINGS, DEFAULT_FLUX_ULTRA_SETTINGS, FLUX_ULTRA_ASPECT_RATIOS, DEFAULT_KLING_AI_SETTINGS, KLING_AI_DURATIONS, KLING_AI_ASPECT_RATIOS, ALL_MODEL_DEFAULT_SETTINGS, TRADING_PRO_PAIRS } from '../constants.ts'; 


const SettingsPanel: React.FC<SettingsPanelProps> = ({
  selectedModel,
  onModelChange,
  modelSettings, 
  onModelSettingsChange,
  isWebSearchEnabled,
  onWebSearchToggle,
  disabled,
  apiKeyStatuses,
  personas,
  activePersonaId,
  onPersonaChange,
  onPersonaSave,
  onPersonaDelete,
  userSession, 
}) => {
  const [showPersonaForm, setShowPersonaForm] = useState(false);
  const [editingPersona, setEditingPersona] = useState<Persona | null>(null);
  const [personaName, setPersonaName] = useState('');
  const [personaInstruction, setPersonaInstruction] = useState('');

  const currentApiKeyStatus = apiKeyStatuses[selectedModel];
  const isImagenModel = selectedModel === Model.IMAGEN3 || currentApiKeyStatus?.isImageGeneration;
  const isTextToSpeechModel = selectedModel === Model.OPENAI_TTS || currentApiKeyStatus?.isTextToSpeech;
  const isRealTimeTranslationModel = selectedModel === Model.REAL_TIME_TRANSLATION || currentApiKeyStatus?.isRealTimeTranslation;
  const isAiAgentModel = selectedModel === Model.AI_AGENT || currentApiKeyStatus?.isAiAgent;
  const isPrivateModel = selectedModel === Model.PRIVATE || currentApiKeyStatus?.isPrivateMode;
  const isFluxKontexModel = selectedModel === Model.FLUX_KONTEX || selectedModel === Model.FLUX_KONTEX_MAX_MULTI;
  const isFluxUltraImageGenModel = selectedModel === Model.FLUX_ULTRA || currentApiKeyStatus?.isFluxUltraImageGeneration;
  const isKlingVideoModel = selectedModel === Model.KLING_VIDEO || currentApiKeyStatus?.isKlingVideoGeneration;
  const isTradingProModel = selectedModel === Model.TRADING_PRO || currentApiKeyStatus?.isTradingPro;


  const showPersonaSection = !isImagenModel && !isTextToSpeechModel && !isRealTimeTranslationModel && !isAiAgentModel && !isPrivateModel && !isFluxKontexModel && !isFluxUltraImageGenModel && !isKlingVideoModel && !isTradingProModel && selectedModel !== Model.CLAUDE;
  const showChatModelSettingsSection = !isImagenModel && !isTextToSpeechModel && !isRealTimeTranslationModel && !isAiAgentModel && !isFluxKontexModel && !isFluxUltraImageGenModel && !isPrivateModel && !isKlingVideoModel && !isTradingProModel && selectedModel !== Model.CLAUDE;
  const showWebSearchToggle = currentApiKeyStatus?.isGeminiPlatform && !isImagenModel && !isTextToSpeechModel && !isRealTimeTranslationModel && !isAiAgentModel && !isPrivateModel && !isFluxKontexModel && !isFluxUltraImageGenModel && !isKlingVideoModel && !isTradingProModel;


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
    if (!editingPersona) { 
        onPersonaChange(newPersona.id);
    } else if (editingPersona && activePersonaId === editingPersona.id) {
        onPersonaChange(newPersona.id); 
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
  
  let effectiveSystemInstruction = "";
  if (showChatModelSettingsSection && 'systemInstruction' in modelSettings) {
    effectiveSystemInstruction = currentActivePersona ? currentActivePersona.instruction : (modelSettings as ModelSettings).systemInstruction;
  }


  const models: Model[] = Object.values(Model) as Model[];
  
  const isCurrentModelGeminiPlatformChat = currentApiKeyStatus?.isGeminiPlatform && 
                                         !currentApiKeyStatus?.isMock && 
                                         !currentApiKeyStatus?.isImageGeneration && 
                                         !currentApiKeyStatus?.isTextToSpeech &&
                                         !currentApiKeyStatus?.isRealTimeTranslation &&
                                         !currentApiKeyStatus?.isAiAgent &&
                                         !currentApiKeyStatus?.isImageEditing &&
                                         !currentApiKeyStatus?.isMultiImageEditing &&
                                         !currentApiKeyStatus?.isFluxUltraImageGeneration &&
                                         !isKlingVideoModel &&
                                         !isTradingProModel;


  const actualModelId = getActualModelIdentifier(selectedModel);
  
  const imagenAspectRatios: { value: string; label: string }[] = [
    { value: '1:1', label: '1:1 (Square)' },
    { value: '16:9', label: '16:9 (Landscape)' },
    { value: '9:16', label: '9:16 (Portrait)' },
    { value: '4:3', label: '4:3 (Standard)' },
    { value: '3:4', label: '3:4 (Tall)' },
  ];

  const fluxKontexAspectRatios: { value: FluxKontexAspectRatio; label: string }[] = [
    { value: 'default', label: 'Default (Model Specified)' },
    { value: '1:1', label: '1:1 (Square)' },
    { value: '16:9', label: '16:9 (Landscape)' },
    { value: '9:16', label: '9:16 (Portrait)' },
    { value: '4:3', label: '4:3 (Standard)' },
    { value: '3:2', label: '3:2 (Classic Photo)' },
    { value: '2:3', label: '2:3 (Portrait Photo)' },
    { value: '3:4', label: '3:4 (Tall)' },
    { value: '9:21', label: '9:21 (Extra Tall)' },
    { value: '21:9', label: '21:9 (Extra Wide)' },
  ];

  const ttsVoices: { value: OpenAiTtsVoice; label: string }[] = [
    { value: 'alloy', label: 'Alloy' },
    { value: 'echo', label: 'Echo' },
    { value: 'fable', label: 'Fable' },
    { value: 'onyx', label: 'Onyx' },
    { value: 'nova', label: 'Nova' },
    { value: 'shimmer', label: 'Shimmer' },
  ];
  
  const handleRandomizeSeed = (modelType: 'fluxKontext' | 'fluxUltra') => {
    const randomSeed = Math.floor(Math.random() * 1000000000); 
    if (modelType === 'fluxKontext' && isFluxKontexModel) {
        onModelSettingsChange({ seed: randomSeed } as Partial<FluxKontexSettings>);
    } else if (modelType === 'fluxUltra' && isFluxUltraImageGenModel) {
        onModelSettingsChange({ seed: randomSeed } as Partial<FluxUltraSettings>);
    }
  };
  
  const isAdminUser = !userSession.isDemoUser && !userSession.isPaidUser;

  let apiKeyTypeString = "";
  if (currentApiKeyStatus) {
    if (currentApiKeyStatus.isMock) apiKeyTypeString = "Mock";
    else if (currentApiKeyStatus.isTextToSpeech) apiKeyTypeString = "TTS API";
    else if (currentApiKeyStatus.isRealTimeTranslation) apiKeyTypeString = "Translation API";
    else if (currentApiKeyStatus.isAiAgent) apiKeyTypeString = "AI Agent API";
    else if (currentApiKeyStatus.isImageEditing || currentApiKeyStatus.isMultiImageEditing) apiKeyTypeString = "Image Editing API";
    else if (currentApiKeyStatus.isFluxUltraImageGeneration) apiKeyTypeString = "Image Gen API (Flux Ultra)";
    else if (currentApiKeyStatus.isKlingVideoGeneration) apiKeyTypeString = "Video Gen API (Kling)";
    else if (currentApiKeyStatus.isPrivateMode) apiKeyTypeString = "Local Mode";
    else if (currentApiKeyStatus.isTradingPro) apiKeyTypeString = "Trading Analysis APIs";
    else apiKeyTypeString = "Live API Key";
  }


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
          {models.map((model) => {
            const isFluxMax = model === Model.FLUX_KONTEX_MAX_MULTI;
            const isFluxUltra = model === Model.FLUX_ULTRA;
            const isKling = model === Model.KLING_VIDEO;
            const isRestricted = (isFluxMax || isFluxUltra || isKling) && !userSession.isPaidUser && !isAdminUser; 
            return (
              <option key={model} value={model} disabled={isRestricted}
                className={isRestricted ? "text-gray-400 dark:text-gray-600" : ""}>
                {model} {isRestricted ? '(Paid Only)' : ''}
              </option>
            );
          })}
        </select>
      </div>

      {isAdminUser && (
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
                      {currentApiKeyStatus.modelName} ({apiKeyTypeString})
                  </p>
                  <p>Env Variable(s): <code>process.env.{currentApiKeyStatus.envVarName}</code></p>
                  {currentApiKeyStatus.isSet ? (
                      <p>Key(s) detected in environment.</p>
                  ) : (
                      currentApiKeyStatus.isMock || currentApiKeyStatus.isPrivateMode ? 
                      <p>Key NOT detected, but this is a mock/local model and will function.</p> :
                      <p>Key(s) NOT detected in environment.</p>
                  )}
                  {!currentApiKeyStatus.isSet && !currentApiKeyStatus.isMock && !currentApiKeyStatus.isPrivateMode && (
                      <p className="mt-1 font-semibold">This model will not function without the API key(s) (<code>process.env.{currentApiKeyStatus.envVarName}</code>).</p>
                  )}
                  {currentApiKeyStatus.isGeminiPlatform && !isTradingProModel && (
                      <p className="mt-1 text-xs text-neutral-600 dark:text-neutral-400">
                          This model uses the Google AI Studio API Key (<code>GEMINI_API_KEY</code> on proxy).
                      </p>
                  )}
                  {isTradingProModel && (
                      <p className="mt-1 text-xs text-neutral-600 dark:text-neutral-400">
                          Trading Pro uses Gemini for analysis and Alpha Vantage for chart data. Keys managed on proxy.
                      </p>
                  )}
                  <p className="mt-2 text-xs text-neutral-600 dark:text-neutral-400">
                      <InformationCircleIcon className="w-4 h-4 inline mr-1" />
                      API keys are configured on the backend proxy server (<code>proxy-server/.env</code>).
                  </p>
              </div>
          )}
        </div>
      )}

      {showPersonaSection && (
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

      {showChatModelSettingsSection && ( 
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
              onChange={(e) => onModelSettingsChange({ systemInstruction: e.target.value } as Partial<ModelSettings>)}
              disabled={disabled || !!currentActivePersona} 
              className={`w-full p-2 border border-secondary dark:border-neutral-darkest rounded-md bg-neutral-light dark:bg-neutral-dark focus:ring-primary dark:focus:ring-primary-light focus:border-primary dark:focus:border-primary-light outline-none ${!!currentActivePersona ? 'opacity-70 cursor-not-allowed' : ''}`}
            />
             {!!currentActivePersona && <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">To edit, change persona to "Default / Custom Instruction" or edit the active persona.</p>}
          </div>
          <div>
            <label htmlFor="temperature" className="block text-sm font-medium text-neutral-darker dark:text-secondary-light mb-1">
              Temperature: {(modelSettings as ModelSettings).temperature.toFixed(2)}
            </label>
            <input
              type="range"
              id="temperature"
              min="0"
              max={currentApiKeyStatus?.isGeminiPlatform ? "1" : "2"} 
              step="0.01"
              value={(modelSettings as ModelSettings).temperature}
              onChange={(e) => onModelSettingsChange({ temperature: parseFloat(e.target.value) } as Partial<ModelSettings>)}
              disabled={disabled}
              className="w-full h-2 bg-secondary dark:bg-neutral-darkest rounded-lg appearance-none cursor-pointer accent-primary dark:accent-primary-light"
            />
          </div>
          { (currentApiKeyStatus?.isGeminiPlatform && !currentApiKeyStatus.isImageGeneration && !currentApiKeyStatus.isImageEditing && !currentApiKeyStatus.isPrivateMode && !currentApiKeyStatus.isMultiImageEditing && !currentApiKeyStatus.isFluxUltraImageGeneration && !isKlingVideoModel && !isTradingProModel) && ( 
          <div>
            <label htmlFor="top-k" className="block text-sm font-medium text-neutral-darker dark:text-secondary-light mb-1">
              Top K: {(modelSettings as ModelSettings).topK}
            </label>
            <input
              type="range"
              id="top-k"
              min="1"
              max="100" 
              step="1"
              value={(modelSettings as ModelSettings).topK}
              onChange={(e) => onModelSettingsChange({ topK: parseInt(e.target.value, 10) } as Partial<ModelSettings>)}
              disabled={disabled}
              className="w-full h-2 bg-secondary dark:bg-neutral-darkest rounded-lg appearance-none cursor-pointer accent-primary dark:accent-primary-light"
            />
          </div>
          )}
          <div> 
            <label htmlFor="top-p" className="block text-sm font-medium text-neutral-darker dark:text-secondary-light mb-1">
              Top P: {(modelSettings as ModelSettings).topP.toFixed(2)}
            </label>
            <input
              type="range"
              id="top-p"
              min="0"
              max="1"
              step="0.01"
              value={(modelSettings as ModelSettings).topP}
              onChange={(e) => onModelSettingsChange({ topP: parseFloat(e.target.value) } as Partial<ModelSettings>)}
              disabled={disabled}
              className="w-full h-2 bg-secondary dark:bg-neutral-darkest rounded-lg appearance-none cursor-pointer accent-primary dark:accent-primary-light"
            />
          </div>
        </div>
      )}

      {isAiAgentModel && (
        <div className="space-y-4 border-t border-secondary dark:border-neutral-darkest pt-4">
          <h3 className="text-lg font-semibold text-neutral-darker dark:text-secondary-light flex items-center">
              <UserCircleIcon className="w-5 h-5 mr-2 text-primary dark:text-primary-light" />
              AI Agent Settings
          </h3>
          <p className="text-xs text-neutral-500 dark:text-neutral-400">
            The AI Agent uses a specific system instruction to guide its planning and execution capabilities.
            You can adjust temperature, Top K, and Top P for its responses. Personas are disabled for AI Agent.
          </p>
          <div>
            <label htmlFor="ai-agent-system-instruction" className="block text-sm font-medium text-neutral-darker dark:text-secondary-light mb-1">
              System Instruction (AI Agent - Read Only)
            </label>
            <textarea
              id="ai-agent-system-instruction"
              rows={5}
              value={(modelSettings as AiAgentSettings).systemInstruction}
              readOnly
              className="w-full p-2 border border-secondary dark:border-neutral-darkest rounded-md bg-neutral-light/70 dark:bg-neutral-dark/70 opacity-70 cursor-not-allowed text-xs"
            />
          </div>
           <div>
            <label htmlFor="ai-agent-temperature" className="block text-sm font-medium text-neutral-darker dark:text-secondary-light mb-1">
              Temperature: {(modelSettings as AiAgentSettings).temperature.toFixed(2)}
            </label>
            <input
              type="range"
              id="ai-agent-temperature"
              min="0"
              max="1" 
              step="0.01"
              value={(modelSettings as AiAgentSettings).temperature}
              onChange={(e) => onModelSettingsChange({ temperature: parseFloat(e.target.value) } as Partial<AiAgentSettings>)}
              disabled={disabled}
              className="w-full h-2 bg-secondary dark:bg-neutral-darkest rounded-lg appearance-none cursor-pointer accent-primary dark:accent-primary-light"
            />
          </div>
          <div>
            <label htmlFor="ai-agent-top-k" className="block text-sm font-medium text-neutral-darker dark:text-secondary-light mb-1">
              Top K: {(modelSettings as AiAgentSettings).topK}
            </label>
            <input
              type="range"
              id="ai-agent-top-k"
              min="1"
              max="100" 
              step="1"
              value={(modelSettings as AiAgentSettings).topK}
              onChange={(e) => onModelSettingsChange({ topK: parseInt(e.target.value, 10) } as Partial<AiAgentSettings>)}
              disabled={disabled}
              className="w-full h-2 bg-secondary dark:bg-neutral-darkest rounded-lg appearance-none cursor-pointer accent-primary dark:accent-primary-light"
            />
          </div>
          <div> 
            <label htmlFor="ai-agent-top-p" className="block text-sm font-medium text-neutral-darker dark:text-secondary-light mb-1">
              Top P: {(modelSettings as AiAgentSettings).topP.toFixed(2)}
            </label>
            <input
              type="range"
              id="ai-agent-top-p"
              min="0"
              max="1"
              step="0.01"
              value={(modelSettings as AiAgentSettings).topP}
              onChange={(e) => onModelSettingsChange({ topP: parseFloat(e.target.value) } as Partial<AiAgentSettings>)}
              disabled={disabled}
              className="w-full h-2 bg-secondary dark:bg-neutral-darkest rounded-lg appearance-none cursor-pointer accent-primary dark:accent-primary-light"
            />
          </div>
        </div>
      )}
      
      {isPrivateModel && (
        <div className="space-y-4 border-t border-secondary dark:border-neutral-darkest pt-4">
            <h3 className="text-lg font-semibold text-neutral-darker dark:text-secondary-light flex items-center">
              <UserCircleIcon className="w-5 h-5 mr-2 text-primary dark:text-primary-light" />
              Private Mode Information
            </h3>
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
                In Private Mode, your chat messages, uploaded images, and files are stored only in this browser session and are NOT sent to any AI model or external server.
                All other model settings (like temperature, personas, web search) are disabled as there is no AI interaction.
            </p>
             <div>
                <label htmlFor="private-mode-system-instruction" className="block text-sm font-medium text-neutral-darker dark:text-secondary-light mb-1">
                System Instruction (Private Mode - Read Only)
                </label>
                <textarea
                id="private-mode-system-instruction"
                rows={2}
                value={(modelSettings as PrivateModeSettings).systemInstruction}
                readOnly
                className="w-full p-2 border border-secondary dark:border-neutral-darkest rounded-md bg-neutral-light/70 dark:bg-neutral-dark/70 opacity-70 cursor-not-allowed text-xs"
                />
            </div>
        </div>
      )}

      {isImagenModel && (
        <div className="space-y-4 border-t border-secondary dark:border-neutral-darkest pt-4">
            <h3 className="text-lg font-semibold text-neutral-darker dark:text-secondary-light flex items-center">
                <PhotoIcon className="w-5 h-5 mr-2 text-primary dark:text-primary-light" /> 
                Imagen Settings
            </h3>
            <div>
                <label htmlFor="number-of-images" className="block text-sm font-medium text-neutral-darker dark:text-secondary-light mb-1">
                Number of Images: {(modelSettings as ImagenSettings).numberOfImages || 1}
                </label>
                <input
                type="range"
                id="number-of-images"
                min="1"
                max="4"
                step="1"
                value={(modelSettings as ImagenSettings).numberOfImages || 1}
                onChange={(e) => onModelSettingsChange({ numberOfImages: parseInt(e.target.value, 10) } as Partial<ImagenSettings>)}
                disabled={disabled}
                className="w-full h-2 bg-secondary dark:bg-neutral-darkest rounded-lg appearance-none cursor-pointer accent-primary dark:accent-primary-light"
                />
            </div>
             <div>
                <label htmlFor="aspect-ratio" className="block text-sm font-medium text-neutral-darker dark:text-secondary-light mb-1">Aspect Ratio</label>
                <select 
                    id="aspect-ratio"
                    value={(modelSettings as ImagenSettings).aspectRatio || '1:1'}
                    onChange={(e) => onModelSettingsChange({ aspectRatio: e.target.value } as Partial<ImagenSettings>)}
                    disabled={disabled}
                    className="w-full p-2 border border-secondary dark:border-neutral-darkest rounded-md bg-neutral-light dark:bg-neutral-dark focus:ring-primary dark:focus:ring-primary-light focus:border-primary dark:focus:border-primary-light outline-none"
                >
                    {imagenAspectRatios.map(ratio => (
                        <option key={ratio.value} value={ratio.value}>{ratio.label}</option>
                    ))}
                </select>
            </div>
            <div>
                <label htmlFor="output-mime-type" className="block text-sm font-medium text-neutral-darker dark:text-secondary-light mb-1">Output Format</label>
                <select 
                    id="output-mime-type"
                    value={(modelSettings as ImagenSettings).outputMimeType || 'image/jpeg'}
                    onChange={(e) => onModelSettingsChange({ outputMimeType: e.target.value as 'image/jpeg' | 'image/png' } as Partial<ImagenSettings>)}
                    disabled={disabled}
                    className="w-full p-2 border border-secondary dark:border-neutral-darkest rounded-md bg-neutral-light dark:bg-neutral-dark focus:ring-primary dark:focus:ring-primary-light focus:border-primary dark:focus:border-primary-light outline-none"
                >
                    <option value="image/jpeg">JPEG</option>
                    <option value="image/png">PNG</option>
                </select>
            </div>
            <div className="mt-2 p-3 rounded-md bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 text-sm text-blue-700 dark:text-blue-300">
                <InformationCircleIcon className="w-5 h-5 inline mr-1.5 align-text-bottom" />
                Enter a prompt in the chat input to generate images. System instructions and other chat settings are not used for image generation.
            </div>
        </div>
      )}
      
      {isFluxUltraImageGenModel && (
        <div className="space-y-4 border-t border-secondary dark:border-neutral-darkest pt-4">
            <h3 className="text-lg font-semibold text-neutral-darker dark:text-secondary-light flex items-center">
                <PhotoIcon className="w-5 h-5 mr-2 text-primary dark:text-primary-light" /> 
                Flux1.1 [Ultra] Settings
            </h3>
             <div>
                <label htmlFor="flux-ultra-aspect-ratio" className="block text-sm font-medium text-neutral-darker dark:text-secondary-light mb-1">Aspect Ratio</label>
                <select 
                    id="flux-ultra-aspect-ratio"
                    value={(modelSettings as FluxUltraSettings).aspect_ratio || DEFAULT_FLUX_ULTRA_SETTINGS.aspect_ratio}
                    onChange={(e) => onModelSettingsChange({ aspect_ratio: e.target.value as FluxUltraAspectRatio } as Partial<FluxUltraSettings>)}
                    disabled={disabled}
                    className="w-full p-2 border border-secondary dark:border-neutral-darkest rounded-md bg-neutral-light dark:bg-neutral-dark focus:ring-primary dark:focus:ring-primary-light focus:border-primary dark:focus:border-primary-light outline-none"
                >
                    {FLUX_ULTRA_ASPECT_RATIOS.map(ratioOpt => (
                        <option key={ratioOpt.value} value={ratioOpt.value}>{ratioOpt.label}</option>
                    ))}
                </select>
            </div>
            <div>
                <label htmlFor="flux-ultra-num-inference-steps" className="block text-sm font-medium text-neutral-darker dark:text-secondary-light mb-1">
                Inference Steps: {(modelSettings as FluxUltraSettings).num_inference_steps ?? DEFAULT_FLUX_ULTRA_SETTINGS.num_inference_steps}
                </label>
                <input
                type="range" id="flux-ultra-num-inference-steps" min="10" max="50" step="1"
                value={(modelSettings as FluxUltraSettings).num_inference_steps ?? DEFAULT_FLUX_ULTRA_SETTINGS.num_inference_steps}
                onChange={(e) => onModelSettingsChange({ num_inference_steps: parseInt(e.target.value, 10) } as Partial<FluxUltraSettings>)}
                disabled={disabled} className="w-full h-2 bg-secondary dark:bg-neutral-darkest rounded-lg appearance-none cursor-pointer accent-primary dark:accent-primary-light"
                />
            </div>
             <div>
                <label htmlFor="flux-ultra-guidance-scale" className="block text-sm font-medium text-neutral-darker dark:text-secondary-light mb-1">
                Guidance Scale: {((modelSettings as FluxUltraSettings).guidance_scale ?? DEFAULT_FLUX_ULTRA_SETTINGS.guidance_scale!).toFixed(1)}
                </label>
                <input
                type="range" id="flux-ultra-guidance-scale" min="0" max="10" step="0.1"
                value={(modelSettings as FluxUltraSettings).guidance_scale ?? DEFAULT_FLUX_ULTRA_SETTINGS.guidance_scale}
                onChange={(e) => onModelSettingsChange({ guidance_scale: parseFloat(e.target.value) } as Partial<FluxUltraSettings>)}
                disabled={disabled} className="w-full h-2 bg-secondary dark:bg-neutral-darkest rounded-lg appearance-none cursor-pointer accent-primary dark:accent-primary-light"
                />
            </div>
            <div>
                <label htmlFor="flux-ultra-num-images" className="block text-sm font-medium text-neutral-darker dark:text-secondary-light mb-1">
                Number of Images: {(modelSettings as FluxUltraSettings).num_images ?? DEFAULT_FLUX_ULTRA_SETTINGS.num_images}
                </label>
                <input
                type="range" id="flux-ultra-num-images" min="1" max="4" step="1"
                value={(modelSettings as FluxUltraSettings).num_images ?? DEFAULT_FLUX_ULTRA_SETTINGS.num_images}
                onChange={(e) => onModelSettingsChange({ num_images: parseInt(e.target.value, 10) } as Partial<FluxUltraSettings>)}
                disabled={disabled} className="w-full h-2 bg-secondary dark:bg-neutral-darkest rounded-lg appearance-none cursor-pointer accent-primary dark:accent-primary-light"
                />
            </div>
            <div className="flex items-end space-x-2">
                <div className="flex-grow">
                    <label htmlFor="flux-ultra-seed" className="block text-sm font-medium text-neutral-darker dark:text-secondary-light mb-1">Seed (empty for random)</label>
                    <input type="number" id="flux-ultra-seed"
                        value={(modelSettings as FluxUltraSettings).seed === null || (modelSettings as FluxUltraSettings).seed === undefined ? '' : (modelSettings as FluxUltraSettings).seed}
                        onChange={(e) => onModelSettingsChange({ seed: e.target.value === '' ? null : parseInt(e.target.value, 10) } as Partial<FluxUltraSettings>)}
                        placeholder="Random" disabled={disabled}
                        className="w-full p-2 border border-secondary dark:border-neutral-darkest rounded-md bg-neutral-light dark:bg-neutral-dark focus:ring-primary dark:focus:ring-primary-light focus:border-primary dark:focus:border-primary-light outline-none" />
                </div>
                <button onClick={() => handleRandomizeSeed('fluxUltra')} disabled={disabled}
                    className="p-2 border border-secondary dark:border-neutral-darkest rounded-md text-neutral-darker dark:text-secondary-light hover:bg-secondary/50 dark:hover:bg-neutral-dark/50" title="Randomize Seed">
                    <ArrowPathIcon className="w-5 h-5"/>
                </button>
            </div>
            <div className="flex items-center justify-between mt-2">
                <label htmlFor="flux-ultra-enable-safety-checker" className="text-sm font-medium text-neutral-darker dark:text-secondary-light">Enable Safety Checker</label>
                <button
                  onClick={() => onModelSettingsChange({ enable_safety_checker: !((modelSettings as FluxUltraSettings).enable_safety_checker ?? DEFAULT_FLUX_ULTRA_SETTINGS.enable_safety_checker) } as Partial<FluxUltraSettings>)}
                  disabled={disabled}
                  className={`${((modelSettings as FluxUltraSettings).enable_safety_checker ?? DEFAULT_FLUX_ULTRA_SETTINGS.enable_safety_checker) ? 'bg-primary dark:bg-primary-light' : 'bg-secondary dark:bg-neutral-darkest'} relative inline-flex items-center h-6 rounded-full w-11 transition-colors focus:outline-none focus:ring-2 focus:ring-primary dark:focus:ring-primary-light focus:ring-offset-2 dark:focus:ring-offset-neutral-dark`}
                  role="switch" aria-checked={(modelSettings as FluxUltraSettings).enable_safety_checker ?? DEFAULT_FLUX_ULTRA_SETTINGS.enable_safety_checker}>
                  <span className={`${((modelSettings as FluxUltraSettings).enable_safety_checker ?? DEFAULT_FLUX_ULTRA_SETTINGS.enable_safety_checker) ? 'translate-x-6' : 'translate-x-1'} inline-block w-4 h-4 transform bg-white rounded-full transition-transform`} />
                </button>
            </div>
             <div className="mt-2 p-3 rounded-md bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 text-sm text-blue-700 dark:text-blue-300">
                <InformationCircleIcon className="w-5 h-5 inline mr-1.5 align-text-bottom" />
                Enter a prompt in the chat input to generate images.
            </div>
        </div>
      )}

      {isKlingVideoModel && (
        <div className="space-y-4 border-t border-secondary dark:border-neutral-darkest pt-4">
          <h3 className="text-lg font-semibold text-neutral-darker dark:text-secondary-light flex items-center">
            <FilmIcon className="w-5 h-5 mr-2 text-primary dark:text-primary-light" />
            Kling AI Video Settings
          </h3>
          <div>
            <label htmlFor="kling-duration" className="block text-sm font-medium text-neutral-darker dark:text-secondary-light mb-1">Duration</label>
            <select
              id="kling-duration"
              value={(modelSettings as KlingAiSettings).duration || DEFAULT_KLING_AI_SETTINGS.duration}
              onChange={(e) => onModelSettingsChange({ duration: e.target.value as KlingAiDuration } as Partial<KlingAiSettings>)}
              disabled={disabled}
              className="w-full p-2 border border-secondary dark:border-neutral-darkest rounded-md bg-neutral-light dark:bg-neutral-dark focus:ring-primary dark:focus:ring-primary-light focus:border-primary dark:focus:border-primary-light outline-none"
            >
              {KLING_AI_DURATIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="kling-aspect-ratio" className="block text-sm font-medium text-neutral-darker dark:text-secondary-light mb-1">Aspect Ratio</label>
            <select
              id="kling-aspect-ratio"
              value={(modelSettings as KlingAiSettings).aspect_ratio || DEFAULT_KLING_AI_SETTINGS.aspect_ratio}
              onChange={(e) => onModelSettingsChange({ aspect_ratio: e.target.value as KlingAiAspectRatio } as Partial<KlingAiSettings>)}
              disabled={disabled}
              className="w-full p-2 border border-secondary dark:border-neutral-darkest rounded-md bg-neutral-light dark:bg-neutral-dark focus:ring-primary dark:focus:ring-primary-light focus:border-primary dark:focus:border-primary-light outline-none"
            >
              {KLING_AI_ASPECT_RATIOS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="kling-negative-prompt" className="block text-sm font-medium text-neutral-darker dark:text-secondary-light mb-1">
              Negative Prompt
            </label>
            <textarea
              id="kling-negative-prompt"
              rows={2}
              value={(modelSettings as KlingAiSettings).negative_prompt || DEFAULT_KLING_AI_SETTINGS.negative_prompt}
              onChange={(e) => onModelSettingsChange({ negative_prompt: e.target.value } as Partial<KlingAiSettings>)}
              disabled={disabled}
              placeholder={DEFAULT_KLING_AI_SETTINGS.negative_prompt}
              className="w-full p-2 border border-secondary dark:border-neutral-darkest rounded-md bg-neutral-light dark:bg-neutral-dark focus:ring-primary dark:focus:ring-primary-light focus:border-primary dark:focus:border-primary-light outline-none text-sm"
            />
          </div>
          <div>
            <label htmlFor="kling-cfg-scale" className="block text-sm font-medium text-neutral-darker dark:text-secondary-light mb-1">
              CFG Scale: {((modelSettings as KlingAiSettings).cfg_scale ?? DEFAULT_KLING_AI_SETTINGS.cfg_scale!).toFixed(1)}
            </label>
            <input
              type="range" id="kling-cfg-scale" min="0" max="2" step="0.1" 
              value={(modelSettings as KlingAiSettings).cfg_scale ?? DEFAULT_KLING_AI_SETTINGS.cfg_scale}
              onChange={(e) => onModelSettingsChange({ cfg_scale: parseFloat(e.target.value) } as Partial<KlingAiSettings>)}
              disabled={disabled} className="w-full h-2 bg-secondary dark:bg-neutral-darkest rounded-lg appearance-none cursor-pointer accent-primary dark:accent-primary-light"
            />
          </div>
           <div className="mt-2 p-3 rounded-md bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 text-sm text-blue-700 dark:text-blue-300">
                <InformationCircleIcon className="w-5 h-5 inline mr-1.5 align-text-bottom" />
                Upload an image and enter a prompt in the chat input to generate a video.
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
                <label htmlFor="tts-model-identifier" className="block text-sm font-medium text-neutral-darker dark:text-secondary-light mb-1">TTS Model</label>
                <select 
                    id="tts-model-identifier"
                    value={(modelSettings as OpenAITtsSettings).modelIdentifier || 'tts-1'}
                    onChange={(e) => onModelSettingsChange({ modelIdentifier: e.target.value as 'tts-1' | 'tts-1-hd' } as Partial<OpenAITtsSettings>)}
                    disabled={disabled}
                    className="w-full p-2 border border-secondary dark:border-neutral-darkest rounded-md bg-neutral-light dark:bg-neutral-dark focus:ring-primary dark:focus:ring-primary-light focus:border-primary dark:focus:border-primary-light outline-none"
                >
                    <option value="tts-1">OpenAI TTS-1 (Standard)</option>
                    <option value="tts-1-hd">OpenAI TTS-1 HD (High Definition)</option>
                </select>
            </div>
            <div>
                <label htmlFor="tts-voice" className="block text-sm font-medium text-neutral-darker dark:text-secondary-light mb-1">Voice</label>
                <select 
                    id="tts-voice"
                    value={(modelSettings as OpenAITtsSettings).voice || 'alloy'}
                    onChange={(e) => onModelSettingsChange({ voice: e.target.value as OpenAiTtsVoice } as Partial<OpenAITtsSettings>)}
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
                Speed: {((modelSettings as OpenAITtsSettings).speed || 1.0).toFixed(2)}x
                </label>
                <input
                type="range"
                id="tts-speed"
                min="0.25"
                max="4.0"
                step="0.05"
                value={(modelSettings as OpenAITtsSettings).speed || 1.0}
                onChange={(e) => onModelSettingsChange({ speed: parseFloat(e.target.value) } as Partial<OpenAITtsSettings>)}
                disabled={disabled}
                className="w-full h-2 bg-secondary dark:bg-neutral-darkest rounded-lg appearance-none cursor-pointer accent-primary dark:accent-primary-light"
                />
            </div>
            <div className="mt-2 p-3 rounded-md bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 text-sm text-blue-700 dark:text-blue-300">
                <InformationCircleIcon className="w-5 h-5 inline mr-1.5 align-text-bottom" />
                Enter text in the chat input to synthesize speech. Chat settings (temp, etc.) are not used.
            </div>
        </div>
      )}

      {isRealTimeTranslationModel && (
         <div className="space-y-4 border-t border-secondary dark:border-neutral-darkest pt-4">
            <h3 className="text-lg font-semibold text-neutral-darker dark:text-secondary-light flex items-center">
                <LanguageIcon className="w-5 h-5 mr-2 text-primary dark:text-primary-light" /> 
                Real-Time Translation Settings
            </h3>
            <div>
                <label htmlFor="target-language" className="block text-sm font-medium text-neutral-darker dark:text-secondary-light mb-1">Target Language for Translation</label>
                <select 
                    id="target-language"
                    value={(modelSettings as RealTimeTranslationSettings).targetLanguage || 'en'}
                    onChange={(e) => onModelSettingsChange({ targetLanguage: e.target.value } as Partial<RealTimeTranslationSettings>)}
                    disabled={disabled}
                    className="w-full p-2 border border-secondary dark:border-neutral-darkest rounded-md bg-neutral-light dark:bg-neutral-dark focus:ring-primary dark:focus:ring-primary-light focus:border-primary dark:focus:border-primary-light outline-none"
                >
                    {TRANSLATION_TARGET_LANGUAGES.map(lang => (
                        <option key={lang.code} value={lang.code}>{lang.flag} {lang.name}</option>
                    ))}
                </select>
            </div>
            <div className="mt-2 p-3 rounded-md bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 text-sm text-blue-700 dark:text-blue-300">
                <InformationCircleIcon className="w-5 h-5 inline mr-1.5 align-text-bottom" />
                Use the microphone button in the chat area to start real-time speech-to-text and translation.
            </div>
        </div>
      )}

      {isFluxKontexModel && (
        <div className="space-y-4 border-t border-secondary dark:border-neutral-darkest pt-4">
          <h3 className="text-lg font-semibold text-neutral-darker dark:text-secondary-light flex items-center">
            <EditIcon className="w-5 h-5 mr-2 text-primary dark:text-primary-light" />
            Flux Kontext Settings
          </h3>
          <div>
            <label htmlFor="flux-output-format" className="block text-sm font-medium text-neutral-darker dark:text-secondary-light mb-1">Output Format</label>
            <select 
                id="flux-output-format"
                value={(modelSettings as FluxKontexSettings).output_format || DEFAULT_FLUX_KONTEX_SETTINGS.output_format}
                onChange={(e) => onModelSettingsChange({ output_format: e.target.value as 'jpeg' | 'png' } as Partial<FluxKontexSettings>)}
                disabled={disabled}
                className="w-full p-2 border border-secondary dark:border-neutral-darkest rounded-md bg-neutral-light dark:bg-neutral-dark focus:ring-primary dark:focus:ring-primary-light focus:border-primary dark:focus:border-primary-light outline-none"
            >
                <option value="jpeg">JPEG</option>
                <option value="png">PNG</option>
            </select>
          </div>
          <div>
            <label htmlFor="flux-safety-tolerance" className="block text-sm font-medium text-neutral-darker dark:text-secondary-light mb-1">
              Safety Tolerance: {(modelSettings as FluxKontexSettings).safety_tolerance ?? DEFAULT_FLUX_KONTEX_SETTINGS.safety_tolerance}
            </label>
            <input
              type="range"
              id="flux-safety-tolerance"
              min="1" max="5" step="1"
              value={(modelSettings as FluxKontexSettings).safety_tolerance ?? DEFAULT_FLUX_KONTEX_SETTINGS.safety_tolerance}
              onChange={(e) => onModelSettingsChange({ safety_tolerance: parseInt(e.target.value, 10) } as Partial<FluxKontexSettings>)}
              disabled={disabled}
              className="w-full h-2 bg-secondary dark:bg-neutral-darkest rounded-lg appearance-none cursor-pointer accent-primary dark:accent-primary-light"
            />
          </div>
          <div>
            <label htmlFor="flux-guidance-scale" className="block text-sm font-medium text-neutral-darker dark:text-secondary-light mb-1">
              Guidance Scale: {((modelSettings as FluxKontexSettings).guidance_scale)?.toFixed(1) ?? DEFAULT_FLUX_KONTEX_SETTINGS.guidance_scale.toFixed(1)}
            </label>
            <input
              type="range"
              id="flux-guidance-scale"
              min="0" max="20" step="0.5"
              value={(modelSettings as FluxKontexSettings).guidance_scale ?? DEFAULT_FLUX_KONTEX_SETTINGS.guidance_scale}
              onChange={(e) => onModelSettingsChange({ guidance_scale: parseFloat(e.target.value) } as Partial<FluxKontexSettings>)}
              disabled={disabled}
              className="w-full h-2 bg-secondary dark:bg-neutral-darkest rounded-lg appearance-none cursor-pointer accent-primary dark:accent-primary-light"
            />
          </div>
          <div>
            <label htmlFor="flux-num-inference-steps" className="block text-sm font-medium text-neutral-darker dark:text-secondary-light mb-1">
              Number of Inference Steps: {(modelSettings as FluxKontexSettings).num_inference_steps ?? DEFAULT_FLUX_KONTEX_SETTINGS.num_inference_steps}
            </label>
            <input
              type="range"
              id="flux-num-inference-steps"
              min="10" max="100" step="1"
              value={(modelSettings as FluxKontexSettings).num_inference_steps ?? DEFAULT_FLUX_KONTEX_SETTINGS.num_inference_steps}
              onChange={(e) => onModelSettingsChange({ num_inference_steps: parseInt(e.target.value, 10) } as Partial<FluxKontexSettings>)}
              disabled={disabled || selectedModel === Model.FLUX_KONTEX_MAX_MULTI} 
              className={`w-full h-2 bg-secondary dark:bg-neutral-darkest rounded-lg appearance-none cursor-pointer accent-primary dark:accent-primary-light ${selectedModel === Model.FLUX_KONTEX_MAX_MULTI ? 'opacity-50' : ''}`}
            />
             {selectedModel === Model.FLUX_KONTEX_MAX_MULTI && <p className="text-xs text-neutral-400 mt-0.5">Inference steps are fixed for Flux Max.</p>}
          </div>
           <div>
            <label htmlFor="flux-num-images" className="block text-sm font-medium text-neutral-darker dark:text-secondary-light mb-1">
              Number of Images (output): {(modelSettings as FluxKontexSettings).num_images ?? DEFAULT_FLUX_KONTEX_SETTINGS.num_images}
            </label>
            <input
              type="range"
              id="flux-num-images"
              min="1" max="4" step="1"
              value={(modelSettings as FluxKontexSettings).num_images ?? DEFAULT_FLUX_KONTEX_SETTINGS.num_images}
              onChange={(e) => onModelSettingsChange({ num_images: parseInt(e.target.value, 10) } as Partial<FluxKontexSettings>)}
              disabled={disabled}
              className="w-full h-2 bg-secondary dark:bg-neutral-darkest rounded-lg appearance-none cursor-pointer accent-primary dark:accent-primary-light"
            />
          </div>
          <div className="flex items-end space-x-2">
            <div className="flex-grow">
                <label htmlFor="flux-seed" className="block text-sm font-medium text-neutral-darker dark:text-secondary-light mb-1">
                Seed (empty for random)
                </label>
                <input
                type="number"
                id="flux-seed"
                value={(modelSettings as FluxKontexSettings).seed === null || (modelSettings as FluxKontexSettings).seed === undefined ? '' : (modelSettings as FluxKontexSettings).seed}
                onChange={(e) => onModelSettingsChange({ seed: e.target.value === '' ? null : parseInt(e.target.value, 10) } as Partial<FluxKontexSettings>)}
                placeholder="Random"
                disabled={disabled}
                className="w-full p-2 border border-secondary dark:border-neutral-darkest rounded-md bg-neutral-light dark:bg-neutral-dark focus:ring-primary dark:focus:ring-primary-light focus:border-primary dark:focus:border-primary-light outline-none"
                />
            </div>
            <button 
                onClick={() => handleRandomizeSeed('fluxKontext')}
                disabled={disabled}
                className="p-2 border border-secondary dark:border-neutral-darkest rounded-md text-neutral-darker dark:text-secondary-light hover:bg-secondary/50 dark:hover:bg-neutral-dark/50"
                title="Randomize Seed"
            >
                <ArrowPathIcon className="w-5 h-5"/>
            </button>
          </div>
          <div>
            <label htmlFor="flux-aspect-ratio" className="block text-sm font-medium text-neutral-darker dark:text-secondary-light mb-1">Aspect Ratio</label>
            <select 
                id="flux-aspect-ratio"
                value={(modelSettings as FluxKontexSettings).aspect_ratio || DEFAULT_FLUX_KONTEX_SETTINGS.aspect_ratio}
                onChange={(e) => onModelSettingsChange({ aspect_ratio: e.target.value as FluxKontexAspectRatio } as Partial<FluxKontexSettings>)}
                disabled={disabled}
                className="w-full p-2 border border-secondary dark:border-neutral-darkest rounded-md bg-neutral-light dark:bg-neutral-dark focus:ring-primary dark:focus:ring-primary-light focus:border-primary dark:focus:border-primary-light outline-none"
            >
                {fluxKontexAspectRatios.map(ratio => (
                    <option key={ratio.value} value={ratio.value}>{ratio.label}</option>
                ))}
            </select>
          </div>
          <div className="mt-2 p-3 rounded-md bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 text-sm text-blue-700 dark:text-blue-300">
            <InformationCircleIcon className="w-5 h-5 inline mr-1.5 align-text-bottom" />
            Upload an image (or multiple for Flux Max) and provide a prompt to describe the desired edits.
          </div>
        </div>
      )}

      {isTradingProModel && (
         <div className="space-y-4 border-t border-secondary dark:border-neutral-darkest pt-4">
            <h3 className="text-lg font-semibold text-neutral-darker dark:text-secondary-light flex items-center">
                <PresentationChartLineIcon className="w-5 h-5 mr-2 text-primary dark:text-primary-light" /> 
                Trading Pro Settings
            </h3>
             <p className="text-xs text-neutral-500 dark:text-neutral-400">
                Trading pair selection and analysis interactions are handled within the Trading Pro view. Web search is always enabled for this model.
            </p>
            {/* Future settings for Trading Pro (e.g., chart interval preferences) could go here, but are not requested for this panel yet. */}
             <div className="mt-2 p-3 rounded-md bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 text-sm text-blue-700 dark:text-blue-300">
                <InformationCircleIcon className="w-5 h-5 inline mr-1.5 align-text-bottom" />
                Select a trading pair (e.g., XAU/USD, BTC/USD) and initiate analysis from the main Trading Pro interface.
            </div>
        </div>
      )}

      {showWebSearchToggle && (
        <div className="border-t border-secondary dark:border-neutral-darkest pt-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-neutral-darker dark:text-secondary-light flex items-center">
              <MagnifyingGlassIcon className="w-5 h-5 mr-2 text-primary dark:text-primary-light" /> Web Search
            </h3>
            <button
              onClick={() => onWebSearchToggle(!isWebSearchEnabled)}
              disabled={disabled || isTradingProModel}
              className={`${
                isWebSearchEnabled && !isTradingProModel ? 'bg-primary dark:bg-primary-light' : 'bg-secondary dark:bg-neutral-darkest'
              } relative inline-flex items-center h-6 rounded-full w-11 transition-colors focus:outline-none focus:ring-2 focus:ring-primary dark:focus:ring-primary-light focus:ring-offset-2 dark:focus:ring-offset-neutral-dark ${isTradingProModel ? 'opacity-50 cursor-not-allowed' : ''}`}
              role="switch"
              aria-checked={isTradingProModel ? true : isWebSearchEnabled} // Trading Pro always uses it
            >
              <span
                className={`${
                  (isWebSearchEnabled || isTradingProModel) ? 'translate-x-6' : 'translate-x-1'
                } inline-block w-4 h-4 transform bg-white rounded-full transition-transform`}
              />
            </button>
          </div>
           <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
                {isTradingProModel 
                    ? "Web search is always enabled for Trading Pro analysis." 
                    : "Enable to allow the AI to search the web for up-to-date information. (Only for compatible Gemini chat models)"
                }
            </p>
        </div>
      )}
    </div>
  );
};

export default SettingsPanel;
