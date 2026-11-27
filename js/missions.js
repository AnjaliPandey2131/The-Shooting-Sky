/* -------------------------------------------------------------
   SHOOTING STARS - Daily Mini-Missions
   3 achievable daily tasks that reset every local YYYY-MM-DD day.
   ------------------------------------------------------------- */

export const MISSION_DEFS = [
    {
        id: 'coins15',
        title: 'Collect 15 Coins in a single run',
        target: 15,
        reward: 25,
        type: 'single_run_coins'
    },
    {
        id: 'survive45',
        title: 'Survive for 45 seconds',
        target: 45,
        reward: 30,
        type: 'single_run_time'
    },
    {
        id: 'play2',
        title: 'Play 2 Games today',
        target: 2,
        reward: 20,
        type: 'daily_games'
    }
];

export function createFreshDailyMissions(dateStr) {
    const progress = {};
    const completed = {};
    for (const m of MISSION_DEFS) {
        progress[m.id] = 0;
        completed[m.id] = false;
    }
    return {
        date: dateStr,
        progress,
        completed
    };
}

export function normalizeDailyMissions(rawState, todayDate) {
    if (!rawState || rawState.date !== todayDate) {
        return createFreshDailyMissions(todayDate);
    }
    const base = createFreshDailyMissions(todayDate);
    for (const m of MISSION_DEFS) {
        base.progress[m.id] = Math.max(0, Math.floor(rawState.progress?.[m.id] || 0));
        base.completed[m.id] = Boolean(rawState.completed?.[m.id]);
    }
    return base;
}

export function evaluateDailyMissions(rawState, todayDate, runStats) {
    const next = normalizeDailyMissions(rawState, todayDate);
    let bonusCoinsEarned = 0;

    const coins = Math.max(0, Math.floor(runStats?.coinsCollected || 0));
    const time = Math.max(0, Math.floor(runStats?.survivalTime || 0));

    for (const m of MISSION_DEFS) {
        if (m.type === 'single_run_coins') {
            next.progress[m.id] = Math.min(m.target, Math.max(next.progress[m.id], coins));
        } else if (m.type === 'single_run_time') {
            next.progress[m.id] = Math.min(m.target, Math.max(next.progress[m.id], time));
        } else if (m.type === 'daily_games') {
            next.progress[m.id] = Math.min(m.target, next.progress[m.id] + 1);
        }

        if (!next.completed[m.id] && next.progress[m.id] >= m.target) {
            next.completed[m.id] = true;
            bonusCoinsEarned += m.reward;
        }
    }

    return { nextMissionsState: next, bonusCoinsEarned };
}
