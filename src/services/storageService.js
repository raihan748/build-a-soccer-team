/**
 * Storage Service - Local Offline Match History & Leaderboard Manager
 */

const STORAGE_KEYS = {
  MATCH_HISTORY: 'soccer_manager_match_history_v1',
  TROPHY_ROOM: 'soccer_manager_trophies_v1',
  MANAGER_PROFILES: 'soccer_manager_profiles_v1'
};

export const storageService = {
  // Save completed match tournament
  saveMatchTournament(tournamentResult) {
    if (typeof window === 'undefined') return;
    try {
      const existing = this.getMatchHistory();
      const updated = [
        {
          id: 'tourney_' + Date.now(),
          timestamp: new Date().toISOString(),
          champion: tournamentResult.champion,
          standings: tournamentResult.standings,
          matches: tournamentResult.matches
        },
        ...existing
      ].slice(0, 20); // Keep last 20 matches

      localStorage.setItem(STORAGE_KEYS.MATCH_HISTORY, JSON.stringify(updated));
    } catch (e) {
      console.error('Failed to save match history:', e);
    }
  },

  getMatchHistory() {
    if (typeof window === 'undefined') return [];
    try {
      const data = localStorage.getItem(STORAGE_KEYS.MATCH_HISTORY);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      return [];
    }
  },

  clearHistory() {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(STORAGE_KEYS.MATCH_HISTORY);
  }
};
