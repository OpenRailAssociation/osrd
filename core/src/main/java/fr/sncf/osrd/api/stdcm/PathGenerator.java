package fr.sncf.osrd.api.stdcm;


import java.util.ArrayList;
import java.util.Objects;

public class PathGenerator {
    public static ArrayList<ArrayList<BlockUse>> generatePaths(
            STDCMConfig config,
            ArrayList<BlockUse> Bfree
    ) {
        var residualCapacity = new ArrayList<ArrayList<ArrayList<BlockUse>>>();
        var consecutiveBlockPairs = new ArrayList<ArrayList<BlockUse>>();
        var Get2 = new ArrayList<ArrayList<ArrayList<BlockUse>>>();
        var paths = new ArrayList<ArrayList<BlockUse>>();

        // data
        double Lt = config.rollingStock.length; // Longueur train
        double Ds = 400; // Safety distance 400m

        // TODO: get it from the infra graph
        double Vc = (float) 160 / 3600; // Vitesse max canton

        var Xs = config.startBlockEntrySig;
        var Xfs = config.startBlockExitSig;

        for (var blockA : Bfree) {
            for (var blockB : Bfree) {
                // only process the block pair if:
                //  - you can go from blockA from blockB
                //  - blockB does not loop back to the start of blockA
                // TODO: cleanup this comment
                // || (blockB.getExitSig() != null && blockB.getExitSig() == blockA.getEntrySig())
                if (blockA.getExitSig() == null || blockA.getExitSig() != blockB.getEntrySig())
                    continue;

                double Tv = Ds / Vc;
                double Tr = Lt / Vc + blockA.getLength() / Vc;
                double Tj = blockB.getLength() / Vc;
                double Tj1 = 300 / Vc;
                var Tm = Tv + Tr + Tj;
                var Cm = (Ds + Lt + blockB.getLength()) / Vc;
                if (blockA.reservationEndTime - blockB.reservationStartTime >= Cm
                        && blockB.reservationEndTime - blockA.reservationStartTime >= Tm + Tj1) {
                    var pair = new ArrayList<BlockUse>();
                    pair.add(blockA);
                    pair.add(blockB);
                    consecutiveBlockPairs.add(pair);
                }
            }
        }

        // All routes
        int tem = consecutiveBlockPairs.size();
        int z = 0;
        residualCapacity.add(new ArrayList<>());
        residualCapacity.get(z).addAll(consecutiveBlockPairs);

        ArrayList<ArrayList<BlockUse>> consecutiveBlocks;
        do {
            consecutiveBlocks = new ArrayList<>();

            for (int i = 0; i < tem; i++) {
                for (var consBlockPair : consecutiveBlockPairs) {
                    var curBlockUse = consBlockPair.get(0);
                    var nextBlockUse = consBlockPair.get(1);
                    if (residualCapacity.get(z).get(i).get(0).getEntrySig() == Xs
                            && residualCapacity.get(z).get(i).get(0).getExitSig() == Xfs
                            && residualCapacity.get(z).get(i).get(residualCapacity.get(z).get(i).size() - 1).block == curBlockUse.block
                            && !residualCapacity.get(z).get(i).contains(nextBlockUse)) {
                        var chain = new ArrayList<>(residualCapacity.get(z).get(i));
                        chain.add(nextBlockUse);
                        consecutiveBlocks.add(chain);
                    }
                }
            }

            if (consecutiveBlocks.size() != 0) {
                tem = consecutiveBlocks.size();
                residualCapacity.add(new ArrayList<>(consecutiveBlocks));
                z++;
            }
        } while (consecutiveBlocks.size() != 0);

        for (int zz = 0; zz < residualCapacity.size(); zz++) {
            Get2.add(new ArrayList<>());
            var etii = 0;

            for (int i = 0; i < residualCapacity.get(zz).size(); i++) {
                double dt = 400 / Vc + Lt / Vc;
                for (int tes = 0; tes < residualCapacity.get(zz).get(i).size(); tes++) {
                    if (tes == residualCapacity.get(zz).get(i).size() - 1) {
                        dt = dt + residualCapacity.get(zz).get(i).get(tes).getLength() / Vc + 1500 / Vc;
                    } else {
                        dt = dt + residualCapacity.get(zz).get(i).get(tes).getLength() / Vc;
                    }
                }

                if (residualCapacity.get(zz).get(i).get(residualCapacity.get(zz).get(i).size() - 1).reservationEndTime - residualCapacity.get(zz).get(i).get(0).reservationStartTime >= dt
                        && residualCapacity.get(zz).get(i).get(residualCapacity.get(zz).get(i).size() - 1).reservationEndTime - residualCapacity.get(zz).get(i).get(0).reservationStartTime < config.maxTime) {
                    Get2.get(zz).add(new ArrayList<>());
                    Get2.get(zz).get(etii).addAll(residualCapacity.get(zz).get(i));
                    etii++;
                }
            }
        }

        residualCapacity.clear();
        residualCapacity.addAll(Get2);

        int pat = 0;
        for (var arrayLists : residualCapacity) {
            for (var arrayList : arrayLists) {
                if (!arrayList.isEmpty()) {
                    paths.add(new ArrayList<>());
                    paths.get(pat).addAll(arrayList);
                    pat++;
                }
            }
        }
        return paths;
    }
}
