use core::f64::consts::PI;

use super::BoundingBox;

// File containing dead_code until https://github.com/DGEXSolutions/osrd/issues/1795 is done

#[allow(dead_code)]
/// Coordinates and level of zoom in a cartesian coordinates system
pub struct Tile {
    x: u64,
    y: u64,
    z: u64,
}

#[allow(dead_code)]
/// North-West and South-East coordinates in a cartesian coordinates system
struct NwSeCoordinates {
    nw_x: u64,
    nw_y: u64,
    se_x: u64,
    se_y: u64,
}

#[allow(dead_code)]
/// Computes coordinates in a cartesian system
///
/// Bounding box documentation: https://wiki.openstreetmap.org/wiki/Bounding_Box
///
/// # Arguments
///
/// * `latitude` - A decimal number between -90.0 and 90.0
/// * `longitude` - A decimal number between -180.0 and 180.0
/// * `zoom` - An integer
fn xy_from_latitude_longitude(latitude: f64, longitude: f64, zoom: u64) -> (u64, u64) {
    let n = 2.0_f64.powf(zoom as f64);
    (
        ((longitude + 180.0) / 360.0 * n).floor() as u64,
        ((1.0 - latitude.to_radians().tan().asinh() / PI) / 2.0 * n).floor() as u64,
    )
}

#[allow(dead_code)]
/// Gets North-West and South-East cartesian coordinates from a bounding box and zoom value
///
/// Panics if the bbox is invalid
fn get_nw_se_coordinates(zoom: u64, bbox: &BoundingBox) -> NwSeCoordinates {
    assert!(bbox.is_valid());
    let (nw_x, nw_y) = xy_from_latitude_longitude(bbox.0 .1, bbox.0 .0, zoom);
    let (se_x, se_y) = xy_from_latitude_longitude(bbox.1 .1, bbox.1 .0, zoom);
    NwSeCoordinates {
        nw_x,
        nw_y,
        se_x,
        se_y,
    }
}

#[allow(dead_code)]
/// Gets tiles for a bounding box and a zoom value
pub fn get_tiles_to_invalidate(max_zoom: u64, bbox: &BoundingBox) -> Vec<Tile> {
    let mut affected_tiles: Vec<Tile> = Vec::new();
    for zoom in 0..(max_zoom + 1) {
        let NwSeCoordinates {
            nw_x,
            nw_y,
            se_x,
            se_y,
        } = get_nw_se_coordinates(zoom, bbox);
        for x in nw_x..(se_x + 1) {
            for y in se_y..(nw_y + 1) {
                affected_tiles.push(Tile { x, y, z: zoom })
            }
        }
    }
    affected_tiles
}

#[allow(dead_code)]
/// Counts tiles for a bounding box and a zoom value
pub fn count_tiles(max_zoom: u64, bbox: &BoundingBox) -> u64 {
    let mut count: u64 = 0;
    for zoom in 0..(max_zoom + 1) {
        let NwSeCoordinates {
            nw_x,
            nw_y,
            se_x,
            se_y,
        } = get_nw_se_coordinates(zoom, bbox);
        // Value added to count is positive or null since validity of bbox is checked in get_nw_se_coordinates()
        count += (se_x - nw_x) * (nw_y - se_y);
    }
    count
}

#[cfg(test)]
mod tests {
    use std::collections::HashSet;

    use crate::chartos::BoundingBox;

    use super::{count_tiles, get_tiles_to_invalidate};

    const CAMPUS_SNCF_BBOX: BoundingBox = BoundingBox((2.3535, 48.921), (2.3568, 48.922));

    #[test]
    fn find_tiles_to_invalidate() {
        let expected_tiles: HashSet<(u64, u64, u64)> = HashSet::from([
            (132786, 90113, 18),
            (132786, 90112, 18),
            (132788, 90112, 18),
            (132788, 90113, 18),
            (132785, 90112, 18),
            (132785, 90113, 18),
            (132787, 90112, 18),
            (132787, 90113, 18),
            (66394, 45056, 17),
            (66393, 45056, 17),
            (66392, 45056, 17),
            (33196, 22528, 16),
            (33197, 22528, 16),
            (16598, 11264, 15),
            (8299, 5632, 14),
            (4149, 2816, 13),
            (2074, 1408, 12),
            (1037, 704, 11),
            (518, 352, 10),
            (259, 176, 9),
            (129, 88, 8),
            (64, 44, 7),
            (32, 22, 6),
            (16, 11, 5),
            (8, 5, 4),
            (4, 2, 3),
            (2, 1, 2),
            (1, 0, 1),
            (0, 0, 0),
        ]);
        let found_tiles: HashSet<(u64, u64, u64)> = get_tiles_to_invalidate(18, &CAMPUS_SNCF_BBOX)
            .iter()
            .map(|tile| (tile.x, tile.y, tile.z))
            .collect();
        assert_eq!(expected_tiles, found_tiles);
    }

    #[test]
    fn test_count_tiles() {
        assert_eq!(count_tiles(18, &CAMPUS_SNCF_BBOX), 3);
    }
}
