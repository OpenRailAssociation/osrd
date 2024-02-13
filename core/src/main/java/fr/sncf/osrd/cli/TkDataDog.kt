package fr.sncf.osrd.cli

import datadog.trace.api.Trace
import io.opentracing.tag.Tags
import io.opentracing.util.GlobalTracer
import org.takes.Request
import org.takes.Response
import org.takes.Take
import org.takes.rq.RqHref
import org.takes.rq.RqMethod
import org.takes.rs.RsStatus
import org.takes.tk.TkWrap

class TkDataDog(take: Take) : TkWrap(Take { request: Request -> datadog(take, request) }) {
    companion object {
        @Trace
        private fun datadog(take: Take, request: Request): Response {
            val span = GlobalTracer.get().activeSpan()
            val method = RqMethod.Base(request).method()
            span.setTag(Tags.HTTP_METHOD, method)
            val path = RqHref.Base(request).href().path()
            span.setTag(Tags.HTTP_URL, path)

            val response = take.act(request)
            val statusCode = RsStatus.Base(response).status()
            span.setTag(Tags.HTTP_STATUS, statusCode)
            if (statusCode < 400) {
                span.setTag(Tags.ERROR, false)
            } else {
                span.setTag(Tags.ERROR, true)
            }

            return response
        }
    }
}
