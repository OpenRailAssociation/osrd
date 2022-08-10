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

public class path_generation {
    public ArrayList<ArrayList<BlockUse>> path_generator(ArrayList<BlockUse> Bfree, SignalingInfra infra, RollingStock rollingStock, double startTime, double endTime, Collection<PathfindingWaypoint> startPoint, Collection<PathfindingWaypoint> endPoint, Collection<STDCMEndpoint.RouteOccupancy> occupancy) throws ParseException {
        SimpleDateFormat dateFormat = new SimpleDateFormat("HH:mm:ss");

        ArrayList<ArrayList<ArrayList<BlockUse>>> Bvar = new ArrayList<ArrayList<ArrayList<BlockUse>>>();
        ArrayList<ArrayList<BlockUse>> B2next = new ArrayList<ArrayList<BlockUse>>();
        ArrayList<ArrayList<ArrayList<BlockUse>>> Get2 = new ArrayList<ArrayList<ArrayList<BlockUse>>>();
        ArrayList<ArrayList<BlockUse>> paths = new ArrayList<ArrayList<BlockUse>>();

        //data
        double Lt = rollingStock.length; // Longueur train
        double Ds = 400; // Safety distance 400m

       // double Vc = (float) 160 / 3600; // Vitesse max canton

        double Cm = 1;//"01:00:00"; // Chevauchement mini
        double Tm = 0;//"03:00:00"; // Temps mini par canton
        int lim = 8600;

        int Xs = startPoint;
        int Xfs = endPoint;

        double MaxTime = 3 * 3.6 * Math.pow(10, 6);
        ///////

        Tempo tem = new Tempo();
        int k = 0;
        System.out.println("step 5:Possible routes generation");

        for (int i = 0; i < Bfree.size(); i++) {
            for (int j = 0; j < Bfree.size(); j++) {
                double Tv = Ds / Vc;
                double Tr = Lt / Vc + Bfree.get(i).getL() / Vc;
                double Tj = Bfree.get(j).getL() / Vc;
                double Tj1 = 300 / Vc;
                Tm = Tv + Tr + Tj;
                Cm = (Ds + Lt + Bfree.get(j).getL()) / Vc;
                if (dateFormat.parse(Bfree.get(i).getTf()).getTime() - dateFormat.parse(Bfree.get(j).getT()).getTime() >= Cm &&
                        dateFormat.parse(Bfree.get(j).getTf()).getTime() - dateFormat.parse(Bfree.get(i).getT()).getTime() >= Tm + Tj1 &&
                        Bfree.get(i).getXf() == Bfree.get(j).getX() &&
                        Bfree.get(i).getX() != Bfree.get(j).getXf()) {
                    B2next.add(new ArrayList<BlockUse>());
                    B2next.get(k).add(Bfree.get(i));
                    B2next.get(k).add(Bfree.get(j));
                    k++;
                }
            }
        }


        ArrayList<ArrayList<BlockUse>> Bnext;

        // All routes
        tem.setValue(B2next.size());
        int z = 0;
        int next = 0;
        Bvar.add(new ArrayList<ArrayList<BlockUse>>());
        Bvar.get(z).addAll(B2next);

        do {
            Bnext = new ArrayList<ArrayList<BlockUse>>();
            k = 0;
            if (next == 1) {
                Bnext.clear();
            }
            next = 0;

            for (int i = 0; i < tem.getValue(); i++) {
                for (int j = 0; j < B2next.size(); j++) {

                    if (Bvar.get(z).get(i).get(0).getX() == Xs && Bvar.get(z).get(i).get(0).getXf() == Xfs && Objects.equals(Bvar.get(z).get(i).get(Bvar.get(z).get(i).size() - 1).getID(), B2next.get(j).get(0).getID()) && !Bvar.get(z).get(i).contains(B2next.get(j).get(1)) && k < lim) {

                        Bnext.add(new ArrayList<BlockUse>());
                        Bnext.get(k).addAll(Bvar.get(z).get(i));
                        Bnext.get(k).add(B2next.get(j).get(1));
                        k++;
                    }
                }

            }

            if (Bnext.size() != 0) {
                tem.setValue(Bnext.size());
                Bvar.add(new ArrayList<ArrayList<BlockUse>>());
                z++;
                Bvar.get(z).addAll(Bnext);
                next = 1;
            }
        } while (Bnext.size() != 0);



        int etii = -1;

        for (int zz = 0; zz < Bvar.size(); zz++) {

            Get2.add(new ArrayList<ArrayList<BlockUse>>());
            etii = -1;

            for (int i = 0; i < Bvar.get(zz).size(); i++) {
                double dt = 400 / Vc + Lt / Vc;
                for (int tes = 0; tes < Bvar.get(zz).get(i).size(); tes++) {
                    if (tes == Bvar.get(zz).get(i).size() - 1) {
                        dt = dt + Bvar.get(zz).get(i).get(tes).getL() / Vc + 1500 / Vc;
                    } else {
                        dt = dt + Bvar.get(zz).get(i).get(tes).getL() / Vc;
                    }
                }

                if (dateFormat.parse(Bvar.get(zz).get(i).get(Bvar.get(zz).get(i).size() - 1).getTf()).getTime() - dateFormat.parse(Bvar.get(zz).get(i).get(0).getT()).getTime() >= dt && dateFormat.parse(Bvar.get(zz).get(i).get(Bvar.get(zz).get(i).size() - 1).getTf()).getTime() - dateFormat.parse(Bvar.get(zz).get(i).get(0).getT()).getTime() < MaxTime) {

                    Get2.get(zz).add(new ArrayList<BlockUse>());
                    etii = etii + 1;
                    Get2.get(zz).get(etii).addAll(Bvar.get(zz).get(i));
                }
            }


        }

        Bvar.clear();
        Bvar.addAll(Get2);
        //Display possible routes
	/*	System.out.println("Display possible block connections");
	for(int i=0;i<B2next.size();i++) {
		for(int j=0;j<B2next.get(i).size();j++) {
		System.out.print("["+B2next.get(i).get(j).getT()+","+B2next.get(i).get(j).getTf()+","+B2next.get(i).get(j).getX()+","+B2next.get(i).get(j).getXf()+","+B2next.get(i).get(j).getID()+"]");
			}
		System.out.println();
		}
	System.out.println();*/



        int sol = 0;
        int pat = -1;
        for (
                int zz = 0; zz < Bvar.size(); zz++) {

            for (int i = 0; i < Bvar.get(zz).size(); i++) {
                if (!Bvar.get(zz).get(i).isEmpty()) {
                    paths.add(new ArrayList<BlockUse>());
                    pat++;
                    paths.get(pat).addAll(Bvar.get(zz).get(i));
                }
                for (int j = 0; j < Bvar.get(zz).get(i).size(); j++) {

                }

                sol++;
            }
        }
        return paths;
    }
}
