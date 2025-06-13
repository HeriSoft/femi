
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
    ApiChatMessage,
    UserGlobalProfile,
    Part 
} from '../types.ts';
import { XMarkIcon, AcademicCapIcon, SpeakerWaveIcon, StopCircleIcon, CheckCircleIcon, XCircleIcon, MicrophoneIcon, ArrowPathIcon, GlobeAltIcon, PencilIcon, CameraIcon, TrashIcon } from './Icons.tsx';
import { LANGUAGE_OPTIONS, BADGES_CATALOG, DEFAULT_USER_LANGUAGE_PROFILE, getNextMilestone } from '../constants.ts';
import { useNotification } from '../contexts/NotificationContext.tsx';
import { sendOpenAIMessageStream } from '../services/openaiService.ts'; 
import { sendGeminiMessageStream } from '../services/geminiService.ts';
import { generateOpenAITTS, ProxiedOpenAITtsParams } from '../services/openaiTTSService.ts';
import HandwritingCanvas from './HandwritingCanvas.tsx';
import type { Content } from '@google/genai';


const INITIAL_ACTIVITY_STATE: LearningActivityState = {
    isLoadingContent: false,
    content: null,
    error: null,
    userAnswer: null,
    userSelectedWordIds: [],
    isAnswerSubmitted: false,
    isAnswerCorrect: null,
    audioUrl: undefined,
    isAudioPlaying: false,
    translatedUserSpeech: undefined,
    isLoadingTranslation: false,
    userHandwritingImage: undefined,
    accuracyScore: undefined,
    aiFeedback: undefined,
    handwritingInputMethod: 'draw',
};

const MAX_PREVIOUS_ITEMS_TO_AVOID = 5;


const LanguageLearningModal: React.FC<LanguageLearningModalProps> = ({
  isOpen,
  onClose,
  userProfile,
  userSession, // Added userSession
  onUpdateProfile,
  onAddExp,
}) => {
  const [selectedLanguage, setSelectedLanguage] = useState<LanguageOption | null>(null);
  const [activeActivityType, setActiveActivityType] = useState<LanguageLearningActivityType | null>(null);
  const [activityState, setActivityState] = useState<LearningActivityState>(INITIAL_ACTIVITY_STATE);
  const { addNotification } = useNotification();
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [transcribedText, setTranscribedText] = useState<string | null>(null);
  
  const [previousQuizQuestions, setPreviousQuizQuestions] = useState<string[]>([]);
  const [previousListeningScripts, setPreviousListeningScripts] = useState<string[]>([]);
  const [previousSpeakingPhrases, setPreviousSpeakingPhrases] = useState<string[]>([]);
  const [previousScrambledSentences, setPreviousScrambledSentences] = useState<string[]>([]);
  const [previousHandwritingTargets, setPreviousHandwritingTargets] = useState<string[]>([]);

  const handwritingCanvasRef = useRef<HTMLCanvasElement>(null);
  const handwritingImageUploadRef = useRef<HTMLInputElement>(null);


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
        setPreviousScrambledSentences([]);
        setPreviousHandwritingTargets([]);
        if (audioPlayerRef.current) {
            audioPlayerRef.current.pause();
            audioPlayerRef.current.src = '';
        }
    }
  }, [isOpen, userProfile, selectedLanguage]);

  const translateTranscribedText = async (textToTranslate: string, sourceLang: LanguageOption, targetLang: LanguageOption) => {
    if (!textToTranslate.trim() || sourceLang === targetLang) {
        setActivityState(prev => ({...prev, translatedUserSpeech: textToTranslate, isLoadingTranslation: false}));
        return;
    }
    setActivityState(prev => ({...prev, isLoadingTranslation: true, translatedUserSpeech: undefined }));
    const sourceLangName = LANGUAGE_OPTIONS.find(l => l.code === sourceLang)?.name || sourceLang;
    const targetLangName = LANGUAGE_OPTIONS.find(l => l.code === targetLang)?.name || targetLang;
    const translationPrompt = `Translate the following text from ${sourceLangName} to ${targetLangName}.
Only return the translated text as a plain string, without any additional explanations, prefixes like "Translation:", or markdown.
Original text: "${textToTranslate}"`;

    try {
        const modelIdentifier = getActualModelIdentifier(Model.GPT4O_MINI);
        const history: ApiChatMessage[] = [
            { role: 'system', content: 'You are an AI assistant that provides direct translations as plain text strings.' },
            { role: 'user', content: translationPrompt }
        ];
        const stream = sendOpenAIMessageStream({ 
            modelIdentifier, 
            history, 
            modelSettings: { temperature: 0.2, topK: 1, topP: 0.9, systemInstruction: "Translate text directly." },
            userSession // Pass userSession
        });
        
        let translatedText = "";
        for await (const chunk of stream) {
            if (chunk.error) throw new Error(chunk.error);
            if (chunk.textDelta) translatedText += chunk.textDelta;
            if (chunk.isFinished) break;
        }
        setActivityState(prev => ({...prev, translatedUserSpeech: translatedText.trim(), isLoadingTranslation: false}));
    } catch (error: any) {
        addNotification(`Failed to translate speech: ${error.message}`, 'error');
        setActivityState(prev => ({...prev, isLoadingTranslation: false, error: `Translation error: ${error.message}`}));
    }
  };


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
    const langForRecognition = selectedLanguage || 'en-US';
    recognition.lang = langForRecognition;


    recognition.onresult = (event: SpeechRecognitionEvent) => {
      const transcript = event.results[0][0].transcript;
      setTranscribedText(transcript);
      setActivityState(prev => ({ ...prev, userAnswer: transcript, isAnswerSubmitted: false, isAnswerCorrect: null, translatedUserSpeech: undefined, isLoadingTranslation: false }));
      setIsRecording(false);

      if (userProfile?.favoriteLanguage && selectedLanguage && transcript) {
        if (userProfile.favoriteLanguage !== selectedLanguage) {
            translateTranscribedText(transcript, selectedLanguage, userProfile.favoriteLanguage);
        } else {
            setActivityState(prev => ({...prev, translatedUserSpeech: transcript, isLoadingTranslation: false}));
        }
      }
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
  }, [isOpen, activeActivityType, selectedLanguage, addNotification, isRecording, userProfile?.favoriteLanguage]);


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
    setPreviousScrambledSentences([]);
    setPreviousHandwritingTargets([]);
    if (userProfile && !userProfile.languageProfiles[langCode]) {
      const updatedProfile: UserGlobalProfile = {
        ...userProfile,
        languageProfiles: {
          ...(userProfile.languageProfiles || {}),
          [langCode]: { ...DEFAULT_USER_LANGUAGE_PROFILE }
        }
      };
      onUpdateProfile(updatedProfile);
    }
  };

  const handleFavoriteLanguageChange = (langCode: LanguageOption | "") => {
    if (userProfile) {
        const updatedProfile: UserGlobalProfile = {
            ...userProfile,
            favoriteLanguage: langCode === "" ? undefined : langCode,
        };
        onUpdateProfile(updatedProfile);
        addNotification(`Favorite translation language set to ${LANGUAGE_OPTIONS.find(l=>l.code===langCode)?.name || 'None'}.`, 'info');
    }
  };

  const parseAIJsonResponse = async (stream: AsyncGenerator<any, void, undefined>, activityName: string) => {
    let fullResponse = "";
    for await (const chunk of stream) {
        if (chunk.error) throw new Error(chunk.error);
        if (chunk.textDelta) fullResponse += chunk.textDelta;
        if (chunk.imagePart) {
          console.warn(`[${activityName}] Received unexpected image part from AI.`);
        }
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
      const modelIdentifier = getActualModelIdentifier(Model.GEMINI); 
      const history: Content[] = [{ role: 'user', parts: [{ text: prompt }] }];
      const stream = sendGeminiMessageStream({ 
          modelName: modelIdentifier,
          historyContents: history, 
          modelSettings: { temperature: 0.6, topK: 50, topP: 0.95, systemInstruction: "You are an AI assistant specialized in creating language learning exercises as JSON. You MUST AVOID REPEATING content if told to do so in the prompt. Respond with application/json." },
          enableGoogleSearch: false,
          userSession // Pass userSession
      });
      const parsedContent = await parseAIJsonResponse(stream, "listening exercise");
      
      if (!parsedContent.script || !parsedContent.question || !parsedContent.options || parsedContent.correctAnswerIndex === undefined) {
        throw new Error("AI response is missing required fields for the listening exercise.");
      }
      const learningContent: LearningContent = {
        id: `listen-${Date.now()}`, activityType: 'listening', language: selectedLanguage,
        script: parsedContent.script, question: parsedContent.question, options: parsedContent.options, correctAnswerIndex: parsedContent.correctAnswerIndex,
      };
      const ttsParams: ProxiedOpenAITtsParams = { 
        modelIdentifier: 'tts-1', 
        textInput: learningContent.script!, 
        voice: 'nova', 
        speed: 1.0,
        userSession // Pass userSession for TTS
      };
      const ttsResult = await generateOpenAITTS(ttsParams);
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
        const modelIdentifier = getActualModelIdentifier(Model.GEMINI);
        const history: Content[] = [{ role: 'user', parts: [{ text: prompt }] }];
        const stream = sendGeminiMessageStream({ 
            modelName: modelIdentifier,
            historyContents: history, 
            modelSettings: { temperature: 0.6, topK: 50, topP: 0.95, systemInstruction: "You are an AI assistant specialized in creating language learning exercises as JSON. Respond with application/json." },
            enableGoogleSearch: false,
            userSession // Pass userSession
        });
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
    const prompt = `Generate a set of 5 unique beginner-level vocabulary words in ${langName}.
Ensure these words are distinct and suitable for a beginner.
For each word, provide:
1. The "word" in ${langName}.
2. Its "meaning" in English.
3. An "exampleSentence" using the word in ${langName}.
Return the response as a single, valid JSON object with a "vocabularySet" key, which is an array of these word objects.
Example for one word: {"word": "こんにちは", "meaning": "Hello / Good afternoon", "exampleSentence": "こんにちは、田中さん。"}`;
    try {
        const modelIdentifier = getActualModelIdentifier(Model.GEMINI);
        const history: Content[] = [{ role: 'user', parts: [{text: prompt}] }];
        const stream = sendGeminiMessageStream({ 
            modelName: modelIdentifier,
            historyContents: history, 
            modelSettings: { temperature: 0.6, topK: 50, topP: 0.95, systemInstruction: "You are an AI assistant specialized in creating language learning vocabulary sets as JSON. Respond with application/json." },
            enableGoogleSearch: false,
            userSession // Pass userSession
        });
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
        const modelIdentifier = getActualModelIdentifier(Model.GEMINI);
        const history: Content[] = [{ role: 'user', parts: [{text: prompt}] }];
        const stream = sendGeminiMessageStream({ 
            modelName: modelIdentifier,
            historyContents: history, 
            modelSettings: { temperature: 0.7, topK: 50, topP: 0.95, systemInstruction: "You are an AI that creates diverse quiz questions in JSON. You MUST AVOID REPEATING questions or their core concepts if told to do so in the prompt. Respond with application/json." },
            enableGoogleSearch: false,
            userSession // Pass userSession
        });
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

  const fetchSentenceScrambleExercise = async () => {
    if (!selectedLanguage) return;
    setActiveActivityType('sentence-scramble');
    setActivityState({ ...INITIAL_ACTIVITY_STATE, isLoadingContent: true, userAnswer: '' });
    const langName = LANGUAGE_OPTIONS.find(l => l.code === selectedLanguage)?.name || 'the selected language';

    let previousContentContext = "The new sentence and its units MUST be different from previous ones. ";
    if (previousScrambledSentences.length > 0) {
        previousContentContext += `DO NOT REPEAT these exact sentences or sentences with the same core meaning/structure:\n${previousScrambledSentences.map((s) => `- "${s.substring(0, 100)}${s.length > 100 ? '...' : ''}"`).join('\n')}`;
    }

    const prompt = `Generate a NEW and DISTINCT simple beginner-level sentence in ${langName}.
The sentence must be grammatically correct and natural for a beginner.
${previousContentContext}
Return the response as a single, valid JSON object with two keys:
1.  "originalSentence": The full, correct sentence as a string.
2.  "sentenceUnits": An array of strings, where each string is a distinct word or meaningful segment from the original sentence. The order of units in this array should match the original sentence. These units will be scrambled by the client. Ensure there are at least 2 units and preferably 3-7 units.
Example for English: {"originalSentence": "My favorite color is blue.", "sentenceUnits": ["My", "favorite", "color", "is", "blue."]}
Example for Japanese: {"originalSentence": "これはペンです。", "sentenceUnits": ["これは", "ペンです。"]}
Another Japanese example: {"originalSentence": "私の名前は田中です。", "sentenceUnits": ["私の名前は", "田中です。"]}`;

    try {
        const modelIdentifier = getActualModelIdentifier(Model.GEMINI);
        const history: Content[] = [{role: 'user', parts: [{text: prompt}]}];
        const stream = sendGeminiMessageStream({ 
            modelName: modelIdentifier,
            historyContents: history, 
            modelSettings: { temperature: 0.65, topK: 50, topP: 0.95, systemInstruction: "You are an AI assistant specialized in creating language learning sentences as JSON. Ensure sentences are grammatically correct and natural for beginners. You MUST AVOID REPEATING content if told to do so in the prompt. For Japanese, Korean, and Chinese, ensure sentenceUnits are meaningful segments. Respond with application/json." },
            enableGoogleSearch: false,
            userSession // Pass userSession
        });
        const parsedContent = await parseAIJsonResponse(stream, "sentence scramble exercise");

        if (!parsedContent.originalSentence || typeof parsedContent.originalSentence !== 'string' || parsedContent.originalSentence.trim() === '' ||
            !parsedContent.sentenceUnits || !Array.isArray(parsedContent.sentenceUnits) || parsedContent.sentenceUnits.length < 2 ||
            !parsedContent.sentenceUnits.every((u: any) => typeof u === 'string' && u.trim() !== '')) {
            console.error("Invalid content from AI for sentence scramble:", parsedContent);
            throw new Error("AI response for sentence scramble is missing or has invalid 'originalSentence' or 'sentenceUnits'. Sentence units must be an array of at least 2 non-empty strings.");
        }

        const original = parsedContent.originalSentence.trim();
        let words = parsedContent.sentenceUnits.map((unit: string, i: number) => ({ word: unit, id: i }));
        
        let scrambledWordsWithObjects;
        let attempts = 0;
        const maxAttempts = 10; 
        do {
            scrambledWordsWithObjects = [...words].sort(() => Math.random() - 0.5);
            attempts++;
        } while (scrambledWordsWithObjects.map(item => item.word).join('') === words.map(item => item.word).join('') && attempts < maxAttempts && words.length > 1);
        
        if (scrambledWordsWithObjects.map(item => item.word).join('') === words.map(item => item.word).join('') && words.length > 1) {
            [scrambledWordsWithObjects[0], scrambledWordsWithObjects[1]] = [scrambledWordsWithObjects[1], scrambledWordsWithObjects[0]];
        }

        setActivityState(prev => ({
            ...prev,
            isLoadingContent: false,
            content: {
                id: `scramble-${Date.now()}`,
                activityType: 'sentence-scramble',
                language: selectedLanguage,
                originalSentence: original,
                scrambledWords: scrambledWordsWithObjects,
            },
            userAnswer: '', 
            userSelectedWordIds: [], 
            error: null
        }));
        setPreviousScrambledSentences(prev => [original, ...prev].slice(0, MAX_PREVIOUS_ITEMS_TO_AVOID));

    } catch (error: any) {
        addNotification(error.message || "Failed to fetch sentence scramble exercise.", 'error');
        setActivityState(prev => ({ ...prev, isLoadingContent: false, error: error.message || "Failed to load exercise." }));
    }
  };

  const fetchHandwritingTarget = async () => {
    if (!selectedLanguage) return;
    setActiveActivityType('handwriting');
    setActivityState({ ...INITIAL_ACTIVITY_STATE, isLoadingContent: true, handwritingInputMethod: 'draw' });
    const langName = LANGUAGE_OPTIONS.find(l => l.code === selectedLanguage)?.name || 'the selected language';

    let previousContentContext = "The new character or word MUST be different. ";
    if (previousHandwritingTargets.length > 0) {
        previousContentContext += `DO NOT REPEAT these exact targets:\n${previousHandwritingTargets.map((t) => `- "${t}"`).join('\n')}`;
    }

    const prompt = `Generate a NEW and DISTINCT simple beginner-level character or very short word (1-3 characters max) in ${langName} for a handwriting practice exercise.
${previousContentContext}
Return the response as a single, valid JSON object with a "targetText" key. Example: {"targetText": "猫"}`;

    try {
        const modelIdentifier = getActualModelIdentifier(Model.GEMINI);
        const history: Content[] = [{ role: 'user', parts: [{ text: prompt }] }];
        const stream = sendGeminiMessageStream({
            modelName: modelIdentifier,
            historyContents: history,
            modelSettings: { temperature: 0.6, topK: 50, topP: 0.95, systemInstruction: "You are an AI assistant creating handwriting targets as JSON. Respond with application/json." },
            enableGoogleSearch: false,
            userSession // Pass userSession
        });
        const parsedContent = await parseAIJsonResponse(stream, "handwriting target");
        if (!parsedContent.targetText || typeof parsedContent.targetText !== 'string' || parsedContent.targetText.trim() === '') {
            throw new Error("AI response is missing or has invalid 'targetText' for handwriting practice.");
        }
        setActivityState(prev => ({
            ...prev,
            isLoadingContent: false,
            content: {
                id: `handwriting-${Date.now()}`,
                activityType: 'handwriting',
                language: selectedLanguage,
                targetText: parsedContent.targetText,
            },
            error: null,
            userHandwritingImage: undefined,
            accuracyScore: undefined,
            aiFeedback: undefined,
            isAnswerSubmitted: false,
        }));
        setPreviousHandwritingTargets(prev => [parsedContent.targetText, ...prev].slice(0, MAX_PREVIOUS_ITEMS_TO_AVOID));
    } catch (error: any) {
        addNotification(error.message || "Failed to fetch handwriting target.", 'error');
        setActivityState(prev => ({ ...prev, isLoadingContent: false, error: error.message || "Failed to load target." }));
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
        setActivityState(prev => ({ ...prev, userAnswer: null, isAnswerSubmitted: false, isAnswerCorrect: null, translatedUserSpeech: undefined, isLoadingTranslation: false }));
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
        const modelIdentifier = getActualModelIdentifier(Model.GEMINI);
        const history: Content[] = [{role: 'user', parts: [{text: evaluationPrompt}]}];
        const stream = sendGeminiMessageStream({ 
            modelName: modelIdentifier,
            historyContents: history, 
            modelSettings: { temperature: 0.3, topK: 50, topP: 0.95, systemInstruction: "You are an AI language learning evaluator. Respond with application/json." },
            enableGoogleSearch: false,
            userSession // Pass userSession
        });
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

  const handleScrambledWordClick = (wordItem: { word: string, id: number }) => {
    if (activityState.isAnswerSubmitted || activityState.userSelectedWordIds?.includes(wordItem.id)) return;
    
    let needsSpace = false;
    if (selectedLanguage === 'en' || selectedLanguage === 'vi') { 
        needsSpace = true;
    }

    setActivityState(prev => {
        const currentAnswer = prev.userAnswer as string;
        let newAnswer;
        if (currentAnswer && needsSpace) {
            newAnswer = `${currentAnswer} ${wordItem.word}`;
        } else if (currentAnswer && !needsSpace) {
            newAnswer = `${currentAnswer}${wordItem.word}`;
        }
        else {
            newAnswer = wordItem.word;
        }
        
        return {
            ...prev,
            userAnswer: newAnswer,
            userSelectedWordIds: [...(prev.userSelectedWordIds || []), wordItem.id]
        };
    });
  };

  const handleClearSentenceAttempt = () => {
    setActivityState(prev => ({
        ...prev,
        userAnswer: '',
        userSelectedWordIds: [],
        isAnswerSubmitted: false,
        isAnswerCorrect: null,
    }));
  };

  const handleSubmitSentenceScramble = () => {
    if (!activityState.content?.originalSentence || !selectedLanguage || typeof activityState.userAnswer !== 'string') return;
    
    const userAnswerString = (activityState.userAnswer as string).trim();
    const originalSentenceNormalized = activityState.content.originalSentence.trim();
    
    const normalize = (str: string, lang: LanguageOption) => {
        let normalized = str.toLowerCase();
        normalized = normalized.replace(/[.,!?;:"“”・。、！？]/g, ''); 
        if (lang === 'ja' || lang === 'zh' || lang === 'ko') {
            normalized = normalized.replace(/\s+/g, '');
        } else {
            normalized = normalized.replace(/\s+/g, ' ').trim();
        }
        return normalized;
    };
    
    const isCorrect = normalize(userAnswerString, selectedLanguage) === normalize(originalSentenceNormalized, selectedLanguage);

    setActivityState(prev => ({ ...prev, isAnswerSubmitted: true, isAnswerCorrect: isCorrect }));
    const expPoints = 25;
    if (isCorrect) {
        onAddExp(selectedLanguage, expPoints);
        addNotification(`Excellent! +${expPoints} EXP`, 'success');
    } else {
        addNotification("Not quite right. Check the order or words.", 'error');
    }
  };

  const handleHandwritingImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
        if (file.size > 2 * 1024 * 1024) {
            addNotification("Image file is too large. Max 2MB.", "error");
            return;
        }
        const reader = new FileReader();
        reader.onloadend = () => {
            setActivityState(prev => ({ ...prev, userHandwritingImage: reader.result as string, isAnswerSubmitted: false, accuracyScore: undefined, aiFeedback: undefined }));
        };
        reader.readAsDataURL(file);
    }
    if (handwritingImageUploadRef.current) handwritingImageUploadRef.current.value = "";
  };

  const handleSubmitHandwriting = async () => {
    if (!selectedLanguage || !activityState.content?.targetText) return;
    
    let imageDataUrl = activityState.userHandwritingImage;
    let finalMimeType = 'image/png'; 

    if (activityState.handwritingInputMethod === 'draw' && handwritingCanvasRef.current) {
        imageDataUrl = handwritingCanvasRef.current.toDataURL('image/png');
        finalMimeType = 'image/png';
    } else if (activityState.handwritingInputMethod === 'upload' && imageDataUrl) {
        const detectedMimeType = imageDataUrl.substring(imageDataUrl.indexOf(':') + 1, imageDataUrl.indexOf(';'));
        if (detectedMimeType) finalMimeType = detectedMimeType;
    }
    
    if (!imageDataUrl) {
        addNotification("Please provide your handwriting (draw or upload).", "error");
        setActivityState(prev => ({ ...prev, isLoadingContent: false }));
        return;
    }
    
    const base64ImageData = imageDataUrl.split(',')[1];
    if (!base64ImageData) {
        addNotification("Invalid image data (empty after splitting prefix).", "error");
        setActivityState(prev => ({ ...prev, isLoadingContent: false, error: "Invalid image data." }));
        return;
    }

    if (activityState.handwritingInputMethod === 'draw' && base64ImageData.length < 200) { 
    }

    setActivityState(prev => ({ ...prev, isLoadingContent: true, error: null, accuracyScore: undefined, aiFeedback: undefined }));
    const langName = LANGUAGE_OPTIONS.find(l => l.code === selectedLanguage)?.name || 'the selected language';
    const evaluationPromptText = `You are a handwriting evaluation expert for ${langName}.
The user is practicing writing the target: "${activityState.content.targetText}".
Analyze the provided image of the user's handwriting.
Evaluate the accuracy based on stroke shape, proportions, and overall legibility compared to a standard form of "${activityState.content.targetText}".
Provide:
1. "accuracyScore": A numerical percentage (0-100) representing the handwriting accuracy. If no handwriting is detected or the image is blank, accuracyScore should be 0.
2. "feedback": Brief, constructive feedback. If no handwriting is detected, the feedback should state that clearly (e.g., "No handwriting was detected in the provided image. Please ensure the image clearly shows the handwriting.").
Return the response as a single, valid JSON object like this: {"accuracyScore": 85, "feedback": "The character is recognizable. Improve the consistency of stroke thickness."}
Another example for no handwriting: {"accuracyScore": 0, "feedback": "No handwriting was detected in the provided image. Please ensure the image clearly shows the handwriting."}`;

    try {
        const modelIdentifier = getActualModelIdentifier(Model.GEMINI); 
        const history: Content[] = [{
            role: 'user',
            parts: [
                { text: evaluationPromptText },
                { inlineData: { mimeType: finalMimeType, data: base64ImageData } }
            ]
        }];
        const stream = sendGeminiMessageStream({
            modelName: modelIdentifier,
            historyContents: history,
            modelSettings: { temperature: 0.4, topK: 32, topP: 0.9, systemInstruction: "You are an AI handwriting evaluator. Respond with application/json as per user's schema." },
            enableGoogleSearch: false,
            userSession // Pass userSession
        });
        const evalResult = await parseAIJsonResponse(stream, "handwriting evaluation");

        if (typeof evalResult.accuracyScore !== 'number' || typeof evalResult.feedback !== 'string') {
            throw new Error("AI response for handwriting evaluation is malformed.");
        }
        
        const accuracy = Math.max(0, Math.min(100, evalResult.accuracyScore));
        setActivityState(prev => ({ ...prev, isLoadingContent: false, isAnswerSubmitted: true, accuracyScore: accuracy, aiFeedback: evalResult.feedback }));
        
        const expPoints = Math.round(accuracy * 0.20);
        if (accuracy > 0) { 
            onAddExp(selectedLanguage, expPoints);
            addNotification(`Evaluation: ${accuracy}% accuracy. ${evalResult.feedback} +${expPoints} EXP!`, 'success');
        } else {
             addNotification(`Evaluation: ${accuracy}% accuracy. ${evalResult.feedback}`, 'info');
        }

    } catch (error: any) {
        addNotification(error.message || "Failed to evaluate handwriting.", 'error');
        setActivityState(prev => ({ ...prev, isLoadingContent: false, error: error.message || "Evaluation failed." }));
    }
  };


  const handleActivitySelect = (type: LanguageLearningActivityType) => {
    setActivityState(INITIAL_ACTIVITY_STATE); 
    switch (type) {
        case 'listening': fetchListeningExercise(); break;
        case 'speaking': fetchSpeakingExercise(); break;
        case 'vocabulary': fetchVocabularySet(); break;
        case 'quiz': fetchQuizQuestion(); break;
        case 'sentence-scramble': fetchSentenceScrambleExercise(); break;
        case 'handwriting': fetchHandwritingTarget(); break;
        default: setActiveActivityType(null); setActivityState(INITIAL_ACTIVITY_STATE);
    }
  };

  const resetActivity = () => {
    setActiveActivityType(null);
    setActivityState(INITIAL_ACTIVITY_STATE);
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
        className="bg-neutral-light dark:bg-neutral-darker rounded-lg shadow-xl w-full max-w-xs sm:max-w-md md:max-w-lg lg:max-w-xl max-h-[90vh] flex flex-col transform transition-all duration-300 scale-100 opacity-100"
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="language-select" className="block text-sm font-medium text-neutral-darker dark:text-secondary-light mb-1">Choose a Language to Learn:</label>
                <select id="language-select" value={selectedLanguage || ''} onChange={(e) => handleLanguageSelect(e.target.value as LanguageOption)}
                  className="w-full p-2.5 border border-secondary dark:border-neutral-darkest rounded-md bg-neutral-light dark:bg-neutral-dark focus:ring-primary dark:focus:ring-primary-light focus:border-primary dark:focus:border-primary-light outline-none text-neutral-darker dark:text-secondary-light">
                  <option value="" disabled>Select a language</option>
                  {LANGUAGE_OPTIONS.map(lang => (<option key={lang.code} value={lang.code}>{lang.flag} {lang.name}</option>))}
                </select>
              </div>
              <div>
                <label htmlFor="favorite-language-select" className="block text-sm font-medium text-neutral-darker dark:text-secondary-light mb-1">
                    <GlobeAltIcon className="w-4 h-4 inline mr-1" /> Favorite Language (for Translation):
                </label>
                <select 
                    id="favorite-language-select" 
                    value={userProfile?.favoriteLanguage || ''} 
                    onChange={(e) => handleFavoriteLanguageChange(e.target.value as LanguageOption | "")}
                    className="w-full p-2.5 border border-secondary dark:border-neutral-darkest rounded-md bg-neutral-light dark:bg-neutral-dark focus:ring-primary dark:focus:ring-primary-light focus:border-primary dark:focus:border-primary-light outline-none text-neutral-darker dark:text-secondary-light"
                >
                  <option value="">None (No Translation)</option>
                  {LANGUAGE_OPTIONS.map(lang => (<option key={`fav-${lang.code}`} value={lang.code}>{lang.flag} {lang.name}</option>))}
                </select>
              </div>
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
                        { type: 'sentence-scramble', label: '🧩 Sentence Scramble', desc: 'Reorder words correctly.' },
                        { type: 'handwriting', label: '✍️ Handwriting Practice', desc: 'Practice characters & get feedback.' },
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
              <div className="flex justify-between items-start">
                <h3 className="text-xl font-semibold text-primary dark:text-primary-light mb-4 capitalize">
                    {activeActivityType.replace('-', ' ')} Practice in {LANGUAGE_OPTIONS.find(l=>l.code === selectedLanguage)?.name}
                </h3>
                {activeActivityType === 'speaking' && userProfile?.favoriteLanguage && userProfile.favoriteLanguage !== selectedLanguage && (
                    <div className="text-xs text-neutral-500 dark:text-neutral-400 mb-2 text-right">
                        <GlobeAltIcon className="w-3 h-3 inline mr-0.5" />
                        Translating to: {LANGUAGE_OPTIONS.find(l => l.code === userProfile.favoriteLanguage)?.name}
                    </div>
                )}
              </div>

              {activityState.isLoadingContent && <p className="text-neutral-600 dark:text-neutral-300 animate-pulse">Loading exercise...</p>}
              {activityState.error && !activityState.isLoadingContent && activeActivityType !== 'speaking' && activeActivityType !== 'handwriting' && !activityState.isLoadingTranslation && <p className="text-red-500 dark:text-red-400">Error: {activityState.error}</p>}
              

              {!activityState.isLoadingContent && !activityState.error && activityState.content && activeActivityType !== 'sentence-scramble' && activeActivityType !== 'handwriting' && (
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
                      <button onClick={handleToggleRecording} disabled={activityState.isLoadingContent || activityState.isLoadingTranslation}
                        className={`flex items-center px-4 py-2 my-2 rounded-md transition-colors ${isRecording ? 'bg-red-500 hover:bg-red-600 text-white' : 'bg-accent hover:bg-accent-dark text-white'}`}>
                        <MicrophoneIcon className="w-5 h-5 mr-2"/>
                        {isRecording ? 'Stop Recording' : (transcribedText ? 'Record Again' : 'Start Recording')}
                      </button>
                      {transcribedText && !isRecording && (
                        <div className="mt-2 p-2 border border-secondary dark:border-neutral-darkest rounded-md">
                            <p className="text-sm text-neutral-500 dark:text-neutral-400">You said ({LANGUAGE_OPTIONS.find(l=>l.code === selectedLanguage)?.name || 'Target Language'}):</p>
                            <p className="italic text-neutral-700 dark:text-neutral-300">"{transcribedText}"</p>
                        </div>
                      )}
                      {activityState.isLoadingTranslation && <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1 animate-pulse">Translating...</p>}
                      {activityState.translatedUserSpeech && !activityState.isLoadingTranslation && userProfile?.favoriteLanguage && (
                         <div className="mt-2 p-2 border border-secondary dark:border-neutral-darkest rounded-md bg-secondary/30 dark:bg-neutral-dark/20">
                            <p className="text-sm text-neutral-500 dark:text-neutral-400">
                                Translation ({LANGUAGE_OPTIONS.find(l => l.code === userProfile.favoriteLanguage)?.name || 'Favorite Language'}):
                            </p>
                            <p className="italic text-neutral-700 dark:text-neutral-300">"{activityState.translatedUserSpeech}"</p>
                        </div>
                      )}
                      {activityState.error && !activityState.isLoadingContent && !activityState.isLoadingTranslation && (
                        <div className={`mt-3 p-3 rounded-md text-sm ${activityState.isAnswerCorrect ? 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300' : 'bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300'}`}>
                          {activityState.isAnswerCorrect ? <CheckCircleIcon className="inline w-5 h-5 mr-1 align-text-bottom" /> : <XCircleIcon className="inline w-5 h-5 mr-1 align-text-bottom" />}
                          {activityState.error} 
                        </div>
                      )}
                       {(activityState.isLoadingContent || activityState.isLoadingTranslation) && activeActivityType === 'speaking' && !activityState.error && <p className="text-neutral-600 dark:text-neutral-300 animate-pulse mt-2">Evaluating your speech...</p>}
                      <button onClick={activityState.isAnswerSubmitted ? fetchSpeakingExercise : handleSubmitSpeakingAnswer} disabled={transcribedText === null || activityState.isLoadingContent || isRecording || activityState.isLoadingTranslation}
                        className="mt-4 px-5 py-2 bg-primary hover:bg-primary-dark text-white rounded-md transition-colors disabled:opacity-50">
                        {activityState.isAnswerSubmitted ? 'Next Phrase' : 'Submit for Evaluation'}
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

              {/* Sentence Scramble Activity UI */}
              {!activityState.isLoadingContent && activityState.content && activeActivityType === 'sentence-scramble' && (
                <div className="space-y-4">
                    <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-2">
                        Click the words in the correct order to form a sentence.
                    </p>
                    
                    <div aria-live="polite" className="min-h-[60px] p-3 mb-4 border-2 border-dashed border-secondary dark:border-neutral-darkest rounded-md bg-white dark:bg-neutral-dark text-neutral-800 dark:text-neutral-100 flex items-center">
                        {(activityState.userAnswer as string) || <span className="italic text-neutral-400 dark:text-neutral-500">Your sentence will appear here...</span>}
                    </div>

                    <div className="flex flex-wrap gap-2 mb-4 min-h-[40px]" aria-label="Scrambled words selection area">
                        {activityState.content.scrambledWords?.map((wordItem) => (
                            <button
                                key={`${wordItem.word}-${wordItem.id}`}
                                onClick={() => handleScrambledWordClick(wordItem)}
                                disabled={activityState.isAnswerSubmitted || activityState.userSelectedWordIds?.includes(wordItem.id)}
                                className={`px-3 py-1.5 border rounded-md text-sm font-medium transition-colors
                                            ${activityState.userSelectedWordIds?.includes(wordItem.id)
                                                ? 'bg-gray-300 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed line-through'
                                                : 'bg-secondary dark:bg-neutral-darkest text-primary dark:text-primary-light hover:bg-secondary-dark dark:hover:bg-neutral-dark'
                                            }
                                            disabled:opacity-50 disabled:cursor-not-allowed`}
                                aria-pressed={activityState.userSelectedWordIds?.includes(wordItem.id)}
                            >
                                {wordItem.word}
                            </button>
                        ))}
                    </div>

                    {activityState.isAnswerSubmitted && (
                        <div className={`mt-3 p-3 rounded-md text-sm ${activityState.isAnswerCorrect ? 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300' : 'bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300'}`}>
                            {activityState.isAnswerCorrect ? <CheckCircleIcon className="inline w-5 h-5 mr-1 align-text-bottom" /> : <XCircleIcon className="inline w-5 h-5 mr-1 align-text-bottom" />}
                            {activityState.isAnswerCorrect ? 'Correct!' : `Incorrect. The correct sentence was: "${activityState.content.originalSentence}"`}
                        </div>
                    )}

                    <div className="mt-4 flex flex-wrap gap-2">
                        <button 
                            onClick={activityState.isAnswerSubmitted ? fetchSentenceScrambleExercise : handleSubmitSentenceScramble}
                            disabled={!(activityState.userAnswer as string) && !activityState.isAnswerSubmitted}
                            className="px-5 py-2 bg-primary hover:bg-primary-dark text-white rounded-md transition-colors disabled:opacity-50">
                            {activityState.isAnswerSubmitted ? 'Next Sentence' : 'Submit Sentence'}
                        </button>
                        {!activityState.isAnswerSubmitted && (
                            <button 
                                onClick={handleClearSentenceAttempt}
                                disabled={!(activityState.userAnswer as string) || activityState.isLoadingContent}
                                className="px-4 py-2 bg-yellow-500 hover:bg-yellow-600 text-white rounded-md transition-colors disabled:opacity-50">
                                Clear Attempt
                            </button>
                        )}
                    </div>
                     <button onClick={resetActivity} className="mt-4 ml-2 px-4 py-2 bg-secondary dark:bg-neutral-darkest hover:bg-secondary-dark dark:hover:bg-neutral-dark text-neutral-darker dark:text-secondary-light rounded-md text-sm">
                        Back to Activities Menu
                    </button>
                </div>
              )}

               {/* Handwriting Practice UI */}
              {!activityState.isLoadingContent && activityState.content && activeActivityType === 'handwriting' && (
                <div className="space-y-4">
                    <p className="text-lg font-semibold text-center text-neutral-800 dark:text-neutral-100 p-4 bg-secondary/50 dark:bg-neutral-dark/30 rounded-md shadow">
                        Practice writing: <span className="text-2xl text-primary dark:text-primary-light">{activityState.content.targetText}</span>
                    </p>
                    
                    <div className="flex justify-center space-x-2 mb-3">
                        {(['draw', 'upload'] as const).map(method => (
                            <button
                                key={method}
                                onClick={() => setActivityState(prev => ({ ...prev, handwritingInputMethod: method, userHandwritingImage: undefined, isAnswerSubmitted: false, accuracyScore: undefined, aiFeedback: undefined }))}
                                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors
                                    ${activityState.handwritingInputMethod === method 
                                        ? 'bg-primary text-white dark:bg-primary-light dark:text-neutral-darker' 
                                        : 'bg-secondary dark:bg-neutral-darkest text-neutral-700 dark:text-neutral-300 hover:bg-secondary-dark dark:hover:bg-neutral-dark'}`}
                            >
                                {method === 'draw' ? <PencilIcon className="w-4 h-4 inline mr-1.5"/> : <CameraIcon className="w-4 h-4 inline mr-1.5"/>}
                                {method === 'draw' ? 'Draw Canvas' : 'Upload Image'}
                            </button>
                        ))}
                    </div>

                    {activityState.handwritingInputMethod === 'draw' && (
                        <div className="flex flex-col items-center space-y-2">
                             <HandwritingCanvas width={300} height={150} canvasRef={handwritingCanvasRef} disabled={activityState.isAnswerSubmitted || activityState.isLoadingContent} />
                            <button onClick={() => {
                                const canvas = handwritingCanvasRef.current;
                                if (canvas) {
                                    const ctx = canvas.getContext('2d');
                                    if (ctx) {
                                        ctx.clearRect(0,0, canvas.width / window.devicePixelRatio, canvas.height / window.devicePixelRatio); 
                                        ctx.fillStyle = '#FFFFFF';
                                        ctx.fillRect(0,0, canvas.width / window.devicePixelRatio, canvas.height / window.devicePixelRatio);
                                    }
                                }
                                setActivityState(prev => ({...prev, isAnswerSubmitted: false, accuracyScore: undefined, aiFeedback: undefined, userHandwritingImage: undefined })); 
                            }}
                                    disabled={activityState.isAnswerSubmitted || activityState.isLoadingContent}
                                    className="px-3 py-1 bg-yellow-500 hover:bg-yellow-600 text-white text-xs rounded-md disabled:opacity-50 flex items-center">
                                <TrashIcon className="w-3 h-3 mr-1"/>Clear Canvas</button>
                        </div>
                    )}

                    {activityState.handwritingInputMethod === 'upload' && (
                        <div className="flex flex-col items-center space-y-2">
                            <input type="file" accept="image/*" ref={handwritingImageUploadRef} onChange={handleHandwritingImageUpload} className="hidden" />
                            <button onClick={() => handwritingImageUploadRef.current?.click()} 
                                    disabled={activityState.isAnswerSubmitted || activityState.isLoadingContent}
                                    className="px-4 py-2 bg-accent hover:bg-accent-dark text-white rounded-md transition-colors disabled:opacity-50 flex items-center">
                                <CameraIcon className="w-5 h-5 mr-2"/> Select Image
                            </button>
                            {activityState.userHandwritingImage && (
                                <div className="relative group w-48 h-24 border border-secondary dark:border-neutral-darkest rounded mt-2">
                                    <img src={activityState.userHandwritingImage} alt="Handwriting preview" className="w-full h-full object-contain rounded"/>
                                    <button onClick={() => {
                                        setActivityState(prev => ({...prev, userHandwritingImage: undefined, isAnswerSubmitted: false, accuracyScore: undefined, aiFeedback: undefined}));
                                    }}
                                            disabled={activityState.isLoadingContent}
                                            className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-50">
                                        <XMarkIcon className="w-3 h-3"/>
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                    
                    {activityState.error && !activityState.isLoadingContent && <p className="text-red-500 dark:text-red-400 text-center">Error: {activityState.error}</p>}

                    {activityState.isAnswerSubmitted && activityState.accuracyScore !== undefined && (
                        <div className="mt-3 p-3 rounded-md text-center bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700">
                            <p className="text-lg font-semibold text-blue-700 dark:text-blue-300">Accuracy: {activityState.accuracyScore}%</p>
                            <p className="text-sm text-neutral-600 dark:text-neutral-400 mt-1">{activityState.aiFeedback}</p>
                        </div>
                    )}
                    
                    <div className="mt-4 flex flex-wrap gap-2 justify-center">
                        <button 
                            onClick={activityState.isAnswerSubmitted ? fetchHandwritingTarget : handleSubmitHandwriting}
                            disabled={activityState.isLoadingContent || (!activityState.isAnswerSubmitted && activityState.handwritingInputMethod === 'upload' && !activityState.userHandwritingImage)}
                            className="px-5 py-2 bg-primary hover:bg-primary-dark text-white rounded-md transition-colors disabled:opacity-50">
                            {activityState.isAnswerSubmitted ? 'Next Character' : 'Submit for Evaluation'}
                        </button>
                    </div>
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
