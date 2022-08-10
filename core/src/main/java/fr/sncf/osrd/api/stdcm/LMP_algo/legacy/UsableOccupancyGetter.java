package fr.sncf.osrd.api.stdcm.LMP_algo.legacy;

import fr.sncf.osrd.api.stdcm.Objects.BlockUse;

import java.text.ParseException;
import java.util.ArrayList;

public class UsableOccupancyGetter {
    public static ArrayList<BlockUse> getUsableCapacity() throws ParseException {
        // first array level: is per GET (per itinerary)
        // second array level: per route
        // third level: occupancy per route
        ArrayList<ArrayList<ArrayList<BlockUse>>> perTrainOccupancy = new ArrayList<>();

        // this step takes the occupancy of each GET, and merges it with all the other GETs
        // at the end of the process, all GETs have the occupancy times from other GETs.
        var combinedOccupancy = OccupancyIntersector.intersect(perTrainOccupancy);

        // This step takes as an input the previous GETs and computes the digital capacity for each one
        // as an output we will have  a list of the digital capacity of each route
        // represented as blocks of digital capacity
        digital_capacity_generator dcg = new digital_capacity_generator();
        combinedOccupancy = dcg.digital_capacity(perTrainOccupancy, combinedOccupancy);

        // This step stores all the digital capacity blocks in a one array
        var Bfree = new ArrayList<BlockUse>();
        for (int k = 0; k < combinedOccupancy.size(); k++) {
            for (int i = 0; i < combinedOccupancy.get(k).size(); i++) {
                for (int j = 0; j < combinedOccupancy.get(k).get(i).size(); j++) {
                    var block = combinedOccupancy.get(k).get(i).get(j);
                    Bfree.add(new BlockUse(block.reservationStartTime, block.reservationEndTime, block.entrySig, block.exitSig, "(" + k + "," + i + "," + j + ")", block.length, 200));
                }
            }
        }

        // This step regroups all the digital capacity block per route
        max_usable_capacity muc = new max_usable_capacity();
        return muc.max_usable_capacity(Bfree);
    }
}
