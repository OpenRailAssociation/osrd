package fr.sncf.osrd.path

import fr.sncf.osrd.path.interfaces.GenericLinearRange
import fr.sncf.osrd.path.interfaces.mapSubObjects
import fr.sncf.osrd.sim_infra.api.Block
import fr.sncf.osrd.sim_infra.api.BlockId
import fr.sncf.osrd.sim_infra.api.Route
import fr.sncf.osrd.sim_infra.api.RouteId
import fr.sncf.osrd.utils.units.Length
import fr.sncf.osrd.utils.units.Offset
import fr.sncf.osrd.utils.units.meters
import kotlin.test.assertEquals
import org.junit.Test

class GenericLinearRangeTest {
    @Test
    fun testProjectionFullRange() {
        /*
        block offset (m)        0       50       100
        block:                  |---------------->
        projected offset:       |        x
        path:           --------|---------------->
        path offset (m)       1_000    1_050   1_100
         */
        val range =
            GenericLinearRange(
                value = BlockId(0U),
                objectBegin = Offset<Block>(0.meters),
                objectEnd = Offset(100.meters),
                pathBegin = Offset(1_000.meters),
                pathEnd = Offset(1_100.meters),
            )

        assertEquals(Offset(50.meters), range.offsetFromTrainPath(Offset(1_050.meters)))
        assertEquals(Offset(1_050.meters), range.offsetToTrainPath(Offset(50.meters)))
        assertEquals(Offset(1_000.meters), range.getObjectAbsolutePathStart())
        assertEquals(Offset(1_100.meters), range.getObjectAbsolutePathEnd(Length(100.meters)))
    }

    @Test
    fun testProjectionPartialRange() {
        /*
        block offset (m)      0   25     42    75      100
        block:                |----|------------|------->
                                          x
        path:                      |------------>
        path offset (m)            0     17    50
         */
        val range =
            GenericLinearRange(
                value = BlockId(0U),
                objectBegin = Offset<Block>(25.meters),
                objectEnd = Offset(75.meters),
                pathBegin = Offset(0.meters),
                pathEnd = Offset(50.meters),
            )

        assertEquals(Offset(42.meters), range.offsetFromTrainPath(Offset(17.meters)))
        assertEquals(Offset(17.meters), range.offsetToTrainPath(Offset(42.meters)))
        assertEquals(Offset((-25).meters), range.getObjectAbsolutePathStart())
        assertEquals(Offset(75.meters), range.getObjectAbsolutePathEnd(Length(100.meters)))
    }

    @Test
    fun testMapSubRange() {
        /*
        route offset (m)      0    100   250    400     600   750  800    1000
        route:                |-----+-----+------+-------+-----+----+------>
        path:                 +     +     |------+-------+----->    +      +
        path offset (m)     -250  -150    0     150     350   500  550    750
        blocks:               |----->|----+------>|------>|----+---->|----->
        block offsets         0    100   150    300     200   150  200    200
         */
        val range =
            GenericLinearRange(
                value = RouteId(0U),
                objectBegin = Offset<Route>(250.meters),
                objectEnd = Offset(750.meters),
                pathBegin = Offset(0.meters),
                pathEnd = Offset(500.meters),
            )
        val blocks = (0U..4U).map { BlockId(it) }
        val blockLengths = listOf(100, 300, 200, 200, 200).map { Length<Block>(it.meters) }

        val blockRanges =
            mapSubObjects(
                listOf(range),
                listSubObject = { blocks },
                subObjectLength = { blockLengths[it.index.toInt()] },
            )

        val expectedRanges =
            listOf(
                GenericLinearRange(
                    value = blocks[1],
                    objectBegin = Offset<Block>(150.meters),
                    objectEnd = Offset(300.meters),
                    pathBegin = Offset(0.meters),
                    pathEnd = Offset(150.meters),
                ),
                GenericLinearRange(
                    value = blocks[2],
                    objectBegin = Offset(0.meters),
                    objectEnd = Offset(200.meters),
                    pathBegin = Offset(150.meters),
                    pathEnd = Offset(350.meters),
                ),
                GenericLinearRange(
                    value = blocks[3],
                    objectBegin = Offset(0.meters),
                    objectEnd = Offset(150.meters),
                    pathBegin = Offset(350.meters),
                    pathEnd = Offset(500.meters),
                ),
            )
        assertEquals(expectedRanges, blockRanges)
    }
}
