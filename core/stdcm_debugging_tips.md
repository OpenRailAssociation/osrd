Here's some tips to debug STDCM requests.

It may be tedious, as we explore a very large graph and we make assumptions during the exploration that are only checked at post-processing.
It's essential to reliably reproduce requests in a local environment.

## Timetable render

For a more global view of the timetable, renders can be generated with the scripts
`generate-debug-space-chart.py` and `render-s3-stdcm-sim.py` in `./scripts`.
The input data for these scripts are generated on success and when a crash happens late enough during post-processing.
It's not generated on failure *yet*, though we probably should (on the shortest path).

These renders are great to:

* Explain why we didn't take that earlier opening
* Identify what went wrong when the solution isn't accepted by "horairistes" (missing train in the timetable?)
* On post-processing crash, to identify the solution space and engineering allowances

## Explaining why no solution was found

We often need to understand why no solution was found. We often have issues that are only visible through
suspected false negatives, either on the algorithm itself or on the input data.

When a request gives a negative result, a file is saved in the s3 that describes some of the conflicts.
It can be accessed through the script in `scripts/download-failure-file.py`.
On local environments, it can be accessed either at http://localhost:9901/ or by setting the env variable
`STDCM_FAILURE_DATA_FILENAME`.

Currently, it contains data on a few conflicts. We keep track of the 10 conflicts that caused the most delay,
and the 10 that were closest to the destination. These are heuristic and may change in the future.

## Get requests payloads and other files

First, we need to get the relevant files. To run an stdcm request, core has actually 3 "inputs":
1. The infrastructure used
2. The timetable, containing all the trains to avoid
3. The actual payload, containing the train data and the requested path

For requests that happened in production environments, all 3 inputs are saved in an s3.
Simple scripts are in the `./scripts` folder and show common workflows.
The most relevant here is `reproduce-s3-request.py`: from a given trace_id, it
can download all relevant files and either run core directly or describe how to run it.

The trace_id can be found in datadog.

Note: datadog is only usable for requests in prod. For local setups, it would appear in jaeger instead.
Files would still be written to an object storage, RustFS, which can be accessed at http://localhost:9901/
(assuming core has the relevant env variables).
The "trace_id" is set to "00000..." though, so each request overrides the saved data from the previous one.

## Reproduce request payloads

`STDCM_DEBUG_DATA_FILENAME=debug_stdcm.json java -Xmx6G -ea -jar build/libs/osrd-all.jar reproduce-request --stdcm-payload-path input-payload.json --railjson infra.railjson --cbor-timetable timetable.cbor`

If either the infra or timetable isn't set, we try to fetch the corresponding object(s) from the local editoast
based on the IDs in the input payload. When reproducing a request that happened in prod, we may end up working
with different inputs entirely.

The `Xmx6G` parameter defines the maximum RAM. 6GB is generally the limit in prod (as of today).

## Limit computation time

The pathfinding step can take *a while*. It can help a lot to reduce the numbers of possibilities while still reproducing the bug.

One way to do this is to exclude any path that diverges from the bugged case. If the solution takes the path `a -> b -> c`,
we can immediatly exclude paths that start from `a -> x`. This generally speeds up the pathfinding step to be almost instantaneous.
It's important to check that the bug is still reproduced though, it's not always the case.

I generally do this by logging blocks IDs used in the solution at the post-processing step (including lookahead), then inside `InfraExplorer.extend()`,
I add a `return false` if any block isn't in that list. I edit the code locally for both of these changes.

This also helps with breakpoints during the exploration, as we're less likely to break on irrelevant paths.

It can also be possible to filter using the times used, but in my experience this often changes the result.


## The case of `mismatch between exploration and postprocessing`

This error is raised when assumptions made during the explorations are proven to be false during the post-processing.

More specifically, when we thought we'd found an opening for a solution, but we couldn't converge to a
full simulation that's free of conflict.

This can have several causes:

1. The engineering allowances aren't possible
2. Incremental conflict detection / spacing requirement generation gives different results during exploration and post-processing (or we don't handle them properly)
3. General differences in simulation inputs, we don't run post-processing in exactly the same way

Option 1 is easy to identify as it will be logged as a warning before the error (sometimes it works out fine).

Option 2 is more annoying. When it happens, there's no way around it: we need to take a notebook and write everything down to identify what differs.
Using conditional breakpoints at post-processing can tell us which zone ID is conflicting and when. Other conditional breakpoints
can tell us what happens during the exploration.

Option 3 has a few known causes. During the search, simulation inputs are limited to the simulated block.
Specifically, slopes from earlier blocks are ignored. During post-processing though, we consider the slopes
from all area covered by the train. Fixing this requires a significant refactor.

Keep in mind that spacing requirement times are offsetted by the departure time after they're first generated.

In any case, when this error is raised, we log some valuable data.

## Advanced logging

For some issues, such as weird timeouts, we need to log as much data as we can during the search and aggregate it.

A good way to do this is with `CSVLogger`, especially with `STDCMNode.toGeoPoint`. We can easily log
data during the search along with its geo coordinates. It can then be imported in QGIS for nice visualizations.
For example, it can identify areas on which we spend too much CPU time because of poor caching.
