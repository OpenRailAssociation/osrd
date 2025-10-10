use std::fs::File;
use std::io::BufReader;
use std::path::PathBuf;
use std::sync::Arc;

use clap::Args;
use clap::Subcommand;
use database::DbConnectionPoolV2;
use schemas::train_schedule::TrainSchedule;

use crate::models;
use crate::models::timetable::Timetable;
use crate::models::timetable::TimetableWithTrains;
use crate::views::timetable::train_schedule::TrainScheduleForm;
use crate::views::timetable::train_schedule::TrainScheduleResponse;
use editoast_models::prelude::*;

#[derive(Subcommand, Debug)]
pub enum TimetablesCommands {
    Import(ImportTimetableArgs),
    Export(ExportTimetableArgs),
}

#[derive(Args, Debug)]
#[command(about, long_about = "Import a train schedule given a JSON file")]
pub struct ImportTimetableArgs {
    /// The timetable id on which attach the trains to
    #[arg(long)]
    id: Option<i64>,
    /// The input file path
    path: PathBuf,
}

#[derive(Args, Debug)]
#[command(about, long_about = "Export the train schedules of a given timetable")]
pub struct ExportTimetableArgs {
    /// The timetable id on which get the train schedules from
    id: i64,
    /// The output file path
    path: PathBuf,
}

pub async fn trains_export(
    args: ExportTimetableArgs,
    db_pool: Arc<DbConnectionPoolV2>,
) -> anyhow::Result<()> {
    let train_ids = TimetableWithTrains::retrieve(db_pool.get().await?, args.id)
        .await?
        .ok_or_else(|| anyhow::anyhow!("Timetable not found, id: {}", args.id))?
        .train_ids;

    let (train_schedules, missing): (Vec<_>, _) =
        models::TrainSchedule::retrieve_batch(&mut db_pool.get().await?, train_ids).await?;

    assert!(missing.is_empty());

    let train_schedules: Vec<TrainSchedule> = train_schedules
        .into_iter()
        .map(|ts| Into::<TrainScheduleResponse>::into(ts).train_schedule)
        .collect();

    let file = File::create(args.path.clone())?;
    serde_json::to_writer_pretty(file, &train_schedules)?;

    println!(
        "✅ Train schedules exported to {0}",
        args.path.to_string_lossy()
    );

    Ok(())
}

pub async fn trains_import(
    args: ImportTimetableArgs,
    db_pool: Arc<DbConnectionPoolV2>,
) -> anyhow::Result<()> {
    let train_file = match File::open(args.path.clone()) {
        Ok(file) => file,
        Err(e) => {
            anyhow::bail!("Could not open file {path:?} ({e:?})", path = args.path);
        }
    };

    let timetable = match args.id {
        Some(timetable) => {
            Timetable::retrieve_or_fail(db_pool.get().await?, timetable, || {
                anyhow::anyhow!("Timetable not found, id: {}", timetable)
            })
            .await?
        }
        None => {
            Timetable::changeset()
                .create(&mut db_pool.get().await?)
                .await?
        }
    };

    let train_schedules: Vec<TrainSchedule> = serde_json::from_reader(BufReader::new(train_file))?;
    let changesets: Vec<Changeset<models::TrainSchedule>> = train_schedules
        .into_iter()
        .map(|train_schedule| {
            TrainScheduleForm {
                timetable_id: Some(timetable.id),
                train_schedule,
            }
            .into()
        })
        .collect();
    let inserted: Vec<_> =
        models::TrainSchedule::create_batch(&mut db_pool.get().await?, changesets).await?;

    println!(
        "✅ {} train schedules created for timetable with id {}",
        inserted.len(),
        timetable.id
    );

    Ok(())
}

#[cfg(test)]
mod tests {
    use std::io::Write as _;

    use tempfile::NamedTempFile;

    use super::*;

    fn get_trainschedule_json_array() -> &'static str {
        include_str!("../tests/train_schedules/simple_array.json")
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn import_export_timetable_schedule() {
        let db_pool = DbConnectionPoolV2::for_tests();
        let db_pool = Arc::new(db_pool);

        let timetable = Timetable::changeset()
            .create(&mut db_pool.get_ok())
            .await
            .unwrap();

        let mut file = NamedTempFile::new().unwrap();
        file.write_all(get_trainschedule_json_array().as_bytes())
            .unwrap();

        // Test import
        let args = ImportTimetableArgs {
            path: file.path().into(),
            id: Some(timetable.id),
        };
        let result = trains_import(args, db_pool.clone()).await;
        assert!(result.is_ok(), "{result:?}");

        // Test to export the import
        let export_file = NamedTempFile::new().unwrap();
        let args = ExportTimetableArgs {
            path: export_file.path().into(),
            id: timetable.id,
        };
        let export_result = trains_export(args, db_pool.clone()).await;
        assert!(export_result.is_ok(), "{export_result:?}");

        // Test to reimport the exported import
        let reimport_args = ImportTimetableArgs {
            path: export_file.path().into(),
            id: Some(timetable.id),
        };
        let reimport_result = trains_import(reimport_args, db_pool.clone()).await;
        assert!(reimport_result.is_ok(), "{reimport_result:?}");

        Timetable::delete_static(&mut db_pool.get_ok(), timetable.id)
            .await
            .unwrap();
    }
}
