import { describe, expect, it } from "vitest";
import { mapSport, toImported, type StravaActivity } from "./mapping";

const base: StravaActivity = {
  id: 987, name: "Corsa del mattino", sport_type: "Run", start_date: "2026-11-02T06:30:00Z", start_date_local: "2026-11-02T07:30:00Z",
  moving_time: 3000, elapsed_time: 3100, distance: 10050, total_elevation_gain: 42.4, has_heartrate: true, average_heartrate: 148.6,
};

describe("importazione da Strava", () => {
  it("sport seguiti e non", () => {
    expect(mapSport({ sport_type: "TrailRun" })).toBe("run");
    expect(mapSport({ sport_type: "GravelRide" })).toBe("bike");
    expect(mapSport({ sport_type: "Swim" })).toBe("swim");
    expect(mapSport({ sport_type: "WeightTraining" })).toBe("gym");
    expect(mapSport({ sport_type: "Walk" })).toBeNull();
    expect(mapSport({ sport_type: "EBikeRide" })).toBeNull();
    expect(mapSport({ type: "Run" })).toBe("run"); // vecchie attività senza sport_type
  });
  it("corsa: data locale, tempo in movimento, km e intertempi", () => {
    const a = toImported({
      ...base,
      splits_metric: [
        { split: 1, distance: 1000, moving_time: 300, average_heartrate: 140, elevation_difference: 3 },
        { split: 2, distance: 1001, moving_time: 296, average_heartrate: 150, elevation_difference: -2 },
        { split: 3, distance: 50.2, moving_time: 14 },
      ],
    })!;
    expect(a).toMatchObject({ externalId: "strava:987", date: "2026-11-02", sport: "run", durationMin: 50, distanceKm: 10.05, avgHr: 149, elevationM: 42 });
    expect(a.splits).toEqual([
      { n: 1, km: 1, paceSec: 300, hr: 140, elevM: 3 },
      { n: 2, km: 1.001, paceSec: 296, hr: 150, elevM: -2 },
      { n: 3, km: 0.05, paceSec: 280 },
    ]);
  });
  it("bici: potenza solo se misurata, km raggruppati in tratti da 5", () => {
    const km = Array.from({ length: 12 }, (_, i) => ({ split: i + 1, distance: 1000, moving_time: 120, average_heartrate: 130, elevation_difference: 5 }));
    const est = toImported({ ...base, sport_type: "Ride", average_watts: 180, device_watts: false, splits_metric: km })!;
    expect(est.avgPowerW).toBeUndefined();
    expect(est.splits!.map((s) => s.km)).toEqual([5, 5, 2]);
    expect(est.splits![0]).toMatchObject({ paceSec: 120, hr: 130, elevM: 25 });
    expect(toImported({ ...base, sport_type: "Ride", average_watts: 180.4, device_watts: true })!.avgPowerW).toBe(180);
  });
  it("nuoto: vasche dai giri, distanza senza dislivello", () => {
    const laps = [25, 25, 50, 0].map((d, i) => ({ lap_index: i, distance: d, moving_time: d ? d * 2 : 20, elapsed_time: d * 2 + 10 }));
    const a = toImported({ ...base, sport_type: "Swim", distance: 100, total_elevation_gain: 0, laps })!;
    expect(a.distanceKm).toBe(0.1);
    expect(a.elevationM).toBeUndefined();
    expect(a.splits!.map((s) => [s.km, s.paceSec])).toEqual([[0.025, 2000], [0.025, 2000], [0.05, 2000]]);
  });
  it("palestra: niente distanza; sport non seguiti esclusi", () => {
    expect(toImported({ ...base, sport_type: "WeightTraining", distance: 0 })).toMatchObject({ sport: "gym", durationMin: 50 });
    expect(toImported({ ...base, sport_type: "WeightTraining" })!.distanceKm).toBeUndefined();
    expect(toImported({ ...base, sport_type: "Walk" })).toBeNull();
  });
});
