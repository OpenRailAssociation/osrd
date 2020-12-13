package fr.sncf.osrd.simulation;

import java.util.ArrayDeque;
import java.util.ArrayList;

public class EventSource<T extends BaseT, BaseT> {
    ArrayList<Process<BaseT>> waitingProcesses = new ArrayList<>();

    public void subscribe(Process<BaseT> proc) {
        assert !waitingProcesses.contains(proc);
        waitingProcesses.add(proc);
    }
}
