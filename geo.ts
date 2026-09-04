import { sql } from "drizzle-orm";
import type { Db } from "../db";

/** Impact thresholds used by the map legend: ≥85 green · 75–84 gold · 60–74 orange · <60 red */
export function regionStatus(impact: number): "on_track" | "at_risk" | "off_track" {
  return impact >= 85 ? "on_track" : impact >= 75 ? "at_risk" : "off_track";
}

export class GeoRepository {
  constructor(private db: Db) {}

  /** Regions summary. Investment of multi-region initiatives is split evenly so the kingdom total never double-counts. */
  async regions(sectorId?: number) {
    const sectorFilter = sectorId ? sql`and p.sector_id = ${sectorId}` : sql``;
    const rows = await this.db.execute(sql`
      with pr as (
        select pr.region_id, pr.project_id, (select count(*) from project_regions x where x.project_id = pr.project_id) as n
        from project_regions pr join projects p on p.id = pr.project_id where p.is_archived = false ${sectorFilter}
      )
      select r.id, r.code, r.name_ar as "nameAr", r.name_en as "nameEn", r.lat, r.lng,
        count(distinct pr.project_id)::int as initiatives,
        coalesce(sum(f.budget / pr.n), 0)::float as investment,
        coalesce(avg(p.impact_achieved / nullif(p.impact_target, 0)) * 100, 0)::float as impact,
        (select count(distinct pk.kpi_id) from project_kpis pk where pk.project_id in (select project_id from pr where pr.region_id = r.id))::int as kpis,
        (select count(*) from risks k where k.project_id in (select project_id from pr where pr.region_id = r.id))::int as risks,
        coalesce(array_agg(distinct s.name_ar) filter (where s.name_ar is not null), '{}') as sectors
      from regions r
      left join pr on pr.region_id = r.id
      left join projects p on p.id = pr.project_id
      left join financials f on f.project_id = p.id
      left join sectors s on s.id = p.sector_id
      group by r.id order by r.id`);
    const regions = (rows.rows as any[]).map((r) => ({ ...r, investment: Math.round(r.investment), impact: Math.round(r.impact), status: regionStatus(Math.round(r.impact)) }));

    const links = await this.db.execute(sql`
      select pr.region_id as "regionId", p.id, p.code, p.name_ar as "nameAr", p.status, p.impact_achieved as "impactAchieved", p.impact_target as "impactTarget", f.budget, s.name_ar as "sectorName"
      from project_regions pr join projects p on p.id = pr.project_id left join financials f on f.project_id = p.id left join sectors s on s.id = p.sector_id
      where p.is_archived = false ${sectorFilter} order by f.budget desc nulls last`);
    const byRegion: Record<number, any[]> = {};
    for (const l of links.rows as any[]) { (byRegion[l.regionId] ??= []).push(l); }

    const [tot] = (await this.db.execute(sql`
      with linked as (select distinct pr.project_id from project_regions pr join projects p on p.id = pr.project_id where p.is_archived = false ${sectorFilter})
      select (select count(*) from linked)::int as initiatives,
        (select coalesce(sum(f.budget),0) from financials f where f.project_id in (select project_id from linked))::float as investment,
        (select count(distinct pk.kpi_id) from project_kpis pk where pk.project_id in (select project_id from linked))::int as kpis`)).rows as any[];
    const totalInv = regions.reduce((a, r) => a + r.investment, 0);
    const impact = totalInv ? Math.round(regions.reduce((a, r) => a + r.impact * r.investment, 0) / totalInv) : 0;

    return {
      totals: { initiatives: tot.initiatives, investment: Math.round(tot.investment), impact, kpis: tot.kpis,
        onTrack: regions.filter((r) => r.status === "on_track").length, atRisk: regions.filter((r) => r.status === "at_risk").length, offTrack: regions.filter((r) => r.status === "off_track").length },
      regions: regions.map((r) => ({ ...r, projects: (byRegion[r.id] ?? []).slice(0, 8) })),
    };
  }

  async sectors(regionId?: number) {
    const regionFilter = regionId ? sql`and exists (select 1 from project_regions x where x.project_id = p.id and x.region_id = ${regionId})` : sql``;
    const rows = await this.db.execute(sql`
      select s.id, s.code, s.name_ar as "nameAr", s.name_en as "nameEn",
        (select count(*) from projects p where p.sector_id = s.id and p.is_archived = false ${regionFilter})::int as initiatives,
        (select coalesce(sum(f.budget),0) from projects p join financials f on f.project_id = p.id where p.sector_id = s.id and p.is_archived = false ${regionFilter})::float as investment,
        (select count(*) from kpis k where k.owner_sector_id = s.id)::int as kpis,
        (select coalesce(avg(p.impact_achieved / nullif(p.impact_target,0)) * 100, 0) from projects p where p.sector_id = s.id and p.is_archived = false ${regionFilter})::float as impact
      from sectors s order by s.id`);
    return (rows.rows as any[]).map((r) => ({ ...r, investment: Math.round(r.investment), impact: Math.round(r.impact), status: regionStatus(Math.round(r.impact)) }));
  }
}
