package fr.sncf.osrd.api.stdcm;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;

public class PathGenerator {
    /** Generates all possible paths from the start to all points */
    @SuppressWarnings("LocalVariableName")
    public static ArrayList<List<BlockUse>> generatePaths(
            STDCMConfig config,
            ArrayList<BlockUse> freeBlockUses
    ) {
        var nextBlocksMap = new HashMap<BlockUse, List<BlockUse>>();

        // data
        double Lt = config.rollingStock.length; // Longueur train
        double Ds = 400; // Safety distance 400m

        // TODO: get it from the infra graph
        double Vc = (float) 160 / 3.6; // Vitesse max canton

        for (var curBlock : freeBlockUses) {
            var nextBlocks = new ArrayList<BlockUse>();
            nextBlocksMap.put(curBlock, nextBlocks);
            for (var nextBlock : freeBlockUses) {
                // only process the block pair if:
                //  - you can go from blockA from blockB
                //  - blockB does not loop back to the start of blockA
                // TODO: cleanup this comment
                // || (blockB.getExitSig() != null && blockB.getExitSig() == blockA.getEntrySig())
                if (!curBlock.block.route.getInfraRoute().getExitDetector().equals(
                        nextBlock.block.route.getInfraRoute().getEntryDetector()))
                    continue;

                double Tv = Ds / Vc;
                double Tr = Lt / Vc + curBlock.getLength() / Vc;
                double Tj = nextBlock.getLength() / Vc;
                double Tj1 = 300 / Vc;
                var Tm = Tv + Tr + Tj;
                var Cm = (Ds + Lt + nextBlock.getLength()) / Vc;
                if (curBlock.reservationEndTime - nextBlock.reservationStartTime >= Cm
                        && nextBlock.reservationEndTime - curBlock.reservationStartTime >= Tm + Tj1)
                    nextBlocks.add(nextBlock);
            }
        }

        // find the set of all block uses which can start a path
        var startBlockUses = new ArrayList<BlockUse>();
        for (var curBlock : freeBlockUses)
            if (config.startSignalingRoutes.contains(curBlock.block.route))
                startBlockUses.add(curBlock);

        // All routes
        // residualCapacity[0] is the set of all paths of length 1
        // residualCapacity[1] is the set of all paths of length 2

        // fill an initial set of paths with a length of 1
        var initialPathsSet = new ArrayList<List<BlockUse>>();
        for (var startBlock : startBlockUses)
            initialPathsSet.add(List.of(startBlock));

        // while longer paths can be built, do so
        var longestChains = initialPathsSet;
        var residualCapacity = new ArrayList<List<List<BlockUse>>>();
        while (!longestChains.isEmpty()) {
            residualCapacity.add(new ArrayList<>(longestChains));
            // build the next length of paths from the last iteration
            var nextChainLenSet = new ArrayList<List<BlockUse>>();
            for (var possiblePath : longestChains) {
                var lastBlockUse = possiblePath.get(possiblePath.size() - 1);
                for (var possibleNextBlock : nextBlocksMap.get(lastBlockUse)) {
                    // avoid loops
                    if (possiblePath.contains(possibleNextBlock))
                        continue;
                    var newPath = new ArrayList<>(possiblePath);
                    newPath.add(possibleNextBlock);
                    nextChainLenSet.add(newPath);
                }
            }
            longestChains = nextChainLenSet;
        }

        var newResCap = new ArrayList<List<List<BlockUse>>>();
        for (var oldCapCur : residualCapacity) {
            var newCapLevel = new ArrayList<List<BlockUse>>();
            newResCap.add(newCapLevel);

            for (var curPath : oldCapCur) {
                double dt = 400 / Vc + Lt / Vc;
                for (int tes = 0; tes < curPath.size(); tes++) {
                    if (tes == curPath.size() - 1) {
                        dt += curPath.get(tes).getLength() / Vc + 1500 / Vc;
                    } else {
                        dt += curPath.get(tes).getLength() / Vc;
                    }
                }

                var curPathStart = curPath.get(0);
                var curPathEnd = curPath.get(curPath.size() - 1);
                if (curPathEnd.reservationEndTime - curPathStart.reservationStartTime >= dt)
                    newCapLevel.add(new ArrayList<>(curPath));
            }
        }

        residualCapacity.clear();
        residualCapacity.addAll(newResCap);

        var paths = new ArrayList<List<BlockUse>>();
        for (var level : residualCapacity)
            for (var path : level) {
                assert !path.isEmpty();
                paths.add(path);
            }
        return paths;
    }
}
