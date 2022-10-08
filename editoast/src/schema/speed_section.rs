use super::generate_id;
use super::ApplicableDirectionsTrackRange;
use super::OSRDObject;
use super::ObjectType;
use super::Panel;
use crate::api_error::ApiError;
use crate::diesel::ExpressionMethods;
use crate::diesel::RunQueryDsl;
use crate::infra_cache::Cache;
use crate::infra_cache::ObjectCache;
use crate::tables::osrd_infra_speedsectionmodel::dsl::*;
use derivative::Derivative;
use diesel::PgConnection;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Derivative, Clone, Deserialize, Serialize, PartialEq)]
#[serde(deny_unknown_fields)]
#[derivative(Default)]
pub struct SpeedSection {
    #[derivative(Default(value = r#"generate_id("speed_section")"#))]
    pub id: String,
    #[derivative(Default(value = "Some(80.)"))]
    pub speed_limit: Option<f64>,
    pub speed_limit_by_tag: HashMap<String, f64>,
    pub track_ranges: Vec<ApplicableDirectionsTrackRange>,
    #[serde(default)]
    pub extensions: SpeedSectionExtensions,
}

#[derive(Debug, Default, Clone, Deserialize, Serialize, PartialEq)]
#[serde(deny_unknown_fields)]
pub struct SpeedSectionExtensions {
    pub lpv_sncf: Option<SpeedSectionLpvSncfExtension>,
}

#[derive(Debug, Default, Clone, Deserialize, Serialize, PartialEq)]
#[serde(deny_unknown_fields)]
pub struct SpeedSectionLpvSncfExtension {
    announcement: Vec<Panel>,
    z: Panel,
    r: Vec<Panel>,
}

impl SpeedSection {
    pub fn persist_batch(
        values: &[Self],
        infrastructure_id: i32,
        conn: &PgConnection,
    ) -> Result<(), Box<dyn ApiError>> {
        let datas = values
            .iter()
            .map(|value| {
                (
                    obj_id.eq(value.get_id().clone()),
                    data.eq(serde_json::to_value(value).unwrap()),
                    infra_id.eq(infrastructure_id),
                )
            })
            .collect::<Vec<_>>();

        diesel::insert_into(osrd_infra_speedsectionmodel)
            .values(datas)
            .execute(conn)?;

        Ok(())
    }
}

impl OSRDObject for SpeedSection {
    fn get_id(&self) -> &String {
        &self.id
    }
    fn get_type(&self) -> ObjectType {
        ObjectType::SpeedSection
    }
}

impl Cache for SpeedSection {
    fn get_track_referenced_id(&self) -> Vec<&String> {
        let mut res: Vec<_> = self.track_ranges.iter().map(|tr| &tr.track).collect();
        if let Some(lpv) = &self.extensions.lpv_sncf {
            res.extend(lpv.announcement.iter().map(|panel| &panel.track));
            res.extend(lpv.r.iter().map(|panel| &panel.track));
            res.push(&lpv.z.track);
        }
        res
    }

    fn get_object_cache(&self) -> ObjectCache {
        ObjectCache::SpeedSection(self.clone())
    }
}

#[cfg(test)]
mod test {
    use super::SpeedSection;
    use super::SpeedSectionExtensions;
    use crate::infra::tests::test_infra_transaction;
    use serde_json::from_str;

    #[test]
    fn test_speed_section_extensions_deserialization() {
        from_str::<SpeedSectionExtensions>(r#"{}"#).unwrap();
    }

    #[test]
    fn test_persist() {
        test_infra_transaction(|conn, infra| {
            let data = (0..10)
                .map(|_| SpeedSection::default())
                .collect::<Vec<SpeedSection>>();

            assert!(SpeedSection::persist_batch(&data, infra.id, conn).is_ok());
        });
    }
}
