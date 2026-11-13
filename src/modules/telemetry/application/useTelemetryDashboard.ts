import { useMemo } from 'react';
import { RankServiceLeaderboardsUseCase } from '../domain/usecases/RankServiceLeaderboardsUseCase';
import { useTelemetryContext } from './TelemetryContext';

export function useTelemetryDashboard() {
  const ctx = useTelemetryContext();
  const { snapshot } = ctx.state;

  const topSellingRanked = useMemo(
    () => (snapshot ? RankServiceLeaderboardsUseCase.rankTopSelling(snapshot.topSelling) : []),
    [snapshot]
  );

  const highestTrafficRanked = useMemo(
    () =>
      snapshot ? RankServiceLeaderboardsUseCase.rankHighestTraffic(snapshot.highestTraffic) : [],
    [snapshot]
  );

  const tokenLeaderboardRanked = useMemo(
    () =>
      snapshot
        ? RankServiceLeaderboardsUseCase.rankTokenConsumption(snapshot.tokenLeaderboard)
        : [],
    [snapshot]
  );

  return {
    ...ctx,
    topSellingRanked,
    highestTrafficRanked,
    tokenLeaderboardRanked
  };
}

