import { BuildingMap } from '../types';

export type IntentType = 'WHERE_AM_I' | 'CHECK_IN' | 'LIST_DESTINATIONS' | 'NAVIGATE_TO' | 'UNKNOWN';

export interface ParsedIntent {
    type: IntentType;
    payload?: string;
}

const DICTIONARY = {
    WHERE_AM_I: ['где я', 'где мы', 'какое это место', 'где нахожусь'],
    LIST_DESTINATIONS: ['куда можно', 'что здесь есть', 'какие есть', 'список', 'маршруты'],

    // Отметка локации (САМАЯ ВАЖНАЯ, ПРОВЕРЯЕТСЯ ПЕРВОЙ)
    CHECK_IN_REGEX: /(?:я у|я возле|я около|я рядом с|нахожусь у|нахожусь на|стою у|стою на|подошел к|около|возле|у)\s+(.+)/i,

    // Навигация (включает короткие 'к', 'в', 'на')
    NAVIGATE_REGEX: /(?:как дойти до|как пройти к|как пройти в|маршрут до|путь до|веди к|веди в|идем в|идем к|отведи к|отведи в|хочу в|мне нужно в|дойти до|в|на|к)\s+(.+)/i,

    FILLER_WORDS: ['сейчас', 'где-то', 'кажется', 'наверное', 'просто', 'вот', 'тут', 'здесь', 'комнаты', 'комната', 'аудитории']
};

export const parseVoiceCommand = (rawText: string): ParsedIntent => {
    let normalized = rawText.toLowerCase().replace(/[.,!?]/g, '').trim();

    if (DICTIONARY.WHERE_AM_I.some(phrase => normalized.includes(phrase))) return { type: 'WHERE_AM_I' };
    if (DICTIONARY.LIST_DESTINATIONS.some(phrase => normalized.includes(phrase))) return { type: 'LIST_DESTINATIONS' };

    const cleanPayload = (text: string) => {
        let result = text;
        DICTIONARY.FILLER_WORDS.forEach(word => {
            const regex = new RegExp(`(^|\\s)${word}(?=\\s|$)`, 'g');
            result = result.replace(regex, ' ').trim();
        });
        return result.replace(/\s+/g, ' ');
    };

    // ПРОВЕРКА 1: Отметка текущего места (ОБЯЗАТЕЛЬНО ИДЕТ ПЕРЕД НАВИГАЦИЕЙ)
    // "Подошел к 27" сработает здесь и вернет CHECK_IN
    const checkInMatch = normalized.match(DICTIONARY.CHECK_IN_REGEX);
    if (checkInMatch) {
        return { type: 'CHECK_IN', payload: cleanPayload(checkInMatch[1]) };
    }

    // ПРОВЕРКА 2: Навигация
    // Если человек сказал просто "К 27", он пропустит шаг выше и попадет сюда
    const navMatch = normalized.match(DICTIONARY.NAVIGATE_REGEX);
    if (navMatch) {
        return { type: 'NAVIGATE_TO', payload: cleanPayload(navMatch[1]) };
    }

    // ПРОВЕРКА 3: Просто число без слов ("27" -> тоже навигация)
    if (/^\d+$/.test(normalized)) {
        return { type: 'NAVIGATE_TO', payload: normalized };
    }

    return { type: 'UNKNOWN' };
};

// ... функция matchNodeOnMap остается без изменений ...
export const matchNodeOnMap = (payload: string, mapData: BuildingMap): string | null => {
    const text = payload.toLowerCase();
    const numbers = text.match(/\d+/g);
    if (numbers) {
        const targetNumber = numbers[0];
        const foundByNumber = Object.keys(mapData).find(key =>
            mapData[key].name.includes(targetNumber) ||
            mapData[key].aliases?.includes(targetNumber)
        );
        if (foundByNumber) return foundByNumber;
    }
    for (const key of Object.keys(mapData)) {
        const node = mapData[key];
        if (text.includes(node.name.toLowerCase())) return key;
        if (node.aliases) {
            for (const alias of node.aliases) {
                if (text.includes(alias)) return key;
            }
        }
    }
    return null;
};