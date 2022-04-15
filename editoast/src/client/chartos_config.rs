use clap::Args;
use derivative::Derivative;

#[derive(Args, Debug, Derivative)]
#[derivative(Default)]
pub struct ChartosConfig {
    #[derivative(Default(value = r#""http://localhost:7000/".into()"#))]
    #[clap(long, env, default_value = "http://localhost:7000/")]
    chartos_url: String,
    #[clap(long, env, default_value_t)]
    pub chartos_token: String,
}

impl ChartosConfig {
    pub fn url(&self) -> String {
        if self.chartos_url.ends_with('/') {
            self.chartos_url.clone()
        } else {
            format!("{}/", self.chartos_url)
        }
    }
}
