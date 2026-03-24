export interface Coordinates {
    lat: number;
    lng: number;
    accuracy?: number;
}

export interface Edge {
    to: string;
    instruction: string;
    distance: number;
    bearing?: number;
    side?: 'слева' | 'справа' | 'прямо';
}

export interface BuildingNode {
    id: string;
    name: string;
    floor: 0 | 1 | 2 | 3;
    description: string;
    edges?: Edge[];
    aliases?: string[];
    gps?: Coordinates;
}

export type BuildingMap = Record<string, BuildingNode>;

export type CommandAction = 'INFO' | 'NAVIGATE' | 'CANCEL' | 'SET_LOCATION' | 'UNKNOWN';

export interface CommandResult {
    action: CommandAction;
    targetId?: string;
}