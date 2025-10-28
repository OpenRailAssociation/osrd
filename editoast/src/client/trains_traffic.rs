use crate::views::timetable::similar_trains::trains_traffic::TrainOperationalPoint;
use crate::views::timetable::similar_trains::trains_traffic::TrainTraffic;
use crate::views::timetable::similar_trains::trains_traffic::TrainsTrafficPool;
use chrono::NaiveDate;
use chrono::Utc;
use serde::Deserialize;
use std::fs::File;
use std::io::BufRead;
use std::io::BufReader;
use std::path::PathBuf;
use std::sync::Arc;
use std::time::Instant;
use tokio::sync::RwLock;

#[derive(Clone, Debug, Deserialize)]
pub struct JsonTrainTraffic {
    pub train_name: String,
    pub date: NaiveDate,
    pub operational_points: Vec<TrainOperationalPoint>,
    pub rolling_stock_name: String,
    pub speed_limit_tag: String,
}

/// Read the  given file and do the import
#[tracing::instrument(skip_all, level = "info", err, name = "train traffic")]
pub async fn import_trains_traffic(
    trains_traffic: Arc<RwLock<TrainsTrafficPool>>,
    file_path: PathBuf,
) -> anyhow::Result<()> {
    let now = Instant::now();
    let mut traffic = trains_traffic.write().await;
    // Open the file and read it
    let file = File::open(file_path.as_path())?;
    let reader = BufReader::new(file);

    // Read each line from the file, we have a train
    for (index, line_result) in reader.lines().enumerate() {
        let line = line_result?;
        if !line.is_empty() {
            let json_train: JsonTrainTraffic = serde_json::from_str::<JsonTrainTraffic>(&line)
                .map_err(|err| {
                    anyhow::anyhow!(
                        "Failed to parse train traffic on line {}: {}",
                        index + 1,
                        err
                    )
                })?;
            traffic
                .add_train_traffic(TrainTraffic::new(
                    index,
                    json_train.train_name,
                    json_train
                        .date
                        .and_hms_opt(0, 0, 0)
                        .unwrap()
                        .and_local_timezone(Utc)
                        .unwrap(),
                    json_train.rolling_stock_name,
                    json_train.speed_limit_tag,
                    json_train.operational_points,
                ))
                .map_err(|err| anyhow::anyhow!("Failed to add train traffic: {}", err))?;
        }
    }

    tracing::Span::current().record("traffic_imported", traffic.len());
    tracing::info!(
        "Loading {:?} train traffics in {:?}",
        traffic.len(),
        now.elapsed()
    );
    Ok(())
}

#[cfg(test)]
pub mod tests {
    use std::path::PathBuf;
    use std::str::FromStr;
    use std::sync::Arc;

    use chrono::DateTime;
    use chrono::Utc;
    use tokio::sync::RwLock;

    use crate::client::trains_traffic::import_trains_traffic;
    use crate::views::timetable::similar_trains::trains_traffic::TrainsTrafficPool;

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn load_traffic_file() {
        let valid_traffic_date =
            DateTime::<Utc>::from_str("2025-03-01T00:00:00Z").expect("Date should be valid");

        let trains_traffic = Arc::new(RwLock::new(TrainsTrafficPool::new_with_date(
            valid_traffic_date,
        )));

        // Test file has 3 train with the same path : A -> B -> C (stop)-> D (stop)
        // And one train is outdated
        import_trains_traffic(
            Arc::clone(&trains_traffic),
            PathBuf::from("src/tests/train-traffic.ndjson"),
        )
        .await
        .expect("Failed to import train traffic file");

        let traffic = trains_traffic.read().await;

        // Checking that train traffic are loaded
        assert_eq!(traffic.len(), 2);
    }
}
