from chartos.layer_cache import find_tiles

from .test_data import campus_sncf_bbox, ref_tiles


def test_find_affected_tiles():
    tiles = {(tile.x, tile.y, tile.z) for tile in find_tiles(18, campus_sncf_bbox)}
    assert tiles == ref_tiles
