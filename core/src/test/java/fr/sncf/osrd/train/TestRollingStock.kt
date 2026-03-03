package fr.sncf.osrd.train

import com.google.common.collect.ImmutableRangeMap
import com.google.common.collect.Lists
import com.google.common.collect.Range
import com.google.common.collect.RangeMap
import fr.sncf.osrd.envelope_sim.EnvelopeSimPathBuilder
import fr.sncf.osrd.envelope_sim.PhysicsRollingStock.InfraConditions
import fr.sncf.osrd.envelope_sim.PhysicsRollingStock.TractiveEffortPoint
import fr.sncf.osrd.path.interfaces.Electrification
import fr.sncf.osrd.path.interfaces.PhysicsPath
import fr.sncf.osrd.railjson.schema.rollingstock.Comfort
import fr.sncf.osrd.utils.units.Distance
import fr.sncf.osrd.utils.units.meters
import org.junit.jupiter.api.Assertions
import org.junit.jupiter.api.Test
import org.junit.jupiter.params.ParameterizedTest
import org.junit.jupiter.params.provider.Arguments
import org.junit.jupiter.params.provider.MethodSource

private fun maxSpeed(curve: Array<TractiveEffortPoint>): Double {
    return curve[curve.size - 1].speed
}

private fun mapTractiveEffortCurveArgs(): Iterable<Arguments> {
    val powerRestrictionMap =
        ImmutableRangeMap.builder<Double, String>()
            .put(Range.closedOpen(0.0, 10.0), "Restrict1")
            .put(Range.closed(10.0, 20.0), "Restrict2")
            .build()
    val emptyPowerRestrictionMap = ImmutableRangeMap.builder<Double, String>().build()
    return Lists.cartesianProduct(
            listOf(
                EnvelopeSimPathBuilder.withElectricalProfiles25000(40.0),
                EnvelopeSimPathBuilder.withElectricalProfiles25000(60.0),
                EnvelopeSimPathBuilder.withModes(50.0),
            ),
            listOf(Comfort.STANDARD, Comfort.AIR_CONDITIONING, Comfort.HEATING),
            listOf(powerRestrictionMap, emptyPowerRestrictionMap),
        )
        .map { Arguments.of(it[0], it[1], it[2]) }
}

class TestRollingStock {
    @ParameterizedTest
    @MethodSource("fr.sncf.osrd.train.TestRollingStockKt#mapTractiveEffortCurveArgs")
    fun testMapTractiveEffortCurveCoherent(
        path: PhysicsPath,
        comfort: Comfort,
        powerRestrictionMap: RangeMap<Double, String>,
    ) {
        val rollingStock = TestTrains.REALISTIC_FAST_TRAIN

        val elecCondMap: ImmutableRangeMap<Double, Electrification> =
            path.getElectrificationMap(
                rollingStock.basePowerClass,
                powerRestrictionMap,
                rollingStock.powerRestrictions,
                false,
            )
        val tractiveEffortCurveMap = rollingStock.mapTractiveEffortCurves(elecCondMap, comfort)
        Assertions.assertTrue(tractiveEffortCurveMap.conditions.fullyCovers(path.length.meters))
        Assertions.assertTrue(tractiveEffortCurveMap.curves.fullyCovers(path.length.meters))
    }

    @Test
    fun testMapTractiveEffortCurveWithProfiles() {
        val powerRestrictionMap =
            ImmutableRangeMap.builder<Double, String>()
                .put(Range.closedOpen(5.0, 11.0), "Restrict2")
                .put(Range.closedOpen(15.0, 18.0), "Restrict1")
                .put(Range.closed(18.0, 20.0), "UnknownRestrict")
                .build()
        val path = EnvelopeSimPathBuilder.withElectricalProfiles25000(50.0)

        val rollingStock = TestTrains.REALISTIC_FAST_TRAIN

        val comfort = Comfort.STANDARD
        val elecCondMap: ImmutableRangeMap<Double, Electrification> =
            path.getElectrificationMap(
                rollingStock.basePowerClass,
                powerRestrictionMap,
                rollingStock.powerRestrictions,
                false,
            )
        val res = rollingStock.mapTractiveEffortCurves(elecCondMap, comfort)

        Assertions.assertTrue(res.curves.fullyCovers(path.length.meters))
        Assertions.assertEquals(
            12,
            res.curves.subMap(Distance.ZERO, path.length.meters).count(),
            "wrong number of ranges",
        )

        // Check that the ranges are correct
        Assertions.assertIterableEquals(
            listOf(0.0, 1.0, 8.0, 8.1, 10.0, 11.0, 12.0, 14.0, 15.0, 17.0, 18.0, 20.0),
            res.curves.subMap(Distance.ZERO, path.length.meters).map { it.lower.meters },
        )

        // Check that the conditions are correct
        Assertions.assertIterableEquals(
            listOf(
                InfraConditions("thermal", null, null), // 0
                InfraConditions("1500V", null, null), // 1
                InfraConditions("thermal", null, null), // 8
                InfraConditions("25000V", null, "Restrict2"), // 8.1
                InfraConditions("25000V", "25000V", "Restrict2"), // 10
                InfraConditions("25000V", "25000V", null), // 11
                InfraConditions("25000V", "22500V", null), // 12
                InfraConditions("25000V", "20000V", null), // 14
                InfraConditions("25000V", "22500V", "Restrict1"), // 15
                InfraConditions("25000V", "25000V", "Restrict1"), // 17
                InfraConditions(
                    "25000V",
                    "25000V",
                    null,
                ), // 18 "UnknownRestrict" invalid for 25000V
                InfraConditions("thermal", null, null), // 20 No mode given
            ),
            res.conditions.subMap(0.meters, path.length.meters).map { it.value },
        )

        // Check that the curves are correct
        Assertions.assertArrayEquals(
            doubleArrayOf(
                TestTrains.MAX_SPEED * 0.92, // 0
                TestTrains.MAX_SPEED * 0.82, // 1
                TestTrains.MAX_SPEED * 0.92, // 8
                TestTrains.MAX_SPEED * 0.79, // 8.1
                TestTrains.MAX_SPEED * 0.79, // 10
                TestTrains.MAX_SPEED, // 11
                TestTrains.MAX_SPEED * 0.9, // 12
                TestTrains.MAX_SPEED * 0.8, // 14
                TestTrains.MAX_SPEED * 0.9 * 0.89, // 15
                TestTrains.MAX_SPEED * 0.89, // 17
                TestTrains.MAX_SPEED, // 18
                TestTrains.MAX_SPEED * 0.92, // 20
            ),
            res.curves
                .subMap(Distance.ZERO, path.length.meters)
                .map { maxSpeed(it.value) }
                .toDoubleArray(),
            0.001,
        )
    }
}
