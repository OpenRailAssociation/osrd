package fr.sncf.osrd.stdcm.preprocessing;

import static fr.sncf.osrd.stdcm.STDCMHelpers.meters;
import static fr.sncf.osrd.stdcm.preprocessing.implementation.UnavailableSpaceBuilder.computeUnavailableSpace;
import static fr.sncf.osrd.train.TestTrains.REALISTIC_FAST_TRAIN;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import fr.sncf.osrd.Helpers;
import fr.sncf.osrd.api.stdcm.STDCMRequest;
import fr.sncf.osrd.standalone_sim.result.ResultTrain;
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
                Set.of(new ResultTrain.SpacingRequirement("a->b", 0, 100)),
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
                        // The train needs to have fully cleared the first block,
                        // its head can't be in the beginning of the second block
                        new OccupancySegment(0, 100, 0, meters(REALISTIC_FAST_TRAIN.getLength()))
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
                Set.of(new ResultTrain.SpacingRequirement("b->c", 0, 100)),
                REALISTIC_FAST_TRAIN,
                0,
                0
        );
        assertEquals(
                Set.of(
                        // This block would display a warning and wouldn't be available
                        new OccupancySegment(0, 100, 0, meters(1000))
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
                Set.of(new ResultTrain.SpacingRequirement("center->b1", 0, 100)),
                REALISTIC_FAST_TRAIN,
                0,
                0
        );
        assertEquals(
                Set.of(
                        new OccupancySegment(0, 100, 0, meters(1000)) // base occupancy
                ),
                res.get(b1)
        );
        assertEquals(
                Set.of(),
                res.get(b2)
        );
        assertEquals(
                Set.of(
                        // The previous block would display a warning
                        new OccupancySegment(0, 100, 0, meters(1000))
                ),
                res.get(b1)
        );
        assertEquals(res.get(a1), res.get(a2));
    }

    @Test
    public void testThirdBlock() {
        var infra = DummyInfra.make();
        var firstBlock = infra.addBlock("a", "b", meters(1000));
        infra.addBlock("b", "c", meters(1000));
        infra.addBlock("c", "d", meters(1000));
        var res = computeUnavailableSpace(
                infra,
                infra,
                Set.of(new ResultTrain.SpacingRequirement("c->d", 0, 100)),
                REALISTIC_FAST_TRAIN,
                0,
                0
        );
        assertEquals(
                Set.of(
                        // Second block displays a warning, first block can't be used in the area where
                        // the signal of the second block is visible
                        new OccupancySegment(0, 100, meters(1000 - 400), meters(1000))
                ),
                res.get(firstBlock)
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
                Set.of(new ResultTrain.SpacingRequirement("b->c", 100, 200)),
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
