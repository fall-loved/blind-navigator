import {NavNode} from "@/utils/mapEngine.ts";

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

export const matchNodeOnMap = (query: string, mapData: Record<string, NavNode>): string | null => {
    const q = query.toLowerCase().trim();

    // Перебираем все узлы карты и ищем совпадение по имени
    for (const key in mapData) {
        const node = mapData[key];
        if (node.name.toLowerCase().includes(q)) {
            return key; // Возвращаем реальный ID (например, 'f2_room_208')
        }
        // Если у вас были aliases в старом коде, можно добавить проверку и здесь
    }

    return null;
};