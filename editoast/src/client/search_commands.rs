use std::{error::Error, fs, path::PathBuf, sync::Arc};

use clap::{Args, Subcommand};
use colored::Colorize as _;
use diesel::sql_query;
use diesel_async::RunQueryDsl as _;
use editoast_models::DbConnectionPoolV2;
use editoast_search::SearchConfigStore as _;

use crate::{views::search::SearchConfigFinder, CliError};

#[derive(Subcommand, Debug)]
pub enum SearchCommands {
    List,
    MakeMigration(MakeMigrationArgs),
    Refresh(RefreshArgs),
}

#[derive(Args, Debug)]
#[command(
    about,
    long_about = "Generate a migration's up.sql and down.sql content for a search object"
)]
pub struct MakeMigrationArgs {
    /// The search object to generate a migration for
    object: String,
    /// The directory of the migration
    migration: PathBuf,
    #[arg(short, long)]
    /// Overwrites the existing up.sql and down.sql files' content
    force: bool,
    #[arg(long)]
    /// Skips the default generation of down.sql to have smarter rollbacks
    skip_down: bool,
}

#[derive(Args, Debug)]
#[command(about, long_about = "Updates the content of the search cache tables")]
pub struct RefreshArgs {
    /// The search objects to refresh. If none, all search objects are refreshed
    objects: Vec<String>,
}

pub fn list_search_objects() {
    SearchConfigFinder::all().into_iter().for_each(|(name, _)| {
        println!("{name}");
    });
}

pub fn make_search_migration(args: MakeMigrationArgs) -> Result<(), Box<dyn Error + Send + Sync>> {
    let MakeMigrationArgs {
        object,
        migration,
        force,
        skip_down,
    } = args;
    let Some(search_config) = SearchConfigFinder::find(&object) else {
        let error = format!("❌ No search object found for {object}");
        return Err(Box::new(CliError::new(2, error)));
    };
    if !search_config.has_migration() {
        let error = format!("❌ No migration defined for {object}");
        return Err(Box::new(CliError::new(2, error)));
    }
    if !migration.is_dir() {
        let error = format!(
            "❌ {} is not a directory",
            migration.to_str().unwrap_or("<unprintable path>")
        );
        return Err(Box::new(CliError::new(2, error)));
    }
    let up_path = migration.join("up.sql");
    let down_path = migration.join("down.sql");
    let up_path_str = up_path.to_str().unwrap_or("<unprintable path>").to_owned();
    let down_path_str = down_path
        .to_str()
        .unwrap_or("<unprintable path>")
        .to_owned();
    if !force
        && (up_path.exists() && fs::read(up_path.clone()).is_ok_and(|v| !v.is_empty())
            || down_path.exists() && fs::read(down_path.clone()).is_ok_and(|v| !v.is_empty()))
    {
        let error = format!("❌ Migration {} already has content\nCowardly refusing to overwrite it\nUse {} at your own risk",
        migration.to_str().unwrap_or("<unprintable path>"),
        "--force".bold());
        return Err(Box::new(CliError::new(2, error)));
    }
    println!(
        "🤖 Generating migration {}",
        migration.to_str().unwrap_or("<unprintable path>")
    );
    let (up, down) = search_config.make_up_down();
    if let Err(err) = fs::write(up_path, up) {
        let error = format!("❌ Failed to write to {up_path_str}: {err}");
        return Err(Box::new(CliError::new(2, error)));
    }
    println!("➡️  Wrote to {up_path_str}");
    if !skip_down {
        if let Err(err) = fs::write(down_path, down) {
            let error = format!("❌ Failed to write to {down_path_str}: {err}");
            return Err(Box::new(CliError::new(2, error)));
        }
        println!("➡️  Wrote to {down_path_str}");
    }
    println!(
        "✅ Migration {} generated!\n🚨 Don't forget to run {} or {} to apply it",
        migration.to_str().unwrap_or("<unprintable path>"),
        "diesel migration run".bold(),
        "diesel migration redo".bold(),
    );
    Ok(())
}

pub async fn refresh_search_tables(
    args: RefreshArgs,
    db_pool: Arc<DbConnectionPoolV2>,
) -> Result<(), Box<dyn Error + Send + Sync>> {
    let objects = if args.objects.is_empty() {
        SearchConfigFinder::all()
            .into_iter()
            .filter_map(|(name, config)| config.has_migration().then(|| name.to_owned()))
            .collect()
    } else {
        args.objects
    };

    for object in objects {
        let Some(search_config) = SearchConfigFinder::find(&object) else {
            eprintln!("❌ No search object found for {object}");
            continue;
        };
        if !search_config.has_migration() {
            eprintln!("❌ No migration defined for {object}");
            continue;
        }
        println!("🤖 Refreshing search table for {}", object);
        println!("🚮 Dropping {} content", search_config.table);
        sql_query(search_config.clear_sql())
            .execute(&mut db_pool.get().await?.write().await)
            .await?;
        println!("♻️  Regenerating {}", search_config.table);
        sql_query(search_config.refresh_table_sql())
            .execute(&mut db_pool.get().await?.write().await)
            .await?;
        println!("✅ Search table for {} refreshed!", object);
    }
    Ok(())
}
