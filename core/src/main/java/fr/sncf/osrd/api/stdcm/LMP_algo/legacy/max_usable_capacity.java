package fr.sncf.osrd.api.stdcm.LMP_algo.legacy;


import fr.sncf.osrd.api.stdcm.Objects.BlockUse;

import java.util.ArrayList;


public class max_usable_capacity {
    public ArrayList<BlockUse> max_usable_capacity(ArrayList<BlockUse> Bfree) {
        int set = -1;
        int start = 0;
        int restart = 0;
        int ind = 0;

        ArrayList<ArrayList<BlockUse>> Tsort = new ArrayList<ArrayList<BlockUse>>();
        ArrayList<BlockUse> Maxbf = new ArrayList<BlockUse>();
        ArrayList<Integer> indexs = new ArrayList<Integer>();
        ArrayList<BlockUse> B2free = new ArrayList<BlockUse>();
        ArrayList<BlockUse> B22free = new ArrayList<BlockUse>();
        ArrayList<Double> Ttab = new ArrayList<Double>();
        ArrayList<BlockUse> Bsortfree = new ArrayList<BlockUse>();

        do {
            int nw = 0;
            int out = 0;
            Tsort.clear();
            Maxbf.clear();
            for (ind = 0; ind < Bfree.size(); ind++) {

                if (!indexs.contains(ind)) {

                    if (Tsort.isEmpty()) {
                        Tsort.add(new ArrayList<BlockUse>());
                        set = set + 1;
                    }

                    if (Bfree.get(start).entrySig != Bfree.get(ind).entrySig && Bfree.get(start).exitSig != Bfree.get(ind).exitSig && nw == 0) {
                        Tsort.add(new ArrayList<BlockUse>());
                        set = set + 1;
                        nw = 1;
                    }

                    if (Bfree.get(start).entrySig == Bfree.get(ind).entrySig && Bfree.get(start).exitSig == Bfree.get(ind).exitSig) {
                        Tsort.get(set).add(Bfree.get(ind));
                        nw = 0;
                        indexs.add(ind);

                    }

                    if (Bfree.get(start).entrySig != Bfree.get(ind).entrySig && Bfree.get(start).exitSig != Bfree.get(ind).exitSig && out == 0) {
                        restart = ind;
                        out = 1;
                    }

                } else if (nw == 0) {

                    Tsort.add(new ArrayList<BlockUse>());
                    set = set + 1;
                    nw = 1;
                }
            }

            B2free.clear();
            B22free.clear();

           for (int m = 0; m < Tsort.size(); m++) {
                B2free.addAll(Tsort.get(m));
            }

            for (int i = 0; i < B2free.size(); i++) {
                BlockUse fb = new BlockUse(B2free.get(i).reservationStartTime, B2free.get(i).reservationEndTime, B2free.get(i).entrySig, B2free.get(i).exitSig, B2free.get(i).id, B2free.get(i).length, 200);
                for (int j = 0; j < B2free.size(); j++) {
                    BlockUse intervalj = B2free.get(j);
                    if (intervalj.reservationStartTime < fb.reservationEndTime && intervalj.reservationEndTime > fb.reservationStartTime && i != j) {
                        double T = Math.max(fb.reservationStartTime, intervalj.reservationStartTime);
                        double Tf = Math.min(fb.reservationEndTime, intervalj.reservationEndTime);
                        fb.reservationStartTime = T;
                        fb.reservationEndTime = Tf;
                    }
                }

                if (Ttab.isEmpty() || !Ttab.contains(fb.reservationStartTime)) {
                    Ttab.add(fb.reservationStartTime);
                    Maxbf.add(new BlockUse(fb.reservationStartTime, fb.reservationEndTime, fb.entrySig, fb.exitSig, fb.id, fb.length, 200));
                }
            }

            Bsortfree.addAll(Maxbf);

            Ttab.clear();
            set = -1;
            start = restart;
        } while (!Maxbf.isEmpty());

        Bfree.clear();
        Bfree.addAll(Bsortfree);
        return Bfree;
    }
}