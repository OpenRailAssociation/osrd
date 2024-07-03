use chashmap::CHashMap;
use editoast_models::DbConnection;

use crate::core::v2::pathfinding::PathfindingResult;
use crate::error::Result;
use crate::modelsv2::timetable::Timetable;
use crate::{Retrieve, RollingStockModel};

/// Used to cache postgres and redis queries while simulating train schedules
#[derive(Debug, Default)]
pub struct TrainScheduleProxy {
    /// Map train schedule id with their respective timetable
    timetables: CHashMap<i64, Timetable>,
    /// Map rolling stock name with their respective rolling stock
    rolling_stocks: CHashMap<String, RollingStockModel>,
    /// Map train schedule id with their computed path
    pathfinding_results: CHashMap<i64, PathfindingResult>,
}

impl TrainScheduleProxy {
    /// Initialize the cache with a list of rolling stocks
    pub fn new(rolling_stocks: &[RollingStockModel], timetables: &[Timetable]) -> Self {
        Self {
            rolling_stocks: rolling_stocks
                .iter()
                .map(|rs| (rs.name.clone(), rs.clone()))
                .collect(),
            timetables: timetables
                .iter()
                .map(|timetable| (timetable.id, timetable.clone()))
                .collect(),
            ..Default::default()
        }
    }

    /// Returns the cached value given a timetable ID.
    /// If the value is not cached, it will retrieve it and cache it.
    pub async fn get_timetable(
        &self,
        id: i64,
        conn: &mut DbConnection,
    ) -> Result<Option<Timetable>> {
        if let Some(timetable) = self.timetables.get(&id) {
            return Ok(Some(timetable.clone()));
        }

        let Some(timetable) = Timetable::retrieve(conn, id).await? else {
            return Ok(None);
        };

        if self.timetables.get_mut(&id).is_none() {
            self.timetables.insert_new(id, timetable.clone());
        }
        Ok(Some(timetable))
    }

    /// Returns the cached value given a rolling stock name.
    /// If the value is not cached, it will retrieve it and cache it.
    pub async fn get_rolling_stock(
        &self,
        name: String,
        conn: &mut DbConnection,
    ) -> Result<Option<RollingStockModel>> {
        if let Some(rs) = self.rolling_stocks.get(&name) {
            return Ok(Some(rs.clone()));
        }

        let Some(rs) = RollingStockModel::retrieve(conn, name).await? else {
            return Ok(None);
        };

        if self.rolling_stocks.get(&rs.name).is_none() {
            self.rolling_stocks.insert(rs.name.clone(), rs.clone());
        }
        Ok(Some(rs))
    }

    /// Returns the cached value given a train schedule ID.
    pub fn get_pathfinding_result(&self, id: i64) -> Option<PathfindingResult> {
        self.pathfinding_results.get(&id).map(|r| r.clone())
    }

    /// Caches a pathfinding result given a train schedule ID.
    /// If the value is already cached, it won't be updated.
    pub fn set_pathfinding_result(&self, id: i64, result: PathfindingResult) {
        if self.pathfinding_results.get(&id).is_none() {
            self.pathfinding_results.insert(id, result);
        }
    }
}
