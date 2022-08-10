package fr.sncf.osrd.api.stdcm.LMP_algo.legacy;



import fr.sncf.osrd.api.stdcm.Objects.BlockUse;

import java.text.ParseException;
import java.text.SimpleDateFormat;
import java.util.ArrayList;

public class digital_capacity_generator {

    public ArrayList<ArrayList<ArrayList<BlockUse>>> digital_capacity (ArrayList<ArrayList<ArrayList<BlockUse>>> Get1, ArrayList<ArrayList<ArrayList<BlockUse>>> Get1free) throws ParseException {

        System.out.println("step 2:Free GET generation");
        SimpleDateFormat dateFormat = new SimpleDateFormat("HH:mm:ss");
        //Lh indicate the end of a day it is used for the ending time of the latest digital capacity block
        String Lh="23:59:59";
        //Generate the digital capacity blocks
        for (int k = 0; k < Get1.size(); k++) {
            for (int i = 0; i < Get1.get(k).size(); i++) {
                for (int j = 0; j < Get1.get(k).get(i).size(); j++) {
                    var cur= Get1.get(k).get(i).get(j);
                    if (j == 0 && dateFormat.parse(cur.getT()).getTime() > 0) {
                        Get1free.get(k).get(i).add(new BlockUse("00:00:00", cur.getT(), cur.getX(), cur.getXf(), "(" + k + "" + i + "" + j + ")", cur.getL(), 200));
                        if (j < Get1.get(k).get(i).size() - 1) {
                            Get1free.get(k).get(i).add(new BlockUse(cur.getTf(), Get1.get(k).get(i).get(j + 1).getT(), cur.getX(), cur.getXf(), "(" + k + "" + i + "" + j + ")", cur.getL(), 200));
                        } else if (j == Get1.get(k).get(i).size() - 1) {
                            Get1free.get(k).get(i).add(new BlockUse(cur.getTf(), Lh, cur.getX(), cur.getXf(), "(" + k + "" + i + "" + j + ")", cur.getL(), 200));
                        }
                    } else if (j == Get1.get(k).get(i).size() - 1 && dateFormat.parse(cur.getTf()).getTime() < dateFormat.parse(Lh).getTime()) {
                            Get1free.get(k).get(i).add(new BlockUse(cur.getTf(), Lh, cur.getX(), cur.getXf(), "(" + k + "" + i + "" + j + ")", cur.getL(), 200));
                    } else {
                        if (j < Get1.get(k).get(i).size() - 1) {
                            Get1free.get(k).get(i).add(new BlockUse(cur.getTf(), Get1.get(k).get(i).get(j + 1).getT(), cur.getX(), cur.getXf(), "(" + k + "" + i + "" + j + ")", cur.getL(), 200));
                            }
                    }
                }
            }
        }
        return Get1free;
    }
}
