use clap::Args;
use derivative::Derivative;

#[derive(Args, Debug, Derivative, Clone)]
#[derivative(Default)]
pub struct RedisConfig {
    #[derivative(Default(value = r#""redis://localhost:6379".into()"#))]
    #[clap(long, env, default_value = "redis://localhost:6379")]
    /// Redis url like `redis://[:PASSWORD@]HOST[:PORT][/DATABASE]`
    pub redis_url: String,
}
