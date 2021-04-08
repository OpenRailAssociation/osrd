import * as d3 from 'd3'
import * as moduleSpace from './ModuleGraphTimeSpace'
import * as moduleSpeed from './ModuleGraphTimeSpeed'

export var transform;
export var tabLast_pos_x_y;

//xScale
export function xScale(width, domainXmin, domainXmax) {
    var xScale = d3.scaleLinear().domain([domainXmin, domainXmax]).range([0, width]);
    return xScale;
}

//yScale
export function yScale(height, domainYmin, domainYmax) {
    var yScale = d3.scaleLinear().domain([domainYmin, domainYmax]).range([height, 0]);
    return yScale;
}

//AxisBottom
export function axisBottom(xScale) {
    var axisBottom = d3.axisBottom(xScale).ticks(10)
    return axisBottom;
}

//AxisLeft
export function axisLeft(yScale) {
    var axisLeft = d3.axisLeft(yScale).ticks(10)
    return axisLeft;
}

//AxisTop
export function axisTop(xScale) {
    var axisTop = d3.axisTop(xScale).ticks(10)
    return axisTop;
}

//AxisRight
export function axisRight(yScale) {
    var axisRight = d3.axisRight(yScale).ticks(10)
    return axisRight;
}

//Creation SVG
export function createSvg(select, viewbox, id, svg_class) {
    return d3.select(select)
        .append("svg")
        .attr("viewBox", "0 50 950 475")
        .append("g")
        .append("svg:g")
        .attr("id", id)
        .attr("class", svg_class);
}

//Creation Rect
export function createRect(svg, width, height, margin) {
    return svg.append("rect")
        .attr("class", "rect-svg")
        .attr("width", width)
        .attr("height", height)
        .attr("transform", "translate(" + margin.left + "," + margin.top + ")");
}

//Creation clipPath
export function createClipPath(svg, width, height) {
    return svg.append("defs")
        .append("clipPath")
        .attr("id", "clip")
        .append("rect")
        .attr("width", width)
        .attr("height", height);
}

//Creation g_clipPath
export function createG_clipPath(svg, margin) {
    return svg.append("g")
        .attr("transform", "translate(" + margin.left + "," + margin.top + ")")
        .attr("clip-path", "url(#clip)");
}

//Creation focus
export function createFocus(svg, margin) {
    return svg.append("g")
        .attr("class", "focus")
        .attr("transform", "translate(" + margin.left + "," + margin.top + ")");
}

//Creation gX
export function creategX(focus, height, axis) {
    return focus.append("g")
        .attr("class", "x axis")
        .attr("transform", "translate(0," + height + ")")
        .call(axis);
}

//Creation gY
export function creategY(focus, width, axis) {
    return focus.append("g")
        .attr("class", "y axis")
        .attr("transform", "translate(" + width + ",0)")
        .call(axis);
}

//Creation title
export function createTitle(focus, width, height, margin, titleX, titleY) {
    focus.append("text")
        .attr("class", "titleXY")
        .attr("transform", "translate(" + (width / 2) + " ," + (height + margin.top) + ")")
        .text(titleX);

    focus.append("text")
        .attr("class", "titleXY")
        .attr("transform", "rotate(-90)")
        .attr("dy", "1em")
        .attr("y", 0 - margin.left)
        .attr("x", 0 - (height / 2))
        .text(titleY);
}

//Creation Panel
export function createPanel(panel_select, class_panel) {
    return d3.select(panel_select)
        .append("div:panel")
        .attr("class", class_panel);
}

//Creation li
export function createLi(element, text_li, id_li, class_li, id, i) {
    return element.append("li")
        .text(text_li)
        .attr("class", class_li + id)
        .attr("id", id_li + i)
        .classed("className", false)
}

//Creation Div
export function createDiv(element, id_div, class_div, i) {
    return element.append("div")
        .attr("class", class_div)
        .attr("id", id_div + i);
}

//Creation Line
export function createLine(element, data, i, id, line, color, class_line, id_line) {
    return element.append("path")
        .datum(data)
        .attr("class", class_line + i)
        .attr("id", id_line + id)
        .attr("stroke", color)
        .attr("stroke-width", "1.5")
        .attr("d", line);
}

//Creation Circle
export function createCircle(element, i, id, class_circle, id_circle) {
    return element.append("circle")
        .attr("class", class_circle + id)
        .attr("id", id_circle + i)
        .attr("r", 4);
}

//Creation Area
export function createArea(element, data, i, area, class_area, id_area, name) {
    return element.append('path')
        .datum(data)
        .attr('class', class_area + i)
        .attr("id", id_area + i)
        .attr('value', i)
        .attr('name', name)
        .attr('d', area);
}

//Creation H1
export function createH1(element, class_h1, id_h1, i, text) {
    return element.append("h1")
        .attr("class", class_h1 + i)
        .attr("id", id_h1 + i)
        .attr("value", i)
        .text(text)
}

//Creation Label
export function createLabel(element, class_label, id_label, id, i, text, color) {
    return element.append("label")
        .attr("class", class_label + id)
        .attr("id", id_label + i)
        .attr("value", id)
        .text(text)
        .style("color", color);
}

//Creation Text
export function createText(element, class_text, id_text, id, i) {
    return element.append('text')
        .attr('class', class_text + id)
        .attr('id', id_text + i)

}

//CreationTrTd
export function createTrTd(element, class_tr, id_tr, text, nbtd) {
    var elementParent = element.append("tr")
        .attr("class", class_tr)
        .attr("id", id_tr);

    for (var i = 0; i < nbtd; i++) {
        elementParent.append("td")
            .text(text[i]);
    }
}

export function createSelect(element, class_tr, id_tr, text) {
    var elementParent = element.append("select")
        .attr("class", class_tr)
        .attr("id", id_tr);

    for (var i = 0; i < text.length; i++) {
        elementParent.append("option")
            .attr("class", "option")
            .attr("id", "option-text")
            .text(text[i])
            .attr("value", i);
    }
}

//Accordeon Panel_info
export function accordeonToggle(d, i, n, ace, max_height) {
    var thiss = d3.select(n[i]).node();
    for (var l = 0; l < ace.length; l++) {
        ace[l].style.maxHeight = "0px";
    }
    var panel = thiss.nextElementSibling;
    panel.style.maxHeight = max_height;
}

// Configuration du Zoom
export function configZoom(svg_dx, svg_dy, svg_dx2, svg_dy2, svgdxET, svgdyET, svgdxET2, svgdyET2) {
    return d3.zoom()
        .extent([
            [svg_dx, svg_dy],
            [svg_dx2, svg_dy2]
        ])
        .scaleExtent([1, 1])
        .translateExtent([
            [svgdxET, svgdyET],
            [svgdxET2, svgdyET2]
        ])
        .filter(function() {
            d3.event.preventDefault();
            switch (d3.event.type) {
                case "mousedown":
                    return d3.event.button === 1
                case "wheel":
                    return d3.event.button === 0
                default:
                    return false
            }
        });
}

export function updateTransform(newTransform) {
    transform = newTransform;
}

//Fonction Zoom
export function zoomed(g, gX, gY, gX2, gY2, xAxisBottom, yAxisLeft, xAxisTop, yAxisRight, xScale, yScale) {

    transform = d3.event.transform;

    gX.call(xAxisBottom.scale(d3.event.transform.rescaleX(xScale)));
    gY.call(yAxisLeft.scale(d3.event.transform.rescaleY(yScale)));
    gX2.call(xAxisTop.scale(d3.event.transform.rescaleX(xScale)));
    gY2.call(yAxisRight.scale(d3.event.transform.rescaleY(yScale)));

    g.selectAll("path")
        .attr("transform", transform);
}

//Fonction opacity Lines
export function opacityLine(nbselect, tab_select, d, i, n) {
    d3.select(n[i]).classed("active", !d3.select(n[i]).classed("active"))
    var thiss = d3.select(n[i]).classed("active");
    var value = d3.select(n[i]).attr("value");
    value = parseInt(value);
    for (var l = 0; l < nbselect; l++) {
        if (thiss === true) {
            d3.selectAll(tab_select[l] + value).style("opacity", "0.3");
        } else {
            d3.selectAll(tab_select[l] + value).style("opacity", "1");
        }
    }
}

//Configuration de la localisation de la souris dans le svg
export function mouseX(element, data, j, scale, bisect) {
    const position_g = d3.selectAll(element).node();

    const x0 = scale.invert(d3.mouse(position_g)[0] - 68);

    const n = bisect(data[j], x0, 1)
    const d0 = data[j][n - 1]
    const d1 = data[j][n]
    const d = x0 - d0 > d1 - x0 ? d1 : d0;
    return d;
}

//Lecture des donnée via le survol de la souris
export function mouseover(d, xscale, yscale, bisect, data, focus, nbTrain, test, element_mousex, transform, t, rotategraph) {
    tabLast_pos_x_y = [];

    const xt = transform.rescaleX(xscale);

    for (let j = 0; j < nbTrain; j++) {
        d = mouseX(element_mousex, data, j, xt, bisect);
        tabLast_pos_x_y.push(d);
        if (test === 0) {
            moduleSpace.mouseoverTime(transform, j, focus, xscale, yscale, d, t, rotategraph)
        } else if (test === 1) {
            moduleSpeed.mouseoverSpeed(transform, j, focus, xscale, yscale, d, t)
        }
    }
}
