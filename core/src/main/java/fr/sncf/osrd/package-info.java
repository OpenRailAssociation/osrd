/**
 * <h1>The core OSRD module</h1>
 *
 * <p>Reading through a log file gives a good overview of how the project works:</p>
 * <ul>
 * <li>
 * <p>The simulation starts by reading a json config file, which contains metadata about what infrastructure,
 * timetables and settings to use. This process also involves parsing the RailML infrastructure file into an internal Infra.</p>
 *
 * <pre>
 * {@code
 * INFO App - parsing the configuration file
 * INFO App - creating the simulation
 * }
 * </pre>
 * </li>
 *
 * <li>
 * <p>When the simulation is created, the ScheduleManager has to know what path trains shall take in order to create
 * any. A simple pathfinding is performed in the edges graph as a stopgap measure.</p>
 *
 * <pre>
 * {@code
 * TRACE Dijkstra - pathfinding from TrackSection { id=ne.micro.foo_a }:100.0 to TrackSection { id=ne.micro.bar_a }:100.0
 * TRACE Dijkstra - considering path ending at TrackSection { id=ne.micro.foo_a } with cost 100.0
 * TRACE Dijkstra - considering path ending at TrackSection { id=ne.micro.foo_a } with cost 100.0
 * TRACE Dijkstra - considering path ending at TrackSection { id=ne.micro.foo_to_bar } with cost 10100.0
 * TRACE Dijkstra - considering path ending at TrackSection { id=ne.micro.bar_a } with cost 10200.0
 * TRACE Dijkstra - found goal
 * }
 * </pre>
 * </li>
 *
 * <li>
 * <p>Once the schedule manager knows the path of each train, it can plan the known speed constraints along the path of
 * the train, such as maximum speed of the rolling stock, and non-signaled speed restrictions. These make up the initial
 * list of speed controllers for the train.</p>
 *
 * <pre>
 * {@code
 * TRACE SchedulerSystem - created initial speed controllers:
 * TRACE SchedulerSystem - MaxSpeedController { targetSpeed=80.000, begin=-Infinity, end=Infinity}
 * }
 * </pre>
 * </li>
 *
 * <li>
 * <p>Then, an event corresponding to the train's departure is created on the simulation timeline. This event already
 * contains the change that will be applied when the event occurs. This change doesn't encapsulate the full
 * initialization of the train: its missing the next move planning step (keep it in mind for later).</p>
 *
 * <pre>
 * {@code
 * INFO Simulation - change published TimelineEventCreated { revision=0, scheduledTime=28800.000000, value=TrainCreatedChange { name=Test. } }
 * }
 * </pre>
 * </li>
 *
 * <li>
 * <p>Now that the journey of every train is known, and their departure registered on the simulation timeline,
 * the simulation can start.</p>
 *
 * <pre>
 * {@code
 * INFO App - starting the simulation
 * }
 * </pre>
 * </li>
 *
 * <li>
 * <p>While there are events on the timeline, the simulation makes them happen in order, moving the simulation time forward
 * to the scheduled time of the next event each time.</p>
 *
 * <pre>
 * {@code
 * DEBUG Simulation - changing the simulation clock from 0.0 to 28800.0
 * }
 * </pre>
 * </li>
 *
 * <li>
 * <p>As the time jumps forward, events occur. The first event corresponds to the point in time where the train should start.</p>
 *
 * <pre>
 * {@code
 * INFO Simulation - change published TimelineEventOccurred { TimelineEventId { scheduledTime=28800.000000, revision=0 } }
 * }
 * </pre>
 * </li>
 *
 * <li>
 * <p>As the event occurs, the train scheduler reacts as it is subscribed to it. The train scheduler then proceeds to
 * apply and publish the change corresponding to the departing train being inserted into the simulation. It also
 * initializes the train by planning its first move: all trains have a planned itinerary up to the next event.</p>
 *
 * <pre>
 * {@code
 * INFO SchedulerSystem - starting train Test.
 * INFO Simulation - change published TrainCreatedChange { name=Test. }
 * INFO Train - planning the next move for train Test.
 * }
 * </pre>
 * </li>
 *
 * <li>
 * <p>Once the itinerary up to the next event for the train is planned, an event corresponding to the train's arrival at
 * its next event is created on the timeline.</p>
 *
 * <pre>
 * {@code
 * INFO Simulation - change published TimelineEventCreated { revision=1, scheduledTime=29041.000000, value=TrainStateChange { speed=70.36, newState.headPathPosition=10335.27 } }
 * }
 * </pre>
 * </li>
 *
 * <li>
 * <p>The train updates its plan using a TrainPlannedMoveChange.
 *
 * <pre>
 * {@code
 * INFO Simulation - change published TrainPlannedMoveChange { nextMoveEvent=TimelineEventId { scheduledTime=29041.000000, revision=1 } }
 * }
 * </pre>
 * </li>
 *
 * <li>
 * <p>Here, the next event on the train's timeline occurs. It just so happen that on this itinerary, there are no signals
 * on the way, so the train already reached its destination. The timeline event happens, and the train reacts by
 * applying the planned location change.</p>
 *
 * <pre>
 * {@code
 * DEBUG Simulation - changing the simulation clock from 28800.0 to 29041.0
 * INFO Simulation - change published TimelineEventOccurred { TimelineEventId { scheduledTime=29041.000000, revision=1 } }
 * INFO Simulation - change published TrainStateChange { speed=70.36, newState.headPathPosition=10335.27 }
 * INFO Train - train Test. reached destination, aborting planning
 * }
 * </pre>
 * </li>
 * </ul>
 */
package fr.sncf.osrd;
