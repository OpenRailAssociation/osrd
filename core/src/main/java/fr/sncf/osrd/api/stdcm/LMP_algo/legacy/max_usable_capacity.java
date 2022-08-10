package fr.sncf.osrd.api.stdcm.LMP_algo.legacy;


import fr.sncf.osrd.api.stdcm.Objects.BlockUse;

import java.text.ParseException;
import java.text.SimpleDateFormat;
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

                    if (Bfree.get(start).getX() != Bfree.get(ind).getX() && Bfree.get(start).getXf() != Bfree.get(ind).getXf() && nw == 0) {
                        Tsort.add(new ArrayList<BlockUse>());
                        set = set + 1;
                        nw = 1;
                    }

                    if (Bfree.get(start).getX() == Bfree.get(ind).getX() && Bfree.get(start).getXf() == Bfree.get(ind).getXf()) {
                        Tsort.get(set).add(Bfree.get(ind));
                        nw = 0;
                        indexs.add(ind);

                    }

                    if (Bfree.get(start).getX() != Bfree.get(ind).getX() && Bfree.get(start).getXf() != Bfree.get(ind).getXf() && out == 0) {
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
                BlockUse fb = new BlockUse(B2free.get(i).getT(), B2free.get(i).getTf(), B2free.get(i).getX(), B2free.get(i).getXf(), B2free.get(i).getID(), B2free.get(i).getL(), 200);
                for (int j = 0; j < B2free.size(); j++) {
                    BlockUse intervalj = B2free.get(j);
                    if (intervalj.getT() < fb.getTf() && intervalj.getTf() > fb.getT() && i != j) {
                        double T = Math.max(fb.getT(), intervalj.getT());
                        double Tf = Math.min(fb.getTf(), intervalj.getTf());
                        fb.setT(T);
                        fb.setTf(Tf);
                    }
                }

                if (Ttab.isEmpty() || !Ttab.contains(fb.getT())) {
                    Ttab.add(fb.getT());
                    Maxbf.add(new BlockUse(fb.getT(), fb.getTf(), fb.getX(), fb.getXf(), fb.getID(), fb.getL(), 200));
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