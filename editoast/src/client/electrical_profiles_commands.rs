use std::{error::Error, fs::File, io::BufReader, path::PathBuf, sync::Arc};

use clap::{Args, Subcommand};
use editoast_models::DbConnectionPoolV2;
use editoast_schemas::infra::ElectricalProfileSetData;

use crate::models::electrical_profiles::ElectricalProfileSet;
use crate::models::prelude::*;

#[derive(Subcommand, Debug)]
pub enum ElectricalProfilesCommands {
    Import(ImportProfileSetArgs),
    Delete(DeleteProfileSetArgs),
    List(ListProfileSetArgs),
}

#[derive(Args, Debug)]
#[command(about, long_about = "Add a set of electrical profiles")]
pub struct ImportProfileSetArgs {
    /// Electrical profile set name
    name: String,
    /// Electrical profile set file path
    electrical_profile_set_path: PathBuf,
}

#[derive(Args, Debug)]
#[command(
    about,
    long_about = "Delete electrical profile sets corresponding to the given ids"
)]
pub struct DeleteProfileSetArgs {
    /// List of infra ids
    profile_set_ids: Vec<i64>,
}

#[derive(Args, Debug)]
#[command(
    about,
    long_about = "List electrical profile sets in the database, <id> - <name>"
)]
pub struct ListProfileSetArgs {
    // Wether to display the list in a ready to parse format
    #[arg(long, default_value_t = false)]
    quiet: bool,
}

pub async fn electrical_profile_set_import(
    args: ImportProfileSetArgs,
    db_pool: Arc<DbConnectionPoolV2>,
) -> Result<(), Box<dyn Error + Send + Sync>> {
    let electrical_profile_set_file = File::open(args.electrical_profile_set_path)?;

    let electrical_profile_set_data: ElectricalProfileSetData =
        serde_json::from_reader(BufReader::new(electrical_profile_set_file))?;
    let ep_set = ElectricalProfileSet::changeset()
        .name(args.name)
        .data(electrical_profile_set_data);

    let created_ep_set = ep_set.create(&mut db_pool.get().await?).await?;
    println!("✅ Electrical profile set {} created", created_ep_set.id);
    Ok(())
}

pub async fn electrical_profile_set_list(
    args: ListProfileSetArgs,
    db_pool: Arc<DbConnectionPoolV2>,
) -> Result<(), Box<dyn Error + Send + Sync>> {
    let electrical_profile_sets = ElectricalProfileSet::list_light(&mut db_pool.get().await?)
        .await
        .unwrap();
    if !args.quiet {
        println!("Electrical profile sets:\nID - Name");
    }
    for electrical_profile_set in electrical_profile_sets {
        println!(
            "{:<2} - {}",
            electrical_profile_set.id, electrical_profile_set.name
        );
    }
    Ok(())
}

pub async fn electrical_profile_set_delete(
    args: DeleteProfileSetArgs,
    db_pool: Arc<DbConnectionPoolV2>,
) -> Result<(), Box<dyn Error + Send + Sync>> {
    for profile_set_id in args.profile_set_ids {
        let deleted =
            ElectricalProfileSet::delete_static(&mut db_pool.get().await?, profile_set_id)
                .await
                .unwrap();
        if !deleted {
            println!("❎ Electrical profile set {} not found", profile_set_id);
        } else {
            println!("✅ Electrical profile set {} deleted", profile_set_id);
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use crate::models::fixtures::create_electrical_profile_set;

    use super::*;

    #[rstest::rstest]
    async fn test_electrical_profile_set_delete() {
        // GIVEN
        let db_pool = DbConnectionPoolV2::for_tests();
        let electrical_profile_set = create_electrical_profile_set(&mut db_pool.get_ok()).await;

        let args = DeleteProfileSetArgs {
            profile_set_ids: vec![electrical_profile_set.id],
        };

        // WHEN
        electrical_profile_set_delete(args, db_pool.clone().into())
            .await
            .unwrap();

        // THEN
        let empty = !ElectricalProfileSet::list_light(&mut db_pool.get_ok())
            .await
            .unwrap()
            .iter()
            .any(|eps| eps.id == electrical_profile_set.id);
        assert!(empty);
    }

    #[rstest::rstest]
    async fn test_electrical_profile_set_list_doesnt_fail() {
        let db_pool = DbConnectionPoolV2::for_tests();
        let _ = create_electrical_profile_set(&mut db_pool.get_ok()).await;
        for quiet in [true, false] {
            let args = ListProfileSetArgs { quiet };
            electrical_profile_set_list(args, db_pool.clone().into())
                .await
                .unwrap();
        }
    }
}
