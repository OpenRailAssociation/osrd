use smol_str::SmolStr;

#[derive(Clone, PartialEq, Eq, Hash)]
pub(super) struct Waypoint {
    pub(super) primary_code: u64,
    pub(super) secondary_code: Option<SmolStr>,
    pub(super) stop: bool,
}

impl std::fmt::Debug for Waypoint {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(
            f,
            "{}{}{}",
            self.primary_code,
            self.secondary_code
                .as_ref()
                .map(|s| format!(":{s}"))
                .unwrap_or_default(),
            if self.stop { "[STOP]" } else { "" },
        )
    }
}
