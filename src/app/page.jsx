'use client';

import React, { useState, useEffect } from 'react';
import ManagerSetup from '../components/ManagerSetup';
import TransferMarket from '../components/TransferMarket';
import FootballPitch from '../components/FootballPitch';
import TacticalMatchSimulator from '../components/TacticalMatchSimulator';
import TrophyCelebration from '../components/TrophyCelebration';

import { getRandom80PlayersPool } from '../data/players';
import { PeerService } from '../services/peerService';
import { storageService } from '../services/storageService';
import { soundFx } from '../services/audioService';

const peerServiceInstance = new PeerService();

export default function Home() {
  const [stage, setStage] = useState('SETUP'); // 'SETUP', 'DRAFT', 'SIMULATION', 'TROPHY'
  const [isConnecting, setIsConnecting] = useState(false);
  const [isOnline, setIsOnline] = useState(false);

  // 80 Random Players Pool for current session
  const [availablePool, setAvailablePool] = useState([]);
  const [purchasedMap, setPurchasedMap] = useState({}); // { [playerId]: buyerIndex }

  // 3 Managers Master State
  const [managers, setManagers] = useState([
    { name: 'Manager Alpha', crest: '🦁', formation: '4-3-3 Attacking', budget: 100000000, squad: [], squadRating: 0 },
    { name: 'Manager Bravo', crest: '🦅', formation: '4-4-2 Classic', budget: 100000000, squad: [], squadRating: 0 },
    { name: 'Manager Charlie', crest: '⚡', formation: '3-5-2 Wingplay', budget: 100000000, squad: [], squadRating: 0 },
  ]);

  const [activePlayerIndex, setActivePlayerIndex] = useState(0);
  const [activeTab, setActiveTab] = useState('MARKET'); // 'MARKET', 'PITCH_P1', 'PITCH_P2', 'PITCH_P3'
  const [finalStandings, setFinalStandings] = useState([]);

  // Calculate Squad Rating
  const calcRating = (squad) => {
    if (!squad.length) return 0;
    const sum = squad.reduce((acc, p) => acc + p.rating, 0);
    return Math.round(sum / squad.length);
  };

  // Helper to Broadcast State if Host
  const broadcastCurrentState = (updatedData) => {
    if (peerServiceInstance.isHost) {
      peerServiceInstance.broadcastState(updatedData);
    }
  };

  // Handler for Remote State Change from PeerJS
  const handleRemoteState = (payload) => {
    if (payload.availablePool) setAvailablePool(payload.availablePool);
    if (payload.purchasedMap) setPurchasedMap(payload.purchasedMap);
    if (payload.managers) setManagers(payload.managers);
    if (payload.activePlayerIndex !== undefined) setActivePlayerIndex(payload.activePlayerIndex);
    if (payload.stage) setStage(payload.stage);
  };

  // --- START LOCAL GAME ---
  const handleStartLocalGame = (mgrData) => {
    const pool = getRandom80PlayersPool();
    const initManagers = mgrData.map((m) => ({
      ...m,
      budget: 100000000,
      squad: [],
      squadRating: 0
    }));

    setAvailablePool(pool);
    setManagers(initManagers);
    setPurchasedMap({});
    setActivePlayerIndex(0);
    setStage('DRAFT');
  };

  // --- CREATE ONLINE ROOM (HOST) ---
  const handleCreateOnlineRoom = async (hostMgr, code) => {
    setIsConnecting(true);
    const success = await peerServiceInstance.createRoom(code, handleRemoteState);
    setIsConnecting(false);

    if (success) {
      setIsOnline(true);
      handleStartLocalGame([
        hostMgr,
        { name: 'Online Guest 2', crest: '🦅', formation: '4-4-2 Classic', budget: 100000000, squad: [], squadRating: 0 },
        { name: 'Online Guest 3', crest: '⚡', formation: '3-5-2 Wingplay', budget: 100000000, squad: [], squadRating: 0 }
      ]);
    } else {
      alert('Gagal membuat Online Room. Silakan coba kode lain!');
    }
  };

  // --- JOIN ONLINE ROOM (CLIENT) ---
  const handleJoinOnlineRoom = async (clientMgr, code) => {
    setIsConnecting(true);
    const success = await peerServiceInstance.joinRoom(code, handleRemoteState);
    setIsConnecting(false);

    if (success) {
      setIsOnline(true);
      setStage('DRAFT');
    } else {
      alert('Gagal terhubung ke Room Code. Pastikan Host sudah membuat room!');
    }
  };

  // --- BUY PLAYER ("SIAPA CEPAT DIA DAPAT") ---
  const handleBuyPlayer = (player, mgrIndex) => {
    if (purchasedMap[player.id]) return;

    const copyManagers = [...managers];
    const buyer = copyManagers[mgrIndex];

    if (buyer.budget < player.price) return;

    buyer.budget -= player.price;
    buyer.squad.push(player);
    buyer.squadRating = calcRating(buyer.squad);

    const newPurchasedMap = { ...purchasedMap, [player.id]: mgrIndex };
    const nextTurnIdx = (activePlayerIndex + 1) % 3;

    setManagers(copyManagers);
    setPurchasedMap(newPurchasedMap);
    setActivePlayerIndex(nextTurnIdx);

    const nextState = {
      availablePool,
      purchasedMap: newPurchasedMap,
      managers: copyManagers,
      activePlayerIndex: nextTurnIdx,
      stage: 'DRAFT'
    };

    broadcastCurrentState(nextState);
  };

  // --- RESELL PLAYER BACK TO MARKET ---
  const handleResellPlayer = (playerId, managerObj) => {
    const mgrIdx = managers.findIndex((m) => m.name === managerObj.name);
    if (mgrIdx === -1) return;

    const copyManagers = [...managers];
    const mgr = copyManagers[mgrIdx];
    const pIdx = mgr.squad.findIndex((p) => p.id === playerId);
    if (pIdx === -1) return;

    const player = mgr.squad[pIdx];
    mgr.budget += player.price; // Refund cash
    mgr.squad.splice(pIdx, 1);
    mgr.squadRating = calcRating(mgr.squad);

    const newPurchasedMap = { ...purchasedMap };
    delete newPurchasedMap[playerId];

    setManagers(copyManagers);
    setPurchasedMap(newPurchasedMap);

    broadcastCurrentState({
      availablePool,
      purchasedMap: newPurchasedMap,
      managers: copyManagers,
      activePlayerIndex,
      stage: 'DRAFT'
    });
  };

  // --- FINISH DRAFT & GO TO MATCH SIMULATION ---
  const handleFinishDraft = () => {
    setStage('SIMULATION');
    broadcastCurrentState({
      availablePool,
      purchasedMap,
      managers,
      activePlayerIndex,
      stage: 'SIMULATION'
    });
  };

  // --- COMPLETE MATCH TOURNAMENT ---
  const handleCompleteTournament = (standingsResult) => {
    setFinalStandings(standingsResult);
    setStage('TROPHY');
    storageService.saveMatchTournament({
      champion: standingsResult[0]?.name,
      standings: standingsResult
    });
  };

  // --- RESTART GAME ---
  const handleRestartGame = () => {
    setStage('SETUP');
    if (peerServiceInstance) {
      peerServiceInstance.destroy();
    }
    setIsOnline(false);
  };

  return (
    <main className="min-h-screen pb-12">
      {/* Navbar Brand Header */}
      <nav className="glass-panel border-b border-white/10 sticky top-0 z-40 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-2xl">⚽</span>
          <span className="font-black text-lg tracking-tight text-white">
            SOCCER MANAGER <span className="text-amber-400">3P</span>
          </span>
        </div>

        {stage !== 'SETUP' && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => { soundFx.playClick(); setActiveTab('MARKET'); }}
              className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all ${
                activeTab === 'MARKET' ? 'bg-amber-500 text-black shadow-glow-gold' : 'bg-slate-800 text-slate-300'
              }`}
            >
              TRANSFER MARKET
            </button>

            {managers.map((m, idx) => (
              <button
                key={idx}
                onClick={() => { soundFx.playClick(); setActiveTab(`PITCH_P${idx + 1}`); }}
                className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all ${
                  activeTab === `PITCH_P${idx + 1}` ? 'bg-cyan-500 text-black shadow-glow-cyan' : 'bg-slate-800 text-slate-300'
                }`}
              >
                {m.crest} {m.name} PITCH
              </button>
            ))}
          </div>
        )}
      </nav>

      {/* Dynamic Stage Render */}
      {stage === 'SETUP' && (
        <ManagerSetup
          onStartLocalGame={handleStartLocalGame}
          onCreateOnlineRoom={handleCreateOnlineRoom}
          onJoinOnlineRoom={handleJoinOnlineRoom}
          isConnecting={isConnecting}
        />
      )}

      {stage === 'DRAFT' && activeTab === 'MARKET' && (
        <TransferMarket
          availablePool={availablePool}
          managers={managers}
          activePlayerIndex={activePlayerIndex}
          purchasedMap={purchasedMap}
          onBuyPlayer={handleBuyPlayer}
          onFinishDraft={handleFinishDraft}
        />
      )}

      {stage === 'DRAFT' && activeTab.startsWith('PITCH_P') && (
        <FootballPitch
          manager={managers[parseInt(activeTab.replace('PITCH_P', '')) - 1]}
          onResellPlayer={handleResellPlayer}
        />
      )}

      {stage === 'SIMULATION' && (
        <TacticalMatchSimulator
          managers={managers}
          onCompleteTournament={handleCompleteTournament}
          peerService={peerServiceInstance}
        />
      )}

      {stage === 'TROPHY' && (
        <TrophyCelebration
          standings={finalStandings}
          onRestartGame={handleRestartGame}
        />
      )}
    </main>
  );
}
