package fr.sncf.osrd.api.stdcm.LMP_algo;


import fr.sncf.osrd.api.stdcm.Objects.BlockUse;

import java.util.ArrayList;
import java.util.Objects;

public class PathGenerator {
    public static ArrayList<ArrayList<BlockUse>> generatePaths(
            STDCMConfig config,
            ArrayList<BlockUse> Bfree,
            int beginSignal,
            int endSignal
    ) {
        var residualCapacity = new ArrayList<ArrayList<ArrayList<BlockUse>>>();
        var B2next = new ArrayList<ArrayList<BlockUse>>();
        var Get2 = new ArrayList<ArrayList<ArrayList<BlockUse>>>();
        var paths = new ArrayList<ArrayList<BlockUse>>();

        // data
        double Lt = config.rollingStock.length; // Longueur train
        double Ds = 400; // Safety distance 400m

        // TODO: get it from the infra graph
        double Vc = (float) 160 / 3600; // Vitesse max canton

        int lim = 8600;

        int Xs = beginSignal;
        int Xfs = endSignal;

        int k = 0;
        for (var blockA : Bfree) {
            for (var blockB : Bfree) {
                double Tv = Ds / Vc;
                double Tr = Lt / Vc + blockA.getL() / Vc;
                double Tj = blockB.getL() / Vc;
                double Tj1 = 300 / Vc;
                var Tm = Tv + Tr + Tj;
                var Cm = (Ds + Lt + blockB.getL()) / Vc;
                if (blockA.getTf() - blockB.getT() >= Cm
                        && blockB.getTf() - blockA.getT() >= Tm + Tj1
                        && blockA.getXf() == blockB.getX()
                        && blockA.getX() != blockB.getXf()) {
                    B2next.add(new ArrayList<>());
                    B2next.get(k).add(blockA);
                    B2next.get(k).add(blockB);
                    k++;
                }
            }
        }

        // All routes
        int tem = B2next.size();
        int z = 0;
        residualCapacity.add(new ArrayList<>());
        residualCapacity.get(z).addAll(B2next);

        ArrayList<ArrayList<BlockUse>> Bnext;
        do {
            Bnext = new ArrayList<>();
            k = 0;

            for (int i = 0; i < tem; i++) {
                for (int j = 0; j < B2next.size(); j++) {
                    if (residualCapacity.get(z).get(i).get(0).getX() == Xs &&
                            residualCapacity.get(z).get(i).get(0).getXf() == Xfs &&
                            Objects.equals(residualCapacity.get(z).get(i).get(residualCapacity.get(z).get(i).size() - 1).getID(), B2next.get(j).get(0).getID()) &&
                            !residualCapacity.get(z).get(i).contains(B2next.get(j).get(1)) && k < lim) {
                        Bnext.add(new ArrayList<>());
                        Bnext.get(k).addAll(residualCapacity.get(z).get(i));
                        Bnext.get(k).add(B2next.get(j).get(1));
                        k++;
                    }
                }
            }

            if (Bnext.size() != 0) {
                tem = Bnext.size();
                residualCapacity.add(new ArrayList<>(Bnext));
                z++;
            }
        } while (Bnext.size() != 0);

        for (int zz = 0; zz < residualCapacity.size(); zz++) {
            Get2.add(new ArrayList<>());
            var etii = 0;

            for (int i = 0; i < residualCapacity.get(zz).size(); i++) {
                double dt = 400 / Vc + Lt / Vc;
                for (int tes = 0; tes < residualCapacity.get(zz).get(i).size(); tes++) {
                    if (tes == residualCapacity.get(zz).get(i).size() - 1) {
                        dt = dt + residualCapacity.get(zz).get(i).get(tes).getL() / Vc + 1500 / Vc;
                    } else {
                        dt = dt + residualCapacity.get(zz).get(i).get(tes).getL() / Vc;
                    }
                }

                if (residualCapacity.get(zz).get(i).get(residualCapacity.get(zz).get(i).size() - 1).getTf() - residualCapacity.get(zz).get(i).get(0).getT() >= dt
                        && residualCapacity.get(zz).get(i).get(residualCapacity.get(zz).get(i).size() - 1).getTf() - residualCapacity.get(zz).get(i).get(0).getT() < config.maxTime) {
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
