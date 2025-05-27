

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
    LanguageLearningModalProps, 
    LanguageOption, 
    UserLanguageProfile, 
    Badge,
    Model,
    LearningContent,
    VocabularyItem, 
    LanguageLearningActivityType,
    LearningActivityState,
    getActualModelIdentifier,
    ApiChatMessage
} from '../types.ts';
import { XMarkIcon, AcademicCapIcon, SpeakerWaveIcon, StopCircleIcon, CheckCircleIcon, XCircleIcon, MicrophoneIcon, ArrowPathIcon } from './Icons.tsx';
import { LANGUAGE_OPTIONS, BADGES_CATALOG, DEFAULT_USER_LANGUAGE_PROFILE, getNextMilestone } from '../constants.ts';
import { useNotification } from '../contexts/NotificationContext.tsx';
import { sendOpenAIMessageStream } from '../services/openaiService.ts'; 
import { generateOpenAITTS, ProxiedOpenAITtsParams } from '../services/openaiTTSService.ts';

const INITIAL_ACTIVITY_STATE: LearningActivityState = {
    isLoadingContent: false,
    content: null,
    error: null,
    userAnswer: null,
    isAnswerSubmitted: false,
    isAnswerCorrect: null,
    audioUrl: undefined,
    isAudioPlaying: false,
};

const MAX_PREVIOUS_ITEMS_TO_AVOID = 5;


const LanguageLearningModal: React.FC<LanguageLearningModalProps> = ({
  isOpen,
  onClose,
  userProfile,
  onUpdateProfile,
  onAddExp,
}) => {
  const [selectedLanguage, setSelectedLanguage] = useState<LanguageOption | null>(null);
  const [activeActivityType, setActiveActivityType] = useState<LanguageLearningActivityType | null>(null);
  const [activityState, setActivityState] = useState<LearningActivityState>(INITIAL_ACTIVITY_STATE);
  const { addNotification } = useNotification();
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null); // For speaking practice
  const [isRecording, setIsRecording] = useState(false); // For speaking practice
  const [transcribedText, setTranscribedText] = useState<string | null>(null); // For speaking practice
  
  const [previousQuizQuestions, setPreviousQuizQuestions] = useState<string[]>([]);
  const [previousListeningScripts, setPreviousListeningScripts] = useState<string[]>([]);
  const [previousSpeakingPhrases, setPreviousSpeakingPhrases] = useState<string[]>([]);


  useEffect(() => {
    if (isOpen && userProfile) {
      const languagesWithProgress = Object.keys(userProfile.languageProfiles || {}) as LanguageOption[];
      if (!selectedLanguage && languagesWithProgress.length > 0) {
         setSelectedLanguage(languagesWithProgress[0]); 
      } else if (!selectedLanguage && LANGUAGE_OPTIONS.length > 0) {
        // Default to the first option if no progress and options exist
        // setSelectedLanguage(LANGUAGE_OPTIONS[0].code); 
      }
    }
    if (!isOpen) {
        setActiveActivityType(null);
        setActivityState(INITIAL_ACTIVITY_STATE);
        setPreviousQuizQuestions([]); 
        setPreviousListeningScripts([]);
        setPreviousSpeakingPhrases([]);
        if (audioPlayerRef.current) {
            audioPlayerRef.current.pause();
            audioPlayerRef.current.src = '';
        }
    }
  }, [isOpen, userProfile, selectedLanguage]);

  useEffect(() => {
    if (!isOpen || activeActivityType !== 'speaking') {
        if (recognitionRef.current && isRecording) {
            recognitionRef.current.stop();
            setIsRecording(false);
        }
        return;
    }

    const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognitionAPI) {
      addNotification("Speech recognition is not supported by your browser.", "error");
      return;
    }
    recognitionRef.current = new SpeechRecognitionAPI();
    const recognition = recognitionRef.current;
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = selectedLanguage || 'en-US'; 

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      const transcript = event.results[0][0].transcript;
      setTranscribedText(transcript);
      setActivityState(prev => ({ ...prev, userAnswer: transcript, isAnswerSubmitted: false, isAnswerCorrect: null }));
      setIsRecording(false);
    };
    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      addNotification(`Speech recognition error: ${event.error}`, "error", event.message);
      setIsRecording(false);
    };
    recognition.onend = () => {
      setIsRecording(false);
    };
    return () => {
        recognition?.stop();
    }
  }, [isOpen, activeActivityType, selectedLanguage, addNotification, isRecording]);


  const currentLangProfile: UserLanguageProfile | undefined = useMemo(() => {
    if (userProfile && selectedLanguage) {
      return userProfile.languageProfiles[selectedLanguage] || DEFAULT_USER_LANGUAGE_PROFILE;
    }
    return undefined;
  }, [userProfile, selectedLanguage]);

  const earnedBadges: Badge[] = useMemo(() => {
    if (!currentLangProfile) return [];
    return currentLangProfile.earnedBadgeIds
      .map(badgeId => BADGES_CATALOG[badgeId])
      .filter(Boolean) as Badge[];
  }, [currentLangProfile]);

  const nextMilestoneData = useMemo(() => {
    if (currentLangProfile) {
        return getNextMilestone(currentLangProfile.exp);
    }
    return null;
  }, [currentLangProfile]);


  const handleLanguageSelect = (langCode: LanguageOption) => {
    setSelectedLanguage(langCode);
    setActiveActivityType(null); 
    setActivityState(INITIAL_ACTIVITY_STATE);
    setPreviousQuizQuestions([]);
    setPreviousListeningScripts([]);
    setPreviousSpeakingPhrases([]);
    if (userProfile && !userProfile.languageProfiles[langCode]) {
      const updatedProfile = {
        ...userProfile,
        languageProfiles: {
          ...(userProfile.languageProfiles || {}),
          [langCode]: { ...DEFAULT_USER_LANGUAGE_PROFILE }
        }
      };
      onUpdateProfile(updatedProfile);
    }
  };

  const parseAIJsonResponse = async (stream: AsyncGenerator<any, void, undefined>, activityName: string) => {
    let fullResponse = "";
    for await (const chunk of stream) {
        if (chunk.error) throw new Error(chunk.error);
        if (chunk.textDelta) fullResponse += chunk.textDelta;
        if (chunk.isFinished) break;
    }
    let jsonStr = fullResponse.trim();
    const fenceRegex = /^```(\w*)?\s*\n?(.*?)\n?\s*```$/s;
    const match = jsonStr.match(fenceRegex);
    if (match && match[2]) jsonStr = match[2].trim();
    
    try {
        return JSON.parse(jsonStr);
    } catch (parseError) {
        console.error(`Failed to parse AI response JSON for ${activityName}:`, parseError, "Raw response:", fullResponse);
        throw new Error(`Failed to understand AI response for the ${activityName}. Please try again.`);
    }
  };

  const fetchListeningExercise = async () => {
    if (!selectedLanguage) return;
    setActiveActivityType('listening');
    setActivityState({ ...INITIAL_ACTIVITY_STATE, isLoadingContent: true });
    const langName = LANGUAGE_OPTIONS.find(l => l.code === selectedLanguage)?.name || 'the selected language';

    let previousContentContext = "The new script MUST be different. ";
    if (previousListeningScripts.length > 0) {
        previousContentContext += `DO NOT REPEAT these exact scripts or scripts with the same core concept:\n${previousListeningScripts.map((q) => `- "${q.substring(0, 100)}${q.length > 100 ? '...' : ''}"`).join('\n')}`;
    }

    const prompt = `Generate a NEW and DISTINCT beginner-level listening exercise in ${langName}.
The exercise should include:
1. A short "script" (20-40 words) that is natural and easy to understand for a beginner.
2. A multiple-choice "question" about the script.
3. An array of three "options" (provide only the text for each option, WITHOUT "A.", "B.", "C." prefixes).
4. The "correctAnswerIndex" (0, 1, or 2 for the options array).
${previousContentContext}
Return the response as a single, valid JSON object with keys: "script", "question", "options", "correctAnswerIndex".`;

    try {
      const modelIdentifier = getActualModelIdentifier(Model.GPT4O_MINI);
      const history: ApiChatMessage[] = [
        { role: 'system', content: 'You are an AI assistant specialized in creating language learning exercises as JSON. You MUST AVOID REPEATING content if told to do so in the prompt.' },
        { role: 'user', content: prompt }
      ];
      const stream = sendOpenAIMessageStream({ modelIdentifier, history, modelSettings: { temperature: 0.6, topK: 50, topP: 0.95, systemInstruction: "Generate language exercises as JSON." }});
      const parsedContent = await parseAIJsonResponse(stream, "listening exercise");
      
      if (!parsedContent.script || !parsedContent.question || !parsedContent.options || parsedContent.correctAnswerIndex === undefined) {
        throw new Error("AI response is missing required fields for the listening exercise.");
      }
      const learningContent: LearningContent = {
        id: `listen-${Date.now()}`, activityType: 'listening', language: selectedLanguage,
        script: parsedContent.script, question: parsedContent.question, options: parsedContent.options, correctAnswerIndex: parsedContent.correctAnswerIndex,
      };
      const ttsResult = await generateOpenAITTS({ modelIdentifier: 'tts-1', textInput: learningContent.script!, voice: 'nova', speed: 1.0 });
      if (ttsResult.error || !ttsResult.audioBlob) throw new Error(ttsResult.error || "Failed to generate audio for the script.");
      const audioUrl = URL.createObjectURL(ttsResult.audioBlob);
      setActivityState(prev => ({ ...prev, isLoadingContent: false, content: learningContent, audioUrl, error: null }));
      setPreviousListeningScripts(prev => [parsedContent.script, ...prev].slice(0, MAX_PREVIOUS_ITEMS_TO_AVOID));
    } catch (error: any) {
      addNotification(error.message || "Failed to fetch listening exercise.", 'error');
      setActivityState(prev => ({ ...prev, isLoadingContent: false, error: error.message || "Failed to load exercise." }));
    }
  };
  
  const fetchSpeakingExercise = async () => {
    if (!selectedLanguage) return;
    setActiveActivityType('speaking');
    setActivityState({ ...INITIAL_ACTIVITY_STATE, isLoadingContent: true });
    setTranscribedText(null);
    const langName = LANGUAGE_OPTIONS.find(l => l.code === selectedLanguage)?.name || 'the selected language';

    let previousContentContext = "The new phrase MUST be different. ";
    if (previousSpeakingPhrases.length > 0) {
        previousContentContext += `DO NOT REPEAT these exact phrases or phrases with the same core concept:\n${previousSpeakingPhrases.map((q) => `- "${q.substring(0, 100)}${q.length > 100 ? '...' : ''}"`).join('\n')}`;
    }

    const prompt = `Generate a NEW and DISTINCT simple beginner-level phrase (5-10 words) in ${langName} for a speaking exercise.
${previousContentContext}
Return the response as a single, valid JSON object with a "phraseToSpeak" key.`;
    try {
        const modelIdentifier = getActualModelIdentifier(Model.GPT4O_MINI);
        const history: ApiChatMessage[] = [
            { role: 'system', content: 'You are an AI assistant specialized in creating language learning exercises as JSON. You MUST AVOID REPEATING content if told to do so in the prompt.' },
            { role: 'user', content: prompt }
        ];
        const stream = sendOpenAIMessageStream({ modelIdentifier, history, modelSettings: { temperature: 0.6, topK: 50, topP: 0.95, systemInstruction: "Generate language phrases as JSON." }});
        const parsedContent = await parseAIJsonResponse(stream, "speaking exercise");
        if (!parsedContent.phraseToSpeak) throw new Error("AI response is missing 'phraseToSpeak'.");
        setActivityState({ ...INITIAL_ACTIVITY_STATE, isLoadingContent: false, content: {
            id: `speak-${Date.now()}`, activityType: 'speaking', language: selectedLanguage, phraseToSpeak: parsedContent.phraseToSpeak,
        }});
        setPreviousSpeakingPhrases(prev => [parsedContent.phraseToSpeak, ...prev].slice(0, MAX_PREVIOUS_ITEMS_TO_AVOID));
    } catch (error: any) {
        addNotification(error.message || "Failed to fetch speaking exercise.", 'error');
        setActivityState(prev => ({ ...prev, isLoadingContent: false, error: error.message || "Failed to load exercise." }));
    }
  };

  const fetchVocabularySet = async () => {
    if (!selectedLanguage) return;
    setActiveActivityType('vocabulary');
    setActivityState({ ...INITIAL_ACTIVITY_STATE, isLoadingContent: true });
    const langName = LANGUAGE_OPTIONS.find(l => l.code === selectedLanguage)?.name || 'the selected language';
    // For vocabulary, asking for "unique" words in the set is the primary way to avoid repetition.
    // Sending previous sets to AI is complex and prompt-heavy.
    const prompt = `Generate a set of 5 unique beginner-level vocabulary words in ${langName}.
Ensure these words are distinct and suitable for a beginner.
For each word, provide:
1. The "word" in ${langName}.
2. Its "meaning" in English.
3. An "exampleSentence" using the word in ${langName}.
Return the response as a single, valid JSON object with a "vocabularySet" key, which is an array of these word objects.
Example for one word: {"word": "こんにちは", "meaning": "Hello / Good afternoon", "exampleSentence": "こんにちは、田中さん。"}`;
    try {
        const modelIdentifier = getActualModelIdentifier(Model.GPT4O_MINI);
        const history: ApiChatMessage[] = [
            { role: 'system', content: 'You are an AI assistant specialized in creating language learning vocabulary sets as JSON.' },
            { role: 'user', content: prompt }
        ];
        const stream = sendOpenAIMessageStream({ modelIdentifier, history, modelSettings: { temperature: 0.6, topK: 50, topP: 0.95, systemInstruction: "Generate vocabulary sets as JSON." }});
        const parsedContent = await parseAIJsonResponse(stream, "vocabulary set");
        if (!parsedContent.vocabularySet || !Array.isArray(parsedContent.vocabularySet) || parsedContent.vocabularySet.length === 0) {
            throw new Error("AI response is missing 'vocabularySet' or it's not a valid array.");
        }
        const learningContent: LearningContent = {
            id: `vocab-${Date.now()}`, activityType: 'vocabulary', language: selectedLanguage,
            vocabularySet: parsedContent.vocabularySet,
        };
        setActivityState(prev => ({ ...prev, isLoadingContent: false, content: learningContent, error: null }));
    } catch (error: any) {
        addNotification(error.message || "Failed to fetch vocabulary set.", 'error');
        setActivityState(prev => ({ ...prev, isLoadingContent: false, error: error.message || "Failed to load vocabulary." }));
    }
  };
  
  const fetchQuizQuestion = async () => {
    if (!selectedLanguage) return;
    setActiveActivityType('quiz');
    setActivityState({ ...INITIAL_ACTIVITY_STATE, isLoadingContent: true });
    const langName = LANGUAGE_OPTIONS.find(l => l.code === selectedLanguage)?.name || 'the selected language';
    
    let previousQuestionsContext = "The new question MUST be different. ";
    if (previousQuizQuestions.length > 0) {
        previousQuestionsContext += `DO NOT REPEAT these exact questions or questions with the same core concept:\n${previousQuizQuestions.map((q) => `- "${q.substring(0, 100)}${q.length > 100 ? '...' : ''}"`).join('\n')}`;
    }

    const prompt = `Generate a NEW and DISTINCT beginner-level multiple-choice quiz question in ${langName}.
The question should test basic vocabulary or grammar.
Provide:
1. A "question" string.
2. An array of three "options" strings (just the text for each option, WITHOUT "A.", "B.", "C." prefixes).
3. The "correctAnswerIndex" (0, 1, or 2).
${previousQuestionsContext}
Return the response as a single, valid JSON object.
Example (if ${langName} is English and previous questions were about colors):
{
  "question": "Which of these is a fruit?",
  "options": ["Carrot", "Apple", "Broccoli"], 
  "correctAnswerIndex": 1 
}`;
    try {
        const modelIdentifier = getActualModelIdentifier(Model.GPT4O_MINI);
        const history: ApiChatMessage[] = [
            { role: 'system', content: 'You are an AI that creates diverse quiz questions in JSON. You MUST AVOID REPEATING questions or their core concepts if told to do so in the prompt.' },
            { role: 'user', content: prompt }
        ];
        const stream = sendOpenAIMessageStream({ modelIdentifier, history, modelSettings: { temperature: 0.7, topK: 50, topP: 0.95, systemInstruction: "Generate unique quiz questions as JSON, ensuring variety and strictly avoiding repetition when asked." }});
        const parsedContent = await parseAIJsonResponse(stream, "quiz question");

        if (!parsedContent.question || !parsedContent.options || parsedContent.correctAnswerIndex === undefined) {
            throw new Error("AI response is missing required fields for the quiz question.");
        }
        const learningContent: LearningContent = {
            id: `quiz-${Date.now()}`, activityType: 'quiz', language: selectedLanguage,
            question: parsedContent.question, options: parsedContent.options, correctAnswerIndex: parsedContent.correctAnswerIndex,
        };
        setActivityState(prev => ({ ...prev, isLoadingContent: false, content: learningContent, error: null, userAnswer: null, isAnswerSubmitted: false, isAnswerCorrect: null }));
        
        setPreviousQuizQuestions(prev => {
            const updated = [parsedContent.question, ...prev];
            return updated.slice(0, MAX_PREVIOUS_ITEMS_TO_AVOID);
        });

    } catch (error: any) {
        addNotification(error.message || "Failed to fetch quiz question.", 'error');
        setActivityState(prev => ({ ...prev, isLoadingContent: false, error: error.message || "Failed to load quiz." }));
    }
  };


  const handlePlayAudio = () => {
    if (audioPlayerRef.current && activityState.audioUrl) {
        if (activityState.isAudioPlaying) audioPlayerRef.current.pause();
        else {
            audioPlayerRef.current.src = activityState.audioUrl; 
            audioPlayerRef.current.play().catch(e => console.error("Error playing audio:", e));
        }
        setActivityState(prev => ({...prev, isAudioPlaying: !prev.isAudioPlaying}));
    }
  };

  useEffect(() => {
    const player = audioPlayerRef.current;
    if (player) {
        const onEnded = () => setActivityState(prev => ({...prev, isAudioPlaying: false}));
        player.addEventListener('ended', onEnded);
        player.addEventListener('pause', onEnded); 
        return () => {
            player.removeEventListener('ended', onEnded);
            player.removeEventListener('pause', onEnded);
        };
    }
  }, []);

  const handleAnswerSelect = (answerIndex: number, activity: 'listening' | 'quiz') => {
    setActivityState(prev => ({ ...prev, userAnswer: answerIndex, isAnswerSubmitted: false, isAnswerCorrect: null }));
  };

  const handleSubmitAnswer = (activity: 'listening' | 'quiz') => {
    if (activityState.content && activityState.userAnswer !== null && selectedLanguage) {
      const isCorrect = activityState.userAnswer === activityState.content.correctAnswerIndex;
      setActivityState(prev => ({ ...prev, isAnswerSubmitted: true, isAnswerCorrect: isCorrect }));
      const expPoints = activity === 'listening' ? 15 : 15; 
      if (isCorrect) {
        onAddExp(selectedLanguage, expPoints); 
        addNotification(`Correct! +${expPoints} EXP`, 'success');
      } else {
        addNotification("Incorrect. Try the next one!", 'error');
      }
    }
  };
  
  const handleToggleRecording = () => {
    if (!recognitionRef.current) return;
    if (isRecording) recognitionRef.current.stop();
    else {
        setTranscribedText(null); 
        setActivityState(prev => ({ ...prev, userAnswer: null, isAnswerSubmitted: false, isAnswerCorrect: null }));
        recognitionRef.current.start();
    }
    setIsRecording(!isRecording);
  };

  const handleSubmitSpeakingAnswer = async () => {
    if (!selectedLanguage || !activityState.content?.phraseToSpeak || transcribedText === null) return;
    setActivityState(prev => ({...prev, isLoadingContent: true})); 
    const evaluationPrompt = `The user was asked to say: "${activityState.content.phraseToSpeak}".
The user's transcribed speech was: "${transcribedText}".
Is the transcribed speech a good match to the original phrase, considering it's for a beginner language learner?
Focus on key words being present and understandable. Minor pronunciation differences are acceptable.
Respond with a single, valid JSON object: {"is_match": boolean, "feedback": "brief feedback string"}.`;
    try {
        const modelIdentifier = getActualModelIdentifier(Model.GPT4O_MINI);
        const history: ApiChatMessage[] = [
            { role: 'system', content: 'You are an AI language learning evaluator.' },
            { role: 'user', content: evaluationPrompt }
        ];
        const stream = sendOpenAIMessageStream({ modelIdentifier, history, modelSettings: { temperature: 0.3, topK: 50, topP: 0.95, systemInstruction: "Evaluate spoken phrases as JSON." }});
        const evalResult = await parseAIJsonResponse(stream, "speaking evaluation");
        setActivityState(prev => ({ ...prev, isLoadingContent: false, isAnswerSubmitted: true, isAnswerCorrect: evalResult.is_match, error: evalResult.feedback }));
        if (evalResult.is_match) {
            onAddExp(selectedLanguage, 20); 
            addNotification(`Correct! +20 EXP. ${evalResult.feedback || ""}`, 'success');
        } else {
            addNotification(`Not quite. ${evalResult.feedback || "Try again!"}`, 'error');
        }
    } catch (error: any) {
        addNotification(error.message || "Failed to evaluate speaking exercise.", 'error');
        setActivityState(prev => ({ ...prev, isLoadingContent: false, error: error.message || "Evaluation failed." }));
    }
  };

  const handleActivitySelect = (type: LanguageLearningActivityType) => {
    if (type === 'quiz') {
        setPreviousQuizQuestions([]); 
    }
     if (type === 'listening') {
        setPreviousListeningScripts([]);
    }
    if (type === 'speaking') {
        setPreviousSpeakingPhrases([]);
    }
    switch (type) {
        case 'listening': fetchListeningExercise(); break;
        case 'speaking': fetchSpeakingExercise(); break;
        case 'vocabulary': fetchVocabularySet(); break;
        case 'quiz': fetchQuizQuestion(); break;
        default: setActiveActivityType(null); setActivityState(INITIAL_ACTIVITY_STATE);
    }
  };

  const resetActivity = () => {
    setActiveActivityType(null);
    setActivityState(INITIAL_ACTIVITY_STATE);
    setPreviousQuizQuestions([]); 
    setPreviousListeningScripts([]);
    setPreviousSpeakingPhrases([]);
    if (audioPlayerRef.current) {
        audioPlayerRef.current.pause();
        audioPlayerRef.current.src = '';
    }
  };

  if (!isOpen) return null;

  return (
    <div 
        className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-[70] p-4 transition-opacity duration-300"
        onClick={onClose}
        role="dialog"
        aria-modal="true"
        aria-labelledby="language-learning-modal-title"
    >
      <audio ref={audioPlayerRef} className="hidden" />
      <div 
        className="bg-neutral-light dark:bg-neutral-darker rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col transform transition-all duration-300 scale-100 opacity-100"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center p-4 sm:p-6 border-b border-secondary dark:border-neutral-darkest">
          <h2 id="language-learning-modal-title" className="text-xl sm:text-2xl font-semibold text-primary dark:text-primary-light flex items-center">
            <AcademicCapIcon className="w-7 h-7 mr-2" /> Language Learning Hub
          </h2>
          <button onClick={onClose} className="p-2 rounded-full text-neutral-darker dark:text-secondary-light hover:bg-secondary dark:hover:bg-neutral-darkest transition-colors" aria-label="Close language learning modal">
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>

        <div className="flex-grow overflow-y-auto p-4 sm:p-6 space-y-6">
          {!activeActivityType && (
            <div>
              <label htmlFor="language-select" className="block text-sm font-medium text-neutral-darker dark:text-secondary-light mb-1">Choose a Language to Learn:</label>
              <select id="language-select" value={selectedLanguage || ''} onChange={(e) => handleLanguageSelect(e.target.value as LanguageOption)}
                className="w-full p-2.5 border border-secondary dark:border-neutral-darkest rounded-md bg-neutral-light dark:bg-neutral-dark focus:ring-primary dark:focus:ring-primary-light focus:border-primary dark:focus:border-primary-light outline-none text-neutral-darker dark:text-secondary-light">
                <option value="" disabled>Select a language</option>
                {LANGUAGE_OPTIONS.map(lang => (<option key={lang.code} value={lang.code}>{lang.flag} {lang.name}</option>))}
              </select>
            </div>
          )}

          {selectedLanguage && currentLangProfile && !activeActivityType && (
            <>
              <div className="p-4 bg-secondary/50 dark:bg-neutral-dark/30 rounded-lg">
                <h3 className="text-lg font-semibold text-neutral-darker dark:text-secondary-light mb-3">Your Progress in {LANGUAGE_OPTIONS.find(l=>l.code === selectedLanguage)?.name}</h3>
                <div className="mb-2">
                  <div className="flex justify-between text-sm text-neutral-600 dark:text-neutral-300 mb-1">
                    <span>EXP: {currentLangProfile.exp.toLocaleString()}</span>
                    {nextMilestoneData && <span>Next Milestone: {nextMilestoneData.milestoneExp.toLocaleString()} EXP</span>}
                  </div>
                  {nextMilestoneData && (
                    <div className="w-full bg-secondary dark:bg-neutral-darkest rounded-full h-4 overflow-hidden">
                      <div className="bg-accent dark:bg-accent-light h-4 rounded-full transition-all duration-500 ease-out" style={{ width: `${nextMilestoneData.progressPercentage}%` }}
                        role="progressbar" aria-valuenow={currentLangProfile.exp} aria-valuemin={nextMilestoneData.currentLevelMilestone} aria-valuemax={nextMilestoneData.nextLevelMilestone}></div>
                    </div>
                  )}
                   {nextMilestoneData && <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">{nextMilestoneData.remainingExp.toLocaleString()} EXP to next milestone.</p>}
                </div>
                <div>
                  <h4 className="text-md font-medium text-neutral-darker dark:text-secondary-light mb-2">Badges Earned:</h4>
                  {earnedBadges.length > 0 ? (
                    <div className="flex flex-wrap gap-3">
                      {earnedBadges.map(badge => (
                        <div key={badge.id} title={`${badge.name}: ${badge.description} (Earned at ${badge.expThreshold} EXP)`} className="flex flex-col items-center p-2 bg-neutral-light dark:bg-neutral-dark rounded-md shadow text-center w-20 h-24 justify-center">
                           <span className="text-3xl mb-1">{badge.icon}</span>
                           <span className="text-xs font-medium text-neutral-darker dark:text-secondary-light truncate w-full">{badge.name}</span>
                        </div>
                      ))}
                    </div>
                  ) : <p className="text-sm text-neutral-500 dark:text-neutral-400">No badges earned yet. Keep learning!</p>}
                </div>
              </div>
              <div className="p-4 bg-secondary/50 dark:bg-neutral-dark/30 rounded-lg">
                <h3 className="text-lg font-semibold text-neutral-darker dark:text-secondary-light mb-3">Learning Activities for {LANGUAGE_OPTIONS.find(l=>l.code === selectedLanguage)?.name}</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {([
                        { type: 'listening', label: '🎧 Listening Practice', desc: 'Hone your comprehension.' },
                        { type: 'speaking', label: '🗣️ Speaking Practice', desc: 'Improve pronunciation.' },
                        { type: 'vocabulary', label: '📖 Vocabulary Builder', desc: 'Expand your word bank.' },
                        { type: 'quiz', label: '✍️ Quizzes & Challenges', desc: 'Test your knowledge.' },
                    ] as { type: LanguageLearningActivityType; label: string; desc: string }[]).map(act => (
                        <button key={act.type} onClick={() => handleActivitySelect(act.type)} className="p-4 bg-primary hover:bg-primary-dark text-white rounded-lg transition-colors text-left">
                            <h4 className="font-semibold text-md">{act.label}</h4>
                            <p className="text-sm opacity-80">{act.desc}</p>
                        </button>
                    ))}
                </div>
              </div>
            </>
          )}

          {activeActivityType && selectedLanguage && (
            <div className="p-4 border border-primary/50 dark:border-primary-light/50 rounded-lg">
              <h3 className="text-xl font-semibold text-primary dark:text-primary-light mb-4 capitalize">
                {activeActivityType.replace('_', ' ')} Practice in {LANGUAGE_OPTIONS.find(l=>l.code === selectedLanguage)?.name}
              </h3>
              {activityState.isLoadingContent && <p className="text-neutral-600 dark:text-neutral-300 animate-pulse">Loading exercise...</p>}
              {activityState.error && !activityState.isLoadingContent && <p className="text-red-500 dark:text-red-400">Error: {activityState.error}</p>}
              
              {!activityState.isLoadingContent && !activityState.error && activityState.content && (
                <div className="space-y-4">
                  {activeActivityType === 'listening' && activityState.content.script && (
                    <>
                      <p className="text-sm text-neutral-500 dark:text-neutral-400">{activityState.content.instruction || "Listen to the audio and answer the question below."}</p>
                      {activityState.audioUrl && (
                        <button onClick={handlePlayAudio} className="flex items-center px-4 py-2 my-2 bg-accent hover:bg-accent-dark text-white rounded-md transition-colors" aria-label={activityState.isAudioPlaying ? "Stop audio" : "Play audio"}>
                            {activityState.isAudioPlaying ? <StopCircleIcon className="w-5 h-5 mr-2"/> : <SpeakerWaveIcon className="w-5 h-5 mr-2"/>}
                            {activityState.isAudioPlaying ? 'Stop' : 'Play Audio Script'}
                        </button>
                      )}
                      <p className="font-medium text-neutral-700 dark:text-neutral-200 mt-2">{activityState.content.question}</p>
                      <div className="space-y-2 mt-2">
                        {activityState.content.options?.map((option, index) => (
                          <button key={index} onClick={() => handleAnswerSelect(index, 'listening')} disabled={activityState.isAnswerSubmitted}
                            className={`w-full text-left p-3 border rounded-md transition-colors ${activityState.userAnswer === index ? 'bg-primary-light/30 dark:bg-primary-dark/40 border-primary dark:border-primary-light' : 'bg-secondary/70 dark:bg-neutral-dark/50 border-secondary dark:border-neutral-darkest hover:bg-secondary dark:hover:bg-neutral-dark'} ${activityState.isAnswerSubmitted ? 'opacity-70 cursor-not-allowed' : ''}`}>
                            {String.fromCharCode(65 + index)}. {option}
                          </button>
                        ))}
                      </div>
                      {activityState.isAnswerSubmitted && (
                        <div className={`mt-3 p-3 rounded-md text-sm ${activityState.isAnswerCorrect ? 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300' : 'bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300'}`}>
                          {activityState.isAnswerCorrect ? <CheckCircleIcon className="inline w-5 h-5 mr-1 align-text-bottom" /> : <XCircleIcon className="inline w-5 h-5 mr-1 align-text-bottom" />}
                          {activityState.isAnswerCorrect ? 'Correct!' : `Incorrect. The correct answer was: ${String.fromCharCode(65 + (activityState.content.correctAnswerIndex ?? 0))}. ${activityState.content.options?.[activityState.content.correctAnswerIndex ?? 0] ?? ''}`}
                        </div>
                      )}
                      <button onClick={activityState.isAnswerSubmitted ? fetchListeningExercise : () => handleSubmitAnswer('listening')} disabled={activityState.userAnswer === null && !activityState.isAnswerSubmitted}
                        className="mt-4 px-5 py-2 bg-primary hover:bg-primary-dark text-white rounded-md transition-colors disabled:opacity-50">
                        {activityState.isAnswerSubmitted ? 'Next Question' : 'Submit Answer'}
                      </button>
                    </>
                  )}
                  {activeActivityType === 'speaking' && activityState.content.phraseToSpeak && (
                     <>
                      <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-2">Read the following phrase aloud:</p>
                      <p className="text-lg font-semibold p-3 bg-secondary dark:bg-neutral-darkest rounded-md text-neutral-800 dark:text-neutral-100 my-2">"{activityState.content.phraseToSpeak}"</p>
                      <button onClick={handleToggleRecording} disabled={activityState.isLoadingContent}
                        className={`flex items-center px-4 py-2 my-2 rounded-md transition-colors ${isRecording ? 'bg-red-500 hover:bg-red-600 text-white' : 'bg-accent hover:bg-accent-dark text-white'}`}>
                        <MicrophoneIcon className="w-5 h-5 mr-2"/>
                        {isRecording ? 'Stop Recording' : (transcribedText ? 'Record Again' : 'Start Recording')}
                      </button>
                      {transcribedText && !isRecording && (
                        <div className="mt-2 p-2 border border-secondary dark:border-neutral-darkest rounded-md">
                            <p className="text-sm text-neutral-500 dark:text-neutral-400">You said:</p>
                            <p className="italic text-neutral-700 dark:text-neutral-300">"{transcribedText}"</p>
                        </div>
                      )}
                      {activityState.isAnswerSubmitted && activityState.error && ( 
                        <div className={`mt-3 p-3 rounded-md text-sm ${activityState.isAnswerCorrect ? 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300' : 'bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300'}`}>
                          {activityState.isAnswerCorrect ? <CheckCircleIcon className="inline w-5 h-5 mr-1 align-text-bottom" /> : <XCircleIcon className="inline w-5 h-5 mr-1 align-text-bottom" />}
                          {activityState.error} 
                        </div>
                      )}
                      <button onClick={activityState.isAnswerSubmitted ? fetchSpeakingExercise : handleSubmitSpeakingAnswer} disabled={transcribedText === null || activityState.isLoadingContent || isRecording}
                        className="mt-4 px-5 py-2 bg-primary hover:bg-primary-dark text-white rounded-md transition-colors disabled:opacity-50">
                        {activityState.isAnswerSubmitted ? 'Next Phrase' : 'Submit Recording'}
                      </button>
                    </>
                  )}
                  {activeActivityType === 'vocabulary' && activityState.content?.vocabularySet && (
                    <div className="space-y-3">
                        {activityState.content.vocabularySet.map((item, index) => (
                            <div key={index} className="p-3 border border-secondary dark:border-neutral-darkest rounded-lg bg-secondary/30 dark:bg-neutral-dark/20">
                                <h4 className="text-lg font-semibold text-primary dark:text-primary-light">{item.word}</h4>
                                <p className="text-sm text-neutral-600 dark:text-neutral-300">Meaning: {item.meaning}</p>
                                <p className="text-sm text-neutral-600 dark:text-neutral-300 mt-1">Example: <em className="italic">{item.exampleSentence}</em></p>
                            </div>
                        ))}
                        <button onClick={() => { onAddExp(selectedLanguage, 10); fetchVocabularySet(); }}
                            className="mt-4 px-5 py-2 bg-primary hover:bg-primary-dark text-white rounded-md transition-colors flex items-center">
                            <ArrowPathIcon className="w-4 h-4 mr-2" /> Next Set (+10 EXP)
                        </button>
                    </div>
                  )}
                  {activeActivityType === 'quiz' && activityState.content?.question && (
                     <>
                      <p className="font-medium text-neutral-700 dark:text-neutral-200 mt-2">{activityState.content.question}</p>
                      <div className="space-y-2 mt-2">
                        {activityState.content.options?.map((option, index) => (
                          <button key={index} onClick={() => handleAnswerSelect(index, 'quiz')} disabled={activityState.isAnswerSubmitted}
                            className={`w-full text-left p-3 border rounded-md transition-colors ${activityState.userAnswer === index ? 'bg-primary-light/30 dark:bg-primary-dark/40 border-primary dark:border-primary-light' : 'bg-secondary/70 dark:bg-neutral-dark/50 border-secondary dark:border-neutral-darkest hover:bg-secondary dark:hover:bg-neutral-dark'} ${activityState.isAnswerSubmitted ? 'opacity-70 cursor-not-allowed' : ''}`}>
                            {String.fromCharCode(65 + index)}. {option}
                          </button>
                        ))}
                      </div>
                      {activityState.isAnswerSubmitted && (
                        <div className={`mt-3 p-3 rounded-md text-sm ${activityState.isAnswerCorrect ? 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300' : 'bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300'}`}>
                          {activityState.isAnswerCorrect ? <CheckCircleIcon className="inline w-5 h-5 mr-1 align-text-bottom" /> : <XCircleIcon className="inline w-5 h-5 mr-1 align-text-bottom" />}
                          {activityState.isAnswerCorrect ? 'Correct!' : `Incorrect. The correct answer was: ${String.fromCharCode(65 + (activityState.content.correctAnswerIndex ?? 0))}. ${activityState.content.options?.[activityState.content.correctAnswerIndex ?? 0] ?? ''}`}
                        </div>
                      )}
                      <button onClick={activityState.isAnswerSubmitted ? fetchQuizQuestion : () => handleSubmitAnswer('quiz')} disabled={activityState.userAnswer === null && !activityState.isAnswerSubmitted}
                        className="mt-4 px-5 py-2 bg-primary hover:bg-primary-dark text-white rounded-md transition-colors disabled:opacity-50">
                        {activityState.isAnswerSubmitted ? 'Next Question' : 'Submit Answer'}
                      </button>
                    </>
                  )}
                  <button onClick={resetActivity} className="mt-4 ml-2 px-4 py-2 bg-secondary dark:bg-neutral-darkest hover:bg-secondary-dark dark:hover:bg-neutral-dark text-neutral-darker dark:text-secondary-light rounded-md text-sm">
                    Back to Activities Menu
                  </button>
                </div>
              )}
            </div>
          )}
          {!selectedLanguage && !activeActivityType && (
            <p className="text-center text-neutral-500 dark:text-neutral-400 py-10">Please select a language to see your progress and start learning.</p>
          )}
        </div>

        <div className="p-4 sm:p-6 border-t border-secondary dark:border-neutral-darkest">
          <button onClick={onClose}
            className="w-full px-4 py-2.5 bg-primary hover:bg-primary-dark dark:bg-primary-light dark:hover:bg-primary text-white dark:text-neutral-darker rounded-md text-sm font-medium focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-neutral-light dark:ring-offset-neutral-darker focus:ring-primary-dark transition-colors">
            Close Language Hub
          </button>
        </div>
      </div>
    </div>
  );
};

export default LanguageLearningModal;
