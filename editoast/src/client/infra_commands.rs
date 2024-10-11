use std::{error::Error, fs::File, io::BufReader, path::PathBuf, sync::Arc};

use clap::{Args, Subcommand};
use colored::Colorize as _;
use editoast_models::{DbConnection, DbConnectionPoolV2};
use editoast_schemas::infra::RailJson;

use crate::map::MapLayers;
use crate::models::prelude::*;
use crate::{infra_cache::InfraCache, models::Infra, views::infra::InfraApiError, CliError};
use crate::{map, ValkeyClient};

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
}

pub async fn clone_infra(
    infra_args: InfraCloneArgs,
    db_pool: Arc<DbConnectionPoolV2>,
) -> Result<(), Box<dyn Error + Send + Sync>> {
    let infra = Infra::retrieve(&mut db_pool.get().await?, infra_args.id as i64)
        .await?
        .ok_or_else(|| {
            // When EditoastError will be removed from the models crate,
            // this can become a retrieve_or_fail
            CliError::new(
                1,
                format!("❌ Infrastructure not found, ID: {}", infra_args.id),
            )
        })?;
    let new_name = infra_args
        .new_name
        .unwrap_or_else(|| format!("{} (clone)", infra.name));
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
) -> Result<(), Box<dyn Error + Send + Sync>> {
    let railjson_file = match File::open(args.railjson_path.clone()) {
        Ok(file) => file,
        Err(_) => {
            let error = CliError::new(
                1,
                format!(
                    "❌ Railjson file not found, Path: {}",
                    args.railjson_path.to_string_lossy()
                ),
            );
            return Err(Box::new(error));
        }
    };

    let infra_name = args.infra_name.clone().bold();

    let infra = Infra::changeset()
        .name(args.infra_name)
        .last_railjson_version();
    let railjson: RailJson = serde_json::from_reader(BufReader::new(railjson_file))?;

    println!("🍞 Importing infra {infra_name}");
    let mut infra = infra.persist(railjson, &mut db_pool.get().await?).await?;

    infra
        .bump_version(&mut db_pool.get().await?)
        .await
        .map_err(|_| InfraApiError::NotFound { infra_id: infra.id })?;

    println!("✅ Infra {infra_name}[{}] saved!", infra.id);
    // Generate only if the was set
    if args.generate {
        let infra_cache = InfraCache::load(&mut db_pool.get().await?, &infra).await?;
        infra.refresh(db_pool, true, &infra_cache).await?;
        println!(
            "✅ Infra {infra_name}[{}] generated data refreshed!",
            infra.id
        );
    };
    Ok(())
}

/// Run the clear subcommand
/// This command clear all generated data for the given infra
pub async fn clear_infra(
    args: ClearArgs,
    db_pool: Arc<DbConnectionPoolV2>,
    valkey_config: ValkeyConfig,
) -> Result<(), Box<dyn Error + Send + Sync>> {
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
        build_valkey_pool_and_invalidate_all_cache(valkey_config.clone(), infra.id).await?;
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
) -> Result<(), Box<dyn Error + Send + Sync>> {
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
            build_valkey_pool_and_invalidate_all_cache(valkey_config.clone(), infra.id).await?;
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
) -> Result<(), Box<dyn Error + Send + Sync>> {
    let valkey = ValkeyClient::new(valkey_config).unwrap();
    let mut conn = valkey.get_connection().await.unwrap();
    Ok(map::invalidate_all(
        &mut conn,
        &MapLayers::parse().layers.keys().cloned().collect(),
        infra_id,
    )
    .await
    .map_err(|e| {
        Box::new(CliError::new(
            1,
            format!("Couldn't refresh valkey cache layers: {e}"),
        ))
    })?)
}

async fn batch_retrieve_infras(
    conn: &mut DbConnection,
    ids: &[u64],
) -> Result<Vec<Infra>, Box<dyn Error + Send + Sync>> {
    let (infras, missing) = Infra::retrieve_batch(conn, ids.iter().map(|id| *id as i64)).await?;
    if !missing.is_empty() {
        let error = CliError::new(
            1,
            format!(
                "❌ Infrastructures not found: {missing}",
                missing = missing
                    .iter()
                    .map(|id| id.to_string())
                    .collect::<Vec<_>>()
                    .join(", ")
            ),
        );
        return Err(Box::new(error));
    }
    Ok(infras)
}

#[cfg(test)]
mod tests {
    use rand::{distributions::Alphanumeric, thread_rng, Rng as _};

    use crate::client::generate_temp_file;

    use super::*;

    #[rstest::rstest]
    async fn import_railjson_ko_file_not_found() {
        // GIVEN
        let railjson_path = "non/existing/railjson/file/location";
        let args: ImportRailjsonArgs = ImportRailjsonArgs {
            infra_name: "test".into(),
            railjson_path: railjson_path.into(),
            generate: false,
        };

        // WHEN
        let result = import_railjson(args.clone(), DbConnectionPoolV2::for_tests().into()).await;

        // THEN
        assert!(result.is_err());
        assert_eq!(
            result
                .unwrap_err()
                .downcast_ref::<CliError>()
                .unwrap()
                .exit_code,
            1
        );
    }

    #[rstest::rstest]
    async fn import_railjson_ok() {
        // GIVEN
        let railjson = Default::default();
        let file = generate_temp_file::<RailJson>(&railjson);
        let infra_name = format!(
            "{}_{}",
            "infra",
            (0..10)
                .map(|_| thread_rng().sample(Alphanumeric) as char)
                .collect::<String>(),
        );
        let args: ImportRailjsonArgs = ImportRailjsonArgs {
            infra_name: infra_name.clone(),
            railjson_path: file.path().into(),
            generate: false,
        };

        // WHEN
        let result = import_railjson(args, DbConnectionPoolV2::for_tests().into()).await;

        // THEN
        assert!(result.is_ok());
    }
}
