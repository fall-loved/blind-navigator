export function getDistanceFromLatLonInKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371;
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c * 1000;
}

export function getTurnInstruction(currentHeading: number, targetBearing: number): string {
    let angle = (targetBearing - currentHeading + 360) % 360;

    if (angle < 45 || angle > 315) return "Идите прямо";
    if (angle >= 45 && angle <= 135) return "Поверните направо";
    if (angle > 135 && angle < 225) return "Развернитесь на 180 градусов";
    if (angle >= 225 && angle <= 315) return "Поверните налево";

    return "Идите прямо";
}
