use std::io::BufReader;
use std::{error::Error, fs::File, path::PathBuf, sync::Arc};

use clap::{Args, Subcommand};
use editoast_models::DbConnectionPoolV2;
use editoast_schemas::train_schedule::TrainScheduleBase;

use crate::models::prelude::*;
use crate::models::train_schedule::TrainSchedule;
use crate::views::train_schedule::TrainScheduleForm;
use crate::{
    models::timetable::{Timetable, TimetableWithTrains},
    views::train_schedule::TrainScheduleResult,
    CliError,
};

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
) -> Result<(), Box<dyn Error + Send + Sync>> {
    let train_ids = match TimetableWithTrains::retrieve(&mut db_pool.get().await?, args.id).await? {
        Some(timetable) => timetable.train_ids,
        None => {
            let error = CliError::new(1, format!("❌ Timetable not found, id: {0}", args.id));
            return Err(Box::new(error));
        }
    };

    let (train_schedules, missing): (Vec<_>, _) =
        TrainSchedule::retrieve_batch(&mut db_pool.get().await?, train_ids).await?;

    assert!(missing.is_empty());

    let train_schedules: Vec<TrainScheduleBase> = train_schedules
        .into_iter()
        .map(|ts| Into::<TrainScheduleResult>::into(ts).train_schedule)
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
) -> Result<(), Box<dyn Error + Send + Sync>> {
    let train_file = match File::open(args.path.clone()) {
        Ok(file) => file,
        Err(e) => {
            let error = CliError::new(
                1,
                format!("❌ Could not open file {:?} ({:?})", args.path, e),
            );
            return Err(Box::new(error));
        }
    };

    let timetable = match args.id {
        Some(timetable) => match Timetable::retrieve(&mut db_pool.get().await?, timetable).await? {
            Some(timetable) => timetable,
            None => {
                let error = CliError::new(1, format!("❌ Timetable not found, id: {0}", timetable));
                return Err(Box::new(error));
            }
        },
        None => Timetable::create(&mut db_pool.get().await?).await?,
    };

    let train_schedules: Vec<TrainScheduleBase> =
        serde_json::from_reader(BufReader::new(train_file))?;
    let changesets: Vec<Changeset<TrainSchedule>> = train_schedules
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
        TrainSchedule::create_batch(&mut db_pool.get().await?, changesets).await?;

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

    #[rstest::rstest]
    async fn import_export_timetable_schedule() {
        let db_pool = DbConnectionPoolV2::for_tests();

        let timetable = Timetable::create(&mut db_pool.get_ok()).await.unwrap();

        let mut file = NamedTempFile::new().unwrap();
        file.write_all(get_trainschedule_json_array().as_bytes())
            .unwrap();

        // Test import
        let args = ImportTimetableArgs {
            path: file.path().into(),
            id: Some(timetable.id),
        };
        let result = trains_import(args, db_pool.clone().into()).await;
        assert!(result.is_ok(), "{:?}", result);

        // Test to export the import
        let export_file = NamedTempFile::new().unwrap();
        let args = ExportTimetableArgs {
            path: export_file.path().into(),
            id: timetable.id,
        };
        let export_result = trains_export(args, db_pool.clone().into()).await;
        assert!(export_result.is_ok(), "{:?}", export_result);

        // Test to reimport the exported import
        let reimport_args = ImportTimetableArgs {
            path: export_file.path().into(),
            id: Some(timetable.id),
        };
        let reimport_result = trains_import(reimport_args, db_pool.clone().into()).await;
        assert!(reimport_result.is_ok(), "{:?}", reimport_result);

        Timetable::delete_static(&mut db_pool.get_ok(), timetable.id)
            .await
            .unwrap();
    }
}
