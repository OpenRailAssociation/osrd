use clap::{Args, Parser};

#[derive(Parser, Debug)]
#[clap(author, version, about, long_about = None)]
pub enum Client {
    Runserver(RunserverCommand),
}

#[derive(Args, Debug)]
#[clap(author, version, about, long_about = "Run the server")]
pub struct RunserverCommand {
    #[clap(long, env = "ROOT_URL", default_value = "/")]
    pub root_url: String,
    #[clap(long, env = "PORT", default_value_t = 8090)]
    pub port: u16,
}
