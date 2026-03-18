export const GameConfig = {
    COLS: 8,
    ROWS: 8,
    COLORS: 5,
    TARGET_SCORE: 1000,
    MAX_MOVES: 20,

    MIN_GROUP_SIZE: 2,
    BOOSTER_GROUP_MIN: 5,
    BOOSTER_GROUP_MAX: 9,
    POWER_BOOSTER_GROUP_MIN: 10,
    BONUS_MOVES_POWER: 2,

    MAX_SHUFFLES: 3,

    DEFAULT_BOMB_BOOSTERS: 5,
    DEFAULT_TELEPORT_BOOSTERS: 3,

    INITIAL_BOMB_COUNT: 0,

    TILE_ROCKET_H: 5,
    TILE_ROCKET_V: 6,
    TILE_BOMB: 7,
    TILE_BOMB_MAX: 8,
    TILE_CLEAR_ALL: 9,
    TILE_TELEPORT: 10,
    TILE_BOMB_CLEAR_FIELD: 11,

    BOMB_RADIUS: 1,
    BOMB_MAX_RADIUS: 2,

    scoreForGroup(size: number): number {
        return size * 10;
    },
    scorePerTile: 10,
} as const;

export type BoardValue = number;
