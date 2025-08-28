Here's some tips to debug STDCM requests.

It may be tedious, as we explore a very large graph and we make assumptions during the exploration that are only checked at post-processing.


## Get requests payloads

It's essential to reliably reproduce requests in a local environment.
Intercepting the requests from editoast to core is ideal as they contain all timetable and work schedule info, though
the payload can get somehow large (100s of mbs).

In local: run core with `LOG_STDCM_REQUESTS=TRUE` as env variable (beware though, it will log *every* request)

## Reproduce request payloads

`java -jar build/libs/osrd-all.jar reproduce-request --stdcm-payload-path stdcm_payload.json --railjson france.json`

Inputting the infra is optional, if not specified we fetch the infra from a locally running editoast. But the infra_id needs to be correct in the request payload.


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

This can have two causes:

1. The engineering allowances aren't possible
2. Incremental conflict detection / spacing requirement generation gives different results during exploration and post-processing (or we don't handle them properly)

Option 1 is easy to identify as it will be logged as a warning before the error (sometimes it works out fine). 

Option 2 is more annoying. When it happens, there's no way around it: we need to take a notebook and write everything down to identify what differs.
Using conditional breakpoints at post-processing can tell us which zone ID is conflicting and when. Other conditional breakpoints
can tell us what happens during the exploration. 

Keep in mind that spacing requirement times are offsetted by the departure time after they're first generated.

In any case, when this error is raised, we log some valuable data.
