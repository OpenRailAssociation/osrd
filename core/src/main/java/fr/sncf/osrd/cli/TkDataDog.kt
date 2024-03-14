package fr.sncf.osrd.cli

import io.opentracing.propagation.Format
import io.opentracing.propagation.TextMapAdapter
import io.opentracing.tag.Tags
import io.opentracing.util.GlobalTracer
import org.takes.Request
import org.takes.Response
import org.takes.Take
import org.takes.rq.RqHeaders
import org.takes.rq.RqHref
import org.takes.rq.RqMethod
import org.takes.rs.RsStatus
import org.takes.tk.TkWrap

class TkDataDog(take: Take) : TkWrap(Take { request: Request -> datadog(take, request) }) {
    companion object {
        private fun datadog(take: Take, request: Request): Response {
            val tracer = GlobalTracer.get()

            val headers = RqHeaders.Base(request)
            val map = mutableMapOf<String, String>()
            headers.names().iterator().forEach { map[it] = headers.header(it)[0] }
            val parentSpanContext = tracer.extract(Format.Builtin.HTTP_HEADERS, TextMapAdapter(map))

            val span =
                tracer
                    .buildSpan("datadog")
                    .asChildOf(parentSpanContext)
                    .withTag(Tags.HTTP_METHOD, RqMethod.Base(request).method())
                    .withTag(Tags.HTTP_URL, RqHref.Base(request).href().path())
                    .start()
            val scope = tracer.activateSpan(span)

            val response = take.act(request)

            val statusCode = RsStatus.Base(response).status()
            span.setTag(Tags.HTTP_STATUS, statusCode)
            if (statusCode < 400) {
                span.setTag(Tags.ERROR, false)
            } else {
                span.setTag(Tags.ERROR, true)
            }
            scope.close()
            span.finish()

            return response

        }
    }
}
