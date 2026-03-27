import { NavNode } from "@/utils/mapEngine";

export type IntentType = 'WHERE_AM_I' | 'CHECK_IN' | 'LIST_DESTINATIONS' | 'NAVIGATE_TO' | 'CONFIRM_FLOOR' | 'UNKNOWN';

export interface ParsedIntent {
    type: IntentType;
    payload?: string;
    isNear?: boolean;
}

const DICTIONARY = {
    WHERE_AM_I: ['где я', 'где мы', 'какое это место', 'где нахожусь'],
    LIST_DESTINATIONS: ['куда можно', 'что здесь есть', 'какие есть', 'список', 'маршруты'],

    CHECK_IN_NEAR_REGEX: /^(?:я у|я возле|я около|я рядом с|нахожусь у|стою у|подошел к|около|возле|у)\s+(.+)/i,
    CHECK_IN_EXACT_REGEX: /^(?:я в|я на|нахожусь в|нахожусь на|стою на|в|на)\s+(.+)/i,

    NAVIGATE_REGEX: /^(?:как дойти до|как пройти к|как пройти в|маршрут до|путь до|веди к|веди в|идем в|идем к|отведи к|отведи в|хочу в|мне нужно в|дойти до|в|на|к)\s+(.+)/i,

    CONFIRM_FLOOR_REGEX: /^(?:я на|на)\s*(первом|втором|третьем|1|2|3)\s*(?:этаже)?/i,

    TRANSPORT_WORDS: ['на лифте', 'на лифту', 'лифтом', 'по лестнице', 'лестницей', 'через лестницу', 'через лифт'],
    FILLER_WORDS: ['пожалуйста', 'сейчас', 'где-то', 'кажется', 'наверное', 'просто', 'вот', 'тут', 'здесь', 'комнаты', 'комната', 'аудитории', 'аудитория', 'кабинет']
};

export const parseVoiceCommand = (rawText: string): ParsedIntent => {
    let normalized = rawText.toLowerCase().replace(/[.,!?]/g, '').trim();

    if (DICTIONARY.WHERE_AM_I.some(phrase => normalized.includes(phrase))) return { type: 'WHERE_AM_I' };
    if (DICTIONARY.LIST_DESTINATIONS.some(phrase => normalized.includes(phrase))) return { type: 'LIST_DESTINATIONS' };

    const floorMatch = normalized.match(DICTIONARY.CONFIRM_FLOOR_REGEX);
    if (floorMatch) {
        return { type: 'CONFIRM_FLOOR', payload: floorMatch[1] };
    }

    const cleanPayload = (text: string) => {
        let result = text;
        [...DICTIONARY.TRANSPORT_WORDS, ...DICTIONARY.FILLER_WORDS].forEach(word => {
            const regex = new RegExp(`(^|\\s)${word}(?=\\s|$)`, 'gi');
            result = result.replace(regex, ' ');
        });
        return result.replace(/\s+/g, ' ').trim();
    };

    const nearMatch = normalized.match(DICTIONARY.CHECK_IN_NEAR_REGEX);
    if (nearMatch) {
        return { type: 'CHECK_IN', payload: cleanPayload(nearMatch[1]), isNear: true };
    }

    const exactMatch = normalized.match(DICTIONARY.CHECK_IN_EXACT_REGEX);
    if (exactMatch) {
        return { type: 'CHECK_IN', payload: cleanPayload(exactMatch[1]), isNear: false };
    }

    const navMatch = normalized.match(DICTIONARY.NAVIGATE_REGEX);
    if (navMatch) {
        return { type: 'NAVIGATE_TO', payload: cleanPayload(navMatch[1]) };
    }

    if (/^\d+[а-я]?$/.test(cleanPayload(normalized))) {
        return { type: 'NAVIGATE_TO', payload: cleanPayload(normalized) };
    }

    return { type: 'UNKNOWN' };
};

const stemWord = (word: string) => {
    if (word.length <= 4) return word;
    return word.replace(/(ую|юю|ая|яя|ое|ее|ие|ые|ой|ый|ий|ом|ем|ам|ям|ах|ях|ов|ев|ей|и|ы|а|я|о|е|у|ю|ь)$/i, '');
};

export const matchNodeOnMap = (query: string, mapData: Record<string, NavNode>): string | null => {
    const q = query.toLowerCase().trim();
    for (const key in mapData) {
        if (mapData[key].name.toLowerCase().includes(q)) return key;
    }

    const queryTokens = q.split(' ').map(stemWord);
    let bestMatch = null;
    let maxMatches = 0;

    for (const key in mapData) {
        const nodeNameTokens = mapData[key].name.toLowerCase().split(' ').map(stemWord);
        let matches = 0;
        for (const qt of queryTokens) {
            if (qt.length >= 2 && nodeNameTokens.some(nt => nt.includes(qt))) matches++;
        }
        if (matches > maxMatches) {
            maxMatches = matches;
            bestMatch = key;
        }
    }

    if (maxMatches > 0) return bestMatch;
    return null;
};