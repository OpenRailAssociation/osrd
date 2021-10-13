package fr.sncf.osrd.simulation.changelog;

import fr.sncf.osrd.simulation.Change;
import java.util.ArrayList;

public class ChangeConsumerMultiplexer extends ChangeConsumer {
    private final ArrayList<ChangeConsumer> consumers;

    public ChangeConsumerMultiplexer(ArrayList<ChangeConsumer> consumers) {
        this.consumers = consumers;
    }

    public ChangeConsumerMultiplexer() {
        this.consumers = new ArrayList<>();
    }

    public void add(ChangeConsumer consumer) {
        consumers.add(consumer);
    }

    @Override
    public void changeCreationCallback(Change change) {
        for (var consumer : consumers)
            consumer.changeCreationCallback(change);
    }

    @Override
    public void changePublishedCallback(Change change) {
        for (var consumer : consumers)
            consumer.changePublishedCallback(change);
    }
}
