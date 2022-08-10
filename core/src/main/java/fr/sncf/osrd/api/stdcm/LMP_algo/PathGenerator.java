package fr.sncf.osrd.api.stdcm.LMP_algo;


import fr.sncf.osrd.api.pathfinding.request.PathfindingWaypoint;
import fr.sncf.osrd.api.stdcm.Objects.BlockUse;
import fr.sncf.osrd.api.stdcm.Objects.Tempo;
import fr.sncf.osrd.api.stdcm.STDCMEndpoint;
import fr.sncf.osrd.infra.api.signaling.SignalingInfra;
import fr.sncf.osrd.train.RollingStock;

import java.text.ParseException;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Objects;

public class PathGenerator {
    public static ArrayList<ArrayList<BlockUse>> path_generator(STDCMConfig config, ArrayList<BlockUse> Bfree) throws ParseException {
        SimpleDateFormat dateFormat = new SimpleDateFormat("HH:mm:ss");

        // residual capacity
        var Bvar = new ArrayList<ArrayList<ArrayList<BlockUse>>>();
        var B2next = new ArrayList<ArrayList<BlockUse>>();
        var Get2 = new ArrayList<ArrayList<ArrayList<BlockUse>>>();
        var paths = new ArrayList<ArrayList<BlockUse>>();

        // data
        double Lt = config.rollingStock.length; // Longueur train
        double Ds = 400; // Safety distance 400m

        // TODO: get it from the infra graph
        double Vc = (float) 160 / 3600; // Vitesse max canton

        double Cm = 1; //"01:00:00"; // Chevauchement mini
        double Tm = 0; //"03:00:00"; // Temps mini par canton
        int lim = 8600;

        int Xs = config.startPoint;
        int Xfs = config.endPoint;

        Tempo tem = new Tempo();
        int k = 0;
        for (var blockA : Bfree) {
            for (var blockB : Bfree) {
                double Tv = Ds / Vc;
                double Tr = Lt / Vc + blockA.getL() / Vc;
                double Tj = blockB.getL() / Vc;
                double Tj1 = 300 / Vc;
                Tm = Tv + Tr + Tj;
                Cm = (Ds + Lt + blockB.getL()) / Vc;
                if (dateFormat.parse(blockA.getTf()).getTime() - dateFormat.parse(blockB.getT()).getTime() >= Cm &&
                        dateFormat.parse(blockB.getTf()).getTime() - dateFormat.parse(blockA.getT()).getTime() >= Tm + Tj1 &&
                        blockA.getXf() == blockB.getX() &&
                        blockA.getX() != blockB.getXf()) {
                    B2next.add(new ArrayList<>());
                    B2next.get(k).add(blockA);
                    B2next.get(k).add(blockB);
                    k++;
                }
            }
        }

        // All routes
        tem.setValue(B2next.size());
        int z = 0;
        Bvar.add(new ArrayList<>());
        Bvar.get(z).addAll(B2next);

        ArrayList<ArrayList<BlockUse>> Bnext;
        do {
            Bnext = new ArrayList<>();
            k = 0;

            for (int i = 0; i < tem.getValue(); i++) {
                for (int j = 0; j < B2next.size(); j++) {
                    if (Bvar.get(z).get(i).get(0).getX() == Xs &&
                            Bvar.get(z).get(i).get(0).getXf() == Xfs &&
                            Objects.equals(Bvar.get(z).get(i).get(Bvar.get(z).get(i).size() - 1).getID(), B2next.get(j).get(0).getID()) &&
                            !Bvar.get(z).get(i).contains(B2next.get(j).get(1)) && k < lim) {
                        Bnext.add(new ArrayList<>());
                        Bnext.get(k).addAll(Bvar.get(z).get(i));
                        Bnext.get(k).add(B2next.get(j).get(1));
                        k++;
                    }
                }
            }

            if (Bnext.size() != 0) {
                tem.setValue(Bnext.size());
                Bvar.add(new ArrayList<>());
                z++;
                Bvar.get(z).addAll(Bnext);
            }
        } while (Bnext.size() != 0);

        for (int zz = 0; zz < Bvar.size(); zz++) {
            Get2.add(new ArrayList<>());
            var etii = 0;

            for (int i = 0; i < Bvar.get(zz).size(); i++) {
                double dt = 400 / Vc + Lt / Vc;
                for (int tes = 0; tes < Bvar.get(zz).get(i).size(); tes++) {
                    if (tes == Bvar.get(zz).get(i).size() - 1) {
                        dt = dt + Bvar.get(zz).get(i).get(tes).getL() / Vc + 1500 / Vc;
                    } else {
                        dt = dt + Bvar.get(zz).get(i).get(tes).getL() / Vc;
                    }
                }

                if (dateFormat.parse(Bvar.get(zz).get(i).get(Bvar.get(zz).get(i).size() - 1).getTf()).getTime() - dateFormat.parse(Bvar.get(zz).get(i).get(0).getT()).getTime() >= dt && dateFormat.parse(Bvar.get(zz).get(i).get(Bvar.get(zz).get(i).size() - 1).getTf()).getTime() - dateFormat.parse(Bvar.get(zz).get(i).get(0).getT()).getTime() < config.maxTime) {
                    Get2.get(zz).add(new ArrayList<>());
                    Get2.get(zz).get(etii).addAll(Bvar.get(zz).get(i));
                    etii++;
                }
            }
        }

        Bvar.clear();
        Bvar.addAll(Get2);

        int pat = 0;
        for (var arrayLists : Bvar) {
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
