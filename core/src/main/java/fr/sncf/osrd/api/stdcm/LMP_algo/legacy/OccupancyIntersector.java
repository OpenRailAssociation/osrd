package fr.sncf.osrd.api.stdcm.LMP_algo.legacy;


import fr.sncf.osrd.api.stdcm.Objects.BlockUse;

import java.text.ParseException;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Objects;

public class OccupancyIntersector {
    public static ArrayList<ArrayList<ArrayList<BlockUse>>> intersect(ArrayList<ArrayList<ArrayList<BlockUse>>> Get1) throws ParseException {
        ArrayList<BlockUse> B2free = new ArrayList<BlockUse>();
        ArrayList<BlockUse> B22free = new ArrayList<BlockUse>();
        ArrayList<ArrayList<ArrayList<BlockUse>>> Get1free = new ArrayList<ArrayList<ArrayList<BlockUse>>>();

        SimpleDateFormat dateFormat = new SimpleDateFormat("HH:mm:ss");

        System.out.println("step 1:Intersection get");

        //Create two lists of BlockUse
        for (int k = 0; k < Get1.size(); k++) {
            for (int i = 0; i < Get1.get(k).size(); i++) {
                for (int j = 0; j < Get1.get(k).get(i).size(); j++) {
                    var cur = Get1.get(k).get(i).get(j);
                    B2free.add(new BlockUse(cur.getT(), cur.getTf(), cur.getX(), cur.getXf(), cur.getID(), cur.getL(), 200));
                    B22free.add(new BlockUse(cur.getT(), cur.getTf(), cur.getX(), cur.getXf(), cur.getID(), cur.getL(), 200));
                }
            }
        }

        boolean test = false;
        for (int index = 0; index < B2free.size(); index++) {
            for (BlockUse blockUse : B22free) {
                var main_block = B2free.get(index);
                var intersected_block = blockUse;

                //Update starting occupancy time of the main_block
                if (main_block.getT() < intersected_block.getTf() && main_block.getT() > intersected_block.getT() && main_block.getX() == intersected_block.getX() && main_block.getXf() == intersected_block.getXf() && !Objects.equals(main_block.getID(), intersected_block.getID())) {
                    main_block.setT(intersected_block.getT());
                    test = true;
                }

                //Updating ending occupancy time of the main_block
                if (main_block.getTf() < intersected_block.getTf() && main_block.getTf() > intersected_block.getT() && main_block.getX() == intersected_block.getX() && main_block.getXf() == intersected_block.getXf() && !Objects.equals(main_block.getID(), intersected_block.getID())) {
                    main_block.setTf(intersected_block.getTf());
                    test = true;
                }
            }

            //Repeat the operaton until all blocks occupancy is updated
            if (test && index == B2free.size() - 1) {
                index = -1;
                test = false;
            }
        }

        int ind = -1;
        for (int k = 0; k < Get1.size(); k++) {
            for (int i = 0; i < Get1.get(k).size(); i++) {
                for (int j = 0; j < Get1.get(k).get(i).size(); j++) {
                    var block = Get1.get(k).get(i).get(j);
                    do {
                        ind++;
                        if (block.getID() == B2free.get(ind).getID()) {
                            block.setT(B2free.get(ind).getT());
                            block.setTf(B2free.get(ind).getTf());
                        }

                    } while (block.getID() != B2free.get(ind).getID());

                    ind = -1;
                }
            }
        }

        // Ini the free get n canton per get(i)
        for (int i = 0; i < Get1.size(); i++) {
            Get1free.add(new ArrayList<>());
            for (int j = 0; j < Get1.get(i).size(); j++)
                Get1free.get(i).add(new ArrayList<>());
        }
        return Get1free;
    }
}
