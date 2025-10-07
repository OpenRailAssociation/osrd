use std::fs::File;
use std::io::BufReader;
use std::path::PathBuf;
use std::sync::Arc;

use clap::Args;
use clap::Subcommand;
use colored::Colorize as _;
use database::DbConnection;
use database::DbConnectionPoolV2;
use schemas::infra::RailJson;

use crate::infra_cache::InfraCache;
use crate::map;
use crate::models::Infra;
use cache;
use editoast_models::map::MapLayers;
use editoast_models::prelude::*;

use super::ValkeyConfig;

#[derive(Subcommand, Debug)]
pub enum InfraCommands {
    Clone(InfraCloneArgs),
    Clear(ClearArgs),
    Generate(GenerateArgs),
    ImportRailjson(ImportRailjsonArgs),
}

#[derive(Args, Debug, Clone)]
#[command(about, long_about = "Clone an infrastructure")]
pub struct InfraCloneArgs {
    /// Infrastructure ID
    id: u64,
    /// Infrastructure new name
    new_name: Option<String>,
}

#[derive(Args, Debug)]
#[command(about, long_about = "Clear infra generated data")]
pub struct ClearArgs {
    /// List of infra ids
    infra_ids: Vec<u64>,
}

#[derive(Args, Debug)]
#[command(about, long_about = "Refresh infra generated data")]
pub struct GenerateArgs {
    /// List of infra ids
    infra_ids: Vec<u64>,
    #[arg(short, long)]
    /// Force the refresh of an infra (even if the generated version is up to date)
    force: bool,
}

#[derive(Args, Debug, Clone)]
#[command(about, long_about = "Import an infra given a railjson file")]
pub struct ImportRailjsonArgs {
    /// Infra name
    infra_name: String,
    /// Railjson file path
    railjson_path: PathBuf,
    /// Whether the import should refresh generated data
    #[arg(short = 'g', long)]
    generate: bool,
    /// Only print the generated infra id (useful when scripting)
    #[arg(short = 'q', long)]
    quiet: bool,
}

pub async fn clone_infra(
    infra_args: InfraCloneArgs,
    db_pool: Arc<DbConnectionPoolV2>,
) -> anyhow::Result<()> {
    let infra = Infra::retrieve_or_fail(db_pool.get().await?, infra_args.id as i64, || {
        anyhow::anyhow!("Infrastructure not found, ID: {}", infra_args.id)
    })
    .await?;
    let new_name = infra_args
        .new_name
        .unwrap_or_else(|| format!("{name} (clone)", name = infra.name));
    let cloned_infra = infra.clone(&mut db_pool.get().await?, new_name).await?;
    println!(
        "✅ Infra {} (ID: {}) was successfully cloned",
        cloned_infra.name.bold(),
        cloned_infra.id
    );
    Ok(())
}

pub async fn import_railjson(
    args: ImportRailjsonArgs,
    db_pool: Arc<DbConnectionPoolV2>,
) -> anyhow::Result<()> {
    let railjson_file = match File::open(args.railjson_path.clone()) {
        Ok(file) => file,
        Err(_) => {
            anyhow::bail!(
                "Railjson file not found, Path: {}",
                args.railjson_path.to_string_lossy()
            );
        }
    };

    let infra_name = args.infra_name.clone().bold();

    let infra = Infra::changeset()
        .name(args.infra_name)
        .last_railjson_version();
    let railjson: RailJson = serde_json::from_reader(BufReader::new(railjson_file))?;

    if !args.quiet {
        println!("🍞 Importing infra {infra_name}");
    }
    let mut infra = infra.persist(railjson, &mut db_pool.get().await?).await?;

    infra.bump_version(&mut db_pool.get().await?).await?;

    if !args.quiet {
        println!("✅ Infra {infra_name}[{}] saved!", infra.id);
    }

    // Generate only if the flag was set
    if args.generate {
        let infra_cache = InfraCache::load(&mut db_pool.get().await?, &infra).await?;
        infra.refresh(db_pool.clone(), true, &infra_cache).await?;
        if !args.quiet {
            println!(
                "✅ Infra {infra_name}[{}] generated data refreshed!",
                infra.id
            );
        }

        let error_counts = infra.get_error_summary(&mut db_pool.get().await?).await?;
        if !error_counts.is_empty() && !args.quiet {
            println!("🚨 Infra {infra_name}[{}] has errors:", infra.id);
            for ((error_type, object_type), count) in error_counts {
                println!("  - {:<15} {} {}", object_type.bold(), count, error_type);
            }
        }
    };
    if args.quiet {
        println!("{}", infra.id);
    }
    Ok(())
}

/// Run the clear subcommand
/// This command clear all generated data for the given infra
pub async fn clear_infra(
    args: ClearArgs,
    db_pool: Arc<DbConnectionPoolV2>,
    valkey_config: ValkeyConfig,
    app_version: Option<&str>,
) -> anyhow::Result<()> {
    let mut infras = vec![];
    if args.infra_ids.is_empty() {
        // Retrieve all available infra
        for infra in Infra::all(&mut db_pool.get().await?).await {
            infras.push(infra);
        }
    } else {
        // Retrieve given infras
        infras = batch_retrieve_infras(&mut db_pool.get().await?, &args.infra_ids).await?;
    };

    for mut infra in infras {
        println!(
            "🍞 Infra {}[{}] is clearing:",
            infra.name.clone().bold(),
            infra.id
        );
        build_valkey_pool_and_invalidate_all_cache(valkey_config.clone(), infra.id, app_version)
            .await?;
        infra.clear(&mut db_pool.get().await?).await?;
        println!("✅ Infra {}[{}] cleared!", infra.name.bold(), infra.id);
    }
    Ok(())
}

/// Run the generate sub command
/// This command refresh all infra given as input (if no infra given then refresh all of them)
pub async fn generate_infra(
    args: GenerateArgs,
    db_pool: Arc<DbConnectionPoolV2>,
    valkey_config: ValkeyConfig,
    app_version: Option<&str>,
) -> anyhow::Result<()> {
    let mut infras = vec![];
    if args.infra_ids.is_empty() {
        // Retrieve all available infra
        for infra in Infra::all(&mut db_pool.get().await?).await {
            infras.push(infra);
        }
    } else {
        // Retrieve given infras
        infras = batch_retrieve_infras(&mut db_pool.get().await?, &args.infra_ids).await?;
    }
    for mut infra in infras {
        println!(
            "🍞 Infra {}[{}] is generating:",
            infra.name.clone().bold(),
            infra.id
        );
        let infra_cache = InfraCache::load(&mut db_pool.get().await?, &infra).await?;
        if infra
            .refresh(db_pool.clone(), args.force, &infra_cache)
            .await?
        {
            build_valkey_pool_and_invalidate_all_cache(
                valkey_config.clone(),
                infra.id,
                app_version,
            )
            .await?;
            println!("✅ Infra {}[{}] generated!", infra.name.bold(), infra.id);
        } else {
            println!(
                "✅ Infra {}[{}] already generated!",
                infra.name.bold(),
                infra.id
            );
        }
    }
    println!(
        "🚨 You may want to refresh the search caches. If so, use {}.",
        "editoast search refresh".bold()
    );
    Ok(())
}

async fn build_valkey_pool_and_invalidate_all_cache(
    valkey_config: ValkeyConfig,
    infra_id: i64,
    app_version: Option<&str>,
) -> anyhow::Result<()> {
    let valkey = cache::Client::new(
        valkey_config.into_cache_config(),
        app_version.unwrap_or_default(),
    );
    let mut conn = valkey.get_connection().await?;
    map::invalidate_all(
        &mut conn,
        &MapLayers::default().layers.keys().cloned().collect(),
        infra_id,
        app_version,
    )
    .await
    .map_err(|e| anyhow::anyhow!("Couldn't refresh valkey cache layers: {e}"))
}

async fn batch_retrieve_infras(conn: &mut DbConnection, ids: &[u64]) -> anyhow::Result<Vec<Infra>> {
    let (infras, missing) = Infra::retrieve_batch(conn, ids.iter().map(|id| *id as i64)).await?;
    if !missing.is_empty() {
        anyhow::bail!(
            "Infrastructures not found: {}",
            missing
                .iter()
                .map(|id| id.to_string())
                .collect::<Vec<_>>()
                .join(", ")
        );
    }
    Ok(infras)
}

#[cfg(test)]
mod tests {
    use rand::Rng as _;
    use rand::distr::Alphanumeric;
    use rand::rng;

    use crate::client::generate_temp_file;

    use super::*;

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn import_railjson_ko_file_not_found() {
        // GIVEN
        let railjson_path = "non/existing/railjson/file/location";
        let args: ImportRailjsonArgs = ImportRailjsonArgs {
            infra_name: "test".into(),
            railjson_path: railjson_path.into(),
            generate: false,
            quiet: false,
        };

        // WHEN
        let result = import_railjson(args.clone(), DbConnectionPoolV2::for_tests().into()).await;

        // THEN
        assert!(result.is_err());
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn import_railjson_ok() {
        // GIVEN
        let railjson = Default::default();
        let file = generate_temp_file::<RailJson>(&railjson);
        let infra_name = format!(
            "{}_{}",
            "infra",
            (0..10)
                .map(|_| rng().sample(Alphanumeric) as char)
                .collect::<String>(),
        );
        let args: ImportRailjsonArgs = ImportRailjsonArgs {
            infra_name: infra_name.clone(),
            railjson_path: file.path().into(),
            generate: false,
            quiet: false,
        };

        // WHEN
        let result = import_railjson(args, DbConnectionPoolV2::for_tests().into()).await;

        // THEN
        assert!(result.is_ok());
    }
}
