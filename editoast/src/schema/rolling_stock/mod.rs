pub mod light_rolling_stock;

editoast_common::schemas! {
    RollingStockWithLiveries,
    light_rolling_stock::schemas(),
}

pub const ROLLING_STOCK_RAILJSON_VERSION: &str = "3.2";
