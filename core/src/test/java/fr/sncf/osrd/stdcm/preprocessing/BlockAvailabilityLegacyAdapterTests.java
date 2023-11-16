package fr.sncf.osrd.stdcm.preprocessing;

import static fr.sncf.osrd.Helpers.getBlocksOnRoutes;
import static fr.sncf.osrd.Helpers.getSmallInfra;
import static fr.sncf.osrd.stdcm.STDCMHelpers.meters;
import static org.junit.jupiter.api.Assertions.assertEquals;

import fr.sncf.osrd.envelope.Envelope;
import fr.sncf.osrd.envelope.EnvelopeTestUtils;
import fr.sncf.osrd.envelope_sim.SimpleRollingStock;
import fr.sncf.osrd.sim_infra.api.InterlockingInfraKt;
import fr.sncf.osrd.standalone_sim.result.ResultTrain;
import fr.sncf.osrd.stdcm.preprocessing.implementation.BlockAvailabilityLegacyAdapter;
import fr.sncf.osrd.stdcm.preprocessing.implementation.UnavailableSpaceBuilder;
import fr.sncf.osrd.stdcm.preprocessing.interfaces.BlockAvailabilityInterface;
import org.junit.jupiter.api.Test;
import java.util.List;

public class BlockAvailabilityLegacyAdapterTests {

    /** This is just a simple smoke test, the class is expected to be replaced very soon
     * so there's no need for extended testing */
    @Test
    public void simpleUnavailableRouteTest() {
        var infra = getSmallInfra();
        var routes = List.of(
                "rt.DA0->DA6",
                "rt.DA6->DC6"
        );
        var blocks = getBlocksOnRoutes(infra, routes);
        var zone = InterlockingInfraKt.getZonePathZone(infra.rawInfra(),
                infra.blockInfra().getBlockPath(blocks.get(0)).get(0));
        var zoneName = infra.rawInfra().getZoneName(zone);

        double startOccupancy = 42;
        double endOccupancy = 84;

        var unavailableSpace = UnavailableSpaceBuilder.computeUnavailableSpace(
                infra.rawInfra(),
                infra.blockInfra(),
                List.of(new ResultTrain.SpacingRequirement(
                        zoneName,
                        startOccupancy,
                        endOccupancy
                )),
                SimpleRollingStock.STANDARD_TRAIN,
                10,
                20
        );
        var adapter = new BlockAvailabilityLegacyAdapter(infra.blockInfra(), unavailableSpace);
        var res = adapter.getAvailability(
                List.of(blocks.get(0)),
                0,
                meters(1),
                Envelope.make(EnvelopeTestUtils.generateTimes(new double[]{0., 1.}, new double[]{100., 100.})),
                42
        );
        var expected = new BlockAvailabilityInterface.Unavailable(42 + 20, 0);
        assertEquals(expected, res);
    }
}
