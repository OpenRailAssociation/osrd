package fr.sncf.osrd.stdcm.preprocessing;

import static fr.sncf.osrd.stdcm.STDCMHelpers.meters;
import static fr.sncf.osrd.stdcm.preprocessing.implementation.UnavailableSpaceBuilder.computeUnavailableSpace;
import static fr.sncf.osrd.train.TestTrains.REALISTIC_FAST_TRAIN;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import fr.sncf.osrd.Helpers;
import fr.sncf.osrd.api.stdcm.STDCMRequest;
import fr.sncf.osrd.stdcm.OccupancySegment;
import fr.sncf.osrd.utils.DummyInfra;
import org.junit.jupiter.api.Test;
import java.util.Set;

public class UnavailableSpaceBuilderTests {
    @Test
    public void testNoOccupancy() throws Exception {
        var infra = Helpers.fullInfraFromRJS(Helpers.getExampleInfra("tiny_infra/infra.json"));
        var res = computeUnavailableSpace(infra.rawInfra(), infra.blockInfra(),
                Set.of(), REALISTIC_FAST_TRAIN, 0, 0);
        assertTrue(res.isEmpty());
    }

    @Test
    public void testFirstBlockOccupied() {
        var infra = DummyInfra.make();
        var firstBlock = infra.addBlock("a", "b", meters(1000));
        var secondBlock = infra.addBlock("b", "c", meters(1000));
        var res = computeUnavailableSpace(
                infra,
                infra,
                Set.of(new STDCMRequest.RouteOccupancy("a->b", 0, 100)),
                REALISTIC_FAST_TRAIN,
                0,
                0
        );
        assertEquals(
                Set.of(
                        new OccupancySegment(0, 100, 0, meters(1000)) // base occupancy
                ),
                res.get(firstBlock)
        );
        assertEquals(
                Set.of(
                        // If the train is in this area, the previous block would be "yellow", causing a conflict
                        new OccupancySegment(0, 100, 0, meters(1000))

                        // Margin added to the base occupancy to account for the train length,
                        // it can be removed if this test fails as it overlaps with the previous one
                        //new OccupancySegment(0, 100, 0, REALISTIC_FAST_TRAIN.getLength())
                ),
                res.get(secondBlock)
        );
    }

    @Test
    public void testSecondBlockOccupied() {
        var infra = DummyInfra.make();
        var firstBlock = infra.addBlock("a", "b", meters(1000));
        var secondBlock = infra.addBlock("b", "c", meters(1000));
        var res = computeUnavailableSpace(
                infra,
                infra,
                Set.of(new STDCMRequest.RouteOccupancy("b->c", 0, 100)),
                REALISTIC_FAST_TRAIN,
                0,
                0
        );
        assertEquals(
                Set.of(
                        // Entering this area would cause the train to see a signal that isn't green
                        new OccupancySegment(0, 100, meters(1000 - 400), meters(1000))
                ),
                res.get(firstBlock)
        );
        assertEquals(
                Set.of(
                        new OccupancySegment(0, 100, 0, meters(1000)) // base occupancy
                ),
                res.get(secondBlock)
        );
    }

    @Test
    public void testBranchingBlocks() {
        /*
        a1        b1
           \      ^
            v    /
            center
            ^    \
           /      v
         a2       b2
         */
        final var infra = DummyInfra.make();
        final var a1 = infra.addBlock("a1", "center", meters(1000));
        final var a2 = infra.addBlock("a2", "center", meters(1000));
        final var b1 = infra.addBlock("center", "b1", meters(1000));
        final var b2 = infra.addBlock("center", "b2", meters(1000));
        final var res = computeUnavailableSpace(
                infra,
                infra,
                Set.of(new STDCMRequest.RouteOccupancy("a1->center", 0, 100)),
                REALISTIC_FAST_TRAIN,
                0,
                0
        );
        assertEquals(
                Set.of(
                        new OccupancySegment(0, 100, 0, meters(1000)) // base occupancy
                ),
                res.get(a1)
        );
        assertEquals(
                Set.of(),
                res.get(a2)
        );
        assertEquals(
                Set.of(
                        // If the train is in this area, the previous block would be "yellow", causing a conflict
                        new OccupancySegment(0, 100, 0, meters(1000))

                        // Margin added to the base occupancy to account for the train length,
                        // it can be removed if this test fails as it overlaps with the previous one
                        // new OccupancySegment(0, 100, 0, REALISTIC_FAST_TRAIN.getLength())
                ),
                res.get(b1)
        );
        assertEquals(res.get(b1), res.get(b2));
    }

    @Test
    public void testThirdBlock() {
        var infra = DummyInfra.make();
        infra.addBlock("a", "b", meters(1000));
        infra.addBlock("b", "c", meters(1000));
        var thirdBlock = infra.addBlock("c", "d", meters(1000));
        var res = computeUnavailableSpace(
                infra,
                infra,
                Set.of(new STDCMRequest.RouteOccupancy("a->b", 0, 100)),
                REALISTIC_FAST_TRAIN,
                0,
                0
        );
        assertEquals(
                Set.of(
                        // The second block can't be occupied in that time because it would cause a "yellow" state
                        // in the first one (conflict), and this accounts for the extra margin needed in the third
                        // block caused by the train length
                        new OccupancySegment(0, 100, 0, meters(REALISTIC_FAST_TRAIN.getLength()))
                ),
                res.get(thirdBlock)
        );
    }

    @Test
    public void testGridMargins() {
        var infra = DummyInfra.make();
        var firstBlock = infra.addBlock("a", "b", meters(1000));
        var secondBlock = infra.addBlock("b", "c", meters(1000));
        var res = computeUnavailableSpace(
                infra,
                infra,
                Set.of(new STDCMRequest.RouteOccupancy("a->b", 100, 200)),
                REALISTIC_FAST_TRAIN,
                20,
                60
        );
        // TimeStart and TimeEnd should be adjusted because of the margins
        // (20s before and 60s after)
        assertEquals(
                Set.of(
                        new OccupancySegment(80, 260, 0, meters(1000))
                ),
                res.get(firstBlock)
        );
        assertEquals(
                Set.of(
                        new OccupancySegment(80, 260, 0, meters(1000))
                ),
                res.get(secondBlock)
        );
    }
}
