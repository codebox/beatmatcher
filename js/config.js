export const baseConfig = {
    pitchRangePercent: 10,
    baseRpm: 100/3,
    recordFriction: 0.999,  // 0-1 0 = no friction, 1 = max friction (don't set it to 0)
    platterInertia: 0.01, // 0-1 0 = no inertia, 1 = max inertia (don't set it to 1)
    platterFriction: 0.9  // 0-1 0 = no friction, 1 = max friction (don't set it to 0) takes effect when power is turned off while deck is moving
};