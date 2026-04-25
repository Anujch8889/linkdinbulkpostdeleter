import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { translations, Language, TranslationKey } from '../utils/translations';

interface LanguageContextType {
    language: Language;
    setLanguage: (lang: Language) => void;
    t: (key: TranslationKey) => string;
}

const LanguageContext = createContext<LanguageContextType>({
    language: 'en',
    setLanguage: () => { },
    t: (key) => key,
});

const LANG_KEY = '@app_language';

export function LanguageProvider({ children }: { children: ReactNode }) {
    const [language, setLang] = useState<Language>('en');

    useEffect(() => {
        loadLanguage();
    }, []);

    const loadLanguage = async () => {
        try {
            const saved = await AsyncStorage.getItem(LANG_KEY);
            if (saved === 'en' || saved === 'hi') {
                setLang(saved);
            }
        } catch (e) {
            console.log('Error loading language:', e);
        }
    };

    const setLanguage = async (lang: Language) => {
        setLang(lang);
        try {
            await AsyncStorage.setItem(LANG_KEY, lang);
        } catch (e) {
            console.log('Error saving language:', e);
        }
    };

    const t = (key: TranslationKey): string => {
        return translations[language][key] || translations.en[key] || key;
    };

    return (
        <LanguageContext.Provider value={{ language, setLanguage, t }}>
            {children}
        </LanguageContext.Provider>
    );
}

export const useLanguage = () => useContext(LanguageContext);
