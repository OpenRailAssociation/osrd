import * as d3 from 'd3'

var xscale;
var yscale;

export function scaleupdate(xscalee, yscalee) {
    xscale = xscalee;
    yscale = yscalee;
}

export function zoomedTransition(svg, transform, gridY, yScale, width, focus) {
    svg.selectAll('.line-vitesse').attr("stroke-width", 2 / transform.k);

    gridY.call(
        d3.axisLeft(yScale)
        .scale(transform.rescaleY(yScale))
        .ticks(10)
        .tickSize(-width)
        .tickFormat(d3.format(""))
    );

    focus.selectAll(".domain").attr("d", "M0.5,6H790")
}

export function mouseoverSpeed(transform, j, focus, xscale, yscale, d, t) {
    focus.select("#circle-vitesse" + j)
        .attr('cx', () => {
            return transform.applyX(xscale(d.espacequeue));
        })
        .attr('cy', () => {
            return transform.applyY(yscale(d.vitesse));
        });

    d3.select('.class-focusText-vitesse' + j)
        .text(t('osrd.graph.space') + " : " + Math.round(d.espacequeue * 100) / 100 + " m" + " | " + t('osrd.graph.speed') + " : " + Math.round(d.vitesse * 100) / 100 + " km/h");
}
